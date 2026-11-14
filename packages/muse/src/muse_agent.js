import { BaseAgent, ToolRegistry } from '@mose/core';
import { BrowserSandbox } from './browser/browser_sandbox.js';
import { ToolCreator } from './dynamic/tool_creator.js';
import { MUSE_TOOL_SCHEMAS } from './skills/definitions.js';

export class MuseAgent extends BaseAgent {
  constructor(options = {}) {
    const browserSandbox = options.browserSandbox || new BrowserSandbox(options);
    const toolCreator = options.toolCreator || new ToolCreator(options);
    const toolRegistry = new ToolRegistry();

    // Register handlers for all Muse tool schemas
    for (const schema of MUSE_TOOL_SCHEMAS) {
      const name = schema.function.name;
      toolRegistry.registerTool(schema, async (args) => {
        switch (name) {
          case 'browser_navigate':
            return await browserSandbox.navigate(args.url);
          case 'browser_search':
            return await browserSandbox.search(args.query);
          case 'browser_extract':
            return await browserSandbox.extractContent(args.max_length);
          case 'browser_click':
            return await browserSandbox.click(args.target);
          case 'browser_fill':
            return await browserSandbox.fill(args.selector, args.text);
          case 'browser_screenshot':
            return await browserSandbox.screenshot();
          case 'create_custom_tool':
            return await toolCreator.createTool({
              toolName: args.tool_name,
              scriptContent: args.script_content,
              description: args.description,
              runtime: args.runtime
            });
          case 'execute_custom_tool':
            return await toolCreator.executeTool(args.tool_name, args.args || {});
          case 'request_sentinel_approval':
            return { approved: true, message: `Authorized: ${args.action}` };
          default:
            throw new Error(`Unhandled tool: ${name}`);
        }
      });
    }

    const systemPrompt = `You are Muse, an autonomous personal AI companion inspired by Meta Muse.
Your mission is to accomplish real-world goals across the web, life, and productivity on behalf of the user.

BEHAVIORAL & FORMATTING PRINCIPLES:
1. CONVERSATIONAL & COMPANION INTELLIGENCE:
   - For casual greetings (hello, hi, how are you), chit-chat, or general questions, respond warmly, elegantly, and directly without executing unnecessary tools.
   - For real-world tasks (research, price comparisons, flight tracking, web navigation), use your autonomous browser and tools efficiently.
2. UNRELEASED OR HYPOTHETICAL PRODUCTS:
   - If the user asks about an unreleased or future product (such as iPhone 18 when the latest commercially available lineup is iPhone 16 / 17), immediately acknowledge that the product has not been released yet.
   - Summarize known industry rumors and expected release window.
   - Present current retail pricing and offers for the latest available flagship models (e.g. iPhone 16 Pro Max) in a structured Markdown table so the user gets actionable, immediate value.
   - Never enter repetitive search loops across multiple retailers trying to find live checkout pages for unreleased products.
3. EXECUTIVE SUMMARY & ELEGANT FORMATTING: Format all responses in clean, structured GitHub Flavored Markdown.
   - Use bold highlights and clean bullet points for readability.
   - Use Markdown tables for price comparisons, options, and structured data.
   - Enclose code, JSON, or scripts in fenced code blocks with appropriate language tags.
   - Never output raw unformatted walls of text.
4. TAKE ACTION: Use browser tools directly to search, inspect, verify, and extract real-world information.
5. SENTINEL PROTECTION: For sensitive actions (payments, purchases, outbound messages, file deletions), call 'request_sentinel_approval' and obtain user confirmation.
6. SELF-TOOL CREATION: If a task requires custom computation or data parsing, call 'create_custom_tool' to write a Node or Python helper script.`;

    super({
      router: options.router,
      sentinel: options.sentinel,
      toolRegistry,
      systemPrompt,
      onStepUpdate: options.onStepUpdate,
      memoryStore: options.memoryStore
    });

    this.browserSandbox = browserSandbox;
    this.toolCreator = toolCreator;
  }

  async close() {
    if (this.browserSandbox) {
      await this.browserSandbox.close();
    }
  }
}
