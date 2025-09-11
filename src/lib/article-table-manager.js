// ReadLater for Obsidian - Article Table Manager
// Markdownテーブルの生成・操作を担当するユーティリティクラス

/**
 * 記事一覧表管理クラス
 */
class ArticleTableManager {
    constructor(config = {}) {
        this.config = {
            dateFormat: 'YYYY-MM-DD',
            maxSummaryLength: 100,
            escapeHtml: false,
            defaultColumns: ['title', 'url', 'summary', 'date'],
            columnLabels: {
                title: 'タイトル',
                url: 'URL',
                summary: '要約',
                date: '日時',
                domain: 'ドメイン',
                author: '著者'
            },
            ...config
        };
        
        // エラーハンドラーの初期化
        this.errorHandler = new (typeof ErrorHandler !== 'undefined' ? ErrorHandler : 
            require('../utils/error-handler.js').ErrorHandler)();
    }

    /**
     * Markdownテーブルのヘッダーを生成
     * @param {Array<string>} columns - カラム名配列
     * @returns {string} テーブルヘッダー
     */
    generateTableHeader(columns = null) {
        const cols = columns && columns.length > 0 ? columns : this.config.defaultColumns;
        
        // ヘッダー行の生成
        const headerLabels = cols.map(col => this.config.columnLabels[col] || col);
        const headerRow = '| ' + headerLabels.join(' | ') + ' |';
        
        // セパレーター行の生成
        const separatorRow = '|' + cols.map(() => '-----').join('|') + '|';
        
        return headerRow + '\n' + separatorRow;
    }

    /**
     * 記事データをテーブル行にフォーマット
     * @param {Object} article - 記事データ
     * @param {Array<string>} columns - カラム名配列
     * @returns {string} テーブル行
     */
    formatTableRow(article, columns = null) {
        const cols = columns && columns.length > 0 ? columns : this.config.defaultColumns;
        
        const cells = cols.map(columnName => {
            let cellValue = '';
            
            switch (columnName) {
                case 'title':
                    cellValue = article.title || '';
                    break;
                case 'url':
                    cellValue = article.url || '';
                    break;
                case 'summary':
                    cellValue = this.truncateSummary(article.shortSummary || article.summary || '');
                    break;
                case 'date':
                    cellValue = this.formatDate(article.savedDate);
                    break;
                case 'domain':
                    cellValue = this.extractDomain(article.url);
                    break;
                case 'author':
                    cellValue = article.author || '';
                    break;
                default:
                    cellValue = article[columnName] || '';
            }
            
            return this.escapeMarkdownTableCell(cellValue);
        });
        
        return '| ' + cells.join(' | ') + ' |';
    }

    /**
     * 複数記事からテーブルを生成
     * @param {Array<Object>} articles - 記事配列
     * @param {Array<string>} columns - カラム名配列
     * @returns {string} 生成されたテーブル
     */
    generateTableFromArticles(articles, columns = null) {
        try {
            if (!Array.isArray(articles)) {
                articles = [];
            }

            const header = this.generateTableHeader(columns);
            
            if (articles.length === 0) {
                return header;
            }

            const rows = [];
            for (const article of articles) {
                try {
                    const row = this.formatTableRow(article, columns);
                    if (row && row.trim()) {
                        rows.push(row);
                    }
                } catch (error) {
                    // エラーが発生した記事はスキップして続行
                    console.warn('ArticleTableManager: Skipping article due to formatting error:', error.message);
                    this.errorHandler.handleError(error, { 
                        operation: 'formatTableRow', 
                        articleTitle: article?.title 
                    });
                }
            }

            return rows.length > 0 ? header + '\n' + rows.join('\n') : header;
            
        } catch (error) {
            const errorResult = this.errorHandler.handleError(
                new Error(`テーブル生成に失敗: ${error.message}`),
                { operation: 'generateTableFromArticles', articlesCount: articles?.length || 0 }
            );
            
            // エラー時でも最低限のテーブル構造を返す
            return this.generateTableHeader(columns);
        }
    }

    /**
     * 既存テーブルに記事を追加
     * @param {Object} article - 記事データ
     * @param {string} existingTable - 既存のテーブル文字列
     * @returns {string} 更新されたテーブル
     */
    addArticleToTable(article, existingTable) {
        if (!existingTable || !this.isValidMarkdownTable(existingTable)) {
            // 無効なテーブルの場合は新規作成
            const header = this.generateTableHeader();
            const row = this.formatTableRow(article);
            return header + '\n' + row;
        }

        // 既存テーブルに行を追加
        const newRow = this.formatTableRow(article);
        return existingTable + '\n' + newRow;
    }

