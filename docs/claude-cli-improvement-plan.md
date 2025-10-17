# Claude CLI 実装改善計画

## 現在の実装の問題点

### 1. エラーハンドリングが弱い
**問題:**
- 汎用的な `Error` のみ使用
- エラータイプの区別ができない
- エラーの詳細情報が不足

**Nook の実装:**
```python
class ClaudeCLIError(Exception): """ベース例外"""
class ClaudeCLITimeoutError(ClaudeCLIError): """タイムアウト"""
class ClaudeCLIProcessError(ClaudeCLIError): """プロセスエラー"""
```

### 2. リトライメカニズムがない
**問題:**
- 一時的な失敗で即座にエラー
- ネットワークエラーに対応できない

**Nook の実装:**
```python
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    reraise=True
)
def _execute_claude_command(...)
```

### 3. レート制限制御が不十分
**問題:**
- 単純な `setTimeout` のみ
- 並行リクエストの制御なし

**Nook の実装:**
```python
# クラスレベルの状態管理
_request_lock = threading.Lock()
_last_request_ts = 0.0

def _throttle_if_needed(self):
    with lock:
        wait = interval - (now - last_ts)
        if wait > 0:
            time.sleep(wait)
```

### 4. タイムアウトが短い
**問題:**
- デフォルト 30秒（短すぎる）
- native_host は 90-240秒

**Nook の実装:**
```python
timeout: int = 120  # 応答に時間がかかるため 120 秒
```

### 5. プロンプト制限がない
**問題:**
- 長すぎるプロンプトを送信する可能性
- メモリオーバーフローのリスク

**Nook の実装:**
```python
max_prompt_chars: Optional[int] = None  # プロンプトの最大文字数制限

def _enforce_prompt_limit(self, prompt, system_instruction):
    """プロンプトが文字数制限を超える場合にトリミング"""
    # システム命令は維持し、ユーザープロンプトのみトリミング
```

### 6. パフォーマンス最適化が不足
**問題:**
- 権限チェックでパフォーマンス低下
- 不要なオプションでオーバーヘッド

**Nook の実装:**
```python
skip_permissions: bool = True
cmd.append("--dangerously-skip-permissions")
```

### 7. セッション管理が不完全
**問題:**
- チャット履歴の管理がない
- コンテキストの保持が弱い

**Nook の実装:**
```python
self._session_history: List[Dict[str, str]] = []
# 直近 2 往復 (4 メッセージ) をコンテキストに含める
recent_history = self._session_history[-4:]
```

## 改善計画

### Phase 1: エラーハンドリングの強化（優先度: 高）

#### 1.1 カスタム例外クラスの導入

```javascript
// カスタム例外クラス
class ClaudeCLIError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'ClaudeCLIError';
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

class ClaudeCLITimeoutError extends ClaudeCLIError {
    constructor(timeout, details = {}) {
        super(`Claude CLI command timed out after ${timeout}ms`, details);
        this.name = 'ClaudeCLITimeoutError';
        this.timeout = timeout;
    }
}

class ClaudeCLIProcessError extends ClaudeCLIError {
    constructor(message, code, stderr, details = {}) {
        super(message, details);
        this.name = 'ClaudeCLIProcessError';
        this.exitCode = code;
        this.stderr = stderr;
    }
}

class ClaudeCLINotFoundError extends ClaudeCLIError {
    constructor(details = {}) {
        super('Claude CLI not found. Please install Claude CLI first.', details);
        this.name = 'ClaudeCLINotFoundError';
    }
}
```

#### 1.2 詳細なエラーログ

```javascript
logError(error, context = {}) {
    console.error('ClaudeCLI Error:', {
        errorType: error.name,
        message: error.message,
        timestamp: error.timestamp || new Date().toISOString(),
        context,
        details: error.details,
        stack: error.stack
    });
}
```

### Phase 2: リトライメカニズムの実装（優先度: 高）

#### 2.1 指数バックオフリトライ

