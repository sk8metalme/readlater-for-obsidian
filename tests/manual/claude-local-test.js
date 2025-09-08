// ReadLater for Obsidian - Claude API ローカルテストスクリプト
// 実際のClaude APIを使用したマニュアルテスト

const { ClaudeAPI, LanguageDetector, TranslationService, SummaryService } = require('../../src/lib/claude-api.js');

// テスト用のサンプル記事データ
const sampleArticles = {
    english: {
        title: "The Future of Artificial Intelligence",
        content: `Artificial intelligence (AI) is rapidly transforming various sectors of our society. From healthcare to transportation, AI technologies are becoming increasingly sophisticated and widespread. Machine learning algorithms can now process vast amounts of data to identify patterns and make predictions with remarkable accuracy.

The development of large language models has particularly revolutionized natural language processing. These models can understand, generate, and translate text in multiple languages, opening up new possibilities for global communication and collaboration.

However, the rapid advancement of AI also raises important ethical and societal questions. Issues such as privacy, bias, and job displacement need to be carefully addressed as we move forward with AI integration.

Despite these challenges, the potential benefits of AI are enormous. From personalized medicine to climate change solutions, AI could help solve some of humanity's most pressing problems.`,
        expectedLanguage: 'en'
    },
    
    japanese: {
        title: "人工知能の未来",
        content: `人工知能（AI）は私たちの社会の様々な分野を急速に変革しています。医療から輸送まで、AI技術はますます洗練され、広範囲に普及しています。機械学習アルゴリズムは、膨大な量のデータを処理してパターンを特定し、驚くべき精度で予測を行うことができるようになりました。

特に大規模言語モデルの発展は、自然言語処理を革命的に変化させました。これらのモデルは複数の言語でテキストを理解、生成、翻訳することができ、グローバルなコミュニケーションと協力の新たな可能性を開いています。

しかし、AIの急速な進歩は重要な倫理的・社会的問題も提起しています。プライバシー、偏見、雇用の置き換えなどの問題は、AI統合を進める際に慎重に対処する必要があります。`,
        expectedLanguage: 'ja'
    },
    
    chinese: {
        title: "人工智能的未来",
        content: `人工智能（AI）正在快速改变我们社会的各个领域。从医疗保健到交通运输，人工智能技术正变得越来越复杂和广泛。机器学习算法现在可以处理大量数据来识别模式，并以惊人的准确度进行预测。

大型语言模型的发展特别revolutionized了自然语言处理。这些模型可以理解、生成和翻译多种语言的文本，为全球沟通与合作开辟了新的可能性。

然而，人工智能的快速发展也引发了重要的伦理和社会问题。在推进人工智能整合时，需要谨慎处理隐私、偏见和就业替代等问题。`,
        expectedLanguage: 'zh'
    }
};

/**
 * Claude APIローカルテストクラス
 */
class ClaudeLocalTester {
    constructor() {
        this.testResults = [];
        this.apiKey = null;
        this.claudeAPI = null;
        this.languageDetector = null;
        this.translationService = null;
        this.summaryService = null;
    }
    
    /**
     * APIキーの設定
     * @param {string} apiKey - Claude APIキー
     */
    setApiKey(apiKey) {
        try {
            this.apiKey = apiKey;
            this.claudeAPI = new ClaudeAPI(apiKey);
            this.languageDetector = new LanguageDetector();
            this.translationService = new TranslationService(this.claudeAPI);
            this.summaryService = new SummaryService(this.claudeAPI);
            
            console.log('✅ Claude API services initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Claude API services:', error.message);
            return false;
        }
    }
    
    /**
     * 全てのテストを実行
     */
    async runAllTests() {
        console.log('\n🧪 Claude API ローカルテスト開始\n');
        
        if (!this.claudeAPI) {
            console.error('❌ Claude API not initialized. Please set API key first.');
            return;
        }
        
        try {
            // 1. 言語検出テスト
            await this.testLanguageDetection();
            
            // 2. 翻訳テスト
            await this.testTranslation();
            
            // 3. 要約テスト
            await this.testSummarization();
            
            // 4. 統合ワークフローテスト
            await this.testIntegratedWorkflow();
            
            // 結果の表示
            this.displayResults();
            
        } catch (error) {
            console.error('❌ Test execution failed:', error);
        }
    }
    
