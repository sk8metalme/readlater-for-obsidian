// ReadLater for Obsidian - Article Extractor Library
// 高度な記事抽出とDOM解析を担当

/**
 * 記事抽出の主要クラス
 * 複数の抽出戦略を統合し、最適な結果を返す
 */
class ArticleExtractor {
    constructor() {
        this.strategies = [
            new StructuredDataExtractor(),
            new SemanticHTMLExtractor(),
            new ReadabilityExtractor(),
            new HeuristicExtractor()
        ];
        
        this.contentFilters = [
            new NavigationFilter(),
            new AdvertisementFilter(),
            new SocialMediaFilter(),
            new BoilerplateFilter()
        ];
    }
    
    /**
     * メイン抽出メソッド
     * @param {Object} options - 抽出オプション
     * @returns {Promise<Object>} 抽出結果
     */
    async extractArticle(options = {}) {
        try {
            console.log('ArticleExtractor: Starting extraction process');
            
            const results = {
                title: await this.extractTitle(),
                content: await this.extractContent(),
                metadata: await this.extractMetadata(),
                url: window.location.href,
                domain: window.location.hostname,
                extractedAt: new Date().toISOString(),
                strategy: null,
                confidence: 0
            };
            
            console.log('ArticleExtractor: Extraction completed', {
                contentLength: results.content.length,
                strategy: results.strategy,
                confidence: results.confidence
            });
            
            return results;
            
        } catch (error) {
            console.error('ArticleExtractor: Extraction failed', error);
            throw new Error(`記事抽出に失敗しました: ${error.message}`);
        }
    }
    
    /**
     * タイトル抽出（優先度順）
     * @returns {Promise<string>} 抽出されたタイトル
     */
    async extractTitle() {
        const titleCandidates = [
            // 1. JSON-LD構造化データから
            () => this.extractFromJsonLd('headline'),
            // 2. Open Graphタグから
            () => this.getMetaContent('property', 'og:title'),
            // 3. Twitter Cardから
            () => this.getMetaContent('name', 'twitter:title'),
            // 4. 通常のtitleタグから
            () => document.title,
            // 5. 主要見出しから
            () => this.extractFromHeadings(),
            // 6. article要素のdata属性から
            () => document.querySelector('article')?.getAttribute('data-title')
        ];
        
        for (const extractor of titleCandidates) {
            try {
                const title = extractor();
                if (title && title.trim() && title.length > 2 && title.length < 200) {
                    return this.cleanTitle(title.trim());
                }
            } catch (e) {
                // 個別抽出エラーは無視して次へ
                console.debug('Title extraction method failed', e);
            }
        }
        
        return 'Untitled Article';
    }
    
    /**
     * コンテンツ抽出（戦略パターン）
     * @returns {Promise<string>} 抽出されたコンテンツ
     */
    async extractContent() {
        let bestResult = { content: '', confidence: 0, strategy: 'fallback' };
        
        // 各戦略を試行し、最も信頼度の高い結果を選択
        for (const strategy of this.strategies) {
            try {
                const result = await strategy.extract();
                if (result.confidence > bestResult.confidence) {
                    bestResult = result;
                }
            } catch (error) {
                console.debug(`Strategy ${strategy.constructor.name} failed:`, error);
            }
        }
        
        // コンテンツのフィルタリング
        let content = bestResult.content;
        for (const filter of this.contentFilters) {
            content = filter.apply(content);
        }
        content = this.postProcessContent(content);

        // うまく抽出できなかった場合のフォールバック（段落集約）
        if (!content || content.length < 200) {
            try {
                const aggregated = this.aggregateParagraphs();
                if (aggregated && aggregated.length > content.length) {
                    return aggregated;
                }
            } catch (e) {
                console.debug('Paragraph aggregation failed', e);
            }
        }

        return content;
    }
    