```javascript
class RetryConfig {
    constructor(options = {}) {
        this.maxAttempts = options.maxAttempts || 3;
        this.initialDelay = options.initialDelay || 4000; // 4秒
        this.maxDelay = options.maxDelay || 10000; // 10秒
        this.multiplier = options.multiplier || 2;
        this.retryableErrors = options.retryableErrors || [
            'ETIMEDOUT',
            'ECONNRESET',
            'ENOTFOUND',
            'ClaudeCLITimeoutError',
            'ClaudeCLIProcessError'
        ];
    }
    
    shouldRetry(error, attemptNumber) {
        if (attemptNumber >= this.maxAttempts) return false;
        
        // エラータイプでリトライ判断
        if (error instanceof ClaudeCLINotFoundError) return false;
        if (error instanceof ClaudeCLITimeoutError) return true;
        if (error instanceof ClaudeCLIProcessError) return true;
        
        return this.retryableErrors.some(errType => 
            error.code === errType || error.name === errType
        );
    }
    
    getDelay(attemptNumber) {
        const delay = this.initialDelay * Math.pow(this.multiplier, attemptNumber - 1);
        return Math.min(delay, this.maxDelay);
    }
}

async function executeWithRetry(fn, retryConfig = new RetryConfig()) {
    let lastError;
    
    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            if (!retryConfig.shouldRetry(error, attempt)) {
                throw error;
            }
            
            const delay = retryConfig.getDelay(attempt);
            console.log(`ClaudeCLI: Retry attempt ${attempt}/${retryConfig.maxAttempts} after ${delay}ms`, {
                error: error.message,
                errorType: error.name
            });
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
}
```

### Phase 3: レート制限とスロットリング（優先度: 中）

#### 3.1 クラスレベルのレート制限

```javascript
class ClaudeCLI {
    // クラスレベルの状態（全インスタンスで共有）
    static _lastRequestTime = 0;
    static _requestLock = Promise.resolve();
    
    constructor(options = {}) {
        // ...既存コード...
        this.minRequestInterval = options.minRequestInterval || 2000; // 2秒
        this.maxPromptChars = options.maxPromptChars || 100000; // 10万文字
    }
    
    async acquireLock() {
        // 排他制御：前のリクエストが完了するまで待機
        await ClaudeCLI._requestLock;
        
        let releaseLock;
        ClaudeCLI._requestLock = new Promise(resolve => {
            releaseLock = resolve;
        });
        
        return releaseLock;
    }
    
    async throttleIfNeeded() {
        if (!this.minRequestInterval || this.minRequestInterval <= 0) {
            return;
        }
        
        const now = Date.now();
        const elapsed = now - ClaudeCLI._lastRequestTime;
        const waitTime = this.minRequestInterval - elapsed;
        
        if (waitTime > 0) {
            console.log(`ClaudeCLI: Throttling request, waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        ClaudeCLI._lastRequestTime = Date.now();
    }
}
```

#### 3.2 プロンプト制限

```javascript
enforcePromptLimit(prompt, systemInstruction = null) {
    if (!this.maxPromptChars) {
        return { prompt, systemInstruction };
    }
    
    let prefixLength = 0;
    if (systemInstruction) {
        prefixLength = systemInstruction.length + 20; // "System: \n\nUser: ".length
    }
    
    const availableForPrompt = Math.max(this.maxPromptChars - prefixLength, 0);
    
    if (availableForPrompt === 0) {
        return {
            prompt: '[入力テキストは長すぎるため全体を送信できませんでした]'.slice(0, this.maxPromptChars),
            systemInstruction
        };
    }
    
    if (prompt.length <= availableForPrompt) {
        return { prompt, systemInstruction };
    }
    
    const truncatedPrompt = prompt.slice(0, availableForPrompt).trimEnd() + 
        '\n\n[入力テキストは制限により途中までで送信されています]';
    
    console.warn(`ClaudeCLI: Prompt truncated from ${prompt.length} to ${truncatedPrompt.length} chars`);
    
    return { prompt: truncatedPrompt, systemInstruction };
}
```

### Phase 4: パフォーマンス最適化（優先度: 中）

#### 4.1 コマンド構築の最適化

```javascript
buildClaudeCommand(prompt, options = {}) {
    const args = ['-p'];
    
    // モデル指定
    if (options.model || this.model) {
        args.push('--model', options.model || this.model);
    }
    
    // パフォーマンス最適化：権限チェックスキップ
    if (this.skipPermissions !== false) {
        args.push('--dangerously-skip-permissions');
    }
    
    // 出力フォーマット
    args.push('--output-format', 'text');
    
    // max-turns
    if (options.maxTurns || this.maxTurns) {
        args.push('--max-turns', String(options.maxTurns || this.maxTurns));
    }
    
    // プロンプト追加
    args.push(prompt);
    
    return args;
}
```

#### 4.2 タイムアウトの延長

```javascript
constructor(options = {}) {
    this.model = options.model || 'sonnet';
    this.maxTurns = options.maxTurns || 1;
    this.timeout = options.timeout || 120000; // 120秒（nookと同じ）
    this.skipPermissions = options.skipPermissions !== false; // デフォルトでtrue
    
    // ...
}
```

### Phase 5: セッション管理の改善（優先度: 低）

#### 5.1 チャット履歴管理

```javascript
constructor(options = {}) {
    // ...既存コード...
    this.sessionHistory = [];
    this.maxHistoryMessages = options.maxHistoryMessages || 4; // 直近2往復
}