    /**
     * 言語検出テスト
     */
    async testLanguageDetection() {
        console.log('📝 言語検出テスト開始...');
        
        for (const [lang, article] of Object.entries(sampleArticles)) {
            try {
                const result = await this.languageDetector.detectLanguage(article.content);
                
                const success = result.language === article.expectedLanguage;
                console.log(`   ${lang}: ${result.language} (信頼度: ${result.confidence.toFixed(2)}) ${success ? '✅' : '❌'}`);
                
                this.testResults.push({
                    test: 'Language Detection',
                    input: lang,
                    expected: article.expectedLanguage,
                    actual: result.language,
                    confidence: result.confidence,
                    success: success
                });
                
            } catch (error) {
                console.error(`   ${lang}: エラー - ${error.message} ❌`);
                this.testResults.push({
                    test: 'Language Detection',
                    input: lang,
                    error: error.message,
                    success: false
                });
            }
        }
        
        console.log('');
    }
    
    /**
     * 翻訳テスト
     */
    async testTranslation() {
        console.log('🌐 翻訳テスト開始...');
        
        // 英語→日本語翻訳テスト
        try {
            const englishArticle = sampleArticles.english;
            
            console.log('   英語タイトル翻訳中...');
            const titleResult = await this.translationService.translateText(
                englishArticle.title,
                'en',
                'ja',
                { isTitle: true }
            );
            
            console.log(`   英語タイトル: "${englishArticle.title}"`);
            console.log(`   翻訳結果: "${titleResult.translatedText}" ✅`);
            
            console.log('\n   英語本文翻訳中...');
            const contentResult = await this.translationService.translateText(
                englishArticle.content.substring(0, 300) + '...', // 短縮版でテスト
                'en',
                'ja'
            );
            
            console.log(`   翻訳完了 (${contentResult.translatedText.length}文字) ✅`);
            
            this.testResults.push({
                test: 'Translation',
                input: 'English to Japanese',
                titleTranslation: titleResult.translatedText,
                contentLength: contentResult.translatedText.length,
                success: !titleResult.skipped && !contentResult.skipped
            });
            
        } catch (error) {
            console.error(`   翻訳エラー: ${error.message} ❌`);
            this.testResults.push({
                test: 'Translation',
                input: 'English to Japanese',
                error: error.message,
                success: false
            });
        }
        
        console.log('');
    }
    
    /**
     * 要約テスト
     */
    async testSummarization() {
        console.log('📄 要約テスト開始...');
        
        try {
            const englishArticle = sampleArticles.english;
            
            console.log('   記事要約生成中...');
            const summaryResult = await this.summaryService.generateSummary(
                englishArticle.content,
                { style: 'structured', maxLength: 300 }
            );
            
            if (!summaryResult.skipped) {
                console.log(`   要約生成完了 (${summaryResult.summaryWordCount}語) ✅`);
                console.log(`   要約内容:\n${summaryResult.summary.substring(0, 200)}...\n`);
                
                // キーワード抽出テスト
                console.log('   キーワード抽出中...');
                const keywordsResult = await this.summaryService.generateKeywords(englishArticle.content);
                console.log(`   抽出キーワード: ${keywordsResult.keywords.join(', ')} ✅`);
                
                this.testResults.push({
                    test: 'Summarization',
                    input: 'English article',
                    summaryLength: summaryResult.summaryWordCount,
                    keywordsCount: keywordsResult.keywords.length,
                    keywords: keywordsResult.keywords,
                    success: true
                });
                
            } else {
                console.log(`   要約スキップ: ${summaryResult.reason} ⚠️`);
                this.testResults.push({
                    test: 'Summarization',
                    input: 'English article',
                    skipped: true,
                    reason: summaryResult.reason,
                    success: false
                });
            }
            
        } catch (error) {
            console.error(`   要約エラー: ${error.message} ❌`);
            this.testResults.push({
                test: 'Summarization',
                input: 'English article',
                error: error.message,
                success: false
            });
        }
        
        console.log('');
    }
    
