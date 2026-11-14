export const MUSE_TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'browser_navigate',
      description: 'Navigate persistent browser to any URL. Returns page title and status.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Target URL' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_search',
      description: 'Search the web for real-time information, products, flights, news, or articles.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_extract',
      description: 'Extract readable text, buttons, and links from the open page.',
      parameters: {
        type: 'object',
        properties: {
          max_length: { type: 'integer', description: 'Max chars' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_click',
      description: 'Click button, link, or element by text or selector.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Button text or CSS selector' }
        },
        required: ['target']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_fill',
      description: 'Type text into form inputs or textareas.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector' },
          text: { type: 'string', description: 'Text to input' }
        },
        required: ['selector', 'text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_screenshot',
      description: 'Capture screenshot of current page state.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_custom_tool',
      description: 'Meta Muse Self-Tool Creator: When no standard tool fits, generate a new Node.js or Python tool.',
      parameters: {
        type: 'object',
        properties: {
          tool_name: { type: 'string', description: 'Name of tool' },
          script_content: { type: 'string', description: 'Executable script' },
          description: { type: 'string', description: 'Tool description' },
          runtime: { type: 'string', enum: ['node', 'python'], default: 'node' }
        },
        required: ['tool_name', 'script_content', 'description']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'execute_custom_tool',
      description: 'Run previously created custom tool.',
      parameters: {
        type: 'object',
        properties: {
          tool_name: { type: 'string', description: 'Name of tool' },
          args: { type: 'object', description: 'JSON parameters' }
        },
        required: ['tool_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'request_sentinel_approval',
      description: 'Explicitly request human authorization before sensitive actions.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'Action summary' },
          risk_level: { type: 'string', enum: ['HIGH', 'CRITICAL'], default: 'HIGH' },
          details: { type: 'string', description: 'Action preview details' }
        },
        required: ['action', 'details']
      }
    }
  }
];
