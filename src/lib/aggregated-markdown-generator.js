// ReadLater for Obsidian - Aggregated Markdown Generator
// 集約Markdownファイル全体の生成を担当するクラス

// 既存モジュールのインポート（実際のブラウザ環境ではself.*から利用）
const { MarkdownGenerator } = require('./markdown-generator.js');
const { ArticleTableManager } = require('./article-table-manager.js');

/**
 * 集約Markdownファイル生成クラス
 */
class AggregatedMarkdownGenerator {
    constructor(dependencies = {}) {
        // 依存関係の注入（テスト用）
        this.markdownGenerator = dependencies.markdownGenerator || new MarkdownGenerator();
        this.tableManager = dependencies.tableManager || new ArticleTableManager();
        
        this.options = {
            includeTableOfContents: true,
            includeSummaryStats: true,
            defaultTitle: 'ReadLater Articles',
            ...dependencies.options
        };
    }

    /**
     * 複数記事から集約Markdownを生成
     * @param {Array<Object>} articles - 記事配列
     * @param {Object} settings - ユーザー設定
     * @returns {Promise<string>} 集約Markdownコンテンツ
     */
    async generateAggregatedMarkdown(articles, settings) {
        const sections = [];

        // ファイルヘッダー
        sections.push(this.generateFileHeader(settings));

        // 目次（オプション）
        if (this.options.includeTableOfContents) {
            sections.push(this.generateTableOfContents(articles));
        }

        // 記事一覧表
        sections.push(this.generateArticleTable(articles, settings));

        // 記事詳細セクション
        sections.push(this.generateArticleDetailsSection(articles));

        // ファイルフッター
        sections.push(this.generateFileFooter(articles.length));

        return sections.join('\n\n');
    }

    /**
     * 既存コンテンツに記事を追加
     * @param {string} existingContent - 既存ファイル内容
     * @param {Object} newArticle - 新規記事
     * @param {Object} settings - ユーザー設定
     * @returns {Promise<string>} 更新されたコンテンツ
     */
    async appendArticleContent(existingContent, newArticle, settings) {
        if (!existingContent || !this.isValidAggregatedFile(existingContent)) {
            // 無効なファイルの場合は新規作成
            return await this.generateAggregatedMarkdown([newArticle], settings);
        }

        let updatedContent = existingContent;

        // テーブルセクションの更新
        updatedContent = this.appendToArticleTable(updatedContent, newArticle, settings);

        // 詳細セクションに記事を追加
        updatedContent = this.appendToDetailsSection(updatedContent, newArticle);

        // 目次の更新
        updatedContent = this.updateTableOfContents(updatedContent);

        return updatedContent;
    }

    /**
     * ファイルヘッダーの生成
     * @param {Object} settings - ユーザー設定
     * @returns {string} ファイルヘッダー
     */
    generateFileHeader(settings) {
        const title = settings.title || this.options.defaultTitle;
        const now = new Date().toISOString().split('T')[0];
        
        return `# ${title}

*作成日: ${now}*
*更新日: ${now}*`;
    }

    /**
     * 目次の生成
     * @param {Array<Object>} articles - 記事配列
     * @returns {string} 目次セクション
     */
    generateTableOfContents(articles) {
        if (!articles || articles.length === 0) {
            return `## 目次

記事はまだ保存されていません。`;
        }

        const tocItems = articles.map(article => {
            const anchor = this.createAnchorLink(article.title);
            return `- [${article.title}](#${anchor})`;
        });

        return `## 目次

${tocItems.join('\n')}`;
    }

    /**
     * 記事一覧表の生成
     * @param {Array<Object>} articles - 記事配列
     * @param {Object} settings - ユーザー設定
     * @returns {string} 記事一覧表
     */
    generateArticleTable(articles, settings) {
        const header = this.tableManager.generateTableHeader(settings.tableColumns);
        
        if (!articles || articles.length === 0) {
            return header;
        }

        const rows = articles.map(article => 
            this.tableManager.formatTableRow(article, settings.tableColumns)
        );

        return header + '\n' + rows.join('\n');
    }

    /**
     * 記事詳細セクション全体の生成
     * @param {Array<Object>} articles - 記事配列
     * @returns {string} 記事詳細セクション
     */
    generateArticleDetailsSection(articles) {
        if (!articles || articles.length === 0) {
            return `## 記事詳細

記事はまだ保存されていません。`;
        }

        const sections = articles.map(article => 
            this.generateArticleDetailSection(article)
        );

        return `## 記事詳細

${sections.join('\n\n')}`;
    }

