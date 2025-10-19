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
      
      // Mock error handler to avoid retries during testing
      fileManager.errorHandler.retry = jest.fn().mockImplementation(async (operation) => {
        return await operation();
      });

      await expect(fileManager.addArticleToAggregatedFile(mockArticleData, mockSettings))
        .rejects.toThrow('Write failed');
    }, 10000);
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

  describe('appendArticleToExisting', () => {
    test('should append article to existing content correctly', async () => {
      const existingContent = `# ReadLater Articles

| タイトル | URL | 要約 | 日時 |
|---------|-----|------|------|
| 既存記事 | https://old.com | 既存要約 | 2025-01-14 |

## 記事詳細

### 既存記事
既存記事の内容...
`;

      const parsedFile = await fileManager.parseExistingFile(existingContent);
      const result = await fileManager.appendArticleToExisting(
        existingContent, 
        mockArticleData, 
        mockSettings, 
        parsedFile
      );

      expect(result).toContain('既存記事');
      expect(result).toContain('記事タイトル');
      expect(result).toContain('https://example.com/article');
    });

    test('should handle special characters in article data', async () => {
      const articleWithSpecialChars = {
        ...mockArticleData,
        title: 'タイトル|特殊文字<script>',
        summary: 'まとめ|パイプ文字\n改行文字'
      };

      const existingContent = '# ReadLater Articles\n\n| タイトル | URL | 要約 | 日時 |\n|---------|-----|------|------|\n\n## 記事詳細\n';
      const parsedFile = await fileManager.parseExistingFile(existingContent);
      
      const result = await fileManager.appendArticleToExisting(
        existingContent, 
        articleWithSpecialChars, 
        mockSettings, 
        parsedFile
      );

      expect(result).toContain('&#124;'); // Escaped pipe character in table
      expect(result).toContain('タイトル|特殊文字<script>'); // Original title in content section
      expect(result).toContain('まとめ|パイプ文字'); // Summary content preserved
    });

    test('should handle translated content properly', async () => {
      const articleWithTranslation = {
        ...mockArticleData,
        translatedContent: '翻訳された内容です',
        translationSkipped: false,
        content: 'Original English content'
      };

      const existingContent = '# ReadLater Articles\n\n| タイトル | URL | 要約 | 日時 |\n|---------|-----|------|------|\n\n## 記事詳細\n';
      const parsedFile = await fileManager.parseExistingFile(existingContent);
      
      const result = await fileManager.appendArticleToExisting(
        existingContent, 
        articleWithTranslation, 
        mockSettings, 
        parsedFile
      );

      expect(result).toContain('翻訳された内容です');
      expect(result).toContain('<details>');
      expect(result).toContain('Original English content');
    });

    test('should handle missing savedDate', async () => {
      const articleWithoutDate = {
        ...mockArticleData
      };
      delete articleWithoutDate.savedDate;

      const existingContent = '# ReadLater Articles\n\n| タイトル | URL | 要約 | 日時 |\n|---------|-----|------|------|\n\n## 記事詳細\n';
      const parsedFile = await fileManager.parseExistingFile(existingContent);
      
      const result = await fileManager.appendArticleToExisting(
        existingContent, 
        articleWithoutDate, 
        mockSettings, 
        parsedFile
      );

      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/); // Should contain a date
    });
  });

  describe('isValidAggregatedContent', () => {
    test('should validate simple aggregated content', () => {
      const validContent = `# ReadLater Articles

| タイトル | URL | 要約 | 日時 |
|---------|-----|------|------|

## 記事詳細
`;

      expect(fileManager.isValidAggregatedContent(validContent)).toBe(true);
    });

    test('should validate enhanced aggregated content with frontmatter', () => {
      const validContentWithFrontmatter = `---
title: "ReadLater Articles"
type: "aggregated-articles"
---

# ReadLater Articles

| タイトル | URL | 要約 | 日時 |
|---------|-----|------|------|

## 📖 記事詳細
`;

      expect(fileManager.isValidAggregatedContent(validContentWithFrontmatter)).toBe(true);
    });

    test('should reject invalid content', () => {
      expect(fileManager.isValidAggregatedContent('')).toBe(false);
      expect(fileManager.isValidAggregatedContent(null)).toBe(false);
      expect(fileManager.isValidAggregatedContent('Just some text')).toBe(false);
    });

    test('should validate content with only table', () => {
      const contentWithOnlyTable = `# ReadLater Articles

| タイトル | URL | 要約 | 日時 |
|---------|-----|------|------|
| 記事 | URL | 要約 | 日時 |
`;

      expect(fileManager.isValidAggregatedContent(contentWithOnlyTable)).toBe(true);
    });

    test('should validate content with only details section', () => {
      const contentWithOnlyDetails = `# ReadLater Articles

## 記事詳細

### 記事タイトル
記事内容...
`;

      expect(fileManager.isValidAggregatedContent(contentWithOnlyDetails)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle null article data', async () => {
      const mockWriteFile = jest.fn();
      fileManager.writeFile = mockWriteFile;
      fileManager.errorHandler.retry = jest.fn().mockImplementation(async (operation) => {
        return await operation();
      });

      await expect(fileManager.addArticleToAggregatedFile(null, mockSettings))
        .rejects.toThrow('記事データが不完全です');
    });

    test('should handle missing article title', async () => {
      const incompleteArticle = {
        ...mockArticleData
      };
      delete incompleteArticle.title;

      const mockWriteFile = jest.fn();
      fileManager.writeFile = mockWriteFile;
      fileManager.errorHandler.retry = jest.fn().mockImplementation(async (operation) => {
        return await operation();
      });

      await expect(fileManager.addArticleToAggregatedFile(incompleteArticle, mockSettings))
        .rejects.toThrow('記事データが不完全です');
    });

    test('should handle missing settings', async () => {
      const mockWriteFile = jest.fn();
      fileManager.writeFile = mockWriteFile;
      fileManager.errorHandler.retry = jest.fn().mockImplementation(async (operation) => {
        return await operation();
      });

      await expect(fileManager.addArticleToAggregatedFile(mockArticleData, null))
        .rejects.toThrow('設定データが不完全です');
    });

    test('should handle file size limits', async () => {
      const mockReadFile = jest.fn().mockRejectedValue(new Error('File not found'));
      const mockWriteFile = jest.fn();
      fileManager.readFile = mockReadFile;
      fileManager.writeFile = mockWriteFile;
      
      // Set small file size limit
      fileManager.options.maxFileSize = 10; // Very small limit

      fileManager.errorHandler.retry = jest.fn().mockImplementation(async (operation) => {
        return await operation();
      });

      await expect(fileManager.addArticleToAggregatedFile(mockArticleData, mockSettings))
        .rejects.toThrow('ファイルサイズが制限を超えています');
    });

    test('should handle corrupted existing file gracefully', async () => {
      const corruptedContent = 'This is not a valid aggregated file format at all';
      const mockReadFile = jest.fn().mockResolvedValue(corruptedContent);
      const mockWriteFile = jest.fn().mockResolvedValue({ success: true });
      
      fileManager.readFile = mockReadFile;
      fileManager.writeFile = mockWriteFile;

      const result = await fileManager.addArticleToAggregatedFile(mockArticleData, mockSettings);

      expect(result.success).toBe(true);
      // Should create new file when existing file is invalid
      const writtenContent = mockWriteFile.mock.calls[0][1];
      expect(writtenContent).toContain('# ReadLater Articles');
      expect(writtenContent).toContain('記事タイトル');
    });

    test('should handle parsing errors gracefully', async () => {
      const contentThatCausesParsingError = `# ReadLater Articles
| Malformed table without proper structure
Random content that doesn't match pattern
`;

      const result = await fileManager.parseExistingFile(contentThatCausesParsingError);
      
      expect(result).toHaveProperty('tableContent', '');
      expect(result).toHaveProperty('articles');
      expect(result.articles).toHaveLength(0);
    });

    test('should handle very large article content', async () => {
      const largeArticle = {
        ...mockArticleData,
        content: 'x'.repeat(1000000), // 1MB of content
        summary: 'y'.repeat(10000)    // 10KB summary
      };

      const mockReadFile = jest.fn().mockRejectedValue(new Error('File not found'));
      const mockWriteFile = jest.fn().mockResolvedValue({ success: true });
      
      fileManager.readFile = mockReadFile;
      fileManager.writeFile = mockWriteFile;

      const result = await fileManager.addArticleToAggregatedFile(largeArticle, mockSettings);

      expect(result.success).toBe(true);
      const writtenContent = mockWriteFile.mock.calls[0][1];
      expect(writtenContent.length).toBeLessThan(fileManager.options.maxFileSize);
    });

    test('should handle empty table content in parsing', async () => {
      const contentWithEmptyTable = `# ReadLater Articles

| タイトル | URL | 要約 | 日時 |
|---------|-----|------|------|

## 記事詳細
`;

      const result = await fileManager.parseExistingFile(contentWithEmptyTable);
      
      expect(result.tableContent).toContain('| タイトル | URL | 要約 | 日時 |');
      expect(result.articles).toHaveLength(0);
    });

    test('should handle malformed table rows', async () => {
      const contentWithMalformedTable = `# ReadLater Articles

| タイトル | URL | 要約 | 日時 |
|---------|-----|------|------|
| 正常な記事 | https://normal.com | 正常 | 2025-01-15 |
| 不正な記事 | incomplete row
| | | | |
| もう一つの正常記事 | https://another.com | 正常2 | 2025-01-16 |

## 記事詳細
`;

      const result = await fileManager.parseExistingFile(contentWithMalformedTable);
      
      expect(result.articles).toHaveLength(2); // Should only parse valid rows
      expect(result.articles[0].title).toBe('正常な記事');
      expect(result.articles[1].title).toBe('もう一つの正常記事');
    });
  });

  describe('File Operation Integration', () => {
    test('should call error handler retry method', async () => {
      const mockWriteFile = jest.fn().mockRejectedValue(new Error('Write failed'));
      const mockReadFile = jest.fn().mockRejectedValue(new Error('File not found'));
      
      fileManager.readFile = mockReadFile;
      fileManager.writeFile = mockWriteFile;
      
      // Mock retry to just execute once without delay
      const mockRetry = jest.fn().mockImplementation(async (operation) => {
        return await operation();
      });
      fileManager.errorHandler.retry = mockRetry;

      await expect(fileManager.addArticleToAggregatedFile(mockArticleData, mockSettings))
        .rejects.toThrow('Write failed');
        
      expect(mockRetry).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ maxRetries: 2, delay: 500 })
      );
    });

    test('should handle file operations failure gracefully', async () => {
      const mockWriteFile = jest.fn().mockRejectedValue(new Error('Disk full'));
      const mockReadFile = jest.fn().mockRejectedValue(new Error('File not found'));
      
      fileManager.readFile = mockReadFile;
      fileManager.writeFile = mockWriteFile;
      
      // Disable retry for fast test
      fileManager.errorHandler.retry = jest.fn().mockImplementation(async (operation) => {
        return await operation();
      });

      await expect(fileManager.addArticleToAggregatedFile(mockArticleData, mockSettings))
        .rejects.toThrow('Disk full');
    });
  });

  describe('Data Sanitization and Security', () => {
    test('should escape HTML in article content', async () => {
      const articleWithHtml = {
        ...mockArticleData,
        title: 'Article with <script>alert("xss")</script>',
        content: '<img src="x" onerror="alert(1)">',
        summary: '<b>Bold</b> summary'
      };

      const result = await fileManager.createNewAggregatedFile(articleWithHtml, mockSettings);

      // Content should be preserved but title in table should be escaped
      expect(result).toContain('Article with <script>alert("xss")</script>'); // In content
      expect(result).toMatch(/Article with.*script.*alert.*xss.*script/); // In table (escaped)
    });

    test('should handle filename security', () => {
      const dangerousSettings = [
        { fileName: '../../etc/passwd' },
        { fileName: 'C:\\Windows\\System32\\evil.md' },
        { fileName: '<script>evil</script>.md' },
        { fileName: 'normal-file.txt' }, // Non-md extension
        { fileName: '.md' }, // Only extension
        { fileName: '' } // Empty filename
      ];

      dangerousSettings.forEach(settings => {
        const result = fileManager.generateFilePath(settings);
        expect(result).toBe('ReadLater_Articles.md'); // Should fallback to safe default
      });
    });

    test('should limit summary length in table', async () => {
      const articleWithLongSummary = {
        ...mockArticleData,
        summary: 'x'.repeat(1000),
        shortSummary: undefined
      };

      const customSettings = {
        ...mockSettings,
        maxTableSummaryLength: 50
      };

      const result = await fileManager.createNewAggregatedFile(articleWithLongSummary, customSettings);

      // Should truncate summary in table
      const tableMatch = result.match(/\| [^|]+ \| [^|]+ \| ([^|]+) \| [^|]+ \|/);
      expect(tableMatch).toBeTruthy();
      const tableSummary = tableMatch[1].trim();
      expect(tableSummary.length).toBeLessThanOrEqual(50);
    });
  });
});