    /**
     * メタデータ抽出の強化版
     * @returns {Promise<Object>} 抽出されたメタデータ
     */
    async extractMetadata() {
        return {
            author: await this.extractAuthor(),
            publishDate: await this.extractPublishDate(),
            modifiedDate: await this.extractModifiedDate(),
            description: await this.extractDescription(),
            keywords: await this.extractKeywords(),
            language: await this.extractLanguage(),
            readingTime: await this.estimateReadingTime(),
            wordCount: await this.countWords(),
            images: await this.extractImages(),
            links: await this.extractLinks(),
            category: await this.extractCategory(),
            tags: await this.extractTags()
        };
    }
    
    // ヘルパーメソッド群
    
    extractFromJsonLd(property) {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
            try {
                const data = JSON.parse(script.textContent);
                const value = this.getNestedProperty(data, property);
                if (value) return value;
            } catch (e) {
                // JSON解析エラーは無視
            }
        }
        return null;
    }
    
    getMetaContent(attribute, value) {
        const element = document.querySelector(`meta[${attribute}="${value}"]`);
        return element?.content?.trim() || null;
    }
    
    extractFromHeadings() {
        const headings = document.querySelectorAll('h1, h2');
        for (const heading of headings) {
            const text = heading.textContent?.trim();
            if (text && text.length > 5 && text.length < 150) {
                return text;
            }
        }
        return null;
    }
    
    cleanTitle(title) {
        // サイト名の除去
        const separators = [' | ', ' - ', ' :: ', ' — ', ' – '];
        for (const sep of separators) {
            if (title.includes(sep)) {
                const parts = title.split(sep);
                return parts[0].trim(); // 最初の部分を記事タイトルとして使用
            }
        }
        return title;
    }
    
    async extractAuthor() {
        const authorCandidates = [
            () => this.extractFromJsonLd('author.name'),
            () => this.extractFromJsonLd('author'),
            () => this.getMetaContent('name', 'author'),
            () => this.getMetaContent('property', 'article:author'),
            () => document.querySelector('[rel="author"]')?.textContent,
            () => document.querySelector('.author, .byline, .writer')?.textContent
        ];
        
        for (const extractor of authorCandidates) {
            try {
                const author = extractor();
                if (author && typeof author === 'string' && author.trim().length > 2) {
                    return author.trim();
                }
            } catch (e) {
                // エラーは無視
            }
        }
        
        return 'Unknown';
    }
    
    async extractPublishDate() {
        const dateCandidates = [
            () => this.extractFromJsonLd('datePublished'),
            () => this.getMetaContent('property', 'article:published_time'),
            () => this.getMetaContent('name', 'date'),
            () => document.querySelector('time[datetime]')?.getAttribute('datetime'),
            () => document.querySelector('[itemprop="datePublished"]')?.getAttribute('datetime')
        ];
        
        for (const extractor of dateCandidates) {
            try {
                const date = extractor();
                if (date && this.isValidDate(date)) {
                    return new Date(date).toISOString();
                }
            } catch (e) {
                // エラーは無視
            }
        }
        
        return new Date().toISOString();
    }
    
    async extractDescription() {
        const descCandidates = [
            () => this.extractFromJsonLd('description'),
            () => this.getMetaContent('property', 'og:description'),
            () => this.getMetaContent('name', 'description'),
            () => this.getMetaContent('name', 'twitter:description')
        ];
        
        for (const extractor of descCandidates) {
            try {
                const desc = extractor();
                if (desc && desc.trim().length > 10) {
                    return desc.trim();
                }
            } catch (e) {
                // エラーは無視
            }
        }
        
        return '';
    }

    async extractModifiedDate() {
        const dateCandidates = [
            () => this.extractFromJsonLd('dateModified'),
            () => this.getMetaContent('property', 'article:modified_time'),
            () => this.getMetaContent('property', 'og:updated_time'),
            () => document.querySelector('time[itemprop="dateModified"][datetime]')?.getAttribute('datetime'),
        ];

        for (const extractor of dateCandidates) {
            try {
                const date = extractor();
                if (date && this.isValidDate(date)) {
                    return new Date(date).toISOString();
                }
            } catch (_) { /* noop */ }
        }
        return 'Unknown';
    }

    async extractKeywords() {
        const candidates = [
            () => this.extractFromJsonLd('keywords'), // may be string or array
            () => this.getMetaContent('name', 'keywords'),
            () => this.getMetaContent('property', 'article:tag')
        ];
        for (const extractor of candidates) {
            try {
                const v = extractor();
                if (!v) continue;
                if (Array.isArray(v)) {
                    return v.map(x => String(x).trim()).filter(Boolean);
                }
                if (typeof v === 'string') {
                    return v.split(',').map(s => s.trim()).filter(Boolean);
                }
            } catch (_) { /* noop */ }
        }
        return [];
    }

    async extractImages() {
        const urls = new Set();
        // og:image
        const og = this.getMetaContent('property', 'og:image');
        if (og) urls.add(og);
        // prominent images inside article/main
        const containers = document.querySelectorAll('article, main, .entry-content, .post-content');
        containers.forEach(c => {
            c.querySelectorAll('img[src]').forEach(img => {
                const src = img.getAttribute('src');
                if (src && src.length > 4) urls.add(src);
            });
        });
        return Array.from(urls).slice(0, 10);
    }

    async extractLinks() {
        const links = [];
        const containers = document.querySelectorAll('article, main, .entry-content, .post-content, .content');
        const seen = new Set();
        containers.forEach(c => {
            c.querySelectorAll('a[href]').forEach(a => {
                const href = a.getAttribute('href');
                if (!href || seen.has(href)) return;
                seen.add(href);
                links.push({ href, text: (a.textContent || '').trim().slice(0, 120) });
            });
        });
        return links.slice(0, 50);
    }

    async extractCategory() {
        const candidates = [
            () => this.extractFromJsonLd('articleSection'),
            () => this.getMetaContent('property', 'article:section'),
        ];
        for (const extractor of candidates) {
            try {
                const v = extractor();
                if (v && typeof v === 'string') return v;
            } catch (_) { /* noop */ }
        }
        return '';
    }

    async extractTags() {
        // Often overlaps with keywords; try to infer from DOM
        const tagSelectors = ['.tags a', '.post-tags a', 'a[rel="tag"]'];
        for (const sel of tagSelectors) {
            const arr = Array.from(document.querySelectorAll(sel)).map(a => a.textContent?.trim()).filter(Boolean);
            if (arr.length) return arr.slice(0, 20);
        }
        return [];
    }
    
    async extractLanguage() {
        return document.documentElement.lang || 
               this.getMetaContent('property', 'og:locale') ||
               this.detectLanguageFromContent() ||
               'unknown';
    }
    
    detectLanguageFromContent() {
        // 簡易的な言語検出（日本語、英語、中国語、韓国語）
        const sampleText = document.body.textContent.slice(0, 1000);
        
        if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(sampleText)) {
            if (/[\u3040-\u309F\u30A0-\u30FF]/.test(sampleText)) {
                return 'ja'; // ひらがな・カタカナがあれば日本語
            }
            return 'zh'; // 漢字のみなら中国語
        }
        
        if (/[\uAC00-\uD7AF]/.test(sampleText)) {
            return 'ko'; // ハングルがあれば韓国語
        }
        
        return 'en'; // デフォルトは英語
    }
    
    async estimateReadingTime() {
        const text = document.body.textContent;
        const wordsPerMinute = 200; // 平均読書速度
        const wordCount = text.split(/\s+/).length;
        return Math.ceil(wordCount / wordsPerMinute);
    }
    
    async countWords() {
        const text = document.body.textContent;
        return text.split(/\s+/).filter(word => word.length > 0).length;
    }
    
    // ユーティリティメソッド
    
    getNestedProperty(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    
    isValidDate(dateString) {
        const date = new Date(dateString);
        return !isNaN(date.getTime()) && date.getFullYear() > 1990;
    }
    
    postProcessContent(content) {
        if (!content) return '';
        
        // 余分な空白の除去
        content = content.replace(/\s+/g, ' ').trim();
        
        // 文の区切りを改行に変換
        content = content.replace(/([.!?。！？])\s+/g, '$1\n\n');
        
        // 長すぎる行の分割
        content = content.replace(/(.{100,}?)\s+/g, '$1\n');
        
        return content;
    }

    /**
     * ページ全体から段落を集約（最終フォールバック）
     */
    aggregateParagraphs() {
        const container = document.querySelector('article, main, .entry-content, .post-content, #content, .content') || document.body;
        const texts = [];
        const seen = new Set();
        const nodes = container.querySelectorAll('p, li');
        for (const n of nodes) {
            let t = (n.textContent || '').trim();
            if (!t) continue;
            // ノイズ除去
            if (t.length < 40) continue;
            if (/^(Share|Tweet|Like|Follow|広告|スポンサー|Advertisement|Subscribe)\b/i.test(t)) continue;
            const key = t.slice(0, 60);
            if (seen.has(key)) continue;
            seen.add(key);
            texts.push(t);
            if (texts.length >= 200) break;
        }
        const joined = texts.join('\n\n');
        return this.postProcessContent(joined);
    }
}