    /**
     * 個別記事の詳細セクションを生成
     * @param {Object} article - 記事データ
     * @returns {string} 記事詳細セクション
     */
    generateArticleDetailSection(article) {
        const sections = [];
        
        // 記事タイトル
        sections.push(`### ${article.title}`);
        
        // 記事情報
        const date = article.savedDate instanceof Date ? 
            article.savedDate.toISOString().split('T')[0] : 
            String(article.savedDate || '');
        
        sections.push(`**元記事**: [${article.title}](${article.url})`);
        sections.push(`**保存日**: ${date}`);
        
        // 要約（利用可能な場合）
        if (article.summary) {
            sections.push(`## 要約\n\n${article.summary}`);
        }
        
        // メインコンテンツ
        if (article.translatedContent && !article.translationSkipped) {
            sections.push(`## 翻訳済み内容\n\n${article.translatedContent}`);
            
            // 原文（折りたたみ）
            if (article.content) {
                sections.push(`<details>\n<summary>原文を表示</summary>\n\n${article.content}\n\n</details>`);
            }
        } else {
            // 翻訳がない場合または翻訳がスキップされた場合
            const content = article.content || 'コンテンツが取得できませんでした。';
            sections.push(`## 内容\n\n${content}`);
        }
        
        return sections.join('\n\n');
    }

    /**
     * 目次を更新
     * @param {string} content - ファイルコンテンツ
     * @returns {string} 更新されたコンテンツ
     */
    updateTableOfContents(content) {
        // 記事タイトルを抽出
        const titleMatches = content.match(/### (.+)/g);
        const articles = titleMatches ? titleMatches.map(match => ({
            title: match.replace('### ', '')
        })) : [];

        // 新しい目次を生成
        const newToc = this.generateTableOfContents(articles);

        // 既存の目次を置換
        const tocRegex = /## 目次[\s\S]*?(?=\n## (?!目次)|$)/;
        if (tocRegex.test(content)) {
            return content.replace(tocRegex, newToc);
        } else {
            // 目次がない場合は追加
            const headerEndIndex = content.indexOf('\n\n') + 2;
            return content.slice(0, headerEndIndex) + newToc + '\n\n' + content.slice(headerEndIndex);
        }
    }

    /**
     * ファイルフッターの生成
     * @param {number} articleCount - 記事数
     * @returns {string} ファイルフッター
     */
    generateFileFooter(articleCount) {
        const now = new Date().toISOString().split('T')[0];
        
        return `---

*Generated by ReadLater for Obsidian*
*総記事数: ${articleCount}件*
*最終更新: ${now}*`;
    }

    /**
     * アンカーリンクの作成
     * @param {string} title - タイトル
     * @returns {string} アンカーリンク
     */
    createAnchorLink(title) {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\s]/g, '-')
            .replace(/\s+/g, '-')
            .replace(/&/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    /**
     * 記事テーブルに新規記事を追加
     * @param {string} content - ファイルコンテンツ
     * @param {Object} article - 新規記事
     * @param {Object} settings - ユーザー設定
     * @returns {string} 更新されたコンテンツ
     */
    appendToArticleTable(content, article, settings) {
        // テーブルセクションを抽出
        const tableRegex = /(\| タイトル \|[\s\S]*?)(?=\n## |$)/;
        const tableMatch = content.match(tableRegex);
        
        if (tableMatch) {
            const existingTable = tableMatch[1];
            const updatedTable = this.tableManager.addArticleToTable(article, existingTable);
            return content.replace(tableMatch[1], updatedTable);
        }
        
        return content;
    }

    /**
     * 詳細セクションに記事を追加
     * @param {string} content - ファイルコンテンツ
     * @param {Object} article - 新規記事
     * @returns {string} 更新されたコンテンツ
     */
    appendToDetailsSection(content, article) {
        const newDetail = this.generateArticleDetailSection(article);
        
        // 詳細セクションの最後に追加
        const detailsRegex = /(## 記事詳細[\s\S]*?)(\n---)/;
        const detailsMatch = content.match(detailsRegex);
        
        if (detailsMatch) {
            const updatedDetails = detailsMatch[1] + '\n\n' + newDetail;
            return content.replace(detailsMatch[1], updatedDetails);
        } else {
            // 詳細セクションが見つからない場合はファイル末尾に追加
            return content + '\n\n' + newDetail;
        }
    }

    /**
     * 有効な集約ファイルかチェック
     * @param {string} content - ファイルコンテンツ
     * @returns {boolean} 有効かどうか
     */
    isValidAggregatedFile(content) {
        if (!content || typeof content !== 'string') {
            return false;
        }

        // 必要なセクションの存在確認
        const hasTitle = /^# /.test(content);
        const hasTable = /\| タイトル \|/.test(content);
        const hasDetails = /## 記事詳細/.test(content);

        return hasTitle && hasTable && hasDetails;
    }
}

// モジュールのエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AggregatedMarkdownGenerator };
} else {
    // ブラウザ環境での利用
    if (typeof self !== 'undefined') {
        self.AggregatedMarkdownGenerator = AggregatedMarkdownGenerator;
    } else if (typeof window !== 'undefined') {
        window.AggregatedMarkdownGenerator = AggregatedMarkdownGenerator;
    }
}