// ReadLater for Obsidian - Claude API Library Tests
// TDD: まずテストを書いてから実装する

const { ClaudeAPI, LanguageDetector, TranslationService, SummaryService } = require('../../src/lib/claude-api.js');

describe('ClaudeAPI', () => {
  let claudeAPI;

  beforeEach(() => {
    claudeAPI = new ClaudeAPI('sk-test-api-key-123');
    fetch.mockClear();
  });

  describe('constructor', () => {
    test('should initialize with API key', () => {
      expect(claudeAPI.apiKey).toBe('sk-test-api-key-123');
      expect(claudeAPI.baseUrl).toBe('https://api.anthropic.com/v1');
    });

    test('should throw error without API key', () => {
      expect(() => new ClaudeAPI()).toThrow('API key is required');
    });

    test('should throw error with invalid API key format', () => {
      expect(() => new ClaudeAPI('invalid-key')).toThrow('Invalid API key format');
    });
  });

  describe('makeRequest', () => {
    test('should make successful API request', async () => {
      const mockResponse = {
        content: [{ text: 'Test response' }]
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await claudeAPI.makeRequest('test prompt');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': 'sk-test-api-key-123',
            'anthropic-version': '2023-06-01'
          }),
          body: expect.stringContaining('test prompt')
        })
      );

      expect(result).toBe('Test response');
    });

    test('should handle API error responses', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Unauthorized' } })
      });

      await expect(claudeAPI.makeRequest('test')).rejects.toThrow('API request failed: Unauthorized');
    });

    test('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(claudeAPI.makeRequest('test')).rejects.toThrow('Network error');
    });

    test('should handle rate limiting with retry', async () => {
      // Mock sleep to avoid actual delays
      jest.spyOn(claudeAPI, 'sleep').mockResolvedValue();
      
      // First call fails with rate limit
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Rate limited' } })
      });

      // Second call succeeds
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ text: 'Success after retry' }] })
      });

      const result = await claudeAPI.makeRequest('test', { enableRetry: true });

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result).toBe('Success after retry');
      expect(claudeAPI.sleep).toHaveBeenCalled();
    });
  });

  describe('validateResponse', () => {
    test('should validate correct response format', () => {
      const validResponse = {
        content: [{ text: 'Valid response' }]
      };

      expect(() => claudeAPI.validateResponse(validResponse)).not.toThrow();
    });

    test('should throw error for invalid response format', () => {
      const invalidResponse = { invalid: 'format' };

      expect(() => claudeAPI.validateResponse(invalidResponse))
        .toThrow('Invalid Claude API response format');
    });

    test('should throw error for empty content', () => {
      const emptyResponse = { content: [] };

      expect(() => claudeAPI.validateResponse(emptyResponse))
        .toThrow('Empty response from Claude API');
    });
  });
});

describe('LanguageDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new LanguageDetector();
  });

  describe('detectLanguage', () => {
    test('should detect Japanese text', async () => {
      const japaneseText = 'これは日本語のテキストです。';
      const result = await detector.detectLanguage(japaneseText);

      expect(result.language).toBe('ja');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should detect English text', async () => {
      const englishText = 'This is an English text sample with common words like the and and or.';
      const result = await detector.detectLanguage(englishText);

      expect(result.language).toBe('en');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should detect Chinese text', async () => {
      const chineseText = '这是中文文本的例子。';
      const result = await detector.detectLanguage(chineseText);

      expect(result.language).toBe('zh');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should detect Korean text', async () => {
      const koreanText = '이것은 한국어 텍스트 예제입니다.';
      const result = await detector.detectLanguage(koreanText);

      expect(result.language).toBe('ko');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should handle mixed language text', async () => {
      const mixedText = 'Hello こんにちは 你好';
      const result = await detector.detectLanguage(mixedText);

      expect(['en', 'ja', 'zh']).toContain(result.language);
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    test('should handle empty text', async () => {
      const result = await detector.detectLanguage('');

      expect(result.language).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    test('should handle very short text', async () => {
      const result = await detector.detectLanguage('a');

      expect(result.language).toBe('unknown');
      expect(result.confidence).toBeLessThan(0.5);
    });
  });
});

describe('TranslationService', () => {
  let translationService;
  let mockClaudeAPI;

  beforeEach(() => {
    mockClaudeAPI = {
      makeRequest: jest.fn()
    };
    translationService = new TranslationService(mockClaudeAPI);
  });

  describe('translateText', () => {
    test('should translate English to Japanese', async () => {
      const expectedTranslation = '人工知能は現代技術において重要な役割を果たしています。';
      mockClaudeAPI.makeRequest.mockResolvedValueOnce(expectedTranslation);

      const result = await translationService.translateText(
        'Artificial intelligence plays a crucial role in modern technology.',
        'en',
        'ja'
      );

      expect(mockClaudeAPI.makeRequest).toHaveBeenCalledWith(
        expect.stringContaining('英語から日本語に翻訳'),
        expect.any(Object)
      );
      expect(result.translatedText).toBe(expectedTranslation);
      expect(result.sourceLanguage).toBe('en');
      expect(result.targetLanguage).toBe('ja');
    });

    test('should handle translation of titles', async () => {
      const expectedTranslation = 'AIの未来：機械学習の新たなフロンティア';
      mockClaudeAPI.makeRequest.mockResolvedValueOnce(expectedTranslation);

      const result = await translationService.translateText(
        'The Future of AI: New Frontiers in Machine Learning',
        'en',
        'ja',
        { isTitle: true }
      );

      expect(mockClaudeAPI.makeRequest).toHaveBeenCalledWith(
        expect.stringContaining('タイトルとして翻訳'),
        expect.any(Object)
      );
      expect(result.translatedText).toBe(expectedTranslation);
    });

    test('should preserve markdown formatting', async () => {
      const markdownText = '**Important:** This is *emphasized* text.';
      const expectedTranslation = '**重要:** これは*強調された*テキストです。';
      mockClaudeAPI.makeRequest.mockResolvedValueOnce(expectedTranslation);

      const result = await translationService.translateText(
        markdownText,
        'en',
        'ja',
        { preserveMarkdown: true }
      );

      expect(result.translatedText).toBe(expectedTranslation);
      expect(result.translatedText).toContain('**');
      expect(result.translatedText).toContain('*');
    });

    test('should skip translation if already in target language', async () => {
      const japaneseText = 'これは既に日本語のテキストです。';

      const result = await translationService.translateText(
        japaneseText,
        'ja',
        'ja'
      );

      expect(mockClaudeAPI.makeRequest).not.toHaveBeenCalled();
      expect(result.translatedText).toBe(japaneseText);
      expect(result.skipped).toBe(true);
    });

    test('should handle translation errors', async () => {
      mockClaudeAPI.makeRequest.mockRejectedValueOnce(new Error('API Error'));

      await expect(translationService.translateText('test', 'en', 'ja'))
        .rejects.toThrow('Translation failed: API Error');
    });

    test('should handle empty text', async () => {
      const result = await translationService.translateText('', 'en', 'ja');

      expect(result.translatedText).toBe('');
      expect(result.skipped).toBe(true);
    });
  });

  describe('batchTranslate', () => {
    test('should translate multiple texts efficiently', async () => {
      const texts = [
        'Hello world',
        'How are you?',
        'Goodbye'
      ];
      const expectedTranslations = [
        'こんにちは世界',
        '元気ですか？',
        'さようなら'
      ];

      mockClaudeAPI.makeRequest.mockResolvedValueOnce(
        expectedTranslations.join('\n---\n')
      );

      const results = await translationService.batchTranslate(texts, 'en', 'ja');

      expect(results).toHaveLength(3);
      expect(results[0].translatedText).toBe('こんにちは世界');
      expect(results[1].translatedText).toBe('元気ですか？');
      expect(results[2].translatedText).toBe('さようなら');
    });
  });
});

describe('SummaryService', () => {
  let summaryService;
  let mockClaudeAPI;

  beforeEach(() => {
    mockClaudeAPI = {
      makeRequest: jest.fn()
    };
    summaryService = new SummaryService(mockClaudeAPI);
  });

  describe('generateSummary', () => {
    test('should generate article summary', async () => {
      const longArticle = 'This is a very long article about artificial intelligence and its impact on society...'.repeat(10);
      const expectedSummary = `## 記事の要点

- 人工知能が社会に与える影響について解説
- 現代技術における AI の重要性
- 将来的な発展の可能性

## 主な内容

人工知能技術は現代社会において重要な役割を果たしており...`;

      mockClaudeAPI.makeRequest.mockResolvedValueOnce(expectedSummary);

      const result = await summaryService.generateSummary(longArticle);

      expect(mockClaudeAPI.makeRequest).toHaveBeenCalledWith(
        expect.stringContaining('以下の記事の要約を日本語で作成'),
        expect.any(Object)
      );
      expect(result.summary).toBe(expectedSummary);
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.summaryRatio).toBeLessThan(1);
    });

    test('should handle different summary styles', async () => {
      const article = 'Test article content with many words to reach minimum length. '.repeat(10); // Make it long enough
      const expectedBulletSummary = '• ポイント1\n• ポイント2\n• ポイント3';

      mockClaudeAPI.makeRequest.mockResolvedValueOnce(expectedBulletSummary);

      const result = await summaryService.generateSummary(article, {
        style: 'bullet',
        maxLength: 200
      });

      expect(mockClaudeAPI.makeRequest).toHaveBeenCalledWith(
        expect.stringContaining('箇条書き'),
        expect.any(Object)
      );
      expect(result.summary).toBe(expectedBulletSummary);
    });

    test('should skip summary for short articles', async () => {
      const shortArticle = 'This is too short.';

      const result = await summaryService.generateSummary(shortArticle);

      expect(mockClaudeAPI.makeRequest).not.toHaveBeenCalled();
      expect(result.summary).toBe('');
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('Article too short for summary');
    });

    test('should handle summary generation errors', async () => {
      const article = 'Test article content'.repeat(50);
      mockClaudeAPI.makeRequest.mockRejectedValueOnce(new Error('API Error'));

      await expect(summaryService.generateSummary(article))
        .rejects.toThrow('Summary generation failed: API Error');
    });
  });

  describe('generateKeywords', () => {
    test('should extract keywords from article', async () => {
      const article = 'Article about artificial intelligence and machine learning';
      const expectedKeywords = ['人工知能', '機械学習', 'テクノロジー', 'AI'];

      mockClaudeAPI.makeRequest.mockResolvedValueOnce(expectedKeywords.join(', '));

      const result = await summaryService.generateKeywords(article);

      expect(result.keywords).toEqual(expectedKeywords);
      expect(result.count).toBe(4);
    });
  });
});
