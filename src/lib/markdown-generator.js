// ReadLater for Obsidian - Markdown Generator Library
// HTML→Markdown変換とMarkdownファイル生成を担当

/**
 * Markdownファイル生成の主要クラス
 */
class MarkdownGenerator {
    constructor(options = {}) {
        this.options = {
            includeMetadata: true,
            includeBacklinks: true,
            includeImages: false, // Phase 2で実装予定
            dateFormat: 'YYYY-MM-DD',
            ...options
        };
        
        this.htmlToMarkdown = new HTMLToMarkdownConverter();
    }
    
    /**
     * 記事データからMarkdownファイルを生成
     * @param {Object} articleData - 記事データ
     * @param {Object} userSettings - ユーザー設定
     * @returns {Promise<Object>} 生成結果
     */
    async generateMarkdown(articleData, userSettings = {}) {
        try {
            console.log('MarkdownGenerator: Starting markdown generation');
            
            // ファイル名の生成
            const filename = this.generateFilename(articleData, userSettings);
            
            // フロントマターの生成
            const frontmatter = this.generateFrontmatter(articleData);
            
            // コンテンツのMarkdown変換
            const markdownContent = await this.convertContentToMarkdown(articleData);
            
            // 要約セクションの生成（将来のClaude CLI連携用）
            const summarySection = await this.generateSummarySection(articleData);
            
            // 完全なMarkdownの組み立て
            const fullMarkdown = this.assembleFullMarkdown({
                frontmatter,
                articleData,
                markdownContent,
                summarySection
            });
            
            console.log('MarkdownGenerator: Markdown generation completed', {
                filename,
                contentLength: fullMarkdown.length
            });
            
            return {
                filename,
                content: fullMarkdown,
                metadata: articleData.metadata,
                generatedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('MarkdownGenerator: Generation failed', error);
            throw new Error(`Markdown生成に失敗しました: ${error.message}`);
        }
    }
    
    /**
     * ファイル名生成
     * @param {Object} articleData - 記事データ
     * @param {Object} userSettings - ユーザー設定
     * @returns {string} ファイル名
     */
    generateFilename(articleData, userSettings) {
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const safeTitle = this.sanitizeFilename(articleData.title);
        
        const namingStyle = userSettings.fileNaming || 'date-title';
        
        switch (namingStyle) {
            case 'title-date':
                return `${safeTitle}_${date}.md`;
            case 'title-only':
                return `${safeTitle}.md`;
            case 'date-title':
            default:
                return `${date}_${safeTitle}.md`;
        }
    }
    
    /**
     * ファイル名に安全な文字列を生成
     * @param {string} title - タイトル
     * @returns {string} 安全なファイル名
     */
    sanitizeFilename(title) {
        return title
            .replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]/g, '') // 英数字、ひらがな、カタカナ、漢字、スペースのみ
            .replace(/\s+/g, '_') // スペースをアンダースコアに
            .slice(0, 50) // 最大50文字
            .trim();
    }
    
    /**
     * フロントマター生成
     * @param {Object} articleData - 記事データ
     * @returns {string} フロントマター
     */
    generateFrontmatter(articleData) {
        const metadata = articleData.metadata || {};
        const date = new Date().toISOString().split('T')[0];
        
        const now = new Date();
        const time = now.toTimeString().split(' ')[0];
        
        const frontmatter = {
            // 基本情報
            title: this.escapeYamlString(articleData.translatedTitle || articleData.title),
            originalTitle: articleData.translatedTitle ? this.escapeYamlString(articleData.title) : undefined,
            url: articleData.url,
            domain: articleData.domain,
            
            // 日時情報（Obsidian連携用）
            date: date,
            time: time,
            created: now.toISOString(),
            
            // タグ（Obsidian用）
            tags: ['ReadLater', 'article'],
            type: 'article',
            source: 'web',
            
            // 記事メタデータ
            author: metadata.author || 'Unknown',
            readingTime: metadata.readingTime || 'Unknown',
            language: metadata.language || 'unknown',
            detectedLanguage: articleData.detectedLanguage || 'unknown',
            extractedAt: articleData.extractedAt,
            strategy: articleData.strategy || 'unknown',
            
            // Obsidian用の追加フィールド
            aliases: generateAliases(articleData),
            cssclass: 'readlater-article',
            publish: false
        };
        
        // Claude AI処理情報
        if (articleData.translatedContent) {
            frontmatter.translated = !articleData.translationSkipped;
            frontmatter.translationSource = articleData.detectedLanguage;
            frontmatter.translationDate = date;
        }
        
        if (articleData.summary) {
            frontmatter.aiSummary = !articleData.summarySkipped;
            frontmatter.summaryWordCount = articleData.summaryWordCount;
            frontmatter.summaryDate = date;
        }
        
        if (articleData.keywords && articleData.keywords.length > 0) {
            frontmatter.aiKeywords = articleData.keywords;
            frontmatter.tags = [...frontmatter.tags, ...articleData.keywords.slice(0, 3)]; // 上位3つをタグに追加
        }
        
        // ファイルサイズ情報
        if (articleData.content) {
            frontmatter.wordCount = articleData.content.split(/\s+/).length;
            frontmatter.charCount = articleData.content.length;
        }
        
        // オプションでメタデータを追加
        if (metadata.publishDate) {
            frontmatter.publishDate = metadata.publishDate;
        }
        
        if (metadata.description) {
            frontmatter.description = this.escapeYamlString(metadata.description);
        }
        
        if (metadata.keywords) {
            frontmatter.keywords = metadata.keywords;
        }
        
        // YAML形式で出力
        let yaml = '---\n';
        for (const [key, value] of Object.entries(frontmatter)) {
            if (Array.isArray(value)) {
                yaml += `${key}:\n`;
                value.forEach(item => {
                    yaml += `  - "${this.escapeYamlString(item)}"\n`;
                });
            } else {
                yaml += `${key}: "${value}"\n`;
            }
        }
        yaml += '---\n';
        
        return yaml;
    }
    
    /**
     * YAML文字列のエスケープ
     * @param {string} str - エスケープする文字列
     * @returns {string} エスケープされた文字列
     */
    escapeYamlString(str) {
        if (typeof str !== 'string') return str;
        return str.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    }
    
    /**
     * コンテンツのMarkdown変換
     * @param {Object} articleData - 記事データ
     * @returns {Promise<string>} Markdown形式のコンテンツ
     */
    async convertContentToMarkdown(articleData) {
        if (!articleData.content) {
            return 'コンテンツが取得できませんでした。';
        }
        
        // プレーンテキストの場合はそのまま使用
        if (typeof articleData.content === 'string') {
            return this.formatPlainTextAsMarkdown(articleData.content);
        }
        
        // HTMLの場合はMarkdownに変換
        return await this.htmlToMarkdown.convert(articleData.content);
    }
    
    /**
     * プレーンテキストをMarkdown形式にフォーマット
     * @param {string} text - プレーンテキスト
     * @returns {string} Markdown形式のテキスト
     */
    formatPlainTextAsMarkdown(text) {
        if (!text) return '';
        
        // 段落の分離と整形
        let formatted = text
            .replace(/\n\s*\n/g, '\n\n') // 複数改行を2つに統一
            .replace(/([.!?。！？])\s*\n/g, '$1\n\n') // 文末改行を段落区切りに
            .trim();
        
        // 長い段落を適切に分割
        formatted = formatted.replace(/(.{200,}?[.!?。！？])\s+/g, '$1\n\n');
        
        return formatted;
    }
    
    /**
     * 要約セクション生成（Claude CLI連携対応）
     * @param {Object} articleData - 記事データ
     * @returns {Promise<string>} 要約セクション
     */
    async generateSummarySection(articleData) {
        // Claude AI要約がある場合はそれを使用
        if (articleData.summary && !articleData.summarySkipped) {
            return `## 📄 AI要約\n\n${articleData.summary}\n`;
        }
        
        // 翻訳された内容がある場合
        const content = articleData.translatedContent || articleData.content || '';
        const wordCount = content.split(/\s+/).length;
        
        if (wordCount < 100) {
            return '## 📄 記事概要\n\n短い記事のため、要約は省略されています。\n';
        }
        
        // AI要約が失敗した場合は簡易的な抜粋
        const excerpt = content.slice(0, 200).trim() + '...';
        
        let section = `## 📄 記事概要\n\n${excerpt}\n`;
        
        // エラー情報があれば追加
        if (articleData.summaryError) {
            section += `\n*⚠️ AI要約の生成に失敗しました: ${articleData.summaryError}*\n`;
        }
        
        return section;
    }
    
    /**
     * 完全なMarkdownの組み立て
     * @param {Object} components - 各コンポーネント
     * @returns {string} 完全なMarkdown
     */
    assembleFullMarkdown({ frontmatter, articleData, markdownContent, summarySection }) {
        const sections = [];
        
        // フロントマター
        sections.push(frontmatter);
        
        // タイトル
        sections.push(`# ${articleData.title}\n`);
        
        // 記事情報
        sections.push(this.generateArticleInfo(articleData));
        
        // 要約セクション
        if (summarySection) {
            sections.push(summarySection);
        }
        
        // メインコンテンツ（翻訳優先）
        if (articleData.translatedContent && !articleData.translationSkipped) {
            sections.push('## 📖 翻訳済み記事内容\n');
            sections.push(markdownContent);
            
            // 翻訳エラーがあれば注記
            if (articleData.translationError) {
                sections.push(`\n*⚠️ 翻訳処理中にエラーが発生しました: ${articleData.translationError}*\n`);
            }
            
            // 原文も含める（折りたたみ形式）
            if (articleData.content) {
                sections.push('\n<details>\n<summary>📄 原文を表示</summary>\n\n');
                sections.push(this.formatPlainTextAsMarkdown(articleData.content));
                sections.push('\n</details>\n');
            }
        } else {
            sections.push('## 📖 記事内容\n');
            sections.push(markdownContent);
        }
        
        // フッター
        sections.push(this.generateFooter(articleData));
        
        return sections.join('\n');
    }
    
    /**
     * 記事情報セクション生成
     * @param {Object} articleData - 記事データ
     * @returns {string} 記事情報セクション
     */
    generateArticleInfo(articleData) {
        const metadata = articleData.metadata || {};
        const date = new Date().toISOString().split('T')[0];
        
        let info = `**📍 元記事**: [${articleData.title}](${articleData.url})\n`;
        info += `**🌐 ドメイン**: ${articleData.domain}\n`;
        info += `**📅 保存日**: ${date}\n`;
        
        if (metadata.author && metadata.author !== 'Unknown') {
            info += `**✍️ 著者**: ${metadata.author}\n`;
        }
        
        if (metadata.publishDate && metadata.publishDate !== 'Unknown') {
            const publishDate = new Date(metadata.publishDate).toLocaleDateString('ja-JP');
            info += `**📊 公開日**: ${publishDate}\n`;
        }
        
        if (metadata.readingTime && metadata.readingTime !== 'Unknown') {
            info += `**⏱️ 読了時間**: 約${metadata.readingTime}分\n`;
        }
        
        if (metadata.language && metadata.language !== 'unknown') {
            info += `**🗣️ 言語**: ${metadata.language}\n`;
        }
        
        return info + '\n';
    }
    
    /**
     * フッター生成
     * @param {Object} articleData - 記事データ
     * @returns {string} フッター
     */
    generateFooter(articleData) {
        const timestamp = new Date().toLocaleString('ja-JP');
        
        return `\n---\n\n*📱 Generated by ReadLater for Obsidian*\n*🕒 ${timestamp}*\n*🎯 Strategy: ${articleData.strategy || 'unknown'}*`;
    }
}

