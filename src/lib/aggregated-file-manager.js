// ReadLater for Obsidian - Aggregated File Manager
// 集約Markdownファイルの管理を担当するクラス

/**
 * 集約Markdownファイルの管理クラス
 */
class AggregatedFileManager {
    constructor(options = {}) {
        this.options = {
            encoding: 'utf-8',
            backup: false,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            ...options
        };
        
        // エラーハンドラーの初期化
        this.errorHandler = new (typeof ErrorHandler !== 'undefined' ? ErrorHandler : 
            require('../utils/error-handler.js').ErrorHandler)();
    }

    /**
     * 設定からファイルパスを生成
     * @param {Object} settings - ユーザー設定
     * @returns {string} ファイルパス
     */
    generateFilePath(settings) {
        // デフォルトファイル名
        const defaultFileName = 'ReadLater_Articles.md';
        
        // 設定が無効な場合はデフォルトを使用
        if (!settings || typeof settings !== 'object') {
            return defaultFileName;
        }
        
        // 設定からファイル名を取得（aggregatedFileNameを使用）
        let fileName = settings.aggregatedFileName || defaultFileName;
        
        // 元のファイル名をチェックして、不正なパスが含まれている場合はデフォルトを使用
        if (fileName.includes('../') || fileName.includes('./') || fileName.includes('/') || fileName.includes('\\')) {
            fileName = defaultFileName;
        } else {
            // セキュリティ: 残りの不正文字を除去
            fileName = fileName.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF._-]/g, '');
        }
        
        // .mdファイル以外は拒否、または空文字列の場合
        if (!fileName.endsWith('.md') || fileName === '' || fileName === '.md') {
            fileName = defaultFileName;
        }

        // 保存先フォルダと組み合わせてフルパスを生成
        const obsidianPath = settings.obsidianPath || 'ReadLater';
        if (obsidianPath.startsWith('/') || obsidianPath.match(/^[A-Za-z]:/)) {
            // 絶対パスの場合
            return `${obsidianPath}/${fileName}`;
        } else {
            // 相対パスの場合（Downloadsフォルダに保存）
            return fileName;
        }
    }

    /**
     * 既存ファイルの解析
     * @param {string} content - ファイル内容
     * @returns {Promise<Object>} 解析結果
     */
    async parseExistingFile(content) {
        try {
            if (!content || typeof content !== 'string') {
                return {
                    tableContent: '',
                    articles: []
                };
            }

            const result = {
                tableContent: '',
                articles: []
            };

            // テーブルセクションの抽出（拡張形式対応）
            const tableRegex = /\|\s*タイトル\s*\|[\s\S]*?(?=\n##|$)/;
            const tableMatch = content.match(tableRegex);
            
            if (tableMatch) {
                result.tableContent = tableMatch[0];
                
                // テーブル行の解析
                const lines = result.tableContent.split('\n');
                for (let i = 2; i < lines.length; i++) { // Skip header and separator
                    const line = lines[i].trim();
                    if (line.startsWith('|') && line.endsWith('|')) {
                        const columns = line.split('|').map(col => col.trim()).slice(1, -1);
                        if (columns.length >= 4) {
                            // 空の行や無効な行を除外
                            const title = columns[0];
                            const url = columns[1];
                            if (title && url) {
                                result.articles.push({
                                    title: title,
                                    url: url,
                                    summary: columns[2],
                                    date: columns[3]
                                });
                            }
                        }
                    }
                }
            }

            return result;
            
        } catch (error) {
            const errorResult = this.errorHandler.handleError(
                new Error(`集約ファイルの解析に失敗: ${error.message}`),
                { operation: 'parseExistingFile', contentLength: content?.length || 0 }
            );
            
            // パースエラーの場合でも空の結果を返してフォールバック
            console.warn('AggregatedFileManager: Parse error, returning empty result', errorResult);
            return {
                tableContent: '',
                articles: []
            };
        }
    }

    /**
     * 記事を集約ファイルに追加
     * @param {Object} articleData - 記事データ
     * @param {Object} settings - ユーザー設定
     * @returns {Promise<Object>} 追加結果
     */
    async addArticleToAggregatedFile(articleData, settings) {
        return await this.errorHandler.retry(async () => {
            const filePath = this.generateFilePath(settings);
            
            try {
                // バリデーション
                if (!articleData || !articleData.title || !articleData.url) {
                    throw new Error('記事データが不完全です: title と url は必須です');
                }
                
                if (!settings) {
                    throw new Error('設定データが不完全です');
                }

                // 既存ファイルの読み込み
                let existingContent;
                try {
                    existingContent = await this.readFile(filePath);
                } catch (error) {
                    // ファイルが存在しない場合は新規作成
                    console.log('AggregatedFileManager: File not found, creating new file:', filePath);
                    existingContent = '';
                }

                let newContent;
                if (existingContent) {
                    // 既存ファイルの形式チェック
                    const parsedFile = await this.parseExistingFile(existingContent);
                    if (this.isValidAggregatedContent(existingContent)) {
                        newContent = await this.appendArticleToExisting(existingContent, articleData, settings, parsedFile);
                    } else {
                        console.warn('AggregatedFileManager: Invalid file format, creating new file');
                        // 無効なファイル形式の場合は新規作成
                        newContent = await this.createNewAggregatedFile(articleData, settings);
                    }
                } else {
                    // 新規ファイル作成
                    newContent = await this.createNewAggregatedFile(articleData, settings);
                }

                // ファイルサイズチェック
                if (newContent.length > this.options.maxFileSize) {
                    throw new Error(`ファイルサイズが制限を超えています: ${newContent.length} bytes > ${this.options.maxFileSize} bytes`);
                }

                // ファイルの書き込み
                await this.writeFile(filePath, newContent);

                return {
                    success: true,
                    filePath,
                    articlesCount: 1 // 簡易実装
                };

            } catch (error) {
                // エラーの詳細な分類と処理
                let contextualError;
                if (error.message.includes('ファイルサイズ') || error.message.includes('制限')) {
                    contextualError = new Error(`storage error: ${error.message}`);
                } else if (error.message.includes('解析') || error.message.includes('parsing')) {
                    contextualError = new Error(`aggregated file conflict: ${error.message}`);
                } else if (error.message.includes('不完全') || error.message.includes('required')) {
                    contextualError = new Error(`validation error: ${error.message}`);
                } else {
                    contextualError = new Error(`aggregated file error: ${error.message}`);
                }
                
                throw contextualError;
            }
        }, {
            maxRetries: 2,
            delay: 500
        });
    }

    /**
     * 新規集約ファイルを作成
     * @param {Object} articleData - 記事データ
     * @param {Object} settings - ユーザー設定
     * @returns {Promise<string>} ファイル内容
     */
    async createNewAggregatedFile(articleData, settings) {
        try {
            // データ検証
            if (!articleData.savedDate || !(articleData.savedDate instanceof Date)) {
                articleData.savedDate = new Date();
            }
            
            const date = articleData.savedDate.toISOString().split('T')[0];
            const shortSummary = articleData.shortSummary || 
                                articleData.summary?.substring(0, settings.maxTableSummaryLength || 100) || '';

            // テーブル内容のエスケープ
            const escapedTitle = (articleData.title || '').replace(/\|/g, '&#124;').replace(/\n/g, ' ');
            const escapedSummary = shortSummary.replace(/\|/g, '&#124;').replace(/\n/g, ' ');

            const content = `# ReadLater Articles

| タイトル | URL | 要約 | 日時 |
|---------|-----|------|------|
| ${escapedTitle} | ${articleData.url} | ${escapedSummary} | ${date} |

## 記事詳細

### ${articleData.title}

**元記事**: [${articleData.title}](${articleData.url})
**保存日**: ${date}

${articleData.content || 'コンテンツが取得できませんでした。'}

---
*Generated by ReadLater for Obsidian*
`;

            return content;
            
        } catch (error) {
            const errorResult = this.errorHandler.handleError(
                new Error(`新規集約ファイル作成に失敗: ${error.message}`),
                { operation: 'createNewAggregatedFile', articleTitle: articleData?.title }
            );
            throw error;
        }
    }

    /**
     * 既存ファイルに記事を追加
     * @param {string} existingContent - 既存のファイル内容
     * @param {Object} articleData - 記事データ
     * @param {Object} settings - ユーザー設定
     * @param {Object} parsedFile - 解析済みファイルデータ
     * @returns {Promise<string>} 更新されたファイル内容
     */
    async appendArticleToExisting(existingContent, articleData, settings, parsedFile) {
        try {
            // データ検証
            if (!articleData.savedDate || !(articleData.savedDate instanceof Date)) {
                articleData.savedDate = new Date();
            }
            
            const date = articleData.savedDate.toISOString().split('T')[0];
            const shortSummary = articleData.shortSummary || 
                                articleData.summary?.substring(0, settings.maxTableSummaryLength || 100) || '';

            // テーブル内容のエスケープ
            const escapedTitle = (articleData.title || '').replace(/\|/g, '&#124;').replace(/\n/g, ' ');
            const escapedSummary = shortSummary.replace(/\|/g, '&#124;').replace(/\n/g, ' ');

            // テーブルに新しい行を追加
            const newTableRow = `| ${escapedTitle} | ${articleData.url} | ${escapedSummary} | ${date} |`;
            
            let updatedContent = existingContent;

            // テーブルの更新
            if (parsedFile.tableContent) {
                const newTableContent = parsedFile.tableContent + '\n' + newTableRow;
                updatedContent = updatedContent.replace(parsedFile.tableContent, newTableContent);
            }

            // 記事詳細セクションに追加（翻訳機能削除により元のコンテンツのみ）
            const articleContent = `## 内容

${articleData.content || 'コンテンツが取得できませんでした。'}`;

            const summarySection = articleData.summary ? `\n## 要約\n\n${articleData.summary}` : '';

            const articleDetail = `\n### ${articleData.title}

**元記事**: [${articleData.title}](${articleData.url})
**保存日**: ${date}${summarySection}

${articleContent}
`;

            // 詳細セクションの最後に追加
            const detailSectionRegex = /(## 記事詳細[\s\S]*?)(\n---\n.*Generated by ReadLater|$)/;
            const detailMatch = updatedContent.match(detailSectionRegex);
            
            if (detailMatch) {
                const updatedDetailSection = detailMatch[1] + articleDetail + '\n';
                updatedContent = updatedContent.replace(detailMatch[1], updatedDetailSection);
            } else {
                // 詳細セクションが見つからない場合は最後に追加
                updatedContent += `\n## 記事詳細${articleDetail}`;
            }

            return updatedContent;
            
        } catch (error) {
            const errorResult = this.errorHandler.handleError(
                new Error(`既存ファイルへの記事追加に失敗: ${error.message}`),
                { operation: 'appendArticleToExisting', articleTitle: articleData?.title }
            );
            throw error;
        }
    }

    /**
     * 有効な集約ファイル形式かチェック
     * @param {string} content - ファイル内容
     * @returns {boolean} 有効かどうか
     */
    isValidAggregatedContent(content) {
        if (!content || typeof content !== 'string') {
            return false;
        }

        // YAML frontmatterがある場合は、それを考慮
        const hasTitle = (/^# /.test(content) || /\n# /.test(content));
        const hasTable = /\| タイトル \|/.test(content);
        const hasDetails = (/## 記事詳細/.test(content) || /## 📖 記事詳細/.test(content));

        return hasTitle && (hasTable || hasDetails);
    }

    /**
     * ファイル読み込み（ネイティブメッセージング対応）
     * @param {string} filePath - ファイルパス
     * @returns {Promise<string>} ファイル内容
     */
    async readFile(filePath) {
        try {
            // ネイティブメッセージングでファイル読み込み
            const response = await chrome.runtime.sendNativeMessage('com.readlater.claude_host', {
                type: 'readFile',
                filePath: filePath
            });
            
            if (response && response.success) {
                return response.content || '';
            } else {
                throw new Error(response?.error || 'ファイル読み込みに失敗しました');
            }
        } catch (error) {
            // ファイルが存在しない場合は空文字列を返す
            if (error.message.includes('ENOENT') || error.message.includes('not found')) {
                return '';
            }
            throw error;
        }
    }

    /**
     * ファイル書き込み（ネイティブメッセージング対応）
     * @param {string} filePath - ファイルパス
     * @param {string} content - ファイル内容
     * @returns {Promise<Object>} 書き込み結果
     */
    async writeFile(filePath, content) {
        try {
            // ネイティブメッセージングでファイル書き込み
            const response = await chrome.runtime.sendNativeMessage('com.readlater.claude_host', {
                type: 'writeFile',
                filePath: filePath,
                content: content
            });
            
            if (response && response.success) {
                return { success: true, filePath: response.filePath };
            } else {
                throw new Error(response?.error || 'ファイル書き込みに失敗しました');
            }
        } catch (error) {
            throw new Error(`ファイル書き込みエラー: ${error.message}`);
        }
    }
}

// モジュールのエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AggregatedFileManager };
} else {
    // ブラウザ環境での利用
    const g = (typeof self !== 'undefined') ? self : 
              (typeof window !== 'undefined') ? window : globalThis;
    g.AggregatedFileManager = AggregatedFileManager;
}