// Tests for AggregatedMarkdownGenerator - TDD implementation
const { AggregatedMarkdownGenerator } = require('../../src/lib/aggregated-markdown-generator.js');

describe('AggregatedMarkdownGenerator', () => {
  let generator;
  let mockArticles;
  let mockSettings;

  // テスト全体でシステム時刻を固定
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-16T00:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    generator = new AggregatedMarkdownGenerator();
    
    mockArticles = [
      {
        id: 'article-1',
        title: '記事タイトル1',
        originalTitle: 'Original Title 1',
        url: 'https://example.com/article1',
        content: '記事1の内容...',
        summary: '記事1の要約',
        shortSummary: '短い要約1',
        savedDate: new Date('2025-01-15'),
        language: 'ja'
      },
      {
        id: 'article-2',
        title: '記事タイトル2',
        originalTitle: 'Original Title 2',
        url: 'https://example.com/article2',
        content: '記事2の内容...',
        summary: '記事2の要約',
        shortSummary: '短い要約2',
        savedDate: new Date('2025-01-16'),
        language: 'ja'
      }
    ];
    
    mockSettings = {
      fileName: 'ReadLater_Articles.md',
      maxTableSummaryLength: 100,
      tableColumns: ['title', 'url', 'summary', 'date']
    };
  });

  describe('constructor', () => {
    test('should create instance with default dependencies', () => {
      expect(generator).toBeInstanceOf(AggregatedMarkdownGenerator);
      expect(generator.markdownGenerator).toBeDefined();
      expect(generator.tableManager).toBeDefined();
    });

    test('should accept custom dependencies', () => {
      const mockMarkdownGen = { generateMarkdown: jest.fn() };
      const mockTableMgr = { generateTableHeader: jest.fn() };
      
      const customGenerator = new AggregatedMarkdownGenerator({
        markdownGenerator: mockMarkdownGen,
        tableManager: mockTableMgr
      });

      expect(customGenerator.markdownGenerator).toBe(mockMarkdownGen);
      expect(customGenerator.tableManager).toBe(mockTableMgr);
    });
  });

  describe('generateAggregatedMarkdown', () => {
    test('should generate complete aggregated markdown with multiple articles', async () => {
      const result = await generator.generateAggregatedMarkdown(mockArticles, mockSettings);
      
      expect(result).toContain('# ReadLater Articles');
      expect(result).toContain('| タイトル | URL | 要約 | 日時 |');
      expect(result).toContain('記事タイトル1');
      expect(result).toContain('記事タイトル2');
      expect(result).toContain('## 📖 記事詳細');
      expect(result).toContain('### 記事タイトル1');
      expect(result).toContain('### 記事タイトル2');
    });

    test('should handle single article', async () => {
      const singleArticle = [mockArticles[0]];
      const result = await generator.generateAggregatedMarkdown(singleArticle, mockSettings);

      expect(result).toContain('記事タイトル1');
      expect(result).not.toContain('記事タイトル2');
      expect(result).toContain('### 記事タイトル1');
    });

    test('should handle empty articles array', async () => {
      const result = await generator.generateAggregatedMarkdown([], mockSettings);

      expect(result).toContain('# ReadLater Articles');
      expect(result).toContain('| タイトル | URL | 要約 | 日時 |');
      expect(result).toContain('## 📖 記事詳細');
      expect(result).toContain('まだ記事が保存されていません');
    });
  });

  describe('appendArticleContent', () => {
    test('should append article to existing content', async () => {
      const existingContent = `---
title: "ReadLater Articles"
type: "aggregated-articles"
created: "2025-01-14T10:00:00.000Z"
updated: "2025-01-14T10:00:00.000Z"
tags: ["ReadLater", "aggregated", "articles"]
cssclass: "readlater-aggregated"
total_articles: 1
---

# ReadLater Articles

> 📚 ReadLater for Obsidianで保存した記事の集約ファイルです  
> 🗓️ **作成日**: 2025-01-14 | **最終更新**: 2025-01-14

## 目次

- [既存記事](#既存記事)

## 📋 記事一覧

> 保存された記事の概要一覧です。タイトルをクリックすると詳細セクションにジャンプできます。

### 📊 統計情報
- **総記事数**: 1件
- **最新保存**: 2025-01-14
- **言語分布**: ja(1)

| タイトル | URL | 要約 | 日時 |
|-----|-----|-----|-----|
| 既存記事 | https://old.com | 既存要約 | 2025-01-14 |

## 📖 記事詳細

> 各記事の完全な翻訳内容と詳細情報です。

### 既存記事

**📍 元記事**: [既存記事](https://old.com)
**🌐 ドメイン**: old.com
**📅 保存日**: 2025-01-14

#### 📖 記事内容

既存記事の内容...

---

## 📈 ファイル情報

- **📊 総記事数**: 1件
- **📅 最終更新**: 2025-01-14
- **🕒 更新時刻**: 2025/1/14 19:00:00
- **📱 生成元**: ReadLater for Obsidian
- **📝 ファイル形式**: 集約型Markdownファイル

---

*📱 Generated by ReadLater for Obsidian*  
*🕒 2025/1/14 19:00:00*  
*🎯 Mode: Aggregated Articles*`;

      const newArticle = mockArticles[0];
      const result = await generator.appendArticleContent(existingContent, newArticle, mockSettings);

      expect(result).toContain('既存記事');
      expect(result).toContain('記事タイトル1');
      expect(result).toContain('### 既存記事');
      expect(result).toContain('### 記事タイトル1');
    });

    test('should handle malformed existing content', async () => {
      const malformedContent = 'Not a proper aggregated file';
      const newArticle = mockArticles[0];
      
      const result = await generator.appendArticleContent(malformedContent, newArticle, mockSettings);
      
      // Should create proper structure with the new article
      expect(result).toContain('# ReadLater Articles');
      expect(result).toContain('記事タイトル1');
    });
  });

  describe('generateTableOfContents', () => {
    test('should generate table of contents from articles', () => {
      const toc = generator.generateTableOfContents(mockArticles);
      
      expect(toc).toContain('## 目次');
      expect(toc).toContain('[記事タイトル1](#記事タイトル1)');
      expect(toc).toContain('[記事タイトル2](#記事タイトル2)');
    });

    test('should handle empty articles array', () => {
      const toc = generator.generateTableOfContents([]);
      
      expect(toc).toContain('## 目次');
      expect(toc).toContain('記事はまだ保存されていません');
    });

    test('should sanitize article titles for anchor links', () => {
      const articlesWithSpecialChars = [
        {
          ...mockArticles[0],
          title: 'タイトル with spaces & special chars!'
        }
      ];
      
      const toc = generator.generateTableOfContents(articlesWithSpecialChars);
      
      expect(toc).toContain('[タイトル with spaces & special chars!](#タイトル-with-spaces-special-chars)');
    });
  });

  describe('generateArticleDetailSection', () => {
    test('should generate detailed section for article', () => {
      const article = mockArticles[0];
      const section = generator.generateArticleDetailSection(article);

      expect(section).toContain('### 記事タイトル1');
      expect(section).toContain('**📍 元記事**: [記事タイトル1](https://example.com/article1)');
      expect(section).toContain('**📅 保存日**: 2025-01-15');
      expect(section).toContain('記事1の内容...');
    });

    test('should include summary if available', () => {
      const article = mockArticles[0];
      const section = generator.generateArticleDetailSection(article);

      expect(section).toContain('#### 📄 AI要約');
      expect(section).toContain('記事1の要約');
    });

    test('should handle article without summary', () => {
      const articleNoSummary = { ...mockArticles[0] };
      delete articleNoSummary.summary;
      
      const section = generator.generateArticleDetailSection(articleNoSummary);

      expect(section).not.toContain('## 要約');
      expect(section).toContain('### 記事タイトル1');
    });

    test('should handle translated content', () => {
      const translatedArticle = {
        ...mockArticles[0],
        translatedContent: '翻訳された内容...',
        translationSkipped: false
      };
      
      const section = generator.generateArticleDetailSection(translatedArticle);

      expect(section).toContain('翻訳された内容...');
      expect(section).toContain('<details>');
      expect(section).toContain('<summary>📄 原文を表示</summary>');
    });
  });

  describe('updateTableOfContents', () => {
    test('should update existing table of contents', () => {
      const contentWithOldToc = `# ReadLater Articles

## 目次
- [Old Article](#old-article)

| タイトル | URL | 要約 | 日時 |
|-----|-----|-----|-----|
| New Article | https://new.com | New summary | 2025-01-15 |

## 記事詳細
### New Article
Content...
`;

      const result = generator.updateTableOfContents(contentWithOldToc);
      
      expect(result).toContain('## 目次');
      expect(result).toContain('[New Article](#new-article)');
      expect(result).not.toContain('[Old Article](#old-article)');
    });

    test('should add table of contents if missing', () => {
      const contentWithoutToc = `# ReadLater Articles

| タイトル | URL | 要約 | 日時 |
|-----|-----|-----|-----|
| Article | https://example.com | Summary | 2025-01-15 |

## 記事詳細
### Article
Content...
`;

      const result = generator.updateTableOfContents(contentWithoutToc);
      
      expect(result).toContain('## 目次');
      expect(result).toContain('[Article](#article)');
    });
  });

  describe('generateFileHeader', () => {
    test('should generate file header with metadata', () => {
      const header = generator.generateFileHeader(mockSettings);

      expect(header).toContain('# ReadLater Articles');
      expect(header).toMatch(/\*\*作成日\*\*: \d{4}-\d{2}-\d{2}/);
      expect(header).toMatch(/\*\*最終更新\*\*: \d{4}-\d{2}-\d{2}/);
    });

    test('should include custom title from settings', () => {
      const customSettings = {
        ...mockSettings,
        title: 'カスタムタイトル'
      };
      
      const header = generator.generateFileHeader(customSettings);
      expect(header).toContain('# カスタムタイトル');
    });
  });

  describe('generateFileFooter', () => {
    test('should generate file footer with metadata', () => {
      const footer = generator.generateFileFooter(mockArticles.length);

      expect(footer).toContain('---');
      expect(footer).toContain('Generated by ReadLater for Obsidian');
      expect(footer).toContain('**📊 総記事数**: 2件');
      expect(footer).toMatch(/\*\*📅 最終更新\*\*: \d{4}-\d{2}-\d{2}/);
    });

    test('should handle zero articles', () => {
      const footer = generator.generateFileFooter(0);
      expect(footer).toContain('**📊 総記事数**: 0件');
    });
  });
});