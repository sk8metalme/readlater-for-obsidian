// Native Messaging bridge for Claude CLI
// Works in Chrome extension contexts (MV3) via chrome.runtime.sendNativeMessage

(function () {
  const HOST_NAME = 'com.readlater.claude_host';

  class NativeClaudeBridge {
    constructor(hostName = HOST_NAME) {
      this.hostName = hostName;
      this.defaultModel = 'sonnet';
      this.timeoutMs = 180000; // default; each call can override
    }

    async checkStatus() {
      const res = await this.#send({ type: 'check' });
      if (!res || res.ok === false) {
        return { available: false, message: res?.error || 'Host not reachable' };
      }
      return { available: !!res.available, version: res.version || null, message: res.message || 'ok' };
    }

    async translate(text, sourceLanguage, targetLanguage, options = {}) {
      return this.#requireOk(
        this.#send({
          type: 'translate',
          text,
          sourceLanguage,
          targetLanguage,
          options: { 
            isTitle: !!options.isTitle, 
            preserveMarkdown: !!options.preserveMarkdown,
            timeoutMs: typeof options.timeoutMs === 'number' ? options.timeoutMs : undefined,
          },
        }, options.timeoutMs)
      );
    }

    async summarize(text, options = {}) {
      console.log('[NativeClaudeBridge] Summarize request', {
        textLength: text.length,
        style: options.style || 'structured',
        maxLength: options.maxLength || 500,
        timeoutMs: options.timeoutMs || this.timeoutMs
      });
      
      return this.#requireOk(
        this.#send(
          { type: 'summarize', text, options: { style: options.style || 'structured', maxLength: options.maxLength || 500, timeoutMs: typeof options.timeoutMs === 'number' ? options.timeoutMs : undefined } },
          options.timeoutMs
        )
      );
    }

    async keywords(text, options = {}) {
      return this.#requireOk(
        this.#send(
          { type: 'keywords', text, options: { maxKeywords: options.maxKeywords || 8, timeoutMs: typeof options.timeoutMs === 'number' ? options.timeoutMs : undefined } },
          options.timeoutMs
        )
      );
    }

    // Internal helpers
    async #send(message, timeoutOverrideMs) {
      return new Promise((resolve) => {
        let done = false;
        const useTimeout = typeof timeoutOverrideMs === 'number' ? timeoutOverrideMs : this.timeoutMs;
        const startTime = Date.now();
        
        console.log('[NativeClaudeBridge] Sending message', {
          type: message.type,
          timeout: useTimeout,
          messageSize: JSON.stringify(message).length
        });
        
        const timer = setTimeout(() => {
          if (done) return;
          done = true;
          const elapsed = Date.now() - startTime;
          console.error('[NativeClaudeBridge] Timeout after', elapsed, 'ms (configured:', useTimeout, 'ms)');
          resolve({ ok: false, error: 'Native host timeout' });
        }, useTimeout);

        try {
          chrome.runtime.sendNativeMessage(this.hostName, message, (response) => {
            if (done) return;
            clearTimeout(timer);
            const elapsed = Date.now() - startTime;
            
            if (chrome.runtime.lastError) {
              console.error('[NativeClaudeBridge] Chrome runtime error after', elapsed, 'ms:', chrome.runtime.lastError.message);
              return resolve({ ok: false, error: chrome.runtime.lastError.message });
            }
            
            console.log('[NativeClaudeBridge] Received response after', elapsed, 'ms', {
              ok: response?.ok,
              hasData: !!(response?.data || response?.summary || response?.translatedText)
            });
            
            resolve(response || { ok: false, error: 'Empty response' });
          });
        } catch (e) {
          if (done) return;
          clearTimeout(timer);
          console.error('[NativeClaudeBridge] Exception:', e.message);
          resolve({ ok: false, error: e.message });
        }
      });
    }

    async #requireOk(promise) {
      const res = await promise;
      if (!res || res.ok === false) {
        const msg = res?.error || 'Native host error';
        throw new Error(msg);
      }
      return res;
    }
  }

  // Simple in-worker language detector (no external deps)
  async function detectLanguageSimple(text) {
    if (!text || typeof text !== 'string') return { language: 'unknown', confidence: 0.0 };
    const t = text.slice(0, 1000);
    if (/[\uAC00-\uD7AF]/.test(t)) return { language: 'ko', confidence: 0.95 };
    const hasCJ = /[\u4E00-\u9FAF]/.test(t);
    const hasKana = /[\u3040-\u309F\u30A0-\u30FF]/.test(t);
    if (hasKana) return { language: 'ja', confidence: 0.9 };
    if (hasCJ) return { language: 'zh', confidence: 0.7 };
    const alpha = (t.match(/[a-zA-Z]/g) || []).length / Math.max(1, t.length);
    if (alpha > 0.5) return { language: 'en', confidence: 0.6 };
    return { language: 'unknown', confidence: 0.2 };
  }

  // expose
  if (typeof self !== 'undefined') {
    self.NativeClaudeBridge = NativeClaudeBridge;
    self.detectLanguageSimple = detectLanguageSimple;
  } else if (typeof window !== 'undefined') {
    window.NativeClaudeBridge = NativeClaudeBridge;
    window.detectLanguageSimple = detectLanguageSimple;
  }
})();
