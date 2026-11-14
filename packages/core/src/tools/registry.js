/**
 * Base Tool Registry
 */
export class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  registerTool(schema, handler) {
    if (!schema?.function?.name) throw new Error('Invalid tool schema: function.name required');
    this.tools.set(schema.function.name, { schema, handler });
  }

  getSchemas() {
    return Array.from(this.tools.values()).map(t => t.schema);
  }

  async execute(name, args) {
    const entry = this.tools.get(name);
    if (!entry) throw new Error(`Tool '${name}' not found in registry.`);
    return await entry.handler(args);
  }
}
