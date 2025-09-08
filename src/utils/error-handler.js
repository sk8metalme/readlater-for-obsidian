// ReadLater for Obsidian - Error Handler Utility
// 拡張機能全体のエラーハンドリングを統一管理

/**
 * エラーハンドリングの主要クラス
 */
class ErrorHandler {
    constructor() {
        this.errorCounts = new Map();
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1秒
    }
    
    /**
     * エラーの分類と処理
     * @param {Error} error - エラーオブジェクト
     * @param {Object} context - エラー発生コンテキスト
     * @returns {Object} エラー処理結果
     */
    handleError(error, context = {}) {
        console.error('ReadLater for Obsidian: Error occurred', {
            error: error.message,
            stack: error.stack,
            context
        });
        
        const errorType = this.classifyError(error);
        const errorInfo = {
            type: errorType,
            message: error.message,
            context,
            timestamp: new Date().toISOString(),
            severity: this.getSeverity(errorType)
        };
        
        // エラー統計の更新
        this.updateErrorStats(errorType);
        
        // エラータイプ別の処理
        switch (errorType) {
            case 'NETWORK_ERROR':
                return this.handleNetworkError(errorInfo);
            case 'EXTRACTION_ERROR':
                return this.handleExtractionError(errorInfo);
            case 'STORAGE_ERROR':
                return this.handleStorageError(errorInfo);
            case 'PERMISSION_ERROR':
                return this.handlePermissionError(errorInfo);
            case 'API_ERROR':
                return this.handleApiError(errorInfo);
            case 'VALIDATION_ERROR':
                return this.handleValidationError(errorInfo);
            case 'TIMEOUT_ERROR':
                return this.handleTimeoutError(errorInfo);
            case 'UNKNOWN_ERROR':
            default:
                return this.handleUnknownError(errorInfo);
        }
    }
    
    /**
     * エラーの分類
     * @param {Error} error - エラーオブジェクト
     * @returns {string} エラータイプ
     */
    classifyError(error) {
        const message = error.message.toLowerCase();
        
        // ネットワーク関連エラー
        if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
            return 'NETWORK_ERROR';
        }
        
        // 記事抽出エラー
        if (message.includes('extraction') || message.includes('抽出') || message.includes('dom')) {
            return 'EXTRACTION_ERROR';
        }
        
        // ストレージエラー
        if (message.includes('storage') || message.includes('quota') || message.includes('disk')) {
            return 'STORAGE_ERROR';
        }
        
        // 権限エラー
        if (message.includes('permission') || message.includes('denied') || message.includes('blocked')) {
            return 'PERMISSION_ERROR';
        }
        
        // API関連エラー
        if (message.includes('api') || message.includes('claude') || message.includes('unauthorized')) {
            return 'API_ERROR';
        }
        
