// ReadLater for Obsidian - Claude API パフォーマンステスト
// レスポンス時間とスループットの測定

const { ClaudeAPI, LanguageDetector, TranslationService, SummaryService } = require('../../src/lib/claude-api.js');

/**
 * パフォーマンステストクラス
 */
class PerformanceTest {
    constructor() {
        this.results = [];
        this.languageDetector = new LanguageDetector();
    }
    
    /**
     * 言語検出のパフォーマンステスト
     */
    async testLanguageDetectionPerformance() {
        console.log('🚀 言語検出パフォーマンステスト開始...\n');
        
        const testCases = [
            { name: '短いテキスト (50文字)', text: 'This is a short English text sample for testing.' },
            { name: '中程度テキスト (200文字)', text: 'This is a medium length English text sample for testing language detection performance. It contains multiple sentences and should provide good detection accuracy. This test helps measure processing speed.' },
            { name: '長いテキスト (1000文字)', text: 'This is a very long English text sample designed to test language detection performance with larger inputs. '.repeat(10) },
            { name: '日本語テキスト (200文字)', text: 'これは日本語のテキストサンプルです。言語検出のパフォーマンステストのために使用されます。複数の文から構成されており、検出精度と処理速度の両方を測定するのに適しています。' },
            { name: '中国語テキスト (200文字)', text: '这是一个中文文本样本，用于测试语言检测性能。它包含多个句子，应该提供良好的检测精度。此测试有助于测量处理速度和准确性。' },
            { name: '混合言語テキスト', text: 'Hello こんにちは 你好 안녕하세요 This is a mixed language sample text for testing.' }
        ];
        
        for (const testCase of testCases) {
            console.log(`テスト: ${testCase.name}`);
            
            // 複数回実行して平均時間を計測
            const iterations = 100;
            const times = [];
            
            for (let i = 0; i < iterations; i++) {
                const startTime = performance.now();
                await this.languageDetector.detectLanguage(testCase.text);
                const endTime = performance.now();
                times.push(endTime - startTime);
            }
            
            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const minTime = Math.min(...times);
            const maxTime = Math.max(...times);
            
            console.log(`  平均時間: ${avgTime.toFixed(2)}ms`);
            console.log(`  最小時間: ${minTime.toFixed(2)}ms`);
            console.log(`  最大時間: ${maxTime.toFixed(2)}ms`);
            console.log(`  文字数: ${testCase.text.length}`);
            console.log(`  処理速度: ${(testCase.text.length / avgTime * 1000).toFixed(0)} 文字/秒\n`);
            
            this.results.push({
                test: 'Language Detection',
                name: testCase.name,
                textLength: testCase.text.length,
                avgTime,
                minTime,
                maxTime,
                throughput: testCase.text.length / avgTime * 1000
            });
        }
    }
    
