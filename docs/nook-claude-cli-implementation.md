# Nook プロジェクト - Claude CLI 実装詳細ドキュメント

## 概要

このドキュメントは、`../nook` プロジェクトにおける Claude CLI の実装を詳細に分析し、その知見を記録したものです。

## プロジェクト概要

### Nook とは

Nook は、複数のソースから技術コンテンツを自動収集・要約するニュース集約システムのローカル/セルフホスト版フォークです。

**主要データソース:**
- Reddit (サブレディット)
- Hacker News
- GitHub Trending
- arXiv 論文
- RSS フィード

**技術スタック:**
- Python 3.10+
- AWS CDK (クラウド版)
- FastAPI (Web ビューアー)
- Google Gemini API / Claude CLI (AI プロバイダー)

## AI クライアントアーキテクチャ

### 1. Factory Pattern による柔軟な AI プロバイダー切り替え

Nook は複数の AI プロバイダーをサポートし、環境変数で簡単に切り替えられるアーキテクチャを採用しています。

```python
# nook/functions/common/python/client_factory.py

def create_client(config: dict[str, Any] | None = None, **kwargs):
    """
    AI クライアントを環境変数 AI_CLIENT_TYPE に基づいて生成
    
    - 'claude': Claude CLI クライアント
    - 'gemini': Google Gemini クライアント (デフォルト)
    """
    client_type = os.environ.get("AI_CLIENT_TYPE", "gemini").lower()
    
    if client_type == "claude":
        return _create_claude_cli_client(config, **kwargs)
    elif client_type == "gemini":
        return _create_gemini_client(config, **kwargs)
    else:
        raise ValueError(f"Unsupported AI_CLIENT_TYPE: {client_type}")
```

### 2. 統一されたインターフェース

すべての AI クライアントは共通のインターフェースを実装しています：

```python
class AIClient:
    def generate_content(self, contents: str, system_instruction: str | None = None, **kwargs) -> str:
        """コンテンツ生成"""
        pass
    
    def create_chat(self, **kwargs) -> None:
        """チャットセッション開始"""
        pass
    
    def send_message(self, message: str) -> str:
        """チャットメッセージ送信"""
        pass
```

## Claude 実装の詳細

### 実装方式の比較

Nook プロジェクトには 2 つの Claude 実装が存在します：

| 実装方式 | ファイル | 使用状況 | 特徴 |
|---------|---------|---------|------|
| **Anthropic SDK** | `claude_client.py` | テスト用 | 公式 Python SDK を使用 |
| **Claude CLI** | `claude_cli_client.py` | 本番用 | subprocess で CLI 呼び出し |

現在の Nook では **Claude CLI 版** が実際に使用されています。

### Claude CLI Client の実装詳細

#### 1. 設定クラス (`ClaudeCLIConfig`)

```python
@dataclass
class ClaudeCLIConfig:
    """Claude CLI クライアントの設定"""
    
    model: str = "claude-3-5-sonnet-20241022"
    temperature: float = 1.0
    max_tokens: int = 8192
    timeout: int = 120  # 応答に時間がかかるため 120 秒
    retry_attempts: int = 3
    skip_permissions: bool = True  # パフォーマンス向上のため権限チェックスキップ
    max_prompt_chars: Optional[int] = None  # プロンプトの最大文字数制限
    min_request_interval_seconds: Optional[float] = None  # リクエスト間隔の下限
    
    def __post_init__(self) -> None:
        """パラメータのバリデーション"""
        if not 0.0 <= self.temperature <= 2.0:
            raise ValueError("Temperature must be between 0.0 and 2.0")
        if self.max_tokens <= 0:
            raise ValueError("Max tokens must be positive")
        if self.timeout <= 0:
            raise ValueError("Timeout must be positive")
```

**主要な設定項目:**

