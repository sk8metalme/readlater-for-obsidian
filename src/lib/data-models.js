// ReadLater for Obsidian - Data Models
// 集約記事保存機能のデータモデル定義

/**
 * 記事データモデル
 * 既存のMarkdownGeneratorパターンを拡張し、集約保存対応
 */
class Article {
    constructor(data = {}) {
        // 必須フィールド
        this.id = data.id || this.generateId(data.url, data.extractedAt);
        this.title = data.title || '';
        this.url = data.url || '';
        // Handle savedDate with proper validation
        if (data.savedDate instanceof Date && !isNaN(data.savedDate.getTime())) {
            this.savedDate = data.savedDate;
        } else if (data.savedDate) {
            const parsed = new Date(data.savedDate);
            this.savedDate = !isNaN(parsed.getTime()) ? parsed : new Date();
        } else {
            this.savedDate = new Date();
        }
        
        // オプショナルフィールド
        this.originalTitle = data.originalTitle || data.title || '';
        this.content = data.content || '';
        this.translatedContent = data.translatedContent || '';
        this.summary = data.summary || '';
        this.shortSummary = data.shortSummary || this.generateShortSummary(data.summary);
        this.language = data.language || 'unknown';
        this.detectedLanguage = data.detectedLanguage || 'unknown';
        
        // メタデータ（MarkdownGeneratorパターンを踏襲）
        this.author = data.author || 'Unknown';
        this.domain = data.domain || this.extractDomainFromUrl(this.url);
        this.readingTime = data.readingTime || 'Unknown';
        
        // 処理状態フラグ
        this.translationSkipped = Boolean(data.translationSkipped);
        this.summarySkipped = Boolean(data.summarySkipped);
        this.translationError = data.translationError || null;
        this.summaryError = data.summaryError || null;
        
        // 追加メタデータ（既存パターンとの互換性）
        this.extractedAt = data.extractedAt || new Date().toISOString();
        this.strategy = data.strategy || 'unknown';
        this.keywords = data.keywords || [];
    }
    
    /**
     * 記事IDを生成（URL+日時ハッシュ）
     * @param {string} url - 記事URL
     * @param {string} extractedAt - 抽出日時
     * @returns {string} 記事ID
     */
    generateId(url, extractedAt) {
        const timestamp = extractedAt || new Date().toISOString();
        const combined = `${url}${timestamp}`;
        
        // 簡易ハッシュ生成（既存のパターンに合わせてシンプルに）
        let hash = 0;
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32bit変換
        }
        