    /**
     * URLからドメインを抽出
     * @param {string} url - URL
     * @returns {string} ドメイン名
     */
    extractDomain(url) {
        if (!url || typeof url !== 'string') {
            return '';
        }

        try {
            const urlObj = new URL(url);
            let hostname = urlObj.hostname;
            
            // www プレフィックスを除去
            if (hostname.startsWith('www.')) {
                hostname = hostname.substring(4);
            }
            
            return hostname;
        } catch (error) {
            // 無効なURLの場合は元の文字列をそのまま返す
            return url;
        }
    }

    /**
     * 日付をフォーマット
     * @param {Date|string} date - 日付
     * @returns {string} フォーマットされた日付文字列
     */
    formatDate(date) {
        if (!date) {
            return '';
        }

        let dateObj;
        if (date instanceof Date) {
            dateObj = date;
        } else {
            dateObj = new Date(date);
        }

        // 無効な日付の場合
        if (isNaN(dateObj.getTime())) {
            return '';
        }

        // 設定に応じたフォーマット
        switch (this.config.dateFormat) {
            case 'DD/MM/YYYY':
                return this.formatDateDDMMYYYY(dateObj);
            case 'MM/DD/YYYY':
                return this.formatDateMMDDYYYY(dateObj);
            case 'YYYY-MM-DD':
            default:
                return dateObj.toISOString().split('T')[0];
        }
    }

    /**
     * DD/MM/YYYY形式で日付をフォーマット
     * @param {Date} date - 日付オブジェクト
     * @returns {string} DD/MM/YYYY形式の日付
     */
    formatDateDDMMYYYY(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    /**
     * MM/DD/YYYY形式で日付をフォーマット
     * @param {Date} date - 日付オブジェクト
     * @returns {string} MM/DD/YYYY形式の日付
     */
    formatDateMMDDYYYY(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
    }

    /**
     * HTMLエスケープ処理
     * @param {string} content - エスケープする内容
     * @returns {string} エスケープされた内容
     */
    escapeHtml(content) {
        if (!content || typeof content !== 'string') {
            return '';
        }

        return content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    /**
     * Markdownテーブルセル用のエスケープ処理
     * @param {string} content - セル内容
     * @returns {string} エスケープされた内容
     */
    escapeMarkdownTableCell(content) {
        if (!content || typeof content !== 'string') {
            return '';
        }

        let processedContent = content;
        
        // HTMLエスケープ（設定で有効な場合）
        if (this.config.escapeHtml) {
            processedContent = this.escapeHtml(processedContent);
        }

        return processedContent
            // パイプ文字をエスケープ
            .replace(/\|/g, '\\|')
            // Markdownシンタックスをエスケープ
            .replace(/\*/g, '\\*')
            .replace(/`/g, '\\`')
            .replace(/_/g, '\\_')
            .replace(/~/g, '\\~')
            .replace(/#/g, '\\#')
            .replace(/>/g, '\\>')
            .replace(/\[/g, '\\[')
            .replace(/\]/g, '\\]')
            .replace(/\(/g, '\\(')
            .replace(/\)/g, '\\)')
            .replace(/!/g, '\\!')
            // 改行を空白に置換（テーブルセルでは改行不可）
            .replace(/\r?\n/g, ' ')
            // 連続する空白を単一の空白に
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * 要約文を指定長に切り詰め
     * @param {string} summary - 要約文
     * @returns {string} 切り詰められた要約文
     */
    truncateSummary(summary) {
        if (!summary || typeof summary !== 'string') {
            return '';
        }

        const maxLength = this.config.maxSummaryLength;
        if (summary.length <= maxLength) {
            return summary;
        }

        return summary.substring(0, maxLength - 3) + '...';
    }

    /**
     * 有効なMarkdownテーブルかチェック
     * @param {string} tableContent - テーブル内容
     * @returns {boolean} 有効なテーブルかどうか
     */
    isValidMarkdownTable(tableContent) {
        if (!tableContent || typeof tableContent !== 'string') {
            return false;
        }

        const lines = tableContent.trim().split('\n');
        if (lines.length < 2) {
            return false;
        }

        // ヘッダー行のチェック
        if (!lines[0].startsWith('|') || !lines[0].endsWith('|')) {
            return false;
        }

        // セパレーター行のチェック
        if (!lines[1].match(/^\|[\s-\|]+\|$/)) {
            return false;
        }

        return true;
    }
}

// モジュールのエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ArticleTableManager };
} else {
    // ブラウザ環境での利用
    const g = (typeof self !== 'undefined') ? self : 
              (typeof window !== 'undefined') ? window : globalThis;
    g.ArticleTableManager = ArticleTableManager;
}