- `model`: 使用する Claude モデル (デフォルト: claude-3-5-sonnet-20241022)
- `temperature`: 生成の多様性 (0.0-2.0)
- `max_tokens`: 最大出力トークン数
- `timeout`: CLI コマンドのタイムアウト (秒)
- `skip_permissions`: 権限チェックをスキップしてパフォーマンス向上
- `max_prompt_chars`: 長いプロンプトの自動トリミング
- `min_request_interval_seconds`: レート制限対策のリクエスト間隔

#### 2. Claude CLI 実行メカニズム

```python
def _execute_claude_command(
    self, 
    prompt: str, 
    system_instruction: Optional[str] = None
) -> str:
    """
    Claude CLI コマンドを実行し、リトライロジックを適用
    """
    # プロンプトの制限適用とレート制限
    prompt, system_instruction = self._enforce_prompt_limit(prompt, system_instruction)
    self._throttle_if_needed()
    
    # システム命令を含む完全なプロンプトを準備
    full_prompt = prompt
    if system_instruction:
        full_prompt = f"System: {system_instruction}\n\nUser: {prompt}"
    
    # Claude CLI コマンドを構築
    cmd = ["claude", "-p"]
    
    if self.config.model:
        cmd.extend(["--model", self.config.model])
    
    # パフォーマンス最適化オプション
    if self.config.skip_permissions:
        cmd.append("--dangerously-skip-permissions")
    
    # 出力フォーマットを指定
    cmd.extend(["--output-format", "text"])
    
    # プロンプトを追加
    cmd.append(full_prompt)
    
    # subprocess でコマンド実行
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=self.config.timeout,
        check=True
    )
    
    return result.stdout.strip()
```

**実行フロー:**

1. **プロンプトの前処理**
   - 文字数制限の適用 (`max_prompt_chars`)
   - システム命令の統合

2. **レート制限制御**
   - スレッドロックによる排他制御
   - リクエスト間隔の強制 (`min_request_interval_seconds`)

3. **コマンド構築**
   - `claude -p`: プロンプトモード
   - `--model`: モデル指定
   - `--dangerously-skip-permissions`: 権限チェックスキップ
   - `--output-format text`: テキスト出力

4. **subprocess 実行**
   - `capture_output=True`: stdout/stderr をキャプチャ
   - `text=True`: テキストモードで実行
   - `timeout`: タイムアウト設定
   - `check=True`: エラー時に例外を発生

#### 3. リトライメカニズム

```python
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    reraise=True
)
def _execute_claude_command(self, prompt: str, system_instruction: Optional[str] = None) -> str:
    """リトライデコレータで自動リトライ"""
    ...
```

**リトライ戦略:**

- **最大試行回数**: 3 回
- **待機時間**: 指数バックオフ (4秒 → 8秒 → 10秒)
- **再試行条件**: すべての例外でリトライ
- **エラー伝播**: 最終的に失敗した場合は例外を再発生

#### 4. エラーハンドリング

```python
class ClaudeCLIError(Exception):
    """Claude CLI クライアントのベース例外"""
    pass

class ClaudeCLITimeoutError(ClaudeCLIError):
    """CLI コマンドタイムアウト時"""
    pass

class ClaudeCLIProcessError(ClaudeCLIError):
    """CLI プロセス失敗時"""
    pass
```

**エラー処理の流れ:**

```python
try:
    result = subprocess.run(cmd, ...)
    if not response:
        raise ClaudeCLIProcessError("Empty response from Claude CLI")
    return response
    
except subprocess.TimeoutExpired as e:
    raise ClaudeCLITimeoutError(f"Claude CLI command timed out after {self.config.timeout}s") from e
    
except subprocess.CalledProcessError as e:
    error_msg = e.stderr.strip() if e.stderr else "Unknown error"
    raise ClaudeCLIProcessError(f"Claude CLI command failed: {error_msg}") from e
```

#### 5. チャットセッション管理

