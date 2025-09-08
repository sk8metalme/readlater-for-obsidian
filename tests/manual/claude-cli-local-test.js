// ReadLater for Obsidian - Claude CLI ローカルテストスクリプト
// ローカルのClaude CLIを使用したマニュアルテスト（APIキー不要）

const { ClaudeCLI, LanguageDetector, TranslationService, SummaryService } = require('../../src/lib/claude-cli.js');

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
 * Claude CLIローカルテストクラス
 */
class ClaudeCLILocalTester {
    constructor() {
        this.testResults = [];
        this.claudeCLI = null;
        this.languageDetector = null;
        this.translationService = null;
        this.summaryService = null;
    }
    
    /**
     * Claude CLIサービスの初期化
     */
    initializeServices() {
        try {
            this.claudeCLI = new ClaudeCLI();
            this.languageDetector = new LanguageDetector();
            
            if (this.claudeCLI.isAvailable) {
                this.translationService = new TranslationService(this.claudeCLI);
                this.summaryService = new SummaryService(this.claudeCLI);
                console.log('✅ Claude CLI services initialized successfully');
                return true;
            } else {
                console.log('⚠️ Claude CLI is not available on this system');
                return false;
            }
        } catch (error) {
            console.error('❌ Failed to initialize Claude CLI services:', error.message);
            return false;
        }
    }
    
    /**
     * 全てのテストを実行
     */
    async runAllTests() {
        console.log('\n🧪 Claude CLI ローカルテスト開始\n');
        console.log('📋 注意: このテストはローカルのClaude CLIを使用します（APIキー不要）\n');
        
        const initialized = this.initializeServices();
        
        try {
            // 1. 言語検出テスト（常に実行可能）
            await this.testLanguageDetection();
            
            if (initialized) {
                // 2. Claude CLI利用可能性テスト
                await this.testClaudeCLIAvailability();
                
                // 3. 翻訳テスト
                await this.testTranslation();
                
                // 4. 要約テスト
                await this.testSummarization();
                
                // 5. 統合ワークフローテスト
                await this.testIntegratedWorkflow();
            } else {
                console.log('⚠️ Claude CLIが利用できないため、言語検出以外のテストをスキップします');
                console.log('   Claude CLIをインストールしてから再度実行してください');
                console.log('   インストール方法: https://docs.anthropic.com/ja/docs/claude-code/cli-reference\n');
            }
            
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
     * Claude CLI利用可能性テスト
     */
    async testClaudeCLIAvailability() {
        console.log('🔧 Claude CLI利用可能性テスト開始...');
        
        try {
            const testPrompt = 'テスト用の簡単なプロンプトです。「テスト成功」と返答してください。';
            
            console.log('   Claude CLIにテストリクエスト送信中...');
            const response = await this.claudeCLI.makeRequest(testPrompt, {
                model: 'sonnet',
                maxTurns: 1
            });
            
            if (response && response.trim().length > 0) {
                console.log(`   Claude CLI応答: "${response.substring(0, 50)}..." ✅`);
                this.testResults.push({
                    test: 'Claude CLI Availability',
                    input: 'Test request',
                    response: response.substring(0, 100),
                    success: true
                });
            } else {
                console.log('   Claude CLI応答が空です ❌');
                this.testResults.push({
                    test: 'Claude CLI Availability',
                    input: 'Test request',
                    error: 'Empty response',
                    success: false
                });
            }
            
        } catch (error) {
            console.error(`   Claude CLIエラー: ${error.message} ❌`);
            this.testResults.push({
                test: 'Claude CLI Availability',
                input: 'Test request',
                error: error.message,
                success: false
            });
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
            
            console.log('\n   英語本文翻訳中（抜粋）...');
            const contentSample = englishArticle.content.substring(0, 200) + '...';
            const contentResult = await this.translationService.translateText(
                contentSample,
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
                englishArticle.content.substring(0, 300),
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
                this.testResults.push({
                    test: 'Integrated Workflow',
                    input: 'English article → Japanese',
                    steps: {
                        detection: langResult.language,
                        translation: translationResult.translatedText.length,
                        summary: 'skipped'
                    },
                    success: false
                });
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
        
        console.log('\n📋 実行環境情報:');
        console.log(`  Node.js: ${process.version}`);
        console.log(`  プラットフォーム: ${process.platform}`);
        console.log(`  実行時刻: ${new Date().toLocaleString('ja-JP')}`);
        
        console.log('\n🏁 Claude CLIローカルテスト完了\n');
        
        if (!this.claudeCLI?.isAvailable) {
            console.log('💡 Claude CLIインストール方法:');
            console.log('   https://docs.anthropic.com/ja/docs/claude-code/cli-reference');
        }
    }
    
    /**
     * 言語検出のみのオフラインテスト
     */
    async runOfflineTests() {
        console.log('\n🔌 オフラインテスト開始 (Claude CLI不要)\n');
        
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
    module.exports = { ClaudeCLILocalTester, sampleArticles };
} else {
    window.ClaudeCLILocalTester = ClaudeCLILocalTester;
    window.sampleArticles = sampleArticles;
}

// CLIとして実行された場合
if (require.main === module) {
    const tester = new ClaudeCLILocalTester();
    
    // コマンドライン引数を確認
    const mode = process.argv[2];
    
    if (mode === 'offline') {
        console.log('言語検出のみのオフラインテストを実行します。');
        tester.runOfflineTests().catch(console.error);
    } else {
        console.log('Claude CLIフルテストを実行します。');
        tester.runAllTests().catch(console.error);
    }
}