/**
 * 構造化データ抽出戦略
 */
class StructuredDataExtractor {
    async extract() {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        
        for (const script of scripts) {
            try {
                const data = JSON.parse(script.textContent);
                if (data['@type'] === 'Article' || data['@type'] === 'NewsArticle') {
                    const content = data.articleBody || data.text;
                    if (content && content.length > 100) {
                        return {
                            content: content,
                            confidence: 0.9,
                            strategy: 'structured-data'
                        };
                    }
                }
            } catch (e) {
                // JSON解析エラーは無視
            }
        }
        
        return { content: '', confidence: 0, strategy: 'structured-data' };
    }
}

/**
 * セマンティックHTML抽出戦略
 */
class SemanticHTMLExtractor {
    async extract() {
        const candidates = [
            { selector: 'article', weight: 0.8 },
            { selector: '[role="main"]', weight: 0.7 },
            { selector: 'main', weight: 0.7 },
            { selector: '.content, .post-content, .entry-content', weight: 0.6 }
        ];
        
        for (const candidate of candidates) {
            const element = document.querySelector(candidate.selector);
            if (element) {
                const content = this.extractTextFromElement(element);
                if (content.length > 200) {
                    return {
                        content: content,
                        confidence: candidate.weight,
                        strategy: 'semantic-html'
                    };
                }
            }
        }
        
        return { content: '', confidence: 0, strategy: 'semantic-html' };
    }
    