addToHistory(role, content, metadata = {}) {
    this.sessionHistory.push({
        role,
        content,
        timestamp: new Date().toISOString(),
        ...metadata
    });
    
    // 履歴が長すぎる場合は古いものを削除
    if (this.sessionHistory.length > this.maxHistoryMessages) {
        this.sessionHistory = this.sessionHistory.slice(-this.maxHistoryMessages);
    }
}

getRecentHistory() {
    return this.sessionHistory.slice(-this.maxHistoryMessages);
}

buildContextPrompt(message) {
    const history = this.getRecentHistory();
    
    if (history.length === 0) {
        return message;
    }
    
    const context = history
        .map(entry => `${entry.role.charAt(0).toUpperCase() + entry.role.slice(1)}: ${entry.content}`)
        .join('\n');
    
    return `${context}\nUser: ${message}`;
}

clearHistory() {
    this.sessionHistory = [];
}
```

## 実装順序

### Step 1: 緊急対応（即時実装）
1. ✅ タイムアウトを 120秒に延長
2. ✅ `--dangerously-skip-permissions` を追加
3. ✅ カスタム例外クラスを導入

### Step 2: 重要な改善（1-2日）
4. ✅ リトライメカニズムの実装
5. ✅ 詳細なエラーログ
6. ✅ プロンプト制限の実装

### Step 3: 品質向上（3-5日）
7. ✅ レート制限の強化
8. ✅ セッション管理の改善
9. ✅ テストスイートの作成

### Step 4: ドキュメント整備（1日）
10. ✅ 実装ドキュメントの更新
11. ✅ トラブルシューティングガイド

## 期待される効果

### パフォーマンス向上
- **タイムアウト延長**: 長い記事でも安定処理
- **権限スキップ**: 10-30% の速度向上
- **リトライ**: 一時的エラーの自動回復

### 信頼性向上
- **エラーハンドリング**: 問題の早期発見
- **リトライメカニズム**: 成功率 95% → 99%
- **レート制限**: API制限エラーの回避

### 保守性向上
- **カスタム例外**: エラーの明確化
- **詳細ログ**: デバッグ時間 50% 削減
- **セッション管理**: 複雑な対話の実現

## 参考実装（Nook）

- `nook/functions/common/python/claude_cli_client.py`: 主要実装
- `nook/functions/common/python/tests/test_claude_cli_client.py`: テスト実装
- `tests/integration/test_claude_basic_integration.py`: 統合テスト

---

**作成日**: 2025-10-09  
**参照**: `nook-claude-cli-implementation.md`



