import { SentinelGuard } from '../src/muse/sentinel.js';
import { BrowserSandbox } from '../src/muse/browser_sandbox.js';
import { ToolCreator } from '../src/muse/tool_creator.js';
import { ModelRouter } from '../src/providers/router.js';

async function runTests() {
  console.log('🧪 Starting Muse Agent Test Suite...\n');
  let passed = 0;
  let failed = 0;

  // Test 1: Sentinel Classification
  try {
    const sentinel = new SentinelGuard({ workspaceRoot: process.cwd() });
    const check1 = sentinel.classifyAction('make_payment', { amount: 50 });
    const check2 = sentinel.classifyAction('browser_navigate', { url: 'https://example.com' });
    const check3 = sentinel.classifyAction('send_email', { to: 'boss@example.com' });

    if (check1.isSensitive && check3.isSensitive && !check2.isSensitive) {
      console.log('✅ Test 1: Sentinel accurately tags sensitive vs benign actions');
      passed++;
    } else {
      throw new Error(`Sentinel classification mismatch: ${JSON.stringify({ check1, check2, check3 })}`);
    }
  } catch (err) {
    console.error('❌ Test 1 Failed:', err.message);
    failed++;
  }

  // Test 2: Tool Creator ("Builds Its Own Tools")
  try {
    const creator = new ToolCreator({ workspaceRoot: process.cwd() });
    const result = await creator.createTool({
      toolName: 'unit_test_math',
      scriptContent: `
const raw = process.env.MUSE_TOOL_ARGS || (process.argv.includes('--b64') ? Buffer.from(process.argv[process.argv.indexOf('--b64') + 1], 'base64').toString('utf8') : '{}');
const args = JSON.parse(raw);
console.log(JSON.stringify({ answer: (args.a || 2) * (args.b || 3) }));
`.trim(),
      description: 'Multiplies two numbers',
      runtime: 'node'
    });

    if (result.success) {
      const execResult = await creator.executeTool('unit_test_math', { a: 5, b: 7 });
      const parsed = JSON.parse(execResult.output);
      if (parsed.answer === 35) {
        console.log('✅ Test 2: Tool Creator successfully writes, validates and executes dynamic tools');
        passed++;
      } else {
        throw new Error(`Tool execution output mismatch: ${execResult.output}`);
      }
    } else {
      throw new Error(`Tool creation failed: ${result.error}`);
    }
  } catch (err) {
    console.error('❌ Test 2 Failed:', err.message);
    failed++;
  }

  // Test 3: Model Router with Gemini Provider
  try {
    const router = new ModelRouter({
      GEMINI_API_KEY: 'test-gemini-key',
      GROQ_API_KEY: 'test-groq-key'
    });
    const providers = router.getActiveProviders();
    const hasGemini = providers.some(p => p.id === 'gemini-flash');
    if (hasGemini) {
      console.log('✅ Test 3: ModelRouter successfully registers Google Gemini provider');
      passed++;
    } else {
      throw new Error('Gemini provider not registered in router');
    }
  } catch (err) {
    console.error('❌ Test 3 Failed:', err.message);
    failed++;
  }

  // Test 4: Browser Sandbox (Playwright + Native Browser)
  try {
    const sandbox = new BrowserSandbox({
      workspaceRoot: process.cwd(),
      headless: true
    });
    const nav = await sandbox.navigate('https://example.com');
    const content = await sandbox.extractContent(500);
    await sandbox.close();

    if (nav.title.includes('Example Domain') && content.text.length > 20) {
      console.log('✅ Test 4: Browser Sandbox successfully launched native browser, navigated and extracted content');
      passed++;
    } else {
      throw new Error(`Unexpected page title or content length: ${nav.title}, len: ${content.text?.length}`);
    }
  } catch (err) {
    console.error('❌ Test 4 Failed:', err.message);
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