    extractTextFromElement(element) {
        const clone = element.cloneNode(true);
        
        // 不要要素の除去
        const removeSelectors = [
            'script', 'style', 'nav', 'header', 'footer', 'aside',
            '.advertisement', '.ad', '.social-share', '.comments',
            '.related-posts', '.sidebar'
        ];
        
        removeSelectors.forEach(selector => {
            clone.querySelectorAll(selector).forEach(el => el.remove());
        });
        
        return clone.textContent || '';
    }
}

/**
 * Readability風抽出戦略
 */
class ReadabilityExtractor {
    async extract() {
        const candidates = [];
        const allElements = document.querySelectorAll('div, section, article, main');
        
        for (const element of allElements) {
            const score = this.calculateReadabilityScore(element);
            if (score > 0) {
                candidates.push({ element, score });
            }
        }
        
        candidates.sort((a, b) => b.score - a.score);
        
        if (candidates.length > 0) {
            const best = candidates[0];
            const content = this.extractTextFromElement(best.element);
            
            return {
                content: content,
                confidence: Math.min(best.score / 100, 0.8),
                strategy: 'readability'
            };
        }
        
        return { content: '', confidence: 0, strategy: 'readability' };
    }
    
    calculateReadabilityScore(element) {
        let score = 0;
        
        // 段落数でスコア加算
        const paragraphs = element.querySelectorAll('p');
        score += paragraphs.length * 10;
        
        // テキスト長でスコア加算
        const textLength = element.textContent.length;
        score += Math.min(textLength / 100, 50);
        
        // 不要要素でスコア減算
        const badElements = element.querySelectorAll('nav, aside, .ad, .advertisement');
        score -= badElements.length * 20;
        
        // クラス名でスコア調整
        const className = element.className.toLowerCase();
        if (/content|article|post|main/.test(className)) {
            score += 20;
        }
        if (/sidebar|nav|footer|header/.test(className)) {
            score -= 30;
        }
        
        return score;
    }
    
