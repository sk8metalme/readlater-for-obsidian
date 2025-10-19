// Tests for Data Models - TDD implementation
const { Article, AggregatedFileData, AggregatedFileSettings } = require('../../src/lib/data-models.js');

describe('Article Data Model', () => {
    describe('constructor', () => {
        test('should create Article with minimal data', () => {
            const article = new Article({
                title: 'Test Article',
                url: 'https://example.com/test'
            });

            expect(article.title).toBe('Test Article');
            expect(article.url).toBe('https://example.com/test');
            expect(article.id).toMatch(/^article-[a-f0-9]+$/);
            expect(article.savedDate).toBeInstanceOf(Date);
            expect(article.domain).toBe('example.com');
        });

        test('should create Article with full data', () => {
            const savedDate = new Date('2025-01-15');
            const article = new Article({
                id: 'custom-id',
                title: 'Full Article',
                originalTitle: 'Original Full Article',
                url: 'https://example.com/full',
                content: 'Article content...',
                translatedContent: '翻訳された内容...',
                summary: 'Article summary',
                shortSummary: '短い要約',
                savedDate,
                language: 'en',
                detectedLanguage: 'en',
                author: 'Test Author',
                readingTime: '5'
            });

            expect(article.id).toBe('custom-id');
            expect(article.originalTitle).toBe('Original Full Article');
            expect(article.translatedContent).toBe('翻訳された内容...');
            expect(article.savedDate).toBe(savedDate);
            expect(article.author).toBe('Test Author');
        });

        test('should handle invalid date gracefully', () => {
            const article = new Article({
                title: 'Test',
                url: 'https://example.com',
                savedDate: 'invalid-date'
            });

            expect(article.savedDate).toBeInstanceOf(Date);
            expect(isNaN(article.savedDate.getTime())).toBe(false);
        });
    });

    describe('generateId', () => {
        test('should generate unique IDs for different URLs', () => {
            const article1 = new Article({
                title: 'Test',
                url: 'https://example.com/1'
            });
            const article2 = new Article({
                title: 'Test',
                url: 'https://example.com/2'
            });

            expect(article1.id).not.toBe(article2.id);
            expect(article1.id).toMatch(/^article-[a-f0-9]+$/);
            expect(article2.id).toMatch(/^article-[a-f0-9]+$/);
        });

        test('should generate consistent ID for same URL and time', () => {
            const url = 'https://example.com/test';
            const extractedAt = '2025-01-15T10:00:00.000Z';
            
            const article1 = new Article({ url, extractedAt });
            const article2 = new Article({ url, extractedAt });

            expect(article1.id).toBe(article2.id);
        });
    });

    describe('extractDomainFromUrl', () => {
        test('should extract domain from valid URL', () => {
            const article = new Article({
                url: 'https://sub.example.com/path/to/article?param=value'
            });

            expect(article.domain).toBe('sub.example.com');
        });

        test('should handle invalid URL gracefully', () => {
            const article = new Article({
                url: 'invalid-url'
            });

            expect(article.domain).toBe('unknown');
        });
    });

    describe('generateShortSummary', () => {
        test('should return original if short enough', () => {
            const shortSummary = 'This is short';
            const article = new Article({
                summary: shortSummary
            });

            expect(article.shortSummary).toBe(shortSummary);
        });

        test('should truncate long summary at sentence boundary', () => {
            const longSummary = 'This is a very long summary that exceeds the maximum length. It has multiple sentences. This should be cut.';
            const article = new Article({
                summary: longSummary
            });

            expect(article.shortSummary.length).toBeLessThanOrEqual(100);
            expect(article.shortSummary).toMatch(/[。！？.]$/);
        });

        test('should add ellipsis if no good sentence boundary', () => {
            const longSummary = 'A'.repeat(120); // No sentence boundaries
            const article = new Article({
                summary: longSummary
            });

            expect(article.shortSummary).toMatch(/\.\.\.$/)
            expect(article.shortSummary.length).toBeLessThanOrEqual(103); // 100 + '...'
        });

        test('should handle empty or null summary', () => {
            const article1 = new Article({ summary: null });
            const article2 = new Article({ summary: '' });
            const article3 = new Article({}); // No summary

            expect(article1.shortSummary).toBe('');
            expect(article2.shortSummary).toBe('');
            expect(article3.shortSummary).toBe('');
        });
    });

    describe('validate', () => {
        test('should validate correct article', () => {
            const article = new Article({
                title: 'Valid Article',
                url: 'https://example.com/valid'
            });

            const validation = article.validate();
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should detect missing required fields', () => {
            const article = new Article({});

            const validation = article.validate();
            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('記事タイトルが必須です');
            expect(validation.errors).toContain('記事URLが必須です');
        });

        test('should detect invalid URL', () => {
            const article = new Article({
                title: 'Test',
                url: 'invalid-url'
            });

            const validation = article.validate();
            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('有効なURLが必要です');
        });

        test('should detect invalid date', () => {
            // Since the constructor now auto-fixes invalid dates,
            // we need to manually set an invalid date to test validation
            const article = new Article({
                title: 'Test',
                url: 'https://example.com'
            });
            
            // Manually set invalid date for validation testing
            article.savedDate = new Date('invalid');

            const validation = article.validate();
            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('有効な保存日時が必要です');
        });
    });

    describe('serialization', () => {
        test('should serialize to JSON correctly', () => {
            const article = new Article({
                title: 'Serialize Test',
                url: 'https://example.com/serialize',
                content: 'Content',
                savedDate: new Date('2025-01-15T10:00:00.000Z')
            });

            const json = article.toJSON();

            expect(json.title).toBe('Serialize Test');
            expect(json.url).toBe('https://example.com/serialize');
            expect(json.savedDate).toBe('2025-01-15T10:00:00.000Z');
            expect(typeof json).toBe('object');
        });

        test('should deserialize from JSON correctly', () => {
            const json = {
                id: 'test-id',
                title: 'Deserialize Test',
                url: 'https://example.com/deserialize',
                savedDate: '2025-01-15T10:00:00.000Z',
                content: 'Content'
            };

            const article = Article.fromJSON(json);

            expect(article).toBeInstanceOf(Article);
            expect(article.id).toBe('test-id');
            expect(article.title).toBe('Deserialize Test');
            expect(article.savedDate).toBeInstanceOf(Date);
            expect(article.savedDate.toISOString()).toBe('2025-01-15T10:00:00.000Z');
        });

        test('should roundtrip serialize/deserialize correctly', () => {
            const original = new Article({
                title: 'Roundtrip Test',
                url: 'https://example.com/roundtrip',
                content: 'Test content',
                summary: 'Test summary'
            });

            const json = original.toJSON();
            const restored = Article.fromJSON(json);

            expect(restored.title).toBe(original.title);
            expect(restored.url).toBe(original.url);
            expect(restored.content).toBe(original.content);
            expect(restored.savedDate.getTime()).toBe(original.savedDate.getTime());
        });
    });
});

