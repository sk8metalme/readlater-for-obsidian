// Tests for ArticleTableManager - TDD implementation
const { ArticleTableManager } = require('../../src/lib/article-table-manager.js');

describe('ArticleTableManager', () => {
  let tableManager;
  let mockArticle;

  beforeEach(() => {
    jest.clearAllMocks();
    
    tableManager = new ArticleTableManager();
    
    mockArticle = {
      title: '記事タイトル',
      url: 'https://example.com/article',
      shortSummary: '短い要約文',
      savedDate: new Date('2025-01-15T10:30:00Z'),
      language: 'ja'
    };
  });

  describe('constructor', () => {
    test('should create instance with default configuration', () => {
      expect(tableManager).toBeInstanceOf(ArticleTableManager);
      expect(tableManager.config).toBeDefined();
    });

    test('should accept custom configuration', () => {
      const customConfig = {
        dateFormat: 'MM/DD/YYYY',
        maxSummaryLength: 150,
        escapeHtml: true
      };
      
      const customManager = new ArticleTableManager(customConfig);
      expect(customManager.config).toEqual(expect.objectContaining(customConfig));
    });
  });

  describe('generateTableHeader', () => {
    test('should generate markdown table header with default columns', () => {
      const header = tableManager.generateTableHeader();
      
      expect(header).toContain('| タイトル | URL | 要約 | 日時 |');
      expect(header).toContain('|-----|-----|-----|-----|');
    });

    test('should generate header with custom columns', () => {
      const customColumns = ['title', 'domain', 'date'];
      const header = tableManager.generateTableHeader(customColumns);
      
      expect(header).toContain('| タイトル | ドメイン | 日時 |');
      expect(header).toContain('|-----|-----|-----|');
    });

    test('should handle empty columns array gracefully', () => {
      const header = tableManager.generateTableHeader([]);
      
      expect(header).toContain('| タイトル | URL | 要約 | 日時 |'); // fallback to default
    });
  });

  describe('formatTableRow', () => {
    test('should format article data into table row', () => {
      const row = tableManager.formatTableRow(mockArticle);
      
      expect(row).toMatch(/^\|\s*記事タイトル\s*\|\s*https:\/\/example\.com\/article\s*\|\s*短い要約文\s*\|\s*2025-01-15\s*\|$/);
    });

    test('should escape special characters in table cells', () => {
      const articleWithSpecialChars = {
        ...mockArticle,
        title: 'Title | with | pipes',
        shortSummary: 'Summary with *markdown* **syntax**'
      };

      const row = tableManager.formatTableRow(articleWithSpecialChars);
      
      expect(row).toContain('Title \\| with \\| pipes');
      expect(row).toContain('Summary with \\*markdown\\* \\*\\*syntax\\*\\*');
    });

    test('should handle missing or undefined fields', () => {
      const incompleteArticle = {
        title: 'Only Title',
        url: 'https://example.com'
        // missing shortSummary and savedDate
      };

      const row = tableManager.formatTableRow(incompleteArticle);
      
      expect(row).toContain('Only Title');
      expect(row).toContain('https://example.com');
      expect(row).toContain(''); // empty summary
    });

    test('should truncate long summaries', () => {
      const longSummaryArticle = {
        ...mockArticle,
        shortSummary: 'a'.repeat(200) // Very long summary
      };

      const row = tableManager.formatTableRow(longSummaryArticle);
      
      // Default max length is 100 characters
      const summaryMatch = row.match(/\|\s*([^|]*)\s*\|\s*[0-9-]+\s*\|$/);
      expect(summaryMatch[1].length).toBeLessThanOrEqual(103); // 100 + '...'
      expect(row).toContain('...');
    });
  });

  describe('addArticleToTable', () => {
    test('should add article to empty table', () => {
      const emptyTable = tableManager.generateTableHeader();
      const result = tableManager.addArticleToTable(mockArticle, emptyTable);
      
      expect(result).toContain('| タイトル | URL | 要約 | 日時 |');
      expect(result).toContain('記事タイトル');
      expect(result).toContain('https://example.com/article');
    });

    test('should append article to existing table', () => {
      const existingTable = `| タイトル | URL | 要約 | 日時 |
|---------|-----|------|------|
| 既存記事 | https://old.com | 既存要約 | 2025-01-14 |`;

      const result = tableManager.addArticleToTable(mockArticle, existingTable);
      
      expect(result).toContain('既存記事');
      expect(result).toContain('記事タイトル');
      expect(result.split('\n')).toHaveLength(4); // header + separator + 2 data rows
    });

    test('should handle malformed existing table', () => {
      const malformedTable = 'Not a proper markdown table';
      
      const result = tableManager.addArticleToTable(mockArticle, malformedTable);
      
      // Should create new table with the article
      expect(result).toContain('| タイトル | URL | 要約 | 日時 |');
      expect(result).toContain('記事タイトル');
    });
  });

  describe('extractDomain', () => {
    test('should extract domain from URL', () => {
      const domain = tableManager.extractDomain('https://www.example.com/path/to/article?param=value');
      expect(domain).toBe('example.com');
    });

    test('should handle URLs without www prefix', () => {
      const domain = tableManager.extractDomain('https://blog.example.com/article');
      expect(domain).toBe('blog.example.com');
    });

    test('should handle invalid URLs gracefully', () => {
      const domain = tableManager.extractDomain('not-a-url');
      expect(domain).toBe('not-a-url'); // fallback to original
    });

    test('should handle empty or null URLs', () => {
      expect(tableManager.extractDomain('')).toBe('');
      expect(tableManager.extractDomain(null)).toBe('');
      expect(tableManager.extractDomain(undefined)).toBe('');
    });
  });

  describe('formatDate', () => {
    test('should format date in default format', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      const formatted = tableManager.formatDate(date);
      
      expect(formatted).toBe('2025-01-15');
    });

    test('should handle different date formats', () => {
      const customManager = new ArticleTableManager({ dateFormat: 'DD/MM/YYYY' });
      const date = new Date('2025-01-15T10:30:00Z');
      const formatted = customManager.formatDate(date);
      
      expect(formatted).toBe('15/01/2025');
    });

    test('should handle invalid dates', () => {
      const formatted = tableManager.formatDate('invalid-date');
      expect(formatted).toBe('');
    });

    test('should handle null or undefined dates', () => {
      expect(tableManager.formatDate(null)).toBe('');
      expect(tableManager.formatDate(undefined)).toBe('');
    });
  });

  describe('escapeMarkdownTableCell', () => {
    test('should escape pipe characters', () => {
      const escaped = tableManager.escapeMarkdownTableCell('text | with | pipes');
      expect(escaped).toBe('text \\| with \\| pipes');
    });

    test('should escape markdown syntax', () => {
      const escaped = tableManager.escapeMarkdownTableCell('**bold** *italic* `code`');
      expect(escaped).toBe('\\*\\*bold\\*\\* \\*italic\\* \\`code\\`');
    });

    test('should handle newlines in cell content', () => {
      const escaped = tableManager.escapeMarkdownTableCell('line1\nline2\nline3');
      expect(escaped).toBe('line1 line2 line3'); // newlines replaced with spaces
    });

    test('should handle empty or null content', () => {
      expect(tableManager.escapeMarkdownTableCell('')).toBe('');
      expect(tableManager.escapeMarkdownTableCell(null)).toBe('');
      expect(tableManager.escapeMarkdownTableCell(undefined)).toBe('');
    });
  });
});