        return `article-${Math.abs(hash).toString(16)}`;
    }
    
    /**
     * URLからドメインを抽出
     * @param {string} url - URL
     * @returns {string} ドメイン名
     */
    extractDomainFromUrl(url) {
        try {
            return new URL(url).hostname;
        } catch (error) {
            return 'unknown';
        }
    }
    
    /**
     * 表用の簡潔要約を生成（100文字以内）
     * @param {string} summary - 詳細要約
     * @returns {string} 簡潔要約
     */
    generateShortSummary(summary) {
        if (!summary || typeof summary !== 'string') {
            return '';
        }
        
        const maxLength = 100;
        if (summary.length <= maxLength) {
            return summary;
        }
        
        // 文の境界で切り取る
        const truncated = summary.substring(0, maxLength);
        const lastSentenceEnd = Math.max(
            truncated.lastIndexOf('。'),
            truncated.lastIndexOf('！'),
            truncated.lastIndexOf('？'),
            truncated.lastIndexOf('.')
        );
        
        if (lastSentenceEnd > maxLength * 0.7) { // 70%以上なら文境界で切る
            return truncated.substring(0, lastSentenceEnd + 1);
        } else {
            return truncated.trim() + '...';
        }
    }
    
    /**
     * データ検証
     * @returns {Object} 検証結果 {valid: boolean, errors: Array<string>}
     */
    validate() {
        const errors = [];
        
        if (!this.id || typeof this.id !== 'string') {
            errors.push('記事IDが必須です');
        }
        
        if (!this.title || typeof this.title !== 'string') {
            errors.push('記事タイトルが必須です');
        }
        
        if (!this.url || typeof this.url !== 'string') {
            errors.push('記事URLが必須です');
        } else {
            try {
                new URL(this.url);
            } catch {
                errors.push('有効なURLが必要です');
            }
        }
        
        if (!(this.savedDate instanceof Date) || isNaN(this.savedDate.getTime())) {
            errors.push('有効な保存日時が必要です');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * JSONシリアライゼーション
     * @returns {Object} JSON表現
     */
    toJSON() {
        return {
            id: this.id,
            title: this.title,
            originalTitle: this.originalTitle,
            url: this.url,
            content: this.content,
            translatedContent: this.translatedContent,
            summary: this.summary,
            shortSummary: this.shortSummary,
            savedDate: this.savedDate.toISOString(),
            language: this.language,
            detectedLanguage: this.detectedLanguage,
            author: this.author,
            domain: this.domain,
            readingTime: this.readingTime,
            translationSkipped: this.translationSkipped,
            summarySkipped: this.summarySkipped,
            translationError: this.translationError,
            summaryError: this.summaryError,
            extractedAt: this.extractedAt,
            strategy: this.strategy,
            keywords: this.keywords
        };
    }
    
    /**
     * JSONから復元
     * @param {Object} json - JSON表現
     * @returns {Article} 記事インスタンス
     */
    static fromJSON(json) {
        return new Article({
            ...json,
            savedDate: new Date(json.savedDate)
        });
    }
}

/**
 * 集約ファイルデータモデル
 */
class AggregatedFileData {
    constructor(data = {}) {
        this.filePath = data.filePath || '';
        this.fileName = data.fileName || 'ReadLater_Articles.md';
        this.articles = (data.articles || []).map(article => 
            article instanceof Article ? article : new Article(article)
        );
        this.tableContent = data.tableContent || '';
        this.lastUpdated = data.lastUpdated instanceof Date ? 
            data.lastUpdated : new Date(data.lastUpdated || Date.now());
        
        // 追加のメタデータ
        this.created = data.created instanceof Date ? 
            data.created : new Date(data.created || Date.now());
        this.totalArticles = this.articles.length;
        this.fileSize = data.fileSize || 0;
        this.version = data.version || '1.0.0';
    }
    
    /**
     * 記事を追加
     * @param {Article|Object} article - 追加する記事
     * @returns {boolean} 追加成功
     */
    addArticle(article) {
        try {
            const articleInstance = article instanceof Article ? 
                article : new Article(article);
            
            const validation = articleInstance.validate();
            if (!validation.valid) {
                console.warn('記事データの検証に失敗:', validation.errors);
                return false;
            }
            
            // 重複チェック
            if (this.articles.some(existing => existing.id === articleInstance.id)) {
                console.warn('重複する記事IDです:', articleInstance.id);
                return false;
            }
            
            this.articles.push(articleInstance);
            this.totalArticles = this.articles.length;
            this.lastUpdated = new Date();
            
            return true;
        } catch (error) {
            console.error('記事追加エラー:', error);
            return false;
        }
    }
    
    /**
     * 記事を削除
     * @param {string} articleId - 記事ID
     * @returns {boolean} 削除成功
     */
    removeArticle(articleId) {
        const index = this.articles.findIndex(article => article.id === articleId);
        if (index === -1) {
            return false;
        }
        
        this.articles.splice(index, 1);
        this.totalArticles = this.articles.length;
        this.lastUpdated = new Date();
        
        return true;
    }
    
    /**
     * 記事を検索
     * @param {string} articleId - 記事ID
     * @returns {Article|null} 記事インスタンス
     */
    findArticle(articleId) {
        return this.articles.find(article => article.id === articleId) || null;
    }
    
    /**
     * 記事を日付順でソート
     * @param {boolean} ascending - 昇順（デフォルト: false = 降順）
     * @returns {Array<Article>} ソート済み記事配列
     */
    getSortedArticles(ascending = false) {
        return [...this.articles].sort((a, b) => {
            const dateA = a.savedDate.getTime();
            const dateB = b.savedDate.getTime();
            return ascending ? dateA - dateB : dateB - dateA;
        });
    }
    
    /**
     * 統計情報を取得
     * @returns {Object} 統計情報
     */
    getStatistics() {
        if (this.articles.length === 0) {
            return {
                totalArticles: 0,
                latestSaveDate: null,
                languageDistribution: {},
                averageWordsPerArticle: 0,
                translatedCount: 0,
                summarizedCount: 0
            };
        }
        
        const languageCount = {};
        let totalWords = 0;
        let translatedCount = 0;
        let summarizedCount = 0;
        
        let latestDate = this.articles[0].savedDate;
        
        this.articles.forEach(article => {
            // 言語分布
            const lang = article.detectedLanguage || article.language || 'unknown';
            languageCount[lang] = (languageCount[lang] || 0) + 1;
            
            // 最新日時
            if (article.savedDate > latestDate) {
                latestDate = article.savedDate;
            }
            
            // 単語数計算
            const content = article.translatedContent || article.content || '';
            const words = content.split(/\s+/).filter(word => word.length > 0);
            totalWords += words.length;
            
            // 処理カウント
            if (article.translatedContent && !article.translationSkipped) {
                translatedCount++;
            }
            if (article.summary && !article.summarySkipped) {
                summarizedCount++;
            }
        });
        
        return {
            totalArticles: this.articles.length,
            latestSaveDate: latestDate,
            languageDistribution: languageCount,
            averageWordsPerArticle: Math.round(totalWords / this.articles.length),
            translatedCount,
            summarizedCount
        };
    }
    
    /**
     * データ検証
     * @returns {Object} 検証結果
     */
    validate() {
        const errors = [];
        
        if (!this.fileName || typeof this.fileName !== 'string') {
            errors.push('ファイル名が必須です');
        }
        
        if (!Array.isArray(this.articles)) {
            errors.push('記事配列が必須です');
        } else {
            this.articles.forEach((article, index) => {
                if (!(article instanceof Article)) {
                    errors.push(`記事[${index}]がArticleインスタンスではありません`);
                } else {
                    const validation = article.validate();
                    if (!validation.valid) {
                        errors.push(`記事[${index}]の検証エラー: ${validation.errors.join(', ')}`);
                    }
                }
            });
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * JSONシリアライゼーション
     * @returns {Object} JSON表現
     */
    toJSON() {
        return {
            filePath: this.filePath,
            fileName: this.fileName,
            articles: this.articles.map(article => article.toJSON()),
            tableContent: this.tableContent,
            lastUpdated: this.lastUpdated.toISOString(),
            created: this.created.toISOString(),
            totalArticles: this.totalArticles,
            fileSize: this.fileSize,
            version: this.version
        };
    }
    
    /**
     * JSONから復元
     * @param {Object} json - JSON表現
     * @returns {AggregatedFileData} インスタンス
     */
    static fromJSON(json) {
        return new AggregatedFileData({
            ...json,
            lastUpdated: new Date(json.lastUpdated),
            created: new Date(json.created),
            articles: json.articles.map(Article.fromJSON)
        });
    }
}

/**
 * 集約ファイル設定データモデル
 */
class AggregatedFileSettings {
    constructor(data = {}) {
        this.enabled = Boolean(data.enabled);
        this.fileName = data.fileName || 'ReadLater_Articles.md';
        this.maxTableSummaryLength = Math.max(1, Math.min(500, data.maxTableSummaryLength || 100));
        this.autoBackup = Boolean(data.autoBackup);
        this.tableColumns = this.validateTableColumns(data.tableColumns);
        
        // 追加設定
        this.maxFileSize = data.maxFileSize || 10 * 1024 * 1024; // 10MB
        this.compressionEnabled = Boolean(data.compressionEnabled);
        this.sortOrder = ['newest', 'oldest', 'title'].includes(data.sortOrder) ? 
            data.sortOrder : 'newest';
        this.includeOriginalContent = Boolean(data.includeOriginalContent !== false); // デフォルトtrue
        this.customTemplate = data.customTemplate || null;
    }
    
    /**
     * テーブルカラム設定の検証
     * @param {Array<string>} columns - カラム配列
     * @returns {Array<string>} 検証済みカラム配列
     */
    validateTableColumns(columns) {
        const validColumns = ['title', 'url', 'summary', 'date', 'language', 'author'];
        const defaultColumns = ['title', 'url', 'summary', 'date'];
        
        if (!Array.isArray(columns) || columns.length === 0) {
            return defaultColumns;
        }
        
        const validatedColumns = columns.filter(col => 
            typeof col === 'string' && validColumns.includes(col)
        );
        
        // 最低限のカラムを保証
        const requiredColumns = ['title', 'url'];
        requiredColumns.forEach(required => {
            if (!validatedColumns.includes(required)) {
                validatedColumns.unshift(required);
            }
        });
        
        return validatedColumns.length > 0 ? validatedColumns : defaultColumns;
    }
    
    /**
     * ファイル名の検証とサニタイゼーション
     * @param {string} fileName - ファイル名
     * @returns {string} 安全なファイル名
     */
    sanitizeFileName(fileName) {
        if (!fileName || typeof fileName !== 'string') {
            return 'ReadLater_Articles.md';
        }
        
        // 危険な文字を除去
        let sanitized = fileName
            .replace(/[<>:"/\\|?*]/g, '') // 危険な文字を除去
            // eslint-disable-next-line no-control-regex
            .replace(/[\x00-\x1f]/g, '') // 制御文字を除去
            .replace(/^\.+/, '') // 先頭のドット除去
            .trim();
        
        // 空になった場合はデフォルト
        if (!sanitized) {
            sanitized = 'ReadLater_Articles';
        }
        
        // 拡張子を確保
        if (!sanitized.endsWith('.md')) {
            sanitized += '.md';
        }
        
        // 長さ制限
        if (sanitized.length > 100) {
            const nameWithoutExt = sanitized.slice(0, -3);
            sanitized = nameWithoutExt.slice(0, 97) + '.md';
        }
        
        return sanitized;
    }
    
    /**
     * 設定の更新
     * @param {Object} updates - 更新する設定
     * @returns {boolean} 更新成功
     */
    update(updates) {
        try {
            if (typeof updates.enabled === 'boolean') {
                this.enabled = updates.enabled;
            }
            
            if (updates.fileName) {
                this.fileName = this.sanitizeFileName(updates.fileName);
            }
            
            if (typeof updates.maxTableSummaryLength === 'number') {
                this.maxTableSummaryLength = Math.max(1, Math.min(500, updates.maxTableSummaryLength));
            }
            
            if (typeof updates.autoBackup === 'boolean') {
                this.autoBackup = updates.autoBackup;
            }
            
            if (updates.tableColumns) {
                this.tableColumns = this.validateTableColumns(updates.tableColumns);
            }
            
            return true;
        } catch (error) {
            console.error('設定更新エラー:', error);
            return false;
        }
    }
    
    /**
     * データ検証
     * @returns {Object} 検証結果
     */
    validate() {
        const errors = [];
        
        if (!this.fileName || !this.fileName.endsWith('.md')) {
            errors.push('有効なMarkdownファイル名が必要です');
        }
        
        if (this.maxTableSummaryLength < 1 || this.maxTableSummaryLength > 500) {
            errors.push('要約最大文字数は1-500文字の範囲で指定してください');
        }
        
        if (!Array.isArray(this.tableColumns) || this.tableColumns.length === 0) {
            errors.push('テーブルカラム設定が必要です');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * JSONシリアライゼーション
     * @returns {Object} JSON表現
     */
    toJSON() {
        return {
            enabled: this.enabled,
            fileName: this.fileName,
            maxTableSummaryLength: this.maxTableSummaryLength,
            autoBackup: this.autoBackup,
            tableColumns: this.tableColumns,
            maxFileSize: this.maxFileSize,
            compressionEnabled: this.compressionEnabled,
            sortOrder: this.sortOrder,
            includeOriginalContent: this.includeOriginalContent,
            customTemplate: this.customTemplate
        };
    }
    
    /**
     * JSONから復元
     * @param {Object} json - JSON表現
     * @returns {AggregatedFileSettings} インスタンス
     */
    static fromJSON(json) {
        return new AggregatedFileSettings(json);
    }
    
    /**
     * デフォルト設定を取得
     * @returns {AggregatedFileSettings} デフォルト設定
     */
    static getDefaults() {
        return new AggregatedFileSettings();
    }
}

// モジュールのエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        Article, 
        AggregatedFileData, 
        AggregatedFileSettings 
    };
} else {
    // ブラウザ環境での利用
    if (typeof self !== 'undefined') {
        self.Article = Article;
        self.AggregatedFileData = AggregatedFileData;
        self.AggregatedFileSettings = AggregatedFileSettings;
    } else if (typeof window !== 'undefined') {
        window.Article = Article;
        window.AggregatedFileData = AggregatedFileData;
        window.AggregatedFileSettings = AggregatedFileSettings;
    }
}