describe('AggregatedFileData', () => {
    let sampleArticle;

    beforeEach(() => {
        sampleArticle = new Article({
            title: 'Sample Article',
            url: 'https://example.com/sample'
        });
    });

    describe('constructor', () => {
        test('should create empty AggregatedFileData', () => {
            const data = new AggregatedFileData();

            expect(data.fileName).toBe('ReadLater_Articles.md');
            expect(data.articles).toHaveLength(0);
            expect(data.totalArticles).toBe(0);
            expect(data.lastUpdated).toBeInstanceOf(Date);
        });

        test('should create AggregatedFileData with articles', () => {
            const data = new AggregatedFileData({
                fileName: 'Custom.md',
                articles: [sampleArticle]
            });

            expect(data.fileName).toBe('Custom.md');
            expect(data.articles).toHaveLength(1);
            expect(data.articles[0]).toBeInstanceOf(Article);
            expect(data.totalArticles).toBe(1);
        });

        test('should convert plain objects to Article instances', () => {
            const plainObject = {
                title: 'Plain Object Article',
                url: 'https://example.com/plain'
            };

            const data = new AggregatedFileData({
                articles: [plainObject]
            });

            expect(data.articles[0]).toBeInstanceOf(Article);
            expect(data.articles[0].title).toBe('Plain Object Article');
        });
    });

    describe('addArticle', () => {
        test('should add valid article successfully', () => {
            const data = new AggregatedFileData();
            const result = data.addArticle(sampleArticle);

            expect(result).toBe(true);
            expect(data.articles).toHaveLength(1);
            expect(data.totalArticles).toBe(1);
            expect(data.articles[0]).toBe(sampleArticle);
        });

        test('should add plain object as Article', () => {
            const data = new AggregatedFileData();
            const plainArticle = {
                title: 'Plain Article',
                url: 'https://example.com/plain'
            };

            const result = data.addArticle(plainArticle);

            expect(result).toBe(true);
            expect(data.articles).toHaveLength(1);
            expect(data.articles[0]).toBeInstanceOf(Article);
        });

        test('should reject invalid article', () => {
            const data = new AggregatedFileData();
            const invalidArticle = { title: '' }; // Missing URL

            const result = data.addArticle(invalidArticle);

            expect(result).toBe(false);
            expect(data.articles).toHaveLength(0);
        });

        test('should reject duplicate article ID', () => {
            const data = new AggregatedFileData();
            const article1 = new Article({
                id: 'duplicate-id',
                title: 'Article 1',
                url: 'https://example.com/1'
            });
            const article2 = new Article({
                id: 'duplicate-id',
                title: 'Article 2',
                url: 'https://example.com/2'
            });

            data.addArticle(article1);
            const result = data.addArticle(article2);

            expect(result).toBe(false);
            expect(data.articles).toHaveLength(1);
            expect(data.articles[0].title).toBe('Article 1');
        });

        test('should update lastUpdated when adding article', () => {
            const data = new AggregatedFileData();
            const originalTime = data.lastUpdated;

            // Wait a bit to ensure time difference
            setTimeout(() => {
                data.addArticle(sampleArticle);
                expect(data.lastUpdated.getTime()).toBeGreaterThan(originalTime.getTime());
            }, 1);
        });
    });

    describe('removeArticle', () => {
        test('should remove existing article', () => {
            const data = new AggregatedFileData({
                articles: [sampleArticle]
            });

            const result = data.removeArticle(sampleArticle.id);

            expect(result).toBe(true);
            expect(data.articles).toHaveLength(0);
            expect(data.totalArticles).toBe(0);
        });

        test('should return false for non-existing article', () => {
            const data = new AggregatedFileData();

            const result = data.removeArticle('non-existing-id');

            expect(result).toBe(false);
        });
    });

    describe('findArticle', () => {
        test('should find existing article', () => {
            const data = new AggregatedFileData({
                articles: [sampleArticle]
            });

            const found = data.findArticle(sampleArticle.id);

            expect(found).toBe(sampleArticle);
        });

        test('should return null for non-existing article', () => {
            const data = new AggregatedFileData();

            const found = data.findArticle('non-existing-id');

            expect(found).toBe(null);
        });
    });

    describe('getSortedArticles', () => {
        test('should sort articles by date descending (newest first)', () => {
            const old = new Article({
                title: 'Old',
                url: 'https://example.com/old',
                savedDate: new Date('2025-01-10')
            });
            const recent = new Article({
                title: 'Recent',
                url: 'https://example.com/recent',
                savedDate: new Date('2025-01-20')
            });

            const data = new AggregatedFileData({
                articles: [old, recent]
            });

            const sorted = data.getSortedArticles();

            expect(sorted[0]).toBe(recent);
            expect(sorted[1]).toBe(old);
        });

        test('should sort articles by date ascending (oldest first)', () => {
            const old = new Article({
                title: 'Old',
                url: 'https://example.com/old',
                savedDate: new Date('2025-01-10')
            });
            const recent = new Article({
                title: 'Recent',
                url: 'https://example.com/recent',
                savedDate: new Date('2025-01-20')
            });

            const data = new AggregatedFileData({
                articles: [recent, old]
            });

            const sorted = data.getSortedArticles(true);

            expect(sorted[0]).toBe(old);
            expect(sorted[1]).toBe(recent);
        });
    });

    describe('getStatistics', () => {
        test('should return empty statistics for no articles', () => {
            const data = new AggregatedFileData();
            const stats = data.getStatistics();

            expect(stats.totalArticles).toBe(0);
            expect(stats.latestSaveDate).toBe(null);
            expect(stats.languageDistribution).toEqual({});
            expect(stats.averageWordsPerArticle).toBe(0);
        });

        test('should calculate statistics correctly', () => {
            const article1 = new Article({
                title: 'Article 1',
                url: 'https://example.com/1',
                content: 'This has five words total',
                language: 'en',
                detectedLanguage: 'en',
                savedDate: new Date('2025-01-10'),
                translatedContent: 'Translated content',
                summary: 'Summary'
            });
            const article2 = new Article({
                title: 'Article 2',
                url: 'https://example.com/2',
                content: 'This has three words',
                language: 'ja',
                detectedLanguage: 'ja',
                savedDate: new Date('2025-01-15')
            });

            const data = new AggregatedFileData({
                articles: [article1, article2]
            });

            const stats = data.getStatistics();

            expect(stats.totalArticles).toBe(2);
            expect(stats.latestSaveDate).toEqual(new Date('2025-01-15'));
            expect(stats.languageDistribution).toEqual({ en: 1, ja: 1 });
            expect(stats.averageWordsPerArticle).toBe(3); // (2 from 'Translated content' + 4 from 'This has three words') / 2 = 3
            expect(stats.translatedCount).toBe(1);
            expect(stats.summarizedCount).toBe(1);
        });
    });

    describe('serialization', () => {
        test('should serialize and deserialize correctly', () => {
            const original = new AggregatedFileData({
                fileName: 'Test.md',
                articles: [sampleArticle]
            });

            const json = original.toJSON();
            const restored = AggregatedFileData.fromJSON(json);

            expect(restored.fileName).toBe(original.fileName);
            expect(restored.articles).toHaveLength(1);
            expect(restored.articles[0]).toBeInstanceOf(Article);
            expect(restored.totalArticles).toBe(1);
        });
    });
});

