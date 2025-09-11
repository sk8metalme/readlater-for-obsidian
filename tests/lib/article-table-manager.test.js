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

  describe('Complex Table Operations', () => {
    test('should generate valid table with multiple articles', () => {
      const articles = [
        { title: '記事1', url: 'https://site1.com', shortSummary: '要約1', savedDate: new Date('2025-01-15') },
        { title: '記事2', url: 'https://site2.com', shortSummary: '要約2', savedDate: new Date('2025-01-16') },
        { title: '記事3', url: 'https://site3.com', shortSummary: '要約3', savedDate: new Date('2025-01-17') }
      ];

      const tableContent = tableManager.generateTableFromArticles(articles);
      
      expect(tableContent).toContain('| タイトル | URL | 要約 | 日時 |');
      expect(tableContent).toContain('|-----|-----|-----|-----|');
      expect(tableContent).toContain('記事1');
      expect(tableContent).toContain('記事2');
      expect(tableContent).toContain('記事3');
      
      // Verify table structure
      const lines = tableContent.split('\n').filter(line => line.trim());
      expect(lines).toHaveLength(5); // header + separator + 3 data rows
    });

    test('should handle empty articles array', () => {
      const tableContent = tableManager.generateTableFromArticles([]);
      
      expect(tableContent).toContain('| タイトル | URL | 要約 | 日時 |');
      expect(tableContent).toContain('|-----|-----|-----|-----|');
      
      const lines = tableContent.split('\n').filter(line => line.trim());
      expect(lines).toHaveLength(2); // Only header + separator
    });

    test('should maintain table structure with mixed content', () => {
      const articlesWithMixedContent = [
        { 
          title: 'Simple Title', 
          url: 'https://simple.com', 
          shortSummary: 'Simple summary', 
          savedDate: new Date('2025-01-15') 
        },
        { 
          title: 'Complex|Title|With|Pipes', 
          url: 'https://complex.com', 
          shortSummary: 'Summary with **markdown** and _italics_ and `code`', 
          savedDate: new Date('2025-01-16') 
        },
        { 
          title: 'Title\nWith\nNewlines', 
          url: 'https://newlines.com', 
          shortSummary: 'Summary\nwith\nmultiple\nlines', 
          savedDate: new Date('2025-01-17') 
        }
      ];

      const tableContent = tableManager.generateTableFromArticles(articlesWithMixedContent);
      
      // Verify all pipes are escaped
      const dataLines = tableContent.split('\n').slice(2);
      dataLines.forEach(line => {
        if (line.trim()) {
          const cellContent = line.split('|').slice(1, -1);
          cellContent.forEach(cell => {
            expect(cell).not.toMatch(/(?<!\\)\|/); // No unescaped pipes
          });
        }
      });
      
      // Verify no unescaped newlines in table cells (should be replaced with spaces)
      dataLines.forEach(line => {
        if (line.trim()) {
          expect(line).not.toMatch(/\|[^|]*\r?\n[^|]*\|/); // No newlines within cells
        }
      });
    });
  });

  describe('Advanced Escaping and Sanitization', () => {
    test('should handle complex HTML content when HTML escaping is enabled', () => {
      const htmlEscapingManager = new ArticleTableManager({ escapeHtml: true });
      
      const articleWithHtml = {
        title: '<script>alert("xss")</script>Article Title',
        url: 'https://example.com/article?param=<script>',
        shortSummary: '<img src="x" onerror="alert(1)">Summary with HTML',
        savedDate: new Date('2025-01-15')
      };

      const row = htmlEscapingManager.formatTableRow(articleWithHtml);
      
      // HTML should be escaped but not removed (content preservation)
      expect(row).toContain('&lt;script&gt;');
      expect(row).toContain('&lt;img src=');
      expect(row).not.toContain('<script>'); // Raw script tag should be escaped
    });

    test('should preserve HTML content when HTML escaping is disabled', () => {
      const noEscapingManager = new ArticleTableManager({ escapeHtml: false });
      
      const articleWithHtml = {
        title: '<em>Emphasized</em> Title',
        url: 'https://example.com',
        shortSummary: '<strong>Bold</strong> summary',
        savedDate: new Date('2025-01-15')
      };

      const row = noEscapingManager.formatTableRow(articleWithHtml);
      
      // HTML angle brackets should be escaped as markdown characters
      // but HTML content structure is preserved
      expect(row).toContain('<em\\>Emphasized</em\\>');
      expect(row).toContain('<strong\\>Bold</strong\\>');
    });

    test('should handle unicode and special characters', () => {
      const articleWithUnicode = {
        title: '日本語記事タイトル 🎌 測試',
        url: 'https://日本語.example.com/記事',
        shortSummary: 'Résumé with àccénts and émojis 🚀 ñ',
        savedDate: new Date('2025-01-15')
      };

      const row = tableManager.formatTableRow(articleWithUnicode);
      
      expect(row).toContain('日本語記事タイトル 🎌 測試');
      expect(row).toContain('Résumé with àccénts');
      expect(row).toContain('🚀');
    });

    test('should handle extremely long content gracefully', () => {
      const articleWithLongContent = {
        title: 'A'.repeat(1000),
        url: 'https://example.com/' + 'path/'.repeat(100),
        shortSummary: 'B'.repeat(2000),
        savedDate: new Date('2025-01-15')
      };

      const row = tableManager.formatTableRow(articleWithLongContent);
      
      // Should be truncated appropriately
      expect(row.length).toBeLessThan(3000); // Reasonable limit
      expect(row).toContain('...'); // Truncation indicator
    });

    test('should handle all markdown special characters', () => {
      const markdownChars = {
        title: '\\*\\_\\~\\`\\#\\>\\[\\]\\(\\)\\!',
        url: 'https://example.com',
        shortSummary: '**Bold** _italic_ ~~strike~~ `code` # Header > Quote [link](url)',
        savedDate: new Date('2025-01-15')
      };

      const row = tableManager.formatTableRow(markdownChars);
      
      // All markdown syntax should be escaped in table
      expect(row).toContain('\\*\\*Bold\\*\\*');
      expect(row).toContain('\\_italic\\_');
      expect(row).toContain('\\`code\\`');
      expect(row).toContain('\\[link\\]\\(url\\)');
    });
  });

  describe('Table Validation and Structure', () => {
    test('should produce valid markdown table structure', () => {
      const articles = [
        { title: 'Test Article', url: 'https://test.com', shortSummary: 'Test summary', savedDate: new Date('2025-01-15') }
      ];

      const table = tableManager.generateTableFromArticles(articles);
      const lines = table.split('\n');
      
      // Check header row
      expect(lines[0]).toMatch(/^\|\s*[^|]+(\s*\|\s*[^|]+)*\s*\|$/);
      
      // Check separator row
      expect(lines[1]).toMatch(/^\|[\s-:]+(\|[\s-:]+)*\|$/);
      
      // Check data rows
      for (let i = 2; i < lines.length; i++) {
        if (lines[i].trim()) {
          expect(lines[i]).toMatch(/^\|\s*[^|]*(\s*\|\s*[^|]*)*\s*\|$/);
        }
      }
    });

    test('should maintain column alignment', () => {
      const articles = [
        { title: 'Short', url: 'https://s.com', shortSummary: 'S', savedDate: new Date('2025-01-15') },
        { title: 'Very Long Article Title That Spans Multiple Words', url: 'https://verylongdomainname.example.com/very/long/path', shortSummary: 'Very long summary that contains multiple sentences and detailed information about the article content', savedDate: new Date('2025-01-16') }
      ];

      const table = tableManager.generateTableFromArticles(articles);
      const lines = table.split('\n');
      
      // All data rows should have the same number of columns
      const headerCols = (lines[0].match(/\|/g) || []).length;
      lines.slice(2).forEach(line => {
        if (line.trim()) {
          const dataCols = (line.match(/\|/g) || []).length;
          expect(dataCols).toBe(headerCols);
        }
      });
    });

    test('should handle null and undefined values consistently', () => {
      const articleWithNulls = {
        title: null,
        url: undefined,
        shortSummary: '',
        savedDate: null
      };

      const row = tableManager.formatTableRow(articleWithNulls);
      
      // Should produce valid table row even with null values
      expect(row).toMatch(/^\|\s*[^|]*\s*\|\s*[^|]*\s*\|\s*[^|]*\s*\|\s*[^|]*\s*\|$/);
      
      // Should not contain 'null' or 'undefined' strings
      expect(row).not.toContain('null');
      expect(row).not.toContain('undefined');
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle large number of articles efficiently', () => {
      const articles = [];
      for (let i = 0; i < 1000; i++) {
        articles.push({
          title: `Article ${i}`,
          url: `https://example${i}.com`,
          shortSummary: `Summary for article ${i}`,
          savedDate: new Date('2025-01-15')
        });
      }

      const startTime = Date.now();
      const table = tableManager.generateTableFromArticles(articles);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(table).toContain('Article 0');
      expect(table).toContain('Article 999');
      
      const lines = table.split('\n').filter(line => line.trim());
      expect(lines).toHaveLength(1002); // header + separator + 1000 data rows
    });

    test('should handle malformed date objects', () => {
      const articleWithBadDate = {
        title: 'Test Article',
        url: 'https://test.com',
        shortSummary: 'Test summary',
        savedDate: 'not a date object'
      };

      const row = tableManager.formatTableRow(articleWithBadDate);
      
      expect(row).toContain('Test Article');
      expect(row).not.toContain('Invalid Date');
      expect(row).not.toContain('NaN');
    });

    test('should handle circular references in article data', () => {
      const articleWithCircular = {
        title: 'Circular Test',
        url: 'https://circular.com',
        shortSummary: 'Test summary',
        savedDate: new Date('2025-01-15')
      };
      
      // Create circular reference
      articleWithCircular.self = articleWithCircular;

      const row = tableManager.formatTableRow(articleWithCircular);
      
      expect(row).toContain('Circular Test');
      expect(row).toContain('https://circular.com');
    });

    test('should handle empty strings vs null vs undefined consistently', () => {
      const testCases = [
        { title: '', url: '', shortSummary: '', savedDate: '' },
        { title: null, url: null, shortSummary: null, savedDate: null },
        { title: undefined, url: undefined, shortSummary: undefined, savedDate: undefined }
      ];

      testCases.forEach((articleData, index) => {
        const row = tableManager.formatTableRow(articleData);
        
        expect(row).toMatch(/^\|\s*[^|]*\s*\|\s*[^|]*\s*\|\s*[^|]*\s*\|\s*[^|]*\s*\|$/);
        expect(row).not.toContain('null');
        expect(row).not.toContain('undefined');
      });
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle table generation errors gracefully', () => {
      // Mock a scenario where formatTableRow throws an error
      const originalFormatTableRow = tableManager.formatTableRow;
      tableManager.formatTableRow = jest.fn().mockImplementation((article) => {
        if (article.title === 'error-article') {
          throw new Error('Format error');
        }
        return originalFormatTableRow.call(tableManager, article);
      });

      const articles = [
        { title: 'good-article', url: 'https://good.com', shortSummary: 'Good', savedDate: new Date('2025-01-15') },
        { title: 'error-article', url: 'https://error.com', shortSummary: 'Error', savedDate: new Date('2025-01-16') },
        { title: 'another-good', url: 'https://another.com', shortSummary: 'Another', savedDate: new Date('2025-01-17') }
      ];

      const table = tableManager.generateTableFromArticles(articles);
      
      // Should still produce valid table with non-erroring articles
      expect(table).toContain('good-article');
      expect(table).toContain('another-good');
      expect(table).not.toContain('error-article'); // Erroring article should be skipped
    });

    test('should validate error handler integration', () => {
      expect(tableManager.errorHandler).toBeDefined();
      expect(typeof tableManager.errorHandler.handleError).toBe('function');
    });
  });
});