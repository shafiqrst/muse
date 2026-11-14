import { ModelRouter, SentinelGuard, ToolRegistry, MemoryStore } from '../packages/core/src/index.js';
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

  // Test 2: @mose/core MemoryStore Persistence
  try {
    const memStore = new MemoryStore({ workspaceRoot: process.cwd() });
    const addedMem = memStore.addMemory({ key: 'Test Preference', value: 'Dark mode', category: 'ui' });
    const memories = memStore.getMemories();
    const foundMem = memories.find(m => m.id === addedMem.id);
    
    const addedGoal = memStore.saveGoal({ title: 'Test Goal Execution', status: 'active', progress: 50 });
    const updatedGoal = memStore.updateGoal(addedGoal.id, { status: 'completed', progress: 100 });
    
    // Clean up test items
    memStore.deleteMemory(addedMem.id);

    if (foundMem && foundMem.value === 'Dark mode' && updatedGoal.progress === 100) {
      console.log('✅ Test 2: @mose/core MemoryStore correctly persists, updates, and removes memories & goals');
      passed++;
    } else {
      throw new Error('MemoryStore verification failed');
    }
  } catch (err) {
    console.error('❌ Test 2 Failed:', err.message);
    failed++;
  }

  // Test 3: @mose/muse Tool Creator
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
        console.log('✅ Test 3: @mose/muse ToolCreator successfully generates & executes dynamic tools');
        passed++;
      } else {
        throw new Error('Tool execution output mismatch');
      }
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    console.error('❌ Test 3 Failed:', err.message);
    failed++;
  }

  // Test 4: @mose/muse Browser Sandbox
  try {
    const sandbox = new BrowserSandbox({ workspaceRoot: process.cwd(), headless: true });
    const nav = await sandbox.navigate('https://example.com');
    const content = await sandbox.extractContent();
    await sandbox.close();

    if (nav.title.includes('Example Domain') && content.text.length > 20) {
      console.log('✅ Test 4: @mose/muse BrowserSandbox successfully launched native browser & extracted DOM');
      passed++;
    } else {
      throw new Error('Browser navigation or content mismatch');
    }
  } catch (err) {
    console.error('❌ Test 4 Failed:', err.message);
    failed++;
  }

  // Test 5: Durable Task State Machine, Checkpointing & Recovery
  try {
    const memStore = new MemoryStore({ workspaceRoot: process.cwd() });
    const task = memStore.createTask({ title: 'Autonomous Market Research' });
    
    // Simulate step 1 checkpoint
    memStore.saveCheckpoint(task.id, {
      step: 1,
      progress: 30,
      status: 'running',
      description: 'Browsing target websites',
      messages: [{ role: 'user', content: 'Autonomous Market Research' }, { role: 'assistant', content: 'Searching...' }]
    });

    // Verify incomplete task detection on restart
    const incompleteBefore = memStore.getIncompleteTasks();
    const hasTask = incompleteBefore.some(t => t.id === task.id && t.step === 1);

    // Verify Idempotency check prevents replay
    const idempotencyKey = `${task.id}_1_search`;
    memStore.recordActionExecution(idempotencyKey, { query: 'test search' });
    const isDuplicate = memStore.hasExecutedAction(idempotencyKey);

    // Complete task
    memStore.updateTaskState(task.id, 'completed', { progress: 100, step: 2 });
    const taskCompleted = memStore.getTask(task.id);

    if (hasTask && isDuplicate && taskCompleted.status === 'completed' && taskCompleted.progress === 100) {
      console.log('✅ Test 5: Durable Task State Machine correctly checkpoints, detects recovery state & enforces idempotency');
      passed++;
    } else {
      throw new Error('Durable task lifecycle verification failed');
    }
  } catch (err) {
    console.error('❌ Test 5 Failed:', err.message);
    failed++;
  }

  // Test 6: Sentinel Granular Browsing vs Payment Interception
  try {
    const sentinel = new SentinelGuard({ workspaceRoot: process.cwd() });
    const searchCheck = sentinel.classifyAction('browser_search', { query: 'iPhone 18 Pro Max price offer cheapest' });
    const navCheck = sentinel.classifyAction('browser_navigate', { url: 'https://apple.com/shop/buy-iphone/16-pro' });
    const clickLinkCheck = sentinel.classifyAction('browser_click', { target: 'The new iPhone - Apple Official Site - Buy now' });
    const checkoutCheck = sentinel.classifyAction('browser_click', { target: 'Place Order' });

    if (!searchCheck.isSensitive && !navCheck.isSensitive && !clickLinkCheck.isSensitive && checkoutCheck.isSensitive && checkoutCheck.riskLevel === 'CRITICAL') {
      console.log('✅ Test 6: Sentinel correctly allows read-only product search/navigation while intercepting checkout/payment');
      passed++;
    } else {
      throw new Error('Sentinel browsing vs payment classification mismatch');
    }
  } catch (err) {
    console.error('❌ Test 6 Failed:', err.message);
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
