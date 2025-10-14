#!/usr/bin/env node
/*
 Native Messaging host for ReadLater (Claude CLI bridge)
 - name: com.readlater.claude_host
 Protocol: JSON messages over stdio with 4-byte little-endian length prefix
*/

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');

// Ensure PATH includes common CLI locations (macOS/Linux GUI launches have limited PATH)
(() => {
  const sep = process.platform === 'win32' ? ';' : ':';
  const extra = process.platform === 'darwin'
    ? ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']
    : process.platform === 'linux'
      ? ['/usr/local/bin', '/usr/bin', '/bin']
      : [];
  const cur = (process.env.PATH || '').split(sep).filter(Boolean);
  const merged = [...new Set([...extra, ...cur])];
  process.env.PATH = merged.join(sep);
})();

function getClaudeCmd() {
  if (process.env.CLAUDE_BIN && process.env.CLAUDE_BIN.trim()) return process.env.CLAUDE_BIN.trim();
  return 'claude';
}

function readMessage() {
  return new Promise((resolve, reject) => {
    const header = Buffer.alloc(4);
    process.stdin.once('readable', () => {
      const h = process.stdin.read(4);
      if (!h) return resolve(null);
      h.copy(header);
      const len = header.readUInt32LE(0);
      
      // Validate message length (max 10MB for safety)
      const MAX_MESSAGE_SIZE = 10 * 1024 * 1024; // 10MB
      if (len === 0 || len > MAX_MESSAGE_SIZE) {
        console.error(`[claude_host] Invalid message length: ${len}`);
        return resolve(null);
      }
      
      const chunks = [];
      let remaining = len;
      function readChunk() {
        const chunk = process.stdin.read(Math.min(remaining, 65536)); // Read in smaller chunks
        if (!chunk) return process.stdin.once('readable', readChunk);
        chunks.push(chunk);
        remaining -= chunk.length;
        if (remaining <= 0) {
          const buf = Buffer.concat(chunks);
          try {
            const msg = JSON.parse(buf.toString('utf8'));
            resolve(msg);
          } catch (e) {
            console.error(`[claude_host] JSON parse error:`, e.message);
            resolve(null);
          }
        }
      }
      readChunk();
    });
  });
}

function writeMessage(obj) {
  const json = Buffer.from(JSON.stringify(obj), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  process.stdout.write(header);
  process.stdout.write(json);
}

function ok(data) { return { ok: true, ...data }; }
function err(message) { return { ok: false, error: message }; }

const MAX_TEXT_LEN = 200000; // chars safeguard (~200 KB)

async function handleMessage(msg) {
  if (!msg || typeof msg !== 'object') return err('Invalid message');
  const type = msg.type;
  try {
    switch (type) {
      case 'check': {
        try {
          const cmd = getClaudeCmd();
          const version = execSync(`${cmd} --version`, { timeout: 5000, stdio: ['ignore','pipe','pipe'] }).toString().trim();
          return ok({ available: true, version, message: 'Claude CLI available' });
        } catch (e) {
          return ok({ available: false, message: 'Claude CLI not found' });
        }
      }
      case 'translate': {
        const { text, sourceLanguage, targetLanguage, options = {} } = msg;
        if (!text || typeof text !== 'string') return err('Empty text');
        if (text.length > MAX_TEXT_LEN) return err('Text too large for single translation; please chunk on client');
        const prompt = buildTranslatePrompt(text, sourceLanguage, targetLanguage, options);
        const out = await runClaude(prompt, options.timeoutMs || 90000);
        return ok({ translatedText: out });
      }
      case 'summarize': {
        const { text, options = {} } = msg;
        if (!text || typeof text !== 'string') return err('Empty text');
        const safeText = text.length > MAX_TEXT_LEN ? (text.slice(0, MAX_TEXT_LEN) + '\n[TRUNCATED]\n') : text;
        const prompt = buildSummaryPrompt(safeText, options);
        const out = await runClaude(prompt, options.timeoutMs || 120000);
        return ok({ summary: out });
      }
      case 'keywords': {
        const { text, options = {} } = msg;
        if (!text || typeof text !== 'string') return err('Empty text');
        const safeText = text.length > MAX_TEXT_LEN ? text.slice(0, MAX_TEXT_LEN) : text;
        const prompt = buildKeywordsPrompt(safeText, options);
        const out = await runClaude(prompt, options.timeoutMs || 60000);
        const keywords = out.split(',').map(s => s.trim()).filter(Boolean).slice(0, options.maxKeywords || 8);
        return ok({ keywords });
      }
      case 'writeFile': {
        const { filePath, content, encoding = 'utf8' } = msg;
        if (!filePath) return err('Missing filePath');
        if (typeof content !== 'string') return err('Invalid content');
        if (content.length > 10 * 1024 * 1024) return err('Content too large');
        const home = os.homedir();
        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(home)) return err('File path outside home is not allowed');
        await fsp.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fsp.writeFile(resolvedPath, content, { encoding });
        const stats = await fsp.stat(resolvedPath);
        return ok({ success: true, filePath: resolvedPath, bytes: stats.size });
      }
      case 'readFile': {
        const { filePath, encoding = 'utf8' } = msg;
        if (!filePath) return err('Missing filePath');
        const home = os.homedir();
        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(home)) return err('File path outside home is not allowed');
        try {
          const content = await fsp.readFile(resolvedPath, { encoding });
          const stats = await fsp.stat(resolvedPath);
          return ok({ success: true, content, filePath: resolvedPath, bytes: stats.size });
        } catch (e) {
          if (e.code === 'ENOENT') {
            return err('File not found');
          }
          return err('Failed to read file: ' + e.message);
        }
      }
      default:
        return err('Unknown type');
    }
  } catch (e) {
    return err(e.message);
  }
}