describe('AggregatedFileSettings', () => {
    describe('constructor', () => {
        test('should create default settings', () => {
            const settings = new AggregatedFileSettings();

            expect(settings.enabled).toBe(false);
            expect(settings.fileName).toBe('ReadLater_Articles.md');
            expect(settings.maxTableSummaryLength).toBe(100);
            expect(settings.autoBackup).toBe(false);
            expect(settings.tableColumns).toEqual(['title', 'url', 'summary', 'date']);
        });

        test('should create settings with custom values', () => {
            const settings = new AggregatedFileSettings({
                enabled: true,
                fileName: 'Custom.md',
                maxTableSummaryLength: 200,
                autoBackup: true,
                tableColumns: ['title', 'url', 'date']
            });

            expect(settings.enabled).toBe(true);
            expect(settings.fileName).toBe('Custom.md');
            expect(settings.maxTableSummaryLength).toBe(200);
            expect(settings.autoBackup).toBe(true);
            expect(settings.tableColumns).toEqual(['title', 'url', 'date']);
        });
    });

    describe('validateTableColumns', () => {
        test('should return default columns for invalid input', () => {
            const settings = new AggregatedFileSettings();

            expect(settings.validateTableColumns(null)).toEqual(['title', 'url', 'summary', 'date']);
            expect(settings.validateTableColumns([])).toEqual(['title', 'url', 'summary', 'date']);
            expect(settings.validateTableColumns('not-array')).toEqual(['title', 'url', 'summary', 'date']);
        });

        test('should filter valid columns', () => {
            const settings = new AggregatedFileSettings();
            const result = settings.validateTableColumns(['title', 'invalid', 'url', 'summary']);

            expect(result).toEqual(['title', 'url', 'summary']);
        });

        test('should ensure required columns', () => {
            const settings = new AggregatedFileSettings();
            const result = settings.validateTableColumns(['summary', 'date']);

            expect(result).toContain('title');
            expect(result).toContain('url');
        });
    });

    describe('sanitizeFileName', () => {
        test('should sanitize dangerous characters', () => {
            const settings = new AggregatedFileSettings();

            expect(settings.sanitizeFileName('file<>:"/\\|?*name')).toBe('filename.md');
            expect(settings.sanitizeFileName('...filename')).toBe('filename.md');
            expect(settings.sanitizeFileName('  spaced  ')).toBe('spaced.md');
        });

        test('should add .md extension if missing', () => {
            const settings = new AggregatedFileSettings();

            expect(settings.sanitizeFileName('filename')).toBe('filename.md');
            expect(settings.sanitizeFileName('filename.txt')).toBe('filename.txt.md');
        });

        test('should handle edge cases', () => {
            const settings = new AggregatedFileSettings();

            expect(settings.sanitizeFileName('')).toBe('ReadLater_Articles.md');
            expect(settings.sanitizeFileName(null)).toBe('ReadLater_Articles.md');
            expect(settings.sanitizeFileName('...')).toBe('ReadLater_Articles.md');
        });

        test('should limit filename length', () => {
            const settings = new AggregatedFileSettings();
            const longName = 'a'.repeat(200);

            const result = settings.sanitizeFileName(longName);

            expect(result.length).toBeLessThanOrEqual(100);
            expect(result.endsWith('.md')).toBe(true);
        });
    });

    describe('update', () => {
        test('should update settings correctly', () => {
            const settings = new AggregatedFileSettings();

            const result = settings.update({
                enabled: true,
                fileName: 'Updated.md',
                maxTableSummaryLength: 150,
                autoBackup: true
            });

            expect(result).toBe(true);
            expect(settings.enabled).toBe(true);
            expect(settings.fileName).toBe('Updated.md');
            expect(settings.maxTableSummaryLength).toBe(150);
            expect(settings.autoBackup).toBe(true);
        });

        test('should sanitize fileName during update', () => {
            const settings = new AggregatedFileSettings();

            settings.update({ fileName: 'bad<file>name' });

            expect(settings.fileName).toBe('badfilename.md');
        });

        test('should enforce limits on maxTableSummaryLength', () => {
            const settings = new AggregatedFileSettings();

            settings.update({ maxTableSummaryLength: 600 });
            expect(settings.maxTableSummaryLength).toBe(500);

            settings.update({ maxTableSummaryLength: -10 });
            expect(settings.maxTableSummaryLength).toBe(1);
        });
    });

    describe('validate', () => {
        test('should validate correct settings', () => {
            const settings = new AggregatedFileSettings();

            const validation = settings.validate();

            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should detect invalid filename', () => {
            const settings = new AggregatedFileSettings();
            settings.fileName = 'invalid-filename'; // Missing .md

            const validation = settings.validate();

            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('有効なMarkdownファイル名が必要です');
        });

        test('should detect invalid maxTableSummaryLength', () => {
            const settings = new AggregatedFileSettings();
            settings.maxTableSummaryLength = 600;

            const validation = settings.validate();

            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('要約最大文字数は1-500文字の範囲で指定してください');
        });
    });

    describe('serialization', () => {
        test('should serialize and deserialize correctly', () => {
            const original = new AggregatedFileSettings({
                enabled: true,
                fileName: 'Test.md',
                maxTableSummaryLength: 150
            });

            const json = original.toJSON();
            const restored = AggregatedFileSettings.fromJSON(json);

            expect(restored.enabled).toBe(original.enabled);
            expect(restored.fileName).toBe(original.fileName);
            expect(restored.maxTableSummaryLength).toBe(original.maxTableSummaryLength);
        });
    });

    describe('static methods', () => {
        test('should provide default settings', () => {
            const defaults = AggregatedFileSettings.getDefaults();

            expect(defaults).toBeInstanceOf(AggregatedFileSettings);
            expect(defaults.enabled).toBe(false);
            expect(defaults.fileName).toBe('ReadLater_Articles.md');
        });
    });
});