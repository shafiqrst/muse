import { ModelRouter, SentinelGuard, ToolRegistry } from '../packages/core/src/index.js';
import { BrowserSandbox, ToolCreator, MuseAgent } from '../packages/muse/src/index.js';

async function runTests() {
  console.log('🧪 Starting Mose AI Monorepo Test Suite...\n');
  let passed = 0;
  let failed = 0;

  // Test 1: @mose/core Router & Sentinel
  try {
    const router = new ModelRouter({ GEMINI_API_KEY: 'test-key', GROQ_API_KEY: 'test-groq' });
    const sentinel = new SentinelGuard({ workspaceRoot: process.cwd() });
    
    const checkPayment = sentinel.classifyAction('make_payment', { amount: 100 });
    const checkNav = sentinel.classifyAction('browser_navigate', { url: 'https://example.com' });

    if (checkPayment.isSensitive && !checkNav.isSensitive && router.getActiveProviders().length > 0) {
      console.log('✅ Test 1: @mose/core Router & Sentinel classification passed');
      passed++;
    } else {
      throw new Error('Classification or provider check failed');
    }
  } catch (err) {
    console.error('❌ Test 1 Failed:', err.message);
    failed++;
  }

  // Test 2: @mose/muse Tool Creator
  try {
    const creator = new ToolCreator({ workspaceRoot: process.cwd() });
    const result = await creator.createTool({
      toolName: 'math_helper',
      scriptContent: 'console.log(JSON.stringify({ result: 42 * 2 }));',
      description: 'Test helper'
    });

    if (result.success) {
      const execRes = await creator.executeTool('math_helper');
      const parsed = JSON.parse(execRes.output);
      if (parsed.result === 84) {
        console.log('✅ Test 2: @mose/muse ToolCreator successfully generates & executes dynamic tools');
        passed++;
      } else {
        throw new Error('Tool execution output mismatch');
      }
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    console.error('❌ Test 2 Failed:', err.message);
    failed++;
  }

  // Test 3: @mose/muse Browser Sandbox
  try {
    const sandbox = new BrowserSandbox({ workspaceRoot: process.cwd(), headless: true });
    const nav = await sandbox.navigate('https://example.com');
    const content = await sandbox.extractContent();
    await sandbox.close();

    if (nav.title.includes('Example Domain') && content.text.length > 20) {
      console.log('✅ Test 3: @mose/muse BrowserSandbox successfully launched native browser & extracted DOM');
      passed++;
    } else {
      throw new Error('Browser navigation or content mismatch');
    }
  } catch (err) {
    console.error('❌ Test 3 Failed:', err.message);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