/**
 * HTML→Markdown変換クラス
 */
class HTMLToMarkdownConverter {
    constructor() {
        this.converters = new Map([
            ['h1', this.convertHeading.bind(this, 1)],
            ['h2', this.convertHeading.bind(this, 2)],
            ['h3', this.convertHeading.bind(this, 3)],
            ['h4', this.convertHeading.bind(this, 4)],
            ['h5', this.convertHeading.bind(this, 5)],
            ['h6', this.convertHeading.bind(this, 6)],
            ['p', this.convertParagraph.bind(this)],
            ['strong', this.convertStrong.bind(this)],
            ['b', this.convertStrong.bind(this)],
            ['em', this.convertEmphasis.bind(this)],
            ['i', this.convertEmphasis.bind(this)],
            ['a', this.convertLink.bind(this)],
            ['img', this.convertImage.bind(this)],
            ['ul', this.convertUnorderedList.bind(this)],
            ['ol', this.convertOrderedList.bind(this)],
            ['li', this.convertListItem.bind(this)],
            ['blockquote', this.convertBlockquote.bind(this)],
            ['code', this.convertInlineCode.bind(this)],
            ['pre', this.convertCodeBlock.bind(this)],
            ['br', this.convertLineBreak.bind(this)]
        ]);
    }
    
