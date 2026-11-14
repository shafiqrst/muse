import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { ModelRouter, SentinelGuard, MemoryStore } from '@mose/core';
import { MuseAgent } from '@mose/muse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

export class CompanionServer {
  constructor(options = {}) {
    this.workspaceRoot = options.workspaceRoot || process.cwd();
    this.port = options.port || 3500;
    this.pendingConfirms = new Map(); // confirmId -> resolve
    this.recentActivity = [];
    this.memoryStore = new MemoryStore({ workspaceRoot: this.workspaceRoot });
    this.initAgents();
  }

  initAgents() {
    this.router = new ModelRouter(process.env);
    this.sentinel = new SentinelGuard({
      workspaceRoot: this.workspaceRoot,
      confirmCallback: async (prompt) => {
        const confirmId = `conf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const request = {
          type: 'confirm_request',
          confirmId,
          action: prompt.action,
          riskLevel: prompt.riskLevel,
          reason: prompt.reason,
          params: prompt.params,
          timestamp: new Date().toISOString()
        };

        this.recordActivity({
          type: 'sentinel_interception',
          title: prompt.action,
          detail: prompt.reason,
          timestamp: request.timestamp
        });

        this.broadcast(request);

        return new Promise((resolve) => {
          this.pendingConfirms.set(confirmId, resolve);
        });
      }
    });

    this.museAgent = new MuseAgent({
      router: this.router,
      sentinel: this.sentinel,
      workspaceRoot: this.workspaceRoot,
      memoryStore: this.memoryStore,
      onStepUpdate: (event) => {
        this.recordActivity({
          type: event.type,
          title: event.name || event.type,
          detail: typeof event.result === 'string' ? event.result : JSON.stringify(event.result || event.args || {}),
          timestamp: new Date().toISOString()
        });
        this.broadcast(event);
      }
    });
  }

  recordActivity(item) {
    this.recentActivity.unshift(item);
    if (this.recentActivity.length > 50) this.recentActivity.pop();
  }

  broadcast(data) {
    if (!this.wss) return;
    const msg = JSON.stringify(data);
    for (const client of this.wss.clients) {
      if (client.readyState === 1) client.send(msg);
    }
  }

  getDashboardState() {
    const active = this.router.getActiveProviders()[0];
    return {
      type: 'init_state',
      activeModel: active ? active.name : 'Local Ollama',
      memories: this.memoryStore.getMemories(),
      goals: this.memoryStore.getGoals(),
      tasks: this.memoryStore.getTasks(),
      incompleteTasks: this.memoryStore.getIncompleteTasks(),
      conversations: this.memoryStore.getConversations(),
      persona: this.memoryStore.getPersona(),
      activity: this.recentActivity.slice(0, 20),
      approvals: Array.from(this.pendingConfirms.entries()).map(([id]) => id),
      connections: [
        { name: 'Isolated Agent Sandbox (Chrome/Edge)', status: 'Connected', icon: '🌐', detail: 'Protected agent profile (.mose/isolated_agent_profile)' },
        { name: 'Google Gemini 2.0 Flash', status: process.env.GEMINI_API_KEY ? 'Active' : 'Unconfigured', icon: '✨', detail: 'Primary reasoning model' },
        { name: 'Groq LPUs', status: process.env.GROQ_API_KEY ? 'Active' : 'Unconfigured', icon: '⚡', detail: 'Fast failover tier' },
        { name: 'OpenRouter Free Tier', status: process.env.OPENROUTER_API_KEY ? 'Active' : 'Unconfigured', icon: '🔀', detail: 'Multi-model free failover' },
        { name: 'Local Ollama', status: 'Standby', icon: '🦙', detail: 'Offline fallback engine' }
      ]
    };
  }

  async start() {
    this.server = http.createServer((req, res) => {
      const reqPath = (req.url || '/').split('?')[0];
      let filePath = path.join(PUBLIC_DIR, reqPath === '/' ? 'index.html' : reqPath);
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      const mime = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json'
      }[ext] || 'text/plain';

      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(filePath).pipe(res);
    });

    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws) => {
      // Send full state to newly connected client
      ws.send(JSON.stringify(this.getDashboardState()));

      // Check for any incomplete tasks that survived a restart and announce them
      const incomplete = this.memoryStore.getIncompleteTasks();
      if (incomplete.length > 0) {
        ws.send(JSON.stringify({
          type: 'tasks_restored',
          tasks: incomplete,
          message: `Restored ${incomplete.length} active task(s) from persistent checkpoint.`
        }));
      }

      ws.on('message', async (raw) => {
        try {
          const msg = JSON.parse(raw);
          if (msg.type === 'goal') {
            const rawText = (msg.text || '').trim();
            const isCasualGreeting = /^(hello|hi|hey|good\s+(morning|afternoon|evening)|howdy|sup|how\s+are\s+you|who\s+are\s+you|what\s+can\s+you\s+do|thanks|thank\s+you)[\s!.]*$/i.test(rawText);

            if (isCasualGreeting) {
              let responseText = "Hello! I'm Muse, your personal AI companion. How can I help you today?";
              if (/who\s+are\s+you/i.test(rawText)) {
                responseText = "I'm **Muse**, your autonomous personal companion. I can research the web, track prices and flight deals, automate browser tasks, and manage ongoing projects for you.";
              } else if (/what\s+can\s+you\s+do/i.test(rawText)) {
                responseText = "Here is what I can do for you:\n\n- 🔍 **Autonomous Web Research:** Compare products, find deals, and read websites.\n- ✈️ **Travel & Flight Tracking:** Find least-cost routes and monitor fares.\n- 🤖 **Browser Automation:** Navigate, extract data, and inspect pages live in our work surface.\n- 🛡️ **Sentinel Security:** Keep your personal actions safe with human authorization for payments and outbound communications.\n- 🎯 **Goals & Memories:** Remember your preferences across conversations.\n\nWhat would you like to explore today?";
              } else if (/how\s+are\s+you/i.test(rawText)) {
                responseText = "I'm doing great and ready to help! What are we working on today?";
              } else if (/thank/i.test(rawText)) {
                responseText = "You're very welcome! Let me know if you need anything else.";
              }

              this.broadcast({
                type: 'complete',
                taskId: null,
                result: responseText
              });
              return;
            }

            // Create durable task record for genuine multi-step goals
            const taskRecord = this.memoryStore.createTask({ title: msg.text });
            const goalRecord = this.memoryStore.saveGoal({ title: msg.text, status: 'active', progress: 15 });
            
            this.broadcast({
              type: 'goal_created',
              goal: goalRecord,
              task: taskRecord
            });

            const result = await this.museAgent.runGoal(msg.text, { taskId: taskRecord.id });
            
            this.memoryStore.updateGoal(goalRecord.id, { 
              status: result.success ? 'completed' : 'failed', 
              progress: 100 
            });

            // Note: museAgent already notifies 'complete' via onStepUpdate.
            // Do not broadcast duplicate complete here to avoid duplicate chat bubbles.
            this.broadcast({ type: 'sync_state', state: this.getDashboardState() });

          } else if (msg.type === 'resume_task') {
            const task = this.memoryStore.getTask(msg.taskId);
            if (task) {
              this.broadcast({
                type: 'task_resumed',
                taskId: task.id,
                title: task.title,
                step: task.step
              });

              const result = await this.museAgent.runGoal(task.title, {
                taskId: task.id,
                isResuming: true,
                startStep: task.step
              });

              // museAgent already notifies 'complete' via onStepUpdate
              this.broadcast({ type: 'sync_state', state: this.getDashboardState() });
            }

          } else if (msg.type === 'confirm_response') {
            const resolve = this.pendingConfirms.get(msg.confirmId);
            if (resolve) {
              resolve(msg.approved);
              this.pendingConfirms.delete(msg.confirmId);
            }
          } else if (msg.type === 'add_memory') {
            const added = this.memoryStore.addMemory(msg.memory);
            this.broadcast({ type: 'memory_added', memory: added, memories: this.memoryStore.getMemories() });
          } else if (msg.type === 'delete_memory') {
            this.memoryStore.deleteMemory(msg.id);
            this.broadcast({ type: 'memory_deleted', id: msg.id, memories: this.memoryStore.getMemories() });
          } else if (msg.type === 'create_conversation') {
            const conv = this.memoryStore.createConversation(msg);
            this.broadcast({ type: 'conversation_created', conversation: conv, conversations: this.memoryStore.getConversations() });
          } else if (msg.type === 'delete_conversation') {
            this.memoryStore.deleteConversation(msg.id);
            this.broadcast({ type: 'conversation_deleted', id: msg.id, conversations: this.memoryStore.getConversations() });
          } else if (msg.type === 'save_conversation_messages') {
            this.memoryStore.saveConversationMessages(msg.id, msg.messages);
          } else if (msg.type === 'update_persona') {
            const updated = this.memoryStore.updatePersona(msg.updates);
            this.broadcast({ type: 'persona_updated', persona: updated });
          } else if (msg.type === 'refresh_state') {
            ws.send(JSON.stringify(this.getDashboardState()));
          }
        } catch (err) {
          this.broadcast({ type: 'error', message: err.message });
        }
      });
    });

    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        resolve(this.port);
      });
    });
  }

  async stop() {
    await this.museAgent.close();
    if (this.server) this.server.close();
  }
}