function runClaude(prompt, timeoutMs = 240000) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--model', 'sonnet', '--max-turns', '1', '--output-format', 'text', prompt];
    const cmd = getClaudeCmd();
    const p = spawn(cmd, args, { shell: false });
    let out = '', err = '';
    p.stdout.on('data', d => (out += d.toString()));
    p.stderr.on('data', d => (err += d.toString()));
    p.on('error', (e) => reject(new Error('Failed to spawn claude: ' + e.message)));
    const to = setTimeout(() => {
      try { p.kill('SIGTERM'); } catch (_) {}
    }, timeoutMs);
    p.on('close', (code) => {
      clearTimeout(to);
      if (code === 0 && out.trim().length > 0) return resolve(out.trim());
      reject(new Error(err || 'Claude CLI exited with code ' + code));
    });
  });
}

function sanitizeFilename(name) {
  // remove path separators and control chars
  return name.replace(/[\\/\0\n\r\t\f\v]/g, '_');
}

function buildTranslatePrompt(text, src, tgt, options) {
  const names = { en: '英語', ja: '日本語', zh: '中国語', ko: '韓国語', fr: 'フランス語', de: 'ドイツ語', es: 'スペイン語' };
  let p = `以下のテキストを${names[src] || src}から${names[tgt] || tgt}に翻訳してください。`;
  if (options.isTitle) p += '\n\nこれはタイトルとして翻訳してください。自然で読みやすいタイトルにしてください。';
  if (options.preserveMarkdown) p += '\n\nMarkdown記法は保持してください。';
  p += '\n\n翻訳対象テキスト:\n' + text + '\n\n翻訳結果のみを出力してください。';
  return p;
}

function buildSummaryPrompt(text, options) {
  const style = options.style || 'structured';
  const maxLength = options.maxLength || 500;
  let p = '以下の記事の要約を日本語で作成してください。出力は日本語のみで、前置きや注釈は不要です。Markdownで出力してください。\n\n';
  if (style === 'bullet') {
    p += '箇条書き形式で主要なポイントを整理してください。\n• 形式で3-5個のポイントにまとめてください。\n';
  } else if (style === 'paragraph') {
    p += '段落形式で簡潔にまとめてください。2-3段落で記事の要点を説明してください。\n';
  } else {
    p += '以下の形式で構造化された要約を作成してください：\n\n## 記事の要点\n- [主要ポイント1]\n- [主要ポイント2]\n- [主要ポイント3]\n\n## 主な内容\n[記事の概要を2-3文で日本語で説明]\n';
  }
  p += `\n要約は${maxLength}文字以内にしてください。\n\n記事内容:\n` + text;
  return p;
}

function buildKeywordsPrompt(text, options) {
  const maxKeywords = options.maxKeywords || 8;
  return `以下の記事から重要なキーワードを抽出してください。\n- 最大${maxKeywords}個\n- カンマ区切りで出力\n\n記事内容:\n${text}`;
}

async function main() {
  // Loop to handle multiple messages until stdin closes
  while (true) {
    const msg = await readMessage();
    if (!msg) break;
    const res = await handleMessage(msg);
    writeMessage(res);
  }
}

main().catch((e) => {
  try { writeMessage(err(e.message)); } catch (_) {}
  process.exit(1);
});
