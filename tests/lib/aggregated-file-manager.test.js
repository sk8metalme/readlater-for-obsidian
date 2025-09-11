// Tests for AggregatedFileManager - TDD implementation
const { AggregatedFileManager } = require('../../src/lib/aggregated-file-manager.js');

describe('AggregatedFileManager', () => {
  let fileManager;
  let mockSettings;
  let mockArticleData;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create fresh instance
    fileManager = new AggregatedFileManager();
    
    // Mock settings
    mockSettings = {
      fileName: 'ReadLater_Articles.md',
      maxTableSummaryLength: 100,
      autoBackup: true,
      tableColumns: ['title', 'url', 'summary', 'date']
    };
    
    // Mock article data
    mockArticleData = {
      id: 'article-1',
      title: '記事タイトル',
      originalTitle: 'Original Title',
      url: 'https://example.com/article',
      content: '記事の内容...',
      summary: '記事の要約',
      shortSummary: '短い要約',
      savedDate: new Date('2025-01-15'),
      language: 'ja'
    };
  });

  describe('constructor', () => {
    test('should create instance with default options', () => {
      expect(fileManager).toBeInstanceOf(AggregatedFileManager);
      expect(fileManager.options).toBeDefined();
    });

    test('should accept custom options', () => {
      const customOptions = { encoding: 'utf-8', backup: true };
      const customManager = new AggregatedFileManager(customOptions);
      
      expect(customManager.options).toEqual(expect.objectContaining(customOptions));
    });
  });

  describe('generateFilePath', () => {
    test('should generate correct file path from settings', () => {
      const result = fileManager.generateFilePath(mockSettings);
      expect(result).toBe('ReadLater_Articles.md');
    });

    test('should use default filename when not provided', () => {
      const settingsWithoutName = { ...mockSettings };
      delete settingsWithoutName.fileName;
      
      const result = fileManager.generateFilePath(settingsWithoutName);
      expect(result).toBe('ReadLater_Articles.md'); // default
    });

    test('should sanitize filename to prevent security issues', () => {
      const dangerousSettings = {
        ...mockSettings,
        fileName: '../../../dangerous-file.md'
      };
      
      const result = fileManager.generateFilePath(dangerousSettings);
      expect(result).not.toContain('../');
      expect(result).toMatch(/^[^\/\\]*\.md$/);
    });
  });

  describe('parseExistingFile', () => {
    test('should parse file with existing articles table', async () => {
      const existingContent = `# ReadLater Articles

| タイトル | URL | 要約 | 日時 |
|---------|-----|------|------|
| 既存記事 | https://example.com | 既存要約 | 2025-01-14 |

## 記事詳細

### 既存記事
既存記事の内容...
`;

      const result = await fileManager.parseExistingFile(existingContent);
      
      expect(result).toHaveProperty('tableContent');
      expect(result).toHaveProperty('articles');
      expect(result.articles).toHaveLength(1);
      expect(result.articles[0]).toEqual(expect.objectContaining({
        title: '既存記事',
        url: 'https://example.com'
      }));
    });

    test('should handle empty file content', async () => {
      const result = await fileManager.parseExistingFile('');
      
      expect(result).toHaveProperty('tableContent', '');
      expect(result).toHaveProperty('articles');
      expect(result.articles).toHaveLength(0);
    });

    test('should handle file with no articles table', async () => {
      const contentWithoutTable = '# Some other content\n\nNo table here.';
      
      const result = await fileManager.parseExistingFile(contentWithoutTable);
      
      expect(result.articles).toHaveLength(0);
      expect(result.tableContent).toBe('');
    });
  });

  describe('addArticleToAggregatedFile', () => {
    test('should add article to new aggregated file', async () => {
      // Mock file operations
      const mockReadFile = jest.fn().mockRejectedValue(new Error('File not found'));
      const mockWriteFile = jest.fn().mockResolvedValue({ success: true });
      
      fileManager.readFile = mockReadFile;
      fileManager.writeFile = mockWriteFile;

      const result = await fileManager.addArticleToAggregatedFile(mockArticleData, mockSettings);

      expect(result).toHaveProperty('success', true);
      expect(mockWriteFile).toHaveBeenCalled();
      
      // Verify the content includes table header and article
      const writtenContent = mockWriteFile.mock.calls[0][1];
      expect(writtenContent).toContain('| タイトル | URL | 要約 | 日時 |');
      expect(writtenContent).toContain('記事タイトル');
      expect(writtenContent).toContain('https://example.com/article');
    });

    test('should append article to existing aggregated file', async () => {
      const existingContent = `# ReadLater Articles

| タイトル | URL | 要約 | 日時 |
|---------|-----|------|------|
| 既存記事 | https://old.com | 既存要約 | 2025-01-14 |

## 記事詳細

### 既存記事
既存記事の内容...
`;

      const mockReadFile = jest.fn().mockResolvedValue(existingContent);
      const mockWriteFile = jest.fn().mockResolvedValue({ success: true });
      
      fileManager.readFile = mockReadFile;
      fileManager.writeFile = mockWriteFile;

      const result = await fileManager.addArticleToAggregatedFile(mockArticleData, mockSettings);

      expect(result).toHaveProperty('success', true);
      expect(mockWriteFile).toHaveBeenCalled();
      
      // Verify both old and new articles are present
      const writtenContent = mockWriteFile.mock.calls[0][1];
      expect(writtenContent).toContain('既存記事');
      expect(writtenContent).toContain('記事タイトル');
    });

    test('should handle file operation errors gracefully', async () => {
      const mockReadFile = jest.fn().mockResolvedValue('existing content');
      const mockWriteFile = jest.fn().mockRejectedValue(new Error('Write failed'));
      
      fileManager.readFile = mockReadFile;
      fileManager.writeFile = mockWriteFile;

      await expect(fileManager.addArticleToAggregatedFile(mockArticleData, mockSettings))
        .rejects.toThrow('Write failed');
    });
  });

  describe('createNewAggregatedFile', () => {
    test('should create new file with proper structure', async () => {
      const result = await fileManager.createNewAggregatedFile(mockArticleData, mockSettings);

      expect(result).toContain('# ReadLater Articles');
      expect(result).toContain('| タイトル | URL | 要約 | 日時 |');
      expect(result).toContain('## 記事詳細');
      expect(result).toContain('記事タイトル');
    });

    test('should include article in table and details sections', async () => {
      const result = await fileManager.createNewAggregatedFile(mockArticleData, mockSettings);

      // Check table section
      expect(result).toMatch(/\|\s*記事タイトル\s*\|/);
      expect(result).toMatch(/\|\s*https:\/\/example\.com\/article\s*\|/);
      
      // Check details section
      expect(result).toContain('### 記事タイトル');
      expect(result).toContain('記事の内容...');
    });
  });
});