/**
 * Base Autonomous Agent Loop
 */
export class BaseAgent {
  constructor({ router, sentinel, toolRegistry, systemPrompt = '', onStepUpdate = null }) {
    this.router = router;
    this.sentinel = sentinel;
    this.tools = toolRegistry;
    this.systemPrompt = systemPrompt;
    this.onStepUpdate = onStepUpdate;
    this.messages = [];
    this.reset();
  }

  reset() {
    this.messages = [];
    if (this.systemPrompt) {
      this.messages.push({ role: 'system', content: this.systemPrompt });
    }
  }

  async runGoal(userGoal, maxSteps = 15) {
    this.messages.push({ role: 'user', content: userGoal });
    let stepCount = 0;

    while (stepCount < maxSteps) {
      stepCount++;
      this.notify({ type: 'thinking', step: stepCount, message: 'Reasoning...' });

      const response = await this.router.chatCompletion({
        messages: this.messages,
        tools: this.tools.getSchemas(),
        temperature: 0.2
      });

      this.messages.push({
        role: 'assistant',
        content: response.content || '',
        tool_calls: response.tool_calls || []
      });

      if (!response.tool_calls || response.tool_calls.length === 0) {
        this.notify({ type: 'complete', result: response.content, provider: response.providerUsed });
        return { success: true, content: response.content, provider: response.providerUsed };
      }

      for (const toolCall of response.tool_calls) {
        const name = toolCall.function.name;
        let args = {};
        try { args = JSON.parse(toolCall.function.arguments || '{}'); } catch {}

        this.notify({ type: 'tool_call', step: stepCount, name, args });

        // Sentinel interception
        const check = await this.sentinel.verifyAction(name, args);
        let result = null;

        if (!check.approved) {
          result = { error: `Action halted by Sentinel: User rejected ${name}.` };
        } else {
          try {
            result = await this.tools.execute(name, args);
          } catch (err) {
            result = { error: `Execution error: ${err.message}` };
          }
        }

        this.notify({ type: 'tool_result', step: stepCount, name, result });
        this.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: typeof result === 'string' ? result : JSON.stringify(result)
        });
      }
    }

    return { success: false, content: 'Max steps reached.' };
  }

  notify(event) {
    if (this.onStepUpdate) this.onStepUpdate(event);
  }
}