    /**
     * HTMLをMarkdownに変換
     * @param {string|Element} html - HTML文字列または要素
     * @returns {Promise<string>} Markdown文字列
     */
    async convert(html) {
        try {
            let element;
            
            if (typeof html === 'string') {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                element = doc.body;
            } else if (html instanceof Element) {
                element = html;
            } else {
                throw new Error('Invalid HTML input');
            }
            
            return this.convertElement(element);
            
        } catch (error) {
            console.error('HTMLToMarkdownConverter: Conversion failed', error);
            // フォールバック: プレーンテキストとして返す
            const text = typeof html === 'string' ? 
                new DOMParser().parseFromString(html, 'text/html').body.textContent :
                html.textContent;
            return text || '';
        }
    }
    
    /**
     * DOM要素をMarkdownに変換
     * @param {Element} element - DOM要素
     * @returns {string} Markdown文字列
     */
    convertElement(element) {
        if (!element) return '';
        
        const tagName = element.tagName?.toLowerCase();
        const converter = this.converters.get(tagName);
        
        if (converter) {
            return converter(element);
        }
        
        // デフォルト: 子要素を再帰的に処理
        return this.convertChildren(element);
    }
    
    /**
     * 子要素を再帰的に変換
     * @param {Element} element - 親要素
     * @returns {string} 変換された文字列
     */
    convertChildren(element) {
        let result = '';
        
        for (const child of element.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                result += child.textContent;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                result += this.convertElement(child);
            }
        }
        