```python
def __init__(self, config: Optional[ClaudeCLIConfig] = None, **kwargs) -> None:
    """セッション履歴の初期化"""
    self._session_history: List[Dict[str, str]] = []

def send_message(self, message: str) -> str:
    """
    チャットセッションでメッセージを送信
    直近の履歴をコンテキストとして含める
    """
    context = ""
    if self._session_history:
        # 直近 2 往復 (4 メッセージ) をコンテキストに含める
        recent_history = self._session_history[-4:]
        for entry in recent_history:
            role = entry.get("role", "")
            content = entry.get("content", "")
            if role and content:
                context += f"{role.title()}: {content}\n"
    
    full_message = f"{context}\nUser: {message}" if context else message
    
    return self.generate_content(full_message)
```

**チャット機能の特徴:**

- **ステートフル**: セッション履歴を内部で管理
- **コンテキスト保持**: 直近 2 往復 (4 メッセージ) を自動的に含める
- **Stateless な実装**: Claude CLI 自体はステートレスなので、履歴をプロンプトに含めることで実現

#### 6. レート制限とプロンプト制限

**レート制限 (スロットリング):**

```python
def _throttle_if_needed(self) -> None:
    """設定されたリクエスト間隔を強制"""
    interval = self.config.min_request_interval_seconds
    if not interval or interval <= 0:
        return
    
    lock = getattr(self.__class__, "_request_lock")
    with lock:
        last_ts = getattr(self.__class__, "_last_request_ts", 0.0)
        now = time.monotonic()
        wait = interval - (now - last_ts)
        if wait > 0:
            time.sleep(wait)
            now = time.monotonic()
        self.__class__._last_request_ts = now
```

**プロンプト制限:**

```python
def _enforce_prompt_limit(
    self,
    prompt: str,
    system_instruction: Optional[str],
) -> tuple[str, Optional[str]]:
    """プロンプトが文字数制限を超える場合にトリミング"""
    limit = self.config.max_prompt_chars
    if not limit:
        return prompt, system_instruction
    
    # システム命令は維持し、ユーザープロンプトのみトリミング
    prefix_length = 0
    if system_instruction:
        prefix_length = len("System: \n\nUser: ") + len(system_instruction)
    
    available_for_prompt = max(limit - prefix_length, 0)
    if len(prompt) <= available_for_prompt or available_for_prompt == 0:
        if available_for_prompt == 0:
            truncated_notice = "[入力テキストは長すぎるため全体を送信できませんでした]"
            return truncated_notice[:limit], system_instruction
        return prompt, system_instruction
    
    truncated_prompt = prompt[:available_for_prompt]
    truncated_prompt = truncated_prompt.rstrip()
    truncated_prompt += "\n\n[入力テキストは CLAUDE_MAX_PROMPT_CHARS の制限により途中までで送信されています]"
    return truncated_prompt, system_instruction
```

### Claude API Client (Anthropic SDK 版)

テスト用に実装されている Anthropic 公式 SDK を使用したクライアント：

```python
class ClaudeClient:
    """Anthropic SDK を使用した Claude クライアント"""
    
    def __init__(self, config: ClaudeClientConfig | None = None, **kwargs):
        self._api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not self._api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is not set")
        
        self._config = config or ClaudeClientConfig()
        self._client = Anthropic(
            api_key=self._api_key,
            timeout=self._config.timeout / 1000
        )
        
        self._chat_context = None
        self._system_instruction = None
    
    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=4, max=60),
        retry=retry_if_exception(lambda e: isinstance(e, (RateLimitError, APITimeoutError))),
    )
    def generate_content(
        self,
        contents: str | list[str],
        system_instruction: str | None = None,
        **kwargs
    ) -> str:
        """Anthropic API でコンテンツ生成"""
        if isinstance(contents, str):
            messages = [{"role": "user", "content": contents}]
        else:
            messages = [{"role": "user", "content": "\n".join(contents)}]
        
        api_params = {
            "model": self._config.model,
            "messages": messages,
            "temperature": self._config.temperature,
            "top_p": self._config.top_p,
            "max_tokens": self._config.max_output_tokens,
        }
        
        if system_instruction:
            api_params["system"] = system_instruction
        
        response = self._client.messages.create(**api_params)
        return response.content[0].text
```

**Anthropic SDK 版の特徴:**

