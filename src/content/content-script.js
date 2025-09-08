// ReadLater for Obsidian - Content Script
// Webページでの記事抽出とDOM操作を担当

console.log('ReadLater for Obsidian: Content script loaded', window.location.href);

// Service Workerからのメッセージを受信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('ReadLater for Obsidian: Message received', request);
    
    if (request.action === 'extractArticle') {
        handleExtractArticle(request.data)
            .then(result => {
                console.log('ReadLater for Obsidian: Article extraction completed', result);
                sendResponse({ success: true, data: result });
            })
            .catch(error => {
                console.error('ReadLater for Obsidian: Article extraction failed', error);
                sendResponse({ success: false, error: error.message });
            });
        
        // 非同期レスポンスのため true を返す
        return true;
    }
});

/**
 * 記事抽出のメイン処理
 * @param {Object} data - 抽出対象データ（URL、タイトル、選択テキストなど）
 * @returns {Promise<Object>} 抽出された記事データ
 */
async function handleExtractArticle(data) {
    try {
        console.log('ReadLater for Obsidian: Starting article extraction', data);
        
        // 基本情報の取得
        const basicInfo = {
            url: data.url || window.location.href,
            title: data.title || extractTitle(),
            domain: window.location.hostname,
            timestamp: new Date().toISOString()
        };
        
        // 記事本文の抽出
        let content = '';
        
        // 選択テキストがある場合はそれを優先
        if (data.selection && data.selection.trim()) {
            content = data.selection.trim();
            console.log('ReadLater for Obsidian: Using selected text as content');
        } else {
            // 自動記事抽出
            content = await extractMainContent();
            console.log('ReadLater for Obsidian: Auto-extracted content length:', content.length);
        }
        
        // メタデータの抽出
        const metadata = extractMetadata();
        
        // 結果の統合
        const result = {
            ...basicInfo,
            content: content,
            metadata: metadata,
            extractedAt: new Date().toISOString()
        };
        
        return result;
        
    } catch (error) {
        console.error('ReadLater for Obsidian: Error in handleExtractArticle', error);
        throw new Error(`記事抽出エラー: ${error.message}`);
    }
}

/**
 * ページタイトルの抽出
 * @returns {string} ページタイトル
 */
function extractTitle() {
    // og:title メタタグを優先
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content) {
        return ogTitle.content.trim();
    }
    
    // Twitter Card title
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle && twitterTitle.content) {
        return twitterTitle.content.trim();
    }
    
    // 通常の title タグ
    if (document.title) {
        return document.title.trim();
    }
    
    // h1 タグから抽出
    const h1 = document.querySelector('h1');
    if (h1 && h1.textContent) {
        return h1.textContent.trim();
    }
    
    return 'Untitled Article';
}

/**
 * メインコンテンツの自動抽出
 * @returns {Promise<string>} 抽出されたコンテンツ
 */
async function extractMainContent() {
    try {
        // 複数の抽出方法を試行
        let content = '';
        
        // 方法1: article タグ
        content = extractFromArticleTag();
        if (content && content.length > 100) {
            console.log('ReadLater for Obsidian: Content extracted from <article> tag');
            return content;
        }
        
        // 方法2: 一般的なコンテンツセレクタ
        content = extractFromCommonSelectors();
        if (content && content.length > 100) {
            console.log('ReadLater for Obsidian: Content extracted from common selectors');
            return content;
        }
        
        // 方法3: Readability風のアルゴリズム（簡易版）
        content = extractUsingReadabilityLike();
        if (content && content.length > 100) {
            console.log('ReadLater for Obsidian: Content extracted using readability-like algorithm');
            return content;
        }
        
        // 方法4: フォールバック - body全体から不要要素を除去
        content = extractFallback();
        console.log('ReadLater for Obsidian: Content extracted using fallback method');
        return content;
        
    } catch (error) {
        console.error('ReadLater for Obsidian: Error in extractMainContent', error);
        return 'コンテンツの抽出に失敗しました。';
    }
}

/**
 * article タグからのコンテンツ抽出
 * @returns {string} 抽出されたコンテンツ
 */
function extractFromArticleTag() {
    const article = document.querySelector('article');
    if (article) {
        return cleanAndFormatText(article);
    }
    return '';
}

/**
 * 一般的なコンテンツセレクタからの抽出
 * @returns {string} 抽出されたコンテンツ
 */
function extractFromCommonSelectors() {
    const commonSelectors = [
        '.post-content',
        '.article-content',
        '.entry-content',
        '.content',
        '.main-content',
        '#content',
        '.post-body',
        '.article-body',
        '[role="main"]',
        'main'
    ];
    
    for (const selector of commonSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            const content = cleanAndFormatText(element);
            if (content.length > 100) {
                return content;
            }
        }
    }
    return '';
}

/**
 * Readability風のアルゴリズム（簡易版）
 * @returns {string} 抽出されたコンテンツ
 */