    extractTextFromElement(element) {
        // SemanticHTMLExtractorと同じロジック
        const clone = element.cloneNode(true);
        
        const removeSelectors = [
            'script', 'style', 'nav', 'header', 'footer', 'aside',
            '.advertisement', '.ad', '.social-share', '.comments'
        ];
        
        removeSelectors.forEach(selector => {
            clone.querySelectorAll(selector).forEach(el => el.remove());
        });
        
        return clone.textContent || '';
    }
}

/**
 * ヒューリスティック抽出戦略（フォールバック）
 */
class HeuristicExtractor {
    async extract() {
        const bodyClone = document.body.cloneNode(true);
        
        // 不要要素の大量除去
        const removeSelectors = [
            'script', 'style', 'nav', 'header', 'footer', 'aside',
            '.navigation', '.menu', '.sidebar', '.comments', 
            '.advertisement', '.ad', '.ads', '.social', '.share',
            '.related', '.recommended', '[role="banner"]',
            '[role="navigation"]', '[role="complementary"]'
        ];
        
        removeSelectors.forEach(selector => {
            bodyClone.querySelectorAll(selector).forEach(el => el.remove());
        });
        
        const content = bodyClone.textContent || '';
        
        return {
            content: content,
            confidence: 0.3,
            strategy: 'heuristic'
        };
    }
}

// コンテンツフィルター群

class NavigationFilter {
    apply(content) {
        // ナビゲーション系のテキストを除去
        const navPatterns = [
            /^(Home|About|Contact|Menu|Navigation|Skip to|Previous|Next|Page \d+).*$/gm,
            /^(ホーム|について|お問い合わせ|メニュー|ナビゲーション|前へ|次へ|ページ \d+).*$/gm
        ];
        
        navPatterns.forEach(pattern => {
            content = content.replace(pattern, '');
        });
        
        return content;
    }
}

class AdvertisementFilter {
    apply(content) {
        // 広告系のテキストを除去
        const adPatterns = [
            /^(Advertisement|Sponsored|AD|広告|スポンサー).*$/gm,
            /^(Click here|Learn more|Sign up|Subscribe|登録|詳しくはこちら).*$/gm
        ];
        
        adPatterns.forEach(pattern => {
            content = content.replace(pattern, '');
        });
        
        return content;
    }
}

class SocialMediaFilter {
    apply(content) {
        // ソーシャルメディア系のテキストを除去
        const socialPatterns = [
            /^(Share|Tweet|Like|Follow|Facebook|Twitter|Instagram|シェア|ツイート|いいね|フォロー).*$/gm,
            /^\d+\s+(shares|likes|tweets|retweets|シェア|いいね).*$/gm
        ];
        
        socialPatterns.forEach(pattern => {
            content = content.replace(pattern, '');
        });
        
        return content;
    }
}

class BoilerplateFilter {
    apply(content) {
        // 定型文の除去
        const boilerplatePatterns = [
            /^(Copyright|All rights reserved|Terms of service|Privacy policy|著作権|利用規約|プライバシーポリシー).*$/gm,
            /^.{0,50}?(cookies?|クッキー).*$/gim
        ];
        
        boilerplatePatterns.forEach(pattern => {
            content = content.replace(pattern, '');
        });
        
        // 余分な空行の除去
        content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
        
        return content.trim();
    }
}

// モジュールのエクスポート（Chrome拡張機能用）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ArticleExtractor };
} else {
    // ブラウザ環境での利用
    window.ArticleExtractor = ArticleExtractor;
}