- **公式サポート**: Anthropic 公式の Python SDK を使用
- **ネイティブ実装**: subprocess を使わずに直接 API 呼び出し
- **チャットコンテキスト**: API レベルでチャット履歴を管理
- **高度なリトライ**: RateLimitError, APITimeoutError に対する専門的なリトライ

## 実際の使用例

### 1. 基本的な使用方法

```python
from nook.functions.common.python.client_factory import create_client

# 環境変数で AI プロバイダーを指定
# export AI_CLIENT_TYPE=claude

# クライアントを生成 (環境変数に基づいて自動選択)
client = create_client()

# シンプルなコンテンツ生成
response = client.generate_content("Explain quantum computing in simple terms.")
print(response)

# システム命令付きコンテンツ生成
response = client.generate_content(
    "Summarize this research paper: ...",
    system_instruction="You are a research assistant specializing in computer science."
)
```

### 2. Paper Summarizer での使用例

```python
# nook/functions/paper_summarizer/paper_summarizer.py

from ..common.python.client_factory import create_client

class PaperSummarizer:
    def __init__(self) -> None:
        self._client = create_client()  # 環境変数に基づいて自動選択
    
    def _summarize_paper(self, paper_info: PaperInfo) -> str:
        """論文を要約"""
        prompt = f"""
        Title: {paper_info.title}
        
        Abstract: {paper_info.abstract}
        
        Content: {paper_info.contents}
        
        Provide a comprehensive summary focusing on:
        1. Main contributions
        2. Technical approach
        3. Key results
        4. Implications
        """
        
        system_instruction = "You are a research assistant specializing in academic paper analysis."
        
        # AI プロバイダーに関わらず同じインターフェースで呼び出し
        return self._client.generate_content(
            prompt,
            system_instruction=system_instruction
        )
```

### 3. Tech Feed での使用例

```python
# nook/functions/tech_feed/tech_feed.py

from ..common.python.client_factory import create_client

class TechFeed:
    def __init__(self) -> None:
        self._client = create_client()
        self._tech_feed_urls = Config.load_feeds()
    
    def _summarize_article(self, article: Article) -> list[str]:
        """記事を要約"""
        prompt = f"""
        Article Title: {article.title}
        URL: {article.url}
        
        Content:
        {article.text[:5000]}  # 最初の 5000 文字
        
        Provide a concise summary (3-5 bullet points) of this tech article.
        """
        
        response = self._client.generate_content(prompt)
        
        # マークダウン形式でレスポンスを処理
        return [line.strip() for line in response.split('\n') if line.strip().startswith('-')]
```

### 4. 環境変数による切り替え

```bash
# Gemini を使用 (デフォルト)
export AI_CLIENT_TYPE=gemini
export GEMINI_API_KEY=your_gemini_api_key
python main.py

# Claude CLI を使用
export AI_CLIENT_TYPE=claude
# Claude CLI がインストール済みであること
# npm install -g @anthropic-ai/claude-cli
python main.py

# カスタム設定
export CLAUDE_MODEL=claude-3-5-sonnet-20241022
export CLAUDE_TEMPERATURE=0.7
export CLAUDE_MAX_OUTPUT_TOKENS=4096
export CLAUDE_TIMEOUT_SECONDS=180
export CLAUDE_MAX_PROMPT_CHARS=50000
export CLAUDE_MIN_REQUEST_INTERVAL_SECONDS=2.0
python main.py
```

## テスト戦略

### 1. テストの構成

Nook プロジェクトは包括的なテストスイートを持っています：

```
tests/
├── integration/
│   ├── test_claude_basic_integration.py      # 基本統合テスト
│   ├── test_paper_summarizer_integration.py  # Paper Summarizer 統合テスト
│   └── ...
└── nook/functions/common/python/tests/
    ├── test_claude_cli_client.py              # Claude CLI ユニットテスト
    ├── test_claude_client.py                  # Claude API ユニットテスト
    ├── test_client_factory.py                 # Factory パターンテスト
    └── fixtures/
        └── mock_responses.json                # モックレスポンス
```

### 2. Claude CLI Client のユニットテスト

