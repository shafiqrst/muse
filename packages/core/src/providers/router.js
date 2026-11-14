/**
 * Core Multi-Model Router with Automatic Cooldown & Failover
 */
export class ModelRouter {
  constructor(config = {}) {
    this.providers = this.initProviders(config);
    this.currentIndex = 0;
    this.onFailoverCallback = config.onFailover || null;
    this.cooldowns = new Map(); // provider.id -> timestamp
  }

  initProviders(config) {
    const list = [];

    // 0. Google Gemini (Free Generative AI API - Multimodal Vision & Long Context)
    if (config.GEMINI_API_KEY) {
      list.push({
        id: 'gemini-flash',
        name: 'Google Gemini 2.0 Flash (Free)',
        url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        key: config.GEMINI_API_KEY,
        model: 'gemini-2.0-flash',
        priority: 0
      });
      list.push({
        id: 'gemini-1.5-flash',
        name: 'Google Gemini 1.5 Flash (Free)',
        url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        key: config.GEMINI_API_KEY,
        model: 'gemini-1.5-flash',
        priority: 0
      });
    }

    // 1. Groq (Ultra-Fast LPUs)
    if (config.GROQ_API_KEY) {
      list.push({
        id: 'groq-qwen',
        name: 'Groq (Qwen 3.8 27B Coder)',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key: config.GROQ_API_KEY,
        model: 'qwen/qwen3.8-27b',
        priority: 1
      });
      list.push({
        id: 'groq-gpt-oss',
        name: 'Groq (OpenAI GPT-OSS 120B)',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key: config.GROQ_API_KEY,
        model: 'openai/gpt-oss-120b',
        priority: 2
      });
    }

    // 2. OpenRouter (Verified Free Models)
    if (config.OPENROUTER_API_KEY) {
      list.push({
        id: 'openrouter-nemotron',
        name: 'OpenRouter (Free Nemotron 3.5 Lightning)',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        key: config.OPENROUTER_API_KEY,
        model: 'nvidia/nemotron-3.5-lightning:free',
        priority: 3
      });
      list.push({
        id: 'openrouter-ernie',
        name: 'OpenRouter (Free Ernie 5.5 Flash)',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        key: config.OPENROUTER_API_KEY,
        model: 'baidu/ernie-5.5-flash-preview:free',
        priority: 4
      });
    }

    // 3. NVIDIA NIM (Free DeepSeek V4.1)
    if (config.NVIDIA_API_KEY) {
      list.push({
        id: 'nvidia-nim',
        name: 'NVIDIA NIM (DeepSeek V4.1 Flash)',
        url: 'https://integrate.api.nvidia.com/v1/chat/completions',
        key: config.NVIDIA_API_KEY,
        model: 'deepseek-ai/deepseek-v4.1-flash',
        priority: 5
      });
    }

    // 4. Local Ollama (100% Offline fallback)
    const ollamaUrl = config.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
    list.push({
      id: 'local-ollama',
      name: 'Local Ollama (Offline)',
      url: `${ollamaUrl.replace(/\/$/, '')}/chat/completions`,
      key: 'ollama',
      model: config.OLLAMA_MODEL || 'qwen2.5-coder:7b',
      priority: 99
    });

    return list;
  }

  getActiveProviders() {
    return this.providers;
  }

  isProviderInCooldown(provider) {
    const expire = this.cooldowns.get(provider.id);
    if (!expire) return false;
    if (Date.now() >= expire) {
      this.cooldowns.delete(provider.id);
      return false;
    }
    return true;
  }

  async chatCompletion({ messages, tools, temperature = 0.2 }) {
    if (this.providers.length === 0) {
      throw new Error('No AI providers configured.');
    }

    let attempts = 0;
    const maxAttempts = this.providers.length;
    const errors = [];

    while (attempts < maxAttempts) {
      const provider = this.providers[this.currentIndex % this.providers.length];

      if (this.isProviderInCooldown(provider) && attempts < maxAttempts - 1) {
        this.currentIndex = (this.currentIndex + 1) % this.providers.length;
        attempts++;
        continue;
      }

      try {
        const body = {
          model: provider.model,
          messages,
          temperature
        };

        if (tools && tools.length > 0) {
          body.tools = tools;
          body.tool_choice = 'auto';
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.key}`
        };

        if (provider.id.startsWith('openrouter')) {
          headers['HTTP-Referer'] = 'https://github.com/shafiqrst/muse';
          headers['X-Title'] = 'Mose AI Agent';
        }

        const response = await fetch(provider.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const status = response.status;
          const errorText = await response.text();

          if (status === 429 || status === 503 || status === 502 || status === 504) {
            const retrySeconds = 60;
            this.cooldowns.set(provider.id, Date.now() + (retrySeconds * 1000));
            errors.push(`${provider.name}: Status ${status}`);

            if (this.onFailoverCallback) {
              this.onFailoverCallback({
                previous: provider,
                reason: `Rate limit or server error (${status})`,
                next: this.providers[(this.currentIndex + 1) % this.providers.length]
              });
            }

            this.currentIndex = (this.currentIndex + 1) % this.providers.length;
            attempts++;
            continue;
          }

          throw new Error(`HTTP ${status} from ${provider.name}: ${errorText.slice(0, 300)}`);
        }

        const data = await response.json();
        const choice = data.choices && data.choices[0];
        if (!choice) throw new Error(`Empty response choices from ${provider.name}`);

        return {
          content: choice.message.content || '',
          tool_calls: choice.message.tool_calls || [],
          providerUsed: provider.name,
          modelUsed: provider.model
        };
      } catch (err) {
        errors.push(`${provider.name}: ${err.message}`);
        this.currentIndex = (this.currentIndex + 1) % this.providers.length;
        attempts++;
      }
    }

    throw new Error(`All providers failed:\n${errors.join('\n')}`);
  }
}
