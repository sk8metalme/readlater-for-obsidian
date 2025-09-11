#!/usr/bin/env node
// Install Native Messaging host for ReadLater (Claude CLI bridge)
// Usage:
//   node scripts/install-native-host.js --ext-id <EXTENSION_ID> [--apply]
//   EXT_ID=<EXTENSION_ID> node scripts/install-native-host.js --apply

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { apply: false, extId: process.env.EXT_ID || '' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--ext-id' && args[i + 1]) { out.extId = args[i + 1]; i++; }
  }
  return out;
}

function getChromeHostsDir() {
  const home = require('os').homedir();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts');
  }
  if (process.platform === 'linux') {
    return path.join(home, '.config', 'google-chrome', 'NativeMessagingHosts');
  }
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return path.join(local, 'Google', 'Chrome', 'User Data', 'NativeMessagingHosts');
  }
  throw new Error(`Unsupported platform: ${process.platform}`);
}

function main() {
  const { apply, extId } = parseArgs();
  const repoRoot = process.cwd();
  const hostScriptAbs = path.join(repoRoot, 'native_host', 'claude_host.js');
  const nodeBin = process.execPath; // absolute path to running Node
  const wrapper = process.platform === 'win32'
    ? path.join(repoRoot, 'native_host', 'claude_host.cmd')
    : path.join(repoRoot, 'native_host', 'claude_host.sh');
  const outDir = getChromeHostsDir();
  const outFile = path.join(outDir, 'com.readlater.claude_host.json');

  const allowedOrigins = [];
  if (extId) {
    allowedOrigins.push(`chrome-extension://${extId}/`);
  }

  const manifest = {
    name: 'com.readlater.claude_host',
    description: 'ReadLater for Obsidian - Claude CLI Native Messaging Host',
    path: wrapper,
    type: 'stdio',
    allowed_origins: allowedOrigins.length ? allowedOrigins : ['chrome-extension://YOUR_EXTENSION_ID/'],
  };

  console.log('Platform         :', process.platform);
  console.log('Node binary      :', nodeBin);
  console.log('Host script      :', hostScriptAbs);
  console.log('Wrapper          :', wrapper);
  console.log('Target manifest  :', outFile);
  console.log('Allowed origins  :', manifest.allowed_origins.join(', '));
  console.log('Apply changes    :', apply ? 'YES' : 'NO (dry-run)');

  if (!apply) {
    console.log('\nDry-run complete. Re-run with --apply and --ext-id <ID> to install.');
    process.exit(0);
  }

  if (!extId) {
    console.error('Error: --ext-id <EXTENSION_ID> is required when using --apply');
    process.exit(1);
  }

  // Ensure host script exists
  if (!fs.existsSync(hostScriptAbs)) {
    console.error('Host script not found at:', hostScriptAbs);
    process.exit(1);
  }

  // Write wrapper that launches node with absolute paths (Chrome has limited PATH)
  if (process.platform === 'win32') {
    const content = `@echo off\r\n"${nodeBin}" "${hostScriptAbs}"`;
    fs.writeFileSync(wrapper, content, 'utf8');
  } else {
    const content = `#!/bin/sh\n"${nodeBin}" "${hostScriptAbs}"`;
    fs.writeFileSync(wrapper, content, 'utf8');
    try { fs.chmodSync(wrapper, 0o755); } catch (e) {}
  }

  // Ensure dir
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('Installed manifest:', outFile);
}

main();
