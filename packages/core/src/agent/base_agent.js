/**
 * Base Autonomous Agent Loop with Durable Task Checkpointing
 */
export class BaseAgent {
  constructor({ router, sentinel, toolRegistry, systemPrompt = '', onStepUpdate = null, memoryStore = null }) {
    this.router = router;
    this.sentinel = sentinel;
    this.tools = toolRegistry;
    this.systemPrompt = systemPrompt;
    this.onStepUpdate = onStepUpdate;
    this.memoryStore = memoryStore;
    this.messages = [];
    this.reset();
  }

  reset() {
    this.messages = [];
    if (this.systemPrompt) {
      this.messages.push({ role: 'system', content: this.systemPrompt });
    }
  }

  async runGoal(userGoal, options = {}) {
    const maxSteps = options.maxSteps || 15;
    let taskId = options.taskId;

    // Create or rehydrate durable task in memory store
    if (this.memoryStore) {
      if (taskId) {
        const existing = this.memoryStore.getTask(taskId);
        if (existing && existing.lastMessagesSnapshot) {
          this.messages = existing.lastMessagesSnapshot;
        }
      } else {
        const task = this.memoryStore.createTask({ title: userGoal });
        taskId = task.id;
      }
    }

    if (!options.isResuming) {
      this.messages.push({ role: 'user', content: userGoal });
    }

    let stepCount = options.startStep || 0;

    if (this.memoryStore && taskId) {
      this.memoryStore.updateTaskState(taskId, 'running', { step: stepCount });
    }

    while (stepCount < maxSteps) {
      stepCount++;
      const progressPercent = Math.min(90, Math.round((stepCount / maxSteps) * 100));

      this.notify({
        type: 'thinking',
        taskId,
        step: stepCount,
        progress: progressPercent,
        message: 'Reasoning...'
      });

      // Save execution checkpoint
      if (this.memoryStore && taskId) {
        this.memoryStore.saveCheckpoint(taskId, {
          step: stepCount,
          progress: progressPercent,
          status: 'running',
          description: `Reasoning step ${stepCount}`,
          messages: this.messages
        });
      }

      // When approaching the step limit, instruct the model to synthesize findings into a final response
      if (stepCount === maxSteps - 1) {
        this.messages.push({
          role: 'system',
          content: 'Notice: You have 1 step remaining. Do not invoke more tools. Synthesize all findings and present your complete final answer now in Markdown.'
        });
      }

      const response = await this.router.chatCompletion({
        messages: this.messages,
        tools: stepCount >= maxSteps ? [] : this.tools.getSchemas(),
        temperature: 0.2
      });

      this.messages.push({
        role: 'assistant',
        content: response.content || '',
        tool_calls: response.tool_calls || []
      });

      if (!response.tool_calls || response.tool_calls.length === 0) {
        if (this.memoryStore && taskId) {
          this.memoryStore.updateTaskState(taskId, 'completed', {
            progress: 100,
            step: stepCount,
            result: response.content
          });
        }

        this.notify({
          type: 'complete',
          taskId,
          result: response.content,
          provider: response.providerUsed
        });

        return { success: true, taskId, content: response.content, provider: response.providerUsed };
      }

      for (const toolCall of response.tool_calls) {
        const name = toolCall.function.name;
        let args = {};
        try { args = JSON.parse(toolCall.function.arguments || '{}'); } catch {}

        this.notify({
          type: 'tool_call',
          taskId,
          step: stepCount,
          name,
          args
        });

        // Sentinel interception
        const check = await this.sentinel.verifyAction(name, args);
        let result = null;

        if (!check.approved) {
          result = { error: `Action halted by Sentinel: User rejected ${name}.` };
          if (this.memoryStore && taskId) {
            this.memoryStore.updateTaskState(taskId, 'waiting_approval', {
              pendingAction: name,
              pendingArgs: args
            });
          }
        } else {
          try {
            // Idempotency check for external operations
            const idempotencyKey = `${taskId}_${stepCount}_${name}`;
            if (this.memoryStore && this.memoryStore.hasExecutedAction(idempotencyKey)) {
              result = { notice: `Skipped duplicate execution: already executed in checkpoint.` };
            } else {
              result = await this.tools.execute(name, args);
              if (this.memoryStore) {
                this.memoryStore.recordActionExecution(idempotencyKey, { name, args });
              }
            }
          } catch (err) {
            result = { error: `Execution error: ${err.message}` };
          }
        }

        this.notify({
          type: 'tool_result',
          taskId,
          step: stepCount,
          name,
          result
        });

        this.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: typeof result === 'string' ? result : JSON.stringify(result)
        });
      }
    }

    // Graceful final synthesis fallback when loop finishes instead of failing with 'Max steps reached'
    try {
      const finalSynthesis = await this.router.chatCompletion({
        messages: [
          ...this.messages,
          {
            role: 'system',
            content: 'Synthesize all findings and observations gathered across steps into an executive summary. If the queried product or subject is unreleased or not yet commercially available, state that clearly, share expected timelines or leaks, and compare with the latest available alternatives with pricing tables.'
          }
        ],
        tools: [],
        temperature: 0.3
      });

      const synthesizedText = finalSynthesis.content || 'I completed the research across multiple sources, but could not locate official commercial listings for this query.';

      if (this.memoryStore && taskId) {
        this.memoryStore.updateTaskState(taskId, 'completed', {
          progress: 100,
          step: stepCount,
          result: synthesizedText
        });
      }

      this.notify({
        type: 'complete',
        taskId,
        result: synthesizedText,
        provider: finalSynthesis.providerUsed
      });

      return { success: true, taskId, content: synthesizedText, provider: finalSynthesis.providerUsed };
    } catch {
      if (this.memoryStore && taskId) {
        this.memoryStore.updateTaskState(taskId, 'failed', { error: 'Execution limit reached' });
      }
      return { success: false, taskId, content: 'Execution limit reached while researching.' };
    }
  }

  notify(event) {
    if (this.onStepUpdate) this.onStepUpdate(event);
  }
}
