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
      expect(content).toContain('## 記事詳細');
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
      expect(tableRows).toHaveLength(3); // header + separator + 2 data rows
      
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
      expect(markdown).toContain('## 記事詳細');
      
      // Check table of contents
      expect(markdown).toContain('[最初の記事](#最初の記事)');
      expect(markdown).toContain('[Technical Deep Dive](#technical-deep-dive)');
      
      // Check article details
      expect(markdown).toContain('### 最初の記事');
      expect(markdown).toContain('### Technical Deep Dive');
      
      // Check translated content handling
      expect(markdown).toContain('翻訳済み内容');
      expect(markdown).toContain('<details>');
      expect(markdown).toContain('<summary>原文を表示</summary>');
    });

    test('should handle empty articles array', async () => {
      const markdown = await markdownGenerator.generateAggregatedMarkdown([], mockSettings);

      expect(markdown).toContain('# ReadLater Articles');
      expect(markdown).toContain('記事はまだ保存されていません');
      expect(markdown).toContain('総記事数: 0件');
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
});