        // バリデーションエラー
        if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
            return 'VALIDATION_ERROR';
        }
        
        // タイムアウトエラー
        if (message.includes('timeout') || message.includes('expired')) {
            return 'TIMEOUT_ERROR';
        }
        
        return 'UNKNOWN_ERROR';
    }
    
    /**
     * エラーの重要度判定
     * @param {string} errorType - エラータイプ
     * @returns {string} 重要度 (low, medium, high, critical)
     */
    getSeverity(errorType) {
        const severityMap = {
            'NETWORK_ERROR': 'medium',
            'EXTRACTION_ERROR': 'medium',
            'STORAGE_ERROR': 'high',
            'PERMISSION_ERROR': 'high',
            'API_ERROR': 'medium',
            'VALIDATION_ERROR': 'low',
            'TIMEOUT_ERROR': 'medium',
            'UNKNOWN_ERROR': 'high'
        };
        
        return severityMap[errorType] || 'medium';
    }
    
    /**
     * エラー統計の更新
     * @param {string} errorType - エラータイプ
     */
    updateErrorStats(errorType) {
        const count = this.errorCounts.get(errorType) || 0;
        this.errorCounts.set(errorType, count + 1);
    }
    
    // 個別エラータイプの処理メソッド
    
    handleNetworkError(errorInfo) {
        return {
            canRetry: true,
            userMessage: 'ネットワーク接続に問題があります。インターネット接続を確認してください。',
            actionSuggestion: 'しばらく待ってから再試行してください。',
            technicalMessage: errorInfo.message
        };
    }
    
    handleExtractionError(errorInfo) {
        return {
            canRetry: true,
            userMessage: '記事の抽出に失敗しました。ページの構造が複雑な可能性があります。',
            actionSuggestion: 'テキストを選択してから再試行するか、別のページを試してください。',
            technicalMessage: errorInfo.message
        };
    }
    
    handleStorageError(errorInfo) {
        return {
            canRetry: false,
            userMessage: 'ファイルの保存に失敗しました。ストレージの容量を確認してください。',
            actionSuggestion: '不要なファイルを削除するか、保存先を変更してください。',
            technicalMessage: errorInfo.message
        };
    }
    
    handlePermissionError(errorInfo) {
        return {
            canRetry: false,
            userMessage: '権限が不足しています。ブラウザの設定を確認してください。',
            actionSuggestion: '拡張機能の権限設定を確認し、必要な権限を許可してください。',
            technicalMessage: errorInfo.message
        };
    }
    
    handleApiError(errorInfo) {
        return {
            canRetry: true,
            userMessage: 'AI機能の利用に失敗しました。APIキーを確認してください。',
            actionSuggestion: '設定画面でAPIキーが正しく入力されているか確認してください。',
            technicalMessage: errorInfo.message
        };
    }
    
    handleValidationError(errorInfo) {
        return {
            canRetry: false,
            userMessage: '入力内容に問題があります。設定を確認してください。',
            actionSuggestion: '必須項目が正しく入力されているか確認してください。',
            technicalMessage: errorInfo.message
        };
    }
    
    handleTimeoutError(errorInfo) {
        return {
            canRetry: true,
            userMessage: '処理がタイムアウトしました。サーバーが混雑している可能性があります。',
            actionSuggestion: 'しばらく待ってから再試行してください。',
            technicalMessage: errorInfo.message
        };
    }
    
    handleUnknownError(errorInfo) {
        return {
            canRetry: true,
            userMessage: '予期しないエラーが発生しました。',
            actionSuggestion: 'ページを更新してから再試行してください。問題が続く場合はサポートに連絡してください。',
            technicalMessage: errorInfo.message
        };
    }
    
    /**
     * リトライ機構
     * @param {Function} operation - 実行する操作
     * @param {Object} options - リトライオプション
     * @returns {Promise<any>} 操作結果
     */
    async retry(operation, options = {}) {
        const maxRetries = options.maxRetries || this.maxRetries;
        const delay = options.delay || this.retryDelay;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`ReadLater for Obsidian: Attempt ${attempt}/${maxRetries}`);
                return await operation();
            } catch (error) {
                const errorResult = this.handleError(error, { attempt, operation: operation.name });
                
                // リトライ不可能なエラーの場合は即座に終了
                if (!errorResult.canRetry) {
                    throw error;
                }
                
                // 最後の試行の場合はエラーを再スロー
                if (attempt === maxRetries) {
                    throw error;
                }
                
                // 指数バックオフで待機
                const waitTime = delay * Math.pow(2, attempt - 1);
                console.log(`ReadLater for Obsidian: Waiting ${waitTime}ms before retry`);
                await this.sleep(waitTime);
            }
        }
    }
    
    /**
     * 待機ユーティリティ
     * @param {number} ms - 待機時間（ミリ秒）
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * エラー統計の取得
     * @returns {Object} エラー統計
     */
    getErrorStats() {
        const stats = {};
        for (const [type, count] of this.errorCounts.entries()) {
            stats[type] = count;
        }
        return stats;
    }
    
    /**
     * エラー統計のリセット
     */
    resetErrorStats() {
        this.errorCounts.clear();
    }
}

/**
 * 通知付きエラーハンドラー（Chrome拡張機能用）
 */
class NotificationErrorHandler extends ErrorHandler {
    /**
     * エラーの処理と通知
     * @param {Error} error - エラーオブジェクト
     * @param {Object} context - エラー発生コンテキスト
     * @param {boolean} showNotification - 通知を表示するかどうか
     * @returns {Object} エラー処理結果
     */
    handleError(error, context = {}, showNotification = true) {
        const result = super.handleError(error, context);
        
        if (showNotification && typeof chrome !== 'undefined' && chrome.notifications) {
            this.showErrorNotification(result);
        }
        
        return result;
    }
    
    /**
     * エラー通知の表示
     * @param {Object} errorResult - エラー処理結果
     */
    showErrorNotification(errorResult) {
        const title = 'ReadLater エラー';
        const message = errorResult.userMessage || 'エラーが発生しました';
        
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: title,
            message: message
        });
    }
}

/**
 * グローバルエラーハンドラーの設定
 */
function setupGlobalErrorHandling() {
    const errorHandler = new NotificationErrorHandler();
    
    // 未処理のPromise拒否をキャッチ
    if (typeof window !== 'undefined') {
        window.addEventListener('unhandledrejection', (event) => {
            console.error('ReadLater for Obsidian: Unhandled promise rejection', event.reason);
            errorHandler.handleError(new Error(event.reason), { type: 'unhandled_rejection' });
            event.preventDefault();
        });
        
        // 未処理のエラーをキャッチ
        window.addEventListener('error', (event) => {
            console.error('ReadLater for Obsidian: Unhandled error', event.error);
            errorHandler.handleError(event.error, { type: 'unhandled_error' });
        });
    }
    
    return errorHandler;
}

// モジュールのエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ErrorHandler, NotificationErrorHandler, setupGlobalErrorHandling };
} else {
    window.ErrorHandler = ErrorHandler;
    window.NotificationErrorHandler = NotificationErrorHandler;
    window.setupGlobalErrorHandling = setupGlobalErrorHandling;
}