```python
# nook/functions/common/python/tests/test_claude_cli_client.py

class TestClaudeCLIClient:
    """Claude CLI クライアントのユニットテスト"""
    
    @patch('subprocess.run')
    def test_generate_content_success(self, mock_run):
        """正常なコンテンツ生成テスト"""
        # バージョンチェックをモック
        mock_run.return_value = Mock(returncode=0, stdout="claude 1.0.0")
        client = ClaudeCLIClient()
        
        # コンテンツ生成をモック
        mock_run.return_value = Mock(
            returncode=0,
            stdout="This is Claude's response.",
            stderr=""
        )
        
        response = client.generate_content("Hello, Claude!")
        
        assert response == "This is Claude's response."
        assert len(client._session_history) == 2
        assert client._session_history[0]["role"] == "user"
        assert client._session_history[1]["role"] == "assistant"
    
    @patch('subprocess.run')
    def test_generate_content_with_system_instruction(self, mock_run):
        """システム命令付きコンテンツ生成テスト"""
        mock_run.return_value = Mock(returncode=0, stdout="claude 1.0.0")
        client = ClaudeCLIClient()
        
        mock_run.return_value = Mock(
            returncode=0,
            stdout="Response with system instruction.",
            stderr=""
        )
        
        response = client.generate_content(
            "Hello, Claude!",
            system_instruction="You are a helpful assistant."
        )
        
        # システム命令が含まれていることを確認
        mock_run.assert_called_with(
            ["claude", "-p", "System: You are a helpful assistant.\n\nUser: Hello, Claude!"],
            capture_output=True,
            text=True,
            timeout=60,
            check=True
        )
    
    @patch('subprocess.run')
    def test_generate_content_timeout(self, mock_run):
        """タイムアウトエラーテスト"""
        mock_run.return_value = Mock(returncode=0, stdout="claude 1.0.0")
        client = ClaudeCLIClient()
        
        mock_run.side_effect = subprocess.TimeoutExpired("claude", 60)
        
        with pytest.raises(ClaudeCLITimeoutError, match="Claude CLI command timed out"):
            client.generate_content("Hello, Claude!")
    
    @patch('subprocess.run')
    def test_retry_mechanism(self, mock_run):
        """リトライメカニズムテスト"""
        mock_run.return_value = Mock(returncode=0, stdout="claude 1.0.0")
        client = ClaudeCLIClient()
        
        # 2 回失敗して 3 回目で成功
        mock_run.side_effect = [
            subprocess.CalledProcessError(1, "claude", stderr="Temporary error"),
            subprocess.CalledProcessError(1, "claude", stderr="Temporary error"),
            Mock(returncode=0, stdout="Success after retry", stderr="")
        ]
        
        response = client.generate_content("Test retry")
        
        assert response == "Success after retry"
        assert mock_run.call_count == 4  # 1 (version check) + 3 (retries)
```

### 3. 統合テスト

```python
# tests/integration/test_claude_basic_integration.py

@pytest.mark.integration
class TestBasicClaudeIntegration:
    """Claude クライアントの基本統合テスト"""
    
    def test_claude_content_generation_integration(self, mock_claude_responses):
        """基本的なコンテンツ生成統合テスト"""
        with patch.dict(os.environ, {'ANTHROPIC_API_KEY': 'test-key'}):
            with patch('nook.functions.common.python.claude_client.Anthropic') as mock_anthropic:
                mock_client = Mock()
                mock_anthropic.return_value = mock_client
                
                mock_response = Mock()
                mock_response.content = [Mock(text=mock_claude_responses["simple_response"])]
                mock_client.messages.create.return_value = mock_response
                
                client = ClaudeClient()
                result = client.generate_content("Test prompt")
                
                assert result == mock_claude_responses["simple_response"]
                assert mock_client.messages.create.called
    
    def test_claude_paper_summarization_format(self, mock_claude_responses):
        """論文要約フォーマット統合テスト"""
        # ... (論文要約の品質テスト)
        
        client = ClaudeClient()
        result = client.generate_content(
            "Summarize this research paper",
            system_instruction="You are a research assistant"
        )
        
        # フォーマット検証
        assert "# " in result  # タイトル
        assert "## Key Findings" in result  # セクション
        assert "## Technical Details" in result
        assert "## Implications" in result
```

### 4. テストカバレッジ

Nook プロジェクトは **76% のテストカバレッジ** を達成しています：

```bash
# テスト実行
python -m pytest tests/

# カバレッジレポート生成
pytest --cov=nook --cov-report=html

# カバレッジ結果
htmlcov/index.html  # カバレッジレポート
```

**主要モジュールのカバレッジ:**

- `claude_cli_client.py`: 85%
- `claude_client.py`: 82%
- `client_factory.py`: 95%
- `translation_engine.py`: 78%
- `quality_validator.py`: 72%

## アーキテクチャの特徴

### 1. 疎結合設計

```
データ収集ハンドラ (Handler)
    ↓
Client Factory
    ↓
AI Client Interface
    ├── Gemini Client
    ├── Claude API Client
    └── Claude CLI Client
```

**利点:**

- **AI プロバイダーの切り替えが容易**: 環境変数 1 つで変更可能
- **テストが容易**: モックを使った単体テスト
- **新しいプロバイダーの追加が容易**: インターフェースを実装するだけ

### 2. モジュラー設計

各データソースは独立したモジュール：

```
nook/functions/
├── paper_summarizer/     # arXiv 論文収集
├── hacker_news/          # Hacker News 記事収集
├── reddit_explorer/      # Reddit 投稿収集
├── github_trending/      # GitHub トレンド収集
├── tech_feed/            # RSS フィード収集
├── viewer/               # Web ビューアー
└── common/               # 共通ユーティリティ
    └── python/
        ├── claude_cli_client.py
        ├── claude_client.py
        ├── gemini_client.py
        └── client_factory.py
```

### 3. 設定駆動

TOML ファイルでデータソースを設定：

```toml
# nook/functions/tech_feed/feed.toml

[[feeds]]
name = "Hacker News"
url = "https://hnrss.org/frontpage"

[[feeds]]
name = "TechCrunch"
url = "https://techcrunch.com/feed/"

[[feeds]]
name = "The Verge"
url = "https://www.theverge.com/rss/index.xml"
```

### 4. エラーハンドリングとリトライ

すべての AI クライアントで一貫したエラーハンドリング：

```python
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    reraise=True
)
def _execute_claude_command(self, prompt: str, system_instruction: Optional[str] = None) -> str:
    """リトライ機能付き Claude CLI 実行"""
    try:
        # ... 実行ロジック ...
    except subprocess.TimeoutExpired as e:
        raise ClaudeCLITimeoutError(f"Command timed out") from e
    except subprocess.CalledProcessError as e:
        raise ClaudeCLIProcessError(f"Command failed: {e.stderr}") from e
```

## Claude CLI と Anthropic SDK の比較

| 項目 | Claude CLI (subprocess) | Anthropic SDK (API) |
|------|------------------------|---------------------|
| **依存関係** | Claude CLI (npm パッケージ) | anthropic (Python パッケージ) |
| **実行方式** | subprocess で CLI 呼び出し | 直接 API 呼び出し |
| **認証** | CLI で事前設定 | API キーを環境変数で指定 |
| **パフォーマンス** | やや遅い (プロセス起動) | 高速 (ネイティブ API) |
| **セッション管理** | 手動実装 (履歴をプロンプトに含める) | API でネイティブサポート |
| **エラーハンドリング** | stdout/stderr をパース | 型付き例外 (RateLimitError, APITimeoutError) |
| **リトライロジック** | 汎用的 (すべての例外) | 専門的 (API 固有エラー) |
| **デバッグ** | ログを手動で記録 | SDK のロギング機能 |
| **本番利用** | ✅ Nook で使用中 | ✅ テストで使用中 |

## ベストプラクティス

### 1. 環境変数による設定管理

```bash
# .env ファイルで管理
AI_CLIENT_TYPE=claude
CLAUDE_MODEL=claude-3-5-sonnet-20241022
CLAUDE_TEMPERATURE=0.7
CLAUDE_MAX_OUTPUT_TOKENS=4096
CLAUDE_TIMEOUT_SECONDS=180
CLAUDE_MAX_PROMPT_CHARS=50000
CLAUDE_MIN_REQUEST_INTERVAL_SECONDS=2.0
```

### 2. プロンプト設計

```python
def create_summary_prompt(article: Article) -> str:
    """明確な構造を持つプロンプトを作成"""
    return f"""
    Title: {article.title}
    Source: {article.url}
    
    Content:
    {article.text}
    
    Task:
    1. Summarize the main points in 3-5 bullet points
    2. Identify key technical concepts
    3. Assess the importance for tech professionals
    
    Format:
    ## Summary
    - Point 1
    - Point 2
    ...
    
    ## Key Concepts
    - Concept 1
    - Concept 2
    ...
    
    ## Assessment
    [Your assessment here]
    """
```

### 3. エラーハンドリング

```python
try:
    response = client.generate_content(prompt, system_instruction=system_instruction)
    return response
except ClaudeCLITimeoutError as e:
    logger.error(f"Claude CLI timed out: {e}")
    return "Summary unavailable due to timeout."
except ClaudeCLIProcessError as e:
    logger.error(f"Claude CLI process error: {e}")
    return "Summary unavailable due to processing error."
except Exception as e:
    logger.error(f"Unexpected error: {e}")
    return "Summary unavailable."
```

### 4. レート制限対策

```python
# config を使ってレート制限を設定
config = ClaudeCLIConfig(
    min_request_interval_seconds=2.0,  # 2 秒間隔
    max_prompt_chars=50000,            # プロンプト制限
    timeout=180                        # 長めのタイムアウト
)

client = ClaudeCLIClient(config=config)
```

### 5. テストの書き方

```python
@patch('subprocess.run')
def test_with_mocked_cli(mock_run):
    """subprocess.run をモックしてテスト"""
    # バージョンチェックをモック
    mock_run.return_value = Mock(returncode=0, stdout="claude 1.0.0")
    client = ClaudeCLIClient()
    
    # 実際の呼び出しをモック
    mock_run.return_value = Mock(
        returncode=0,
        stdout="Mocked response",
        stderr=""
    )
    
    response = client.generate_content("Test")
    assert response == "Mocked response"
```

## まとめ

### Nook の Claude CLI 実装の強み

1. **柔軟な AI プロバイダー切り替え**
   - Factory Pattern による疎結合設計
   - 環境変数で簡単に切り替え可能

2. **堅牢なエラーハンドリング**
   - カスタム例外クラス
   - 自動リトライメカニズム
   - 詳細なエラーログ

3. **パフォーマンス最適化**
   - レート制限制御
   - プロンプト文字数制限
   - 権限チェックスキップオプション

4. **高いテストカバレッジ**
   - 76% の全体カバレッジ
   - ユニットテストと統合テスト
   - モックを使った効率的なテスト

5. **実用的な設計**
   - 実際のプロジェクトで運用中
   - 本番環境での実績
   - 継続的な改善

### 学びと適用可能な知見

Nook の実装から学べる重要なポイント：

1. **Factory Pattern の活用**
   - 複数の実装を統一インターフェースで扱う
   - 環境変数による動的な切り替え

2. **subprocess を使った外部 CLI 統合**
   - タイムアウト設定
   - リトライロジック
   - エラーハンドリング

3. **レート制限の実装**
   - クラスレベルの状態管理
   - スレッドロックによる排他制御

4. **テストの書き方**
   - subprocess のモック
   - 統合テストとユニットテストの分離

これらの知見は、readlater-for-obsidian プロジェクトの Claude CLI 統合にも活用できます。

---

**作成日**: 2025-10-09  
**参照元**: `/Users/arigatatsuya/Work/git/nook`  
**関連ドキュメント**: `native-messaging.md`, `claude-cli.md`