    /**
     * 統合ワークフローテスト
     */
    async testIntegratedWorkflow() {
        console.log('🔄 統合ワークフローテスト開始...');
        
        try {
            const englishArticle = sampleArticles.english;
            
            // 1. 言語検出
            console.log('   1. 言語検出...');
            const langResult = await this.languageDetector.detectLanguage(englishArticle.content);
            console.log(`      検出言語: ${langResult.language} ✅`);
            
            // 2. 翻訳
            console.log('   2. 翻訳実行...');
            const translationResult = await this.translationService.translateText(
                englishArticle.content.substring(0, 200),
                langResult.language,
                'ja'
            );
            console.log(`      翻訳完了: ${translationResult.translatedText.length}文字 ✅`);
            
            // 3. 要約（翻訳された内容で）
            console.log('   3. 要約生成...');
            const summaryResult = await this.summaryService.generateSummary(
                translationResult.translatedText,
                { style: 'bullet', maxLength: 200 }
            );
            
            if (!summaryResult.skipped) {
                console.log(`      要約完了: ${summaryResult.summaryWordCount}語 ✅`);
                
                this.testResults.push({
                    test: 'Integrated Workflow',
                    input: 'English article → Japanese',
                    steps: {
                        detection: langResult.language,
                        translation: translationResult.translatedText.length,
                        summary: summaryResult.summaryWordCount
                    },
                    success: true
                });
                
            } else {
                console.log(`      要約スキップ: ${summaryResult.reason} ⚠️`);
            }
            
        } catch (error) {
            console.error(`   統合ワークフローエラー: ${error.message} ❌`);
            this.testResults.push({
                test: 'Integrated Workflow',
                error: error.message,
                success: false
            });
        }
        
        console.log('');
    }
    
    /**
     * テスト結果の表示
     */
    displayResults() {
        console.log('📊 テスト結果サマリー\n');
        
        const successCount = this.testResults.filter(r => r.success).length;
        const totalCount = this.testResults.length;
        
        console.log(`成功: ${successCount}/${totalCount} (${(successCount/totalCount*100).toFixed(1)}%)`);
        
        console.log('\n詳細結果:');
        this.testResults.forEach((result, index) => {
            const status = result.success ? '✅' : '❌';
            console.log(`  ${index + 1}. ${result.test} (${result.input}): ${status}`);
            
            if (result.error) {
                console.log(`     エラー: ${result.error}`);
            }
        });
        
        console.log('\n🏁 テスト完了\n');
    }
    
    /**
     * APIキー不要のオフラインテスト
     */
    async runOfflineTests() {
        console.log('\n🔌 オフラインテスト開始 (APIキー不要)\n');
        
        // 言語検出のみテスト
        const detector = new LanguageDetector();
        
        for (const [lang, article] of Object.entries(sampleArticles)) {
            try {
                const result = await detector.detectLanguage(article.content);
                const success = result.language === article.expectedLanguage;
                console.log(`${lang}: ${result.language} (信頼度: ${result.confidence.toFixed(2)}) ${success ? '✅' : '❌'}`);
            } catch (error) {
                console.error(`${lang}: エラー - ${error.message} ❌`);
            }
        }
        
        console.log('\n🏁 オフラインテスト完了\n');
    }
}

// モジュールのエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ClaudeLocalTester, sampleArticles };
} else {
    window.ClaudeLocalTester = ClaudeLocalTester;
    window.sampleArticles = sampleArticles;
}

// CLIとして実行された場合
if (require.main === module) {
    const tester = new ClaudeLocalTester();
    
    // コマンドライン引数からAPIキーを取得
    const apiKey = process.env.CLAUDE_API_KEY || process.argv[2];
    
    if (apiKey && apiKey !== 'offline') {
        tester.setApiKey(apiKey);
        tester.runAllTests().catch(console.error);
    } else {
        console.log('APIキーが提供されていません。オフラインテストのみ実行します。');
        console.log('使用法: node claude-local-test.js <API_KEY> または CLAUDE_API_KEY環境変数を設定');
        tester.runOfflineTests().catch(console.error);
    }
}