function extractUsingReadabilityLike() {
    // p タグが多い要素を探す
    const candidates = [];
    const allElements = document.querySelectorAll('div, section, article');
    
    for (const element of allElements) {
        const paragraphs = element.querySelectorAll('p');
        const textLength = element.textContent.length;
        
        if (paragraphs.length >= 3 && textLength > 200) {
            candidates.push({
                element: element,
                score: paragraphs.length * 10 + textLength / 100
            });
        }
    }
    
    // スコアが最も高い要素を選択
    candidates.sort((a, b) => b.score - a.score);
    
    if (candidates.length > 0) {
        return cleanAndFormatText(candidates[0].element);
    }
    
    return '';
}

/**
 * フォールバック: body全体から不要要素を除去
 * @returns {string} 抽出されたコンテンツ
 */
function extractFallback() {
    const bodyClone = document.body.cloneNode(true);
    
    // 不要な要素を除去
    const removeSelectors = [
        'script', 'style', 'nav', 'header', 'footer', 'aside',
        '.navigation', '.menu', '.sidebar', '.comments', '.advertisement',
        '.ad', '.ads', '.social', '.share', '.related', '.recommended'
    ];
    
    for (const selector of removeSelectors) {
        const elements = bodyClone.querySelectorAll(selector);
        elements.forEach(el => el.remove());
    }
    
    return cleanAndFormatText(bodyClone);
}

/**
 * テキストのクリーニングとフォーマット
 * @param {Element} element - 対象要素
 * @returns {string} クリーニングされたテキスト
 */
function cleanAndFormatText(element) {
    if (!element) return '';
    
    // 不要な子要素を除去
    const clone = element.cloneNode(true);
    const removeSelectors = [
        'script', 'style', 'nav', 'header', 'footer', 'aside',
        '.advertisement', '.ad', '.ads', '.social-share', '.comments'
    ];
    
    for (const selector of removeSelectors) {
        const elements = clone.querySelectorAll(selector);
        elements.forEach(el => el.remove());
    }
    
    // テキストを抽出
    let text = clone.textContent || clone.innerText || '';
    
    // 複数の空白・改行を整理
    text = text.replace(/\s+/g, ' ').trim();
    
    // 段落の復元（簡易版）
    text = text.replace(/([.!?。！？])\s+/g, '$1\n\n');
    
    return text;
}

/**
 * メタデータの抽出
 * @returns {Object} メタデータ
 */
function extractMetadata() {
    const metadata = {};
    
    // 著者情報
    metadata.author = extractAuthor();
    
    // 公開日
    metadata.publishDate = extractPublishDate();
    
    // 説明文
    metadata.description = extractDescription();
    
    // 言語
    metadata.language = document.documentElement.lang || 'unknown';
    
    // キーワード
    metadata.keywords = extractKeywords();
    
    return metadata;
}

/**
 * 著者情報の抽出
 * @returns {string} 著者名
 */
function extractAuthor() {
    // メタタグから抽出
    const authorMeta = document.querySelector('meta[name="author"]') || 
                       document.querySelector('meta[property="article:author"]');
    if (authorMeta && authorMeta.content) {
        return authorMeta.content.trim();
    }
    
    // 構造化データから抽出
    const jsonLd = document.querySelector('script[type="application/ld+json"]');
    if (jsonLd) {
        try {
            const data = JSON.parse(jsonLd.textContent);
            if (data.author) {
                return typeof data.author === 'string' ? data.author : data.author.name;
            }
        } catch (e) {
            // JSON解析エラーは無視
        }
    }
    
    return 'Unknown';
}

/**
 * 公開日の抽出
 * @returns {string} 公開日
 */
function extractPublishDate() {
    // メタタグから抽出
    const publishMeta = document.querySelector('meta[property="article:published_time"]') ||
                        document.querySelector('meta[name="date"]') ||
                        document.querySelector('meta[name="publish_date"]');
    if (publishMeta && publishMeta.content) {
        return publishMeta.content.trim();
    }
    
    // time タグから抽出
    const timeElement = document.querySelector('time[datetime]');
    if (timeElement && timeElement.getAttribute('datetime')) {
        return timeElement.getAttribute('datetime');
    }
    
    return 'Unknown';
}

/**
 * 説明文の抽出
 * @returns {string} 説明文
 */
function extractDescription() {
    const descMeta = document.querySelector('meta[name="description"]') ||
                     document.querySelector('meta[property="og:description"]');
    if (descMeta && descMeta.content) {
        return descMeta.content.trim();
    }
    return '';
}

/**
 * キーワードの抽出
 * @returns {string} キーワード
 */
function extractKeywords() {
    const keywordsMeta = document.querySelector('meta[name="keywords"]');
    if (keywordsMeta && keywordsMeta.content) {
        return keywordsMeta.content.trim();
    }
    return '';
}

// デバッグ用: 記事抽出のテスト関数
window.readlaterDebug = {
    extractArticle: () => handleExtractArticle({ url: window.location.href }),
    extractTitle: extractTitle,
    extractMainContent: extractMainContent
};