        return result;
    }
    
    // 個別要素の変換メソッド
    
    convertHeading(level, element) {
        const text = this.convertChildren(element).trim();
        return '#'.repeat(level) + ' ' + text + '\n\n';
    }
    
    convertParagraph(element) {
        const text = this.convertChildren(element).trim();
        return text ? text + '\n\n' : '';
    }
    
    convertStrong(element) {
        const text = this.convertChildren(element);
        return `**${text}**`;
    }
    
    convertEmphasis(element) {
        const text = this.convertChildren(element);
        return `*${text}*`;
    }
    
    convertLink(element) {
        const text = this.convertChildren(element);
        const href = element.getAttribute('href') || '';
        
        if (!href || href.startsWith('#')) {
            return text; // 内部リンクはテキストのみ
        }
        
        return `[${text}](${href})`;
    }
    
    convertImage(element) {
        const alt = element.getAttribute('alt') || '';
        const src = element.getAttribute('src') || '';
        
        if (!src) return '';
        
        // Phase 1では画像のMarkdown記法のみ
        // Phase 2で画像ダウンロード機能を実装予定
        return `![${alt}](${src})`;
    }
    
    convertUnorderedList(element) {
        const items = this.convertChildren(element);
        return items + '\n';
    }
    
    convertOrderedList(element) {
        const items = this.convertChildren(element);
        return items + '\n';
    }
    
    convertListItem(element) {
        const text = this.convertChildren(element).trim();
        const parent = element.parentElement;
        
        if (parent && parent.tagName.toLowerCase() === 'ol') {
            // 番号付きリスト
            const index = Array.from(parent.children).indexOf(element) + 1;
            return `${index}. ${text}\n`;
        } else {
            // 箇条書き
            return `- ${text}\n`;
        }
    }
    
    convertBlockquote(element) {
        const text = this.convertChildren(element).trim();
        return text.split('\n').map(line => `> ${line}`).join('\n') + '\n\n';
    }
    
    convertInlineCode(element) {
        const text = element.textContent || '';
        return `\`${text}\``;
    }
    
    convertCodeBlock(element) {
        const text = element.textContent || '';
        return `\`\`\`\n${text}\n\`\`\`\n\n`;
    }
    
    convertLineBreak(element) {
        return '\n';
    }
}

/**
 * エイリアス生成（Obsidian用）
 * @param {Object} articleData - 記事データ
 * @returns {Array<string>} エイリアス配列
 */
function generateAliases(articleData) {
    const aliases = [];
    
    // 元のタイトルをエイリアスに追加
    if (articleData.title && articleData.title !== articleData.translatedTitle) {
        aliases.push(articleData.title);
    }
    
    // ドメイン名をエイリアスに追加
    if (articleData.domain) {
        aliases.push(articleData.domain);
    }
    
    // 短縮タイトルをエイリアスに追加
    const shortTitle = (articleData.translatedTitle || articleData.title || '').substring(0, 30);
    if (shortTitle && shortTitle !== articleData.translatedTitle) {
        aliases.push(shortTitle);
    }
    
    return aliases;
}

// モジュールのエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MarkdownGenerator, HTMLToMarkdownConverter };
} else {
    window.MarkdownGenerator = MarkdownGenerator;
    window.HTMLToMarkdownConverter = HTMLToMarkdownConverter;
}
