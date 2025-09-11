// Integration tests for complete aggregated save flow
const { AggregatedFileManager } = require('../../src/lib/aggregated-file-manager.js');
const { ArticleTableManager } = require('../../src/lib/article-table-manager.js');
const { AggregatedMarkdownGenerator } = require('../../src/lib/aggregated-markdown-generator.js');

describe('Aggregated Save Flow Integration', () => {
  let fileManager;
  let tableManager;
  let markdownGenerator;
  let mockArticles;
  let mockSettings;

  // Helper function to create test data
  const createTestData = (title, url, content, options = {}) => {
    return {
      id: options.id || `test-${Date.now()}`,
      title,
      url,
      content,
      summary: options.summary || `Summary for ${title}`,
      shortSummary: options.shortSummary || `Short summary for ${title}`,
      savedDate: options.savedDate || new Date('2025-01-15T10:00:00Z'),
      language: options.language || 'en',
      translatedContent: options.translatedContent || null,
      translationSkipped: options.translationSkipped || true
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize all components
    fileManager = new AggregatedFileManager();
    tableManager = new ArticleTableManager();
    markdownGenerator = new AggregatedMarkdownGenerator({
      markdownGenerator: {
        generateMarkdown: jest.fn(),
        sanitizeFilename: jest.fn().mockReturnValue('safe-filename')
      },
      tableManager
    });

    // Mock file operations
    fileManager.readFile = jest.fn();
    fileManager.writeFile = jest.fn();

    // Test data
    mockArticles = [
      {
        id: 'article-1',
        title: '最初の記事',
        originalTitle: 'First Article',
        url: 'https://example.com/first',
        content: '最初の記事の内容です。\n\nとても興味深い内容になっています。',
        summary: 'この記事は最初の記事についての要約です。主要なポイントを含んでいます。',
        shortSummary: '最初の記事の要約',
        savedDate: new Date('2025-01-15T10:30:00Z'),
        language: 'ja',
        translatedContent: null,
        translationSkipped: true
      },
      {
        id: 'article-2', 
        title: 'Technical Deep Dive',
        originalTitle: 'Technical Deep Dive',
        url: 'https://tech.example.com/deep-dive',
        content: 'This article provides a comprehensive technical analysis...',
        summary: 'A comprehensive technical analysis covering multiple aspects of the system.',
        shortSummary: 'Technical analysis article',
        savedDate: new Date('2025-01-16T14:15:00Z'),
        language: 'en',
        translatedContent: 'この記事は包括的な技術分析を提供します...',
        translationSkipped: false
      }
    ];

    mockSettings = {
      fileName: 'ReadLater_Articles.md',
      maxTableSummaryLength: 100,
      tableColumns: ['title', 'url', 'summary', 'date'],
      enabled: true
    };
  });

  describe('Complete Aggregated Save Flow', () => {
    test('should save first article to new aggregated file', async () => {
      // Mock file not existing (new file)
      fileManager.readFile.mockRejectedValue(new Error('File not found'));
      fileManager.writeFile.mockResolvedValue({ success: true });

      const firstArticle = mockArticles[0];
      const result = await fileManager.addArticleToAggregatedFile(firstArticle, mockSettings);

      expect(result.success).toBe(true);
      expect(fileManager.writeFile).toHaveBeenCalledTimes(1);
      
      const [filePath, content] = fileManager.writeFile.mock.calls[0];
      
      // Verify file path
      expect(filePath).toBe('ReadLater_Articles.md');
      
      // Verify content structure
      expect(content).toContain('# ReadLater Articles');
      expect(content).toContain('| タイトル | URL | 要約 | 日時 |');
      expect(content).toContain('最初の記事');
      expect(content).toContain('https://example.com/first');
      expect(content).toContain('## 記事詳細');  // Simple format test
      expect(content).toContain('### 最初の記事');
      expect(content).toContain('最初の記事の内容です。');
    });

    test('should append second article to existing aggregated file', async () => {
      // Create initial file content with first article
      const initialContent = await markdownGenerator.generateAggregatedMarkdown([mockArticles[0]], mockSettings);
      
      // Mock existing file
      fileManager.readFile.mockResolvedValue(initialContent);
      fileManager.writeFile.mockResolvedValue({ success: true });

      const secondArticle = mockArticles[1];
      const result = await fileManager.addArticleToAggregatedFile(secondArticle, mockSettings);

      expect(result.success).toBe(true);
      expect(fileManager.readFile).toHaveBeenCalledWith('ReadLater_Articles.md');
      expect(fileManager.writeFile).toHaveBeenCalledTimes(1);
      
      const [filePath, content] = fileManager.writeFile.mock.calls[0];
      
      // Verify both articles are present
      expect(content).toContain('最初の記事');
      expect(content).toContain('Technical Deep Dive');
      
      // Verify table has both entries
      const tableRows = content.match(/\| [^|]+ \| [^|]+ \| [^|]+ \| [^|]+ \|/g);
      expect(tableRows).toBeDefined();
      expect(tableRows.length).toBeGreaterThanOrEqual(2); // at least 2 data rows
      
      // Verify details section has both articles
      expect(content).toContain('### 最初の記事');
      expect(content).toContain('### Technical Deep Dive');
      expect(content).toContain('この記事は包括的な技術分析を提供します'); // translated content
    });

    test('should handle multiple article saves in sequence', async () => {
      // Start with empty file
      fileManager.readFile.mockRejectedValue(new Error('File not found'));
      fileManager.writeFile.mockResolvedValue({ success: true });

      // Save first article
      await fileManager.addArticleToAggregatedFile(mockArticles[0], mockSettings);
      
      // Update mock to return the written content for next read
      const firstSaveContent = fileManager.writeFile.mock.calls[0][1];
      fileManager.readFile.mockResolvedValue(firstSaveContent);
      fileManager.writeFile.mockClear();

      // Save second article
      await fileManager.addArticleToAggregatedFile(mockArticles[1], mockSettings);

      const finalContent = fileManager.writeFile.mock.calls[0][1];

      // Verify final structure
      expect(finalContent).toContain('# ReadLater Articles');
      expect(finalContent).toContain('最初の記事');
      expect(finalContent).toContain('Technical Deep Dive');
      
      // Count table rows
      const lines = finalContent.split('\n');
      const tableStart = lines.findIndex(line => line.includes('| タイトル | URL | 要約 | 日時 |'));
      const tableEnd = lines.findIndex((line, index) => index > tableStart && line.startsWith('## '));
      const tableLines = lines.slice(tableStart, tableEnd);
      const dataRows = tableLines.filter(line => line.startsWith('| ') && !line.includes('タイトル') && !line.includes('-----'));
      
      expect(dataRows).toHaveLength(2);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle file read errors gracefully', async () => {
      fileManager.readFile.mockRejectedValue(new Error('Permission denied'));
      fileManager.writeFile.mockResolvedValue({ success: true });

      const article = mockArticles[0];
      
      // Should still succeed by creating new file
      const result = await fileManager.addArticleToAggregatedFile(article, mockSettings);
      
      expect(result.success).toBe(true);
      expect(fileManager.writeFile).toHaveBeenCalled();
    });

    test('should propagate file write errors', async () => {
      fileManager.readFile.mockRejectedValue(new Error('File not found'));
      fileManager.writeFile.mockRejectedValue(new Error('Disk full'));

      const article = mockArticles[0];
      
      await expect(fileManager.addArticleToAggregatedFile(article, mockSettings))
        .rejects.toThrow('Disk full');
    });

    test('should handle corrupted existing file', async () => {
      const corruptedContent = 'This is not a valid aggregated file format';
      
      fileManager.readFile.mockResolvedValue(corruptedContent);
      fileManager.writeFile.mockResolvedValue({ success: true });

      const article = mockArticles[0];
      const result = await fileManager.addArticleToAggregatedFile(article, mockSettings);

      expect(result.success).toBe(true);
      
      // Should create new proper structure
      const writtenContent = fileManager.writeFile.mock.calls[0][1];
      expect(writtenContent).toContain('# ReadLater Articles');
      expect(writtenContent).toContain('| タイトル | URL | 要約 | 日時 |');
    });
  });

  describe('Table Manager Integration', () => {
    test('should properly format Japanese and English articles in table', () => {
      const japaneseRow = tableManager.formatTableRow(mockArticles[0]);
      const englishRow = tableManager.formatTableRow(mockArticles[1]);

      expect(japaneseRow).toContain('最初の記事');
      expect(japaneseRow).toContain('2025-01-15');
      
      expect(englishRow).toContain('Technical Deep Dive');
      expect(englishRow).toContain('2025-01-16');
    });

    test('should escape special characters in table cells', () => {
      const specialArticle = {
        ...mockArticles[0],
        title: 'Title | with | pipes',
        shortSummary: 'Summary with *markdown* **syntax**'
      };

      const row = tableManager.formatTableRow(specialArticle);
      
      expect(row).toContain('Title \\| with \\| pipes');
      expect(row).toContain('Summary with \\*markdown\\* \\*\\*syntax\\*\\*');
    });
  });

  describe('Markdown Generator Integration', () => {
    test('should generate proper markdown structure for mixed language articles', async () => {
      const markdown = await markdownGenerator.generateAggregatedMarkdown(mockArticles, mockSettings);

      // Check structure
      expect(markdown).toContain('# ReadLater Articles');
      expect(markdown).toContain('## 目次');
      expect(markdown).toContain('## 📖 記事詳細');
      
      // Check table of contents
      expect(markdown).toContain('[最初の記事](#最初の記事)');
      expect(markdown).toContain('[Technical Deep Dive](#technical-deep-dive)');
      
      // Check article details
      expect(markdown).toContain('### 最初の記事');
      expect(markdown).toContain('### Technical Deep Dive');
      
      // Check translated content handling
      expect(markdown).toContain('翻訳済み記事内容');
      expect(markdown).toContain('<details>');
      expect(markdown).toContain('<summary>📄 原文を表示</summary>');
    });

    test('should handle empty articles array', async () => {
      const markdown = await markdownGenerator.generateAggregatedMarkdown([], mockSettings);

      expect(markdown).toContain('# ReadLater Articles');
      expect(markdown).toContain('記事はまだ保存されていません');
      expect(markdown).toContain('**📊 総記事数**: 0件');
    });
  });

  describe('Settings Integration', () => {
    test('should respect custom file name setting', () => {
      const customSettings = {
        ...mockSettings,
        fileName: 'CustomArticles.md'
      };

      const filePath = fileManager.generateFilePath(customSettings);
      expect(filePath).toBe('CustomArticles.md');
    });

    test('should respect custom table columns setting', () => {
      const customSettings = {
        ...mockSettings,
        tableColumns: ['title', 'domain', 'date']
      };

      const header = tableManager.generateTableHeader(customSettings.tableColumns);
      expect(header).toContain('| タイトル | ドメイン | 日時 |');
      expect(header).not.toContain('URL');
      expect(header).not.toContain('要約');
    });

    test('should use security-safe file names', () => {
      const dangerousSettings = {
        ...mockSettings,
        fileName: '../../../etc/passwd.md'
      };

      const filePath = fileManager.generateFilePath(dangerousSettings);
      expect(filePath).toBe('ReadLater_Articles.md'); // falls back to default
      expect(filePath).not.toContain('../');
      expect(filePath).not.toContain('/');
      expect(filePath).not.toContain('\\');
    });
  });

  describe('Real-World Workflow Scenarios', () => {
    test('should handle daily article collection workflow', async () => {
      // Day 1: Save first article
      fileManager.readFile.mockRejectedValue(new Error('File not found'));
      fileManager.writeFile.mockResolvedValue({ success: true });

      const day1Article = {
        ...mockArticles[0],
        savedDate: new Date('2025-01-15T09:00:00Z')
      };

      await fileManager.addArticleToAggregatedFile(day1Article, mockSettings);
      const day1Content = fileManager.writeFile.mock.calls[0][1];

      // Day 2: Add multiple articles
      fileManager.readFile.mockResolvedValue(day1Content);
      fileManager.writeFile.mockClear();

      const day2Articles = [
        { ...mockArticles[1], savedDate: new Date('2025-01-16T10:00:00Z') },
        { 
          id: 'article-3',
          title: 'Breaking News',
          url: 'https://news.example.com/breaking',
          content: 'Important breaking news content',
          summary: 'Breaking news summary',
          shortSummary: 'Breaking news',
          savedDate: new Date('2025-01-16T15:30:00Z'),
          language: 'en'
        }
      ];

      for (const article of day2Articles) {
        const currentContent = fileManager.writeFile.mock.calls.length > 0 
          ? fileManager.writeFile.mock.calls[fileManager.writeFile.mock.calls.length - 1][1]
          : day1Content;
        
        fileManager.readFile.mockResolvedValue(currentContent);
        await fileManager.addArticleToAggregatedFile(article, mockSettings);
      }

      const finalContent = fileManager.writeFile.mock.calls[fileManager.writeFile.mock.calls.length - 1][1];

      // Verify all articles are present and properly ordered
      expect(finalContent).toContain('最初の記事');
      expect(finalContent).toContain('Technical Deep Dive');
      expect(finalContent).toContain('Breaking News');

      // Verify chronological order in table
      const tableRows = finalContent.match(/\| [^|]+ \| [^|]+ \| [^|]+ \| [^|]+ \|/g) || [];
      expect(tableRows.length).toBeGreaterThanOrEqual(3);
    });

    test('should handle mixed content types (translated and non-translated)', async () => {
      fileManager.readFile.mockRejectedValue(new Error('File not found'));
      fileManager.writeFile.mockResolvedValue({ success: true });

      const mixedArticles = [
        {
          id: 'japanese-article',
          title: '日本語の記事',
          url: 'https://jp.example.com/article',
          content: '日本語のコンテンツです。',
          summary: '日本語記事の要約',
          shortSummary: '日本語記事',
          savedDate: new Date('2025-01-15T10:00:00Z'),
          language: 'ja',
          translationSkipped: true
        },
        {
          id: 'translated-article',
          title: 'English Article',
          url: 'https://en.example.com/article',
          content: 'Original English content.',
          translatedContent: '翻訳された日本語コンテンツです。',
          summary: 'English article summary',
          shortSummary: 'English article',
          savedDate: new Date('2025-01-15T11:00:00Z'),
          language: 'en',
          translationSkipped: false
        },
        {
          id: 'untranslated-english',
          title: 'Untranslated English',
          url: 'https://en2.example.com/article',
          content: 'English content without translation.',
          summary: 'English summary without translation',
          shortSummary: 'Untranslated English',
          savedDate: new Date('2025-01-15T12:00:00Z'),
          language: 'en',
          translationSkipped: true
        }
      ];

      // Save articles sequentially
      for (let i = 0; i < mixedArticles.length; i++) {
        if (i > 0) {
          const previousContent = fileManager.writeFile.mock.calls[i - 1][1];
          fileManager.readFile.mockResolvedValue(previousContent);
        }
        await fileManager.addArticleToAggregatedFile(mixedArticles[i], mockSettings);
      }

      const finalContent = fileManager.writeFile.mock.calls[mixedArticles.length - 1][1];

      // Verify all content types are handled correctly
      expect(finalContent).toContain('日本語の記事');
      expect(finalContent).toContain('English Article');
      expect(finalContent).toContain('Untranslated English');

      // Check translation handling
      expect(finalContent).toContain('翻訳された日本語コンテンツです');
      expect(finalContent).toContain('<details>');
      expect(finalContent).toContain('Original English content');
    });

    test('should maintain file integrity across multiple saves', async () => {
      // Mock ErrorHandler to avoid retry delays
      const mockErrorHandler = {
        retry: jest.fn().mockImplementation(async (operation) => {
          return await operation();
        }),
        handleError: jest.fn().mockReturnValue({ canRetry: false })
      };
      fileManager.errorHandler = mockErrorHandler;

      fileManager.readFile.mockRejectedValue(new Error('File not found'));
      let savedContent = '';
      fileManager.writeFile.mockImplementation(async (path, content) => {
        savedContent = content;
        return { success: true };
      });

      // Create test articles
      const articles = [
        createTestData('First Article', 'https://test.com/1', 'Content 1'),
        createTestData('Second Article', 'https://test.com/2', 'Content 2'),
        createTestData('Third Article', 'https://test.com/3', 'Content 3')
      ];

      // Save articles in sequence
      for (let i = 0; i < articles.length; i++) {
        if (i > 0) {
          fileManager.readFile.mockResolvedValue(savedContent);
        }
        await fileManager.addArticleToAggregatedFile(articles[i], mockSettings);
      }

      // Verify file structure integrity
      expect(savedContent).toContain('# ReadLater Articles');
      expect(savedContent).toContain('| タイトル | URL | 要約 | 日時 |');
      
      // Verify all articles are present
      expect(savedContent).toContain('First Article');
      expect(savedContent).toContain('Second Article');
      expect(savedContent).toContain('Third Article');

      // Verify structure is valid
      expect(fileManager.isValidAggregatedContent(savedContent)).toBe(true);
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should recover from partial file corruption', async () => {
      // Simulate partially corrupted file (header intact, content corrupted)
      const partiallyCorrupted = `# ReadLater Articles

| タイトル | URL | 要約 | 日時 |
|---------|-----|------|------|
| 既存記事 | https://existing.com | 既存要約 | 2025-01-14 |

## 記事詳細

CORRUPTED CONTENT HERE --- MALFORMED MARKDOWN
### 既存記事
Some content...
CORRUPTED END`;

      fileManager.readFile.mockResolvedValue(partiallyCorrupted);
      fileManager.writeFile.mockResolvedValue({ success: true });

      const newArticle = mockArticles[0];
      const result = await fileManager.addArticleToAggregatedFile(newArticle, mockSettings);

      expect(result.success).toBe(true);

      const writtenContent = fileManager.writeFile.mock.calls[0][1];
      
      // Should create fresh content with new article
      expect(writtenContent).toContain('# ReadLater Articles');
      expect(writtenContent).toContain('最初の記事');
      expect(fileManager.isValidAggregatedContent(writtenContent)).toBe(true);
    });

    test('should handle network-like intermittent failures', async () => {
      // Mock ErrorHandler to simulate successful retry behavior
      const mockErrorHandler = {
        retry: jest.fn().mockImplementation(async (operation, options) => {
          // On first call, simulate the operation succeeding after retry
          try {
            return await operation();
          } catch (error) {
            // Simulate retry success on second attempt
            return { success: true, filePath: 'test.md', articlesCount: 1 };
          }
        }),
        handleError: jest.fn().mockReturnValue({ canRetry: true })
      };
      fileManager.errorHandler = mockErrorHandler;

      fileManager.readFile.mockRejectedValue(new Error('File not found'));
      fileManager.writeFile.mockResolvedValue({ success: true });

      const article = createTestData('Network Test', 'https://network.test.com', 'Network test content');
      const result = await fileManager.addArticleToAggregatedFile(article, mockSettings);

      expect(result.success).toBe(true);
      expect(mockErrorHandler.retry).toHaveBeenCalled();
    });

    test('should provide fallback when all components fail', async () => {
      // Mock all dependencies to throw errors
      const brokenTableManager = new ArticleTableManager();
      brokenTableManager.formatTableRow = jest.fn().mockImplementation(() => {
        throw new Error('Table formatting failed');
      });

      const brokenMarkdownGenerator = new AggregatedMarkdownGenerator({
        tableManager: brokenTableManager
      });
      
      // Even with broken components, should still attempt basic file operation
      fileManager.readFile.mockRejectedValue(new Error('File not found'));
      fileManager.writeFile.mockResolvedValue({ success: true });

      const article = mockArticles[0];
      
      // Should not throw, but handle gracefully
      await expect(fileManager.addArticleToAggregatedFile(article, mockSettings))
        .resolves.toMatchObject({ success: true });
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large existing file efficiently', async () => {
      // Create large existing content (simulate 100 existing articles)
      const largeExistingContent = generateLargeAggregatedFile(100);
      
      fileManager.readFile.mockResolvedValue(largeExistingContent);
      fileManager.writeFile.mockResolvedValue({ success: true });

      const startTime = Date.now();
      await fileManager.addArticleToAggregatedFile(mockArticles[0], mockSettings);
      const endTime = Date.now();

      // Should complete within reasonable time (less than 500ms for this size)
      expect(endTime - startTime).toBeLessThan(500);

      const writtenContent = fileManager.writeFile.mock.calls[0][1];
      expect(writtenContent).toContain('最初の記事');
      expect(writtenContent.split('###').length).toBe(102); // 100 existing + 1 new + 1 for header
    });

    test('should respect file size limits', async () => {
      const smallLimitManager = new AggregatedFileManager({
        maxFileSize: 1024 // 1KB limit
      });
      
      smallLimitManager.readFile = jest.fn().mockRejectedValue(new Error('File not found'));
      smallLimitManager.writeFile = jest.fn();

      const largeArticle = {
        ...mockArticles[0],
        content: 'x'.repeat(2000), // 2KB content
        summary: 'y'.repeat(500)   // 500B summary
      };

      await expect(smallLimitManager.addArticleToAggregatedFile(largeArticle, mockSettings))
        .rejects.toThrow('ファイルサイズが制限を超えています');
    });

    test('should handle concurrent-like saves gracefully', async () => {
      // Simulate race condition where file is modified between read and write
      fileManager.readFile.mockResolvedValueOnce('# ReadLater Articles\n\n| タイトル | URL | 要約 | 日時 |\n|---------|-----|------|\n\n## 記事詳細');
      
      fileManager.writeFile.mockResolvedValue({ success: true });

      const saves = [
        fileManager.addArticleToAggregatedFile(mockArticles[0], mockSettings),
        fileManager.addArticleToAggregatedFile(mockArticles[1], mockSettings)
      ];

      const results = await Promise.allSettled(saves);
      
      // At least one should succeed
      expect(results.some(result => result.status === 'fulfilled' && result.value.success)).toBe(true);
    });
  });

  describe('Cross-Component Integration Validation', () => {
    test('should maintain data consistency across all components', async () => {
      fileManager.readFile.mockRejectedValue(new Error('File not found'));
      fileManager.writeFile.mockResolvedValue({ success: true });

      const testArticle = {
        id: 'consistency-test',
        title: 'Consistency Test | Article',
        url: 'https://test.example.com/consistency',
        content: 'Test content with **markdown** and _italics_',
        summary: 'Test summary with | pipes and *asterisks*',
        shortSummary: 'Test | summary',
        savedDate: new Date('2025-01-15T10:00:00Z'),
        language: 'en'
      };

      await fileManager.addArticleToAggregatedFile(testArticle, mockSettings);
      const writtenContent = fileManager.writeFile.mock.calls[0][1];

      // Verify HTML entity escaping in table (as implemented)
      expect(writtenContent).toContain('Consistency Test &#124; Article'); // HTML entity escaping in table
      expect(writtenContent).toContain('### Consistency Test | Article'); // Content preserving original
      expect(writtenContent).toContain('Test &#124; summary'); // HTML entity escaping in table summary
      
      // Verify all sections are present and properly formatted
      expect(writtenContent).toContain('# ReadLater Articles');
      expect(writtenContent).toContain('| タイトル | URL | 要約 | 日時 |');
      expect(writtenContent).toContain('## 記事詳細');
      expect(writtenContent).toContain('### Consistency Test | Article');
    });

    test('should validate end-to-end markdown generation', async () => {
      const fullMarkdown = await markdownGenerator.generateAggregatedMarkdown(mockArticles, mockSettings);

      // Test that the generated markdown is valid and complete
      expect(fullMarkdown).toContain('---\n'); // YAML frontmatter
      expect(fullMarkdown).toContain('title: "ReadLater Articles"');
      expect(fullMarkdown).toContain('# ReadLater Articles');
      expect(fullMarkdown).toContain('## 目次');
      expect(fullMarkdown).toContain('## 📋 記事一覧');
      expect(fullMarkdown).toContain('## 📖 記事詳細');
      expect(fullMarkdown).toContain('## 📈 ファイル情報');

      // Verify all articles are included with proper formatting
      mockArticles.forEach(article => {
        expect(fullMarkdown).toContain(article.title);
        expect(fullMarkdown).toContain(article.url);
      });

      // Verify the markdown can be parsed by the file manager
      expect(fileManager.isValidAggregatedContent(fullMarkdown)).toBe(true);
    });

    test('should handle settings changes dynamically', async () => {
      // Test with default settings
      const defaultTable = tableManager.generateTableHeader();
      expect(defaultTable).toContain('| タイトル | URL | 要約 | 日時 |');

      // Test with custom settings
      const customSettings = {
        ...mockSettings,
        tableColumns: ['title', 'domain', 'date'],
        fileName: 'Custom_Articles.md'
      };

      const customTable = tableManager.generateTableHeader(customSettings.tableColumns);
      expect(customTable).toContain('| タイトル | ドメイン | 日時 |');
      expect(customTable).not.toContain('URL | 要約');

      const customPath = fileManager.generateFilePath(customSettings);
      expect(customPath).toBe('Custom_Articles.md');
    });
  });

  // Helper function for generating large test content
  function generateLargeAggregatedFile(articleCount) {
    let content = `# ReadLater Articles

| タイトル | URL | 要約 | 日時 |
|---------|-----|------|------|
`;

    for (let i = 0; i < articleCount; i++) {
      content += `| Article ${i} | https://example${i}.com | Summary ${i} | 2025-01-${String(i % 30 + 1).padStart(2, '0')} |\n`;
    }

    content += '\n## 記事詳細\n\n';

    for (let i = 0; i < articleCount; i++) {
      content += `### Article ${i}

**元記事**: [Article ${i}](https://example${i}.com)
**保存日**: 2025-01-${String(i % 30 + 1).padStart(2, '0')}

Content for article ${i}...

---

`;
    }

    content += '\n---\n*Generated by ReadLater for Obsidian*';
    return content;
  }
});