    /**
     * メモリ使用量テスト
     */
    async testMemoryUsage() {
        console.log('💾 メモリ使用量テスト開始...\n');
        
        if (typeof process !== 'undefined' && process.memoryUsage) {
            const initialMemory = process.memoryUsage();
            console.log('初期メモリ使用量:');
            console.log(`  RSS: ${(initialMemory.rss / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Heap Used: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Heap Total: ${(initialMemory.heapTotal / 1024 / 1024).toFixed(2)} MB\n`);
            
            // 大量の言語検出処理を実行
            const largeText = 'This is a large text sample for memory testing. '.repeat(1000);
            
            for (let i = 0; i < 1000; i++) {
                await this.languageDetector.detectLanguage(largeText);
                
                if (i % 100 === 0) {
                    const currentMemory = process.memoryUsage();
                    console.log(`${i}回目 - Heap Used: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
                }
            }
            
            const finalMemory = process.memoryUsage();
            console.log('\n最終メモリ使用量:');
            console.log(`  RSS: ${(finalMemory.rss / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Heap Used: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Heap Total: ${(finalMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
            
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            console.log(`  メモリ増加: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB\n`);
            
        } else {
            console.log('⚠️ Node.js環境でないため、メモリテストをスキップします\n');
        }
    }
    
    /**
     * 並行処理テスト
     */
    async testConcurrentProcessing() {
        console.log('⚡ 並行処理テスト開始...\n');
        
        const testTexts = [
            'This is English text for concurrent testing.',
            'これは並行処理テスト用の日本語テキストです。',
            '这是用于并发测试的中文文本。',
            '이것은 동시 처리 테스트를 위한 한국어 텍스트입니다.',
            'Ceci est un texte français pour les tests concurrents.'
        ];
        
        // 並行処理数を変えてテスト
        const concurrencyLevels = [1, 5, 10, 20];
        
        for (const concurrency of concurrencyLevels) {
            console.log(`並行度: ${concurrency}`);
            
            const startTime = performance.now();
            const promises = [];
            
            for (let i = 0; i < concurrency; i++) {
                const text = testTexts[i % testTexts.length];
                promises.push(this.languageDetector.detectLanguage(text));
            }
            
            await Promise.all(promises);
            const endTime = performance.now();
            
            const totalTime = endTime - startTime;
            const avgTimePerTask = totalTime / concurrency;
            
            console.log(`  総時間: ${totalTime.toFixed(2)}ms`);
            console.log(`  平均時間/タスク: ${avgTimePerTask.toFixed(2)}ms`);
            console.log(`  スループット: ${(concurrency / totalTime * 1000).toFixed(2)} タスク/秒\n`);
            
            this.results.push({
                test: 'Concurrent Processing',
                concurrency,
                totalTime,
                avgTimePerTask,
                throughput: concurrency / totalTime * 1000
            });
        }
    }
    
    /**
     * エラー処理パフォーマンステスト
     */
    async testErrorHandlingPerformance() {
        console.log('🚨 エラー処理パフォーマンステスト開始...\n');
        
        const errorCases = [
            { name: '空文字列', input: '' },
            { name: 'null', input: null },
            { name: 'undefined', input: undefined },
            { name: '非常に短いテキスト', input: 'a' },
            { name: '数値のみ', input: '12345' },
            { name: '記号のみ', input: '!@#$%^&*()' }
        ];
        
        for (const errorCase of errorCases) {
            console.log(`エラーケース: ${errorCase.name}`);
            
            const iterations = 100;
            const times = [];
            
            for (let i = 0; i < iterations; i++) {
                const startTime = performance.now();
                try {
                    await this.languageDetector.detectLanguage(errorCase.input);
                } catch (error) {
                    // エラーは期待される
                }
                const endTime = performance.now();
                times.push(endTime - startTime);
            }
            
            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            console.log(`  平均処理時間: ${avgTime.toFixed(2)}ms\n`);
            
            this.results.push({
                test: 'Error Handling',
                name: errorCase.name,
                avgTime
            });
        }
    }
    
    /**
     * 全テストの実行
     */
    async runAllTests() {
        console.log('🧪 Claude API パフォーマンステスト開始\n');
        console.log('=' * 50 + '\n');
        
        await this.testLanguageDetectionPerformance();
        await this.testMemoryUsage();
        await this.testConcurrentProcessing();
        await this.testErrorHandlingPerformance();
        
        this.generateReport();
    }
    
    /**
     * レポート生成
     */
    generateReport() {
        console.log('📊 パフォーマンステスト結果サマリー\n');
        console.log('=' * 50 + '\n');
        
        // 言語検出パフォーマンス
        const langDetectionResults = this.results.filter(r => r.test === 'Language Detection');
        if (langDetectionResults.length > 0) {
            console.log('🔍 言語検出パフォーマンス:');
            langDetectionResults.forEach(result => {
                console.log(`  ${result.name}: ${result.avgTime.toFixed(2)}ms (${result.throughput.toFixed(0)} 文字/秒)`);
            });
            console.log('');
        }
        
        // 並行処理パフォーマンス
        const concurrentResults = this.results.filter(r => r.test === 'Concurrent Processing');
        if (concurrentResults.length > 0) {
            console.log('⚡ 並行処理パフォーマンス:');
            concurrentResults.forEach(result => {
                console.log(`  並行度${result.concurrency}: ${result.throughput.toFixed(2)} タスク/秒`);
            });
            console.log('');
        }
        
        // エラー処理パフォーマンス
        const errorResults = this.results.filter(r => r.test === 'Error Handling');
        if (errorResults.length > 0) {
            console.log('🚨 エラー処理パフォーマンス:');
            errorResults.forEach(result => {
                console.log(`  ${result.name}: ${result.avgTime.toFixed(2)}ms`);
            });
            console.log('');
        }
        
        console.log('🏁 パフォーマンステスト完了');
        console.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}\n`);
    }
}

// モジュールのエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PerformanceTest };
}

// CLIとして実行された場合
if (require.main === module) {
    const perfTest = new PerformanceTest();
    perfTest.runAllTests().catch(console.error);
}
