import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { ModelRouter, SentinelGuard } from '@mose/core';
import { MuseAgent } from '@mose/muse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

export class CompanionServer {
  constructor(options = {}) {
    this.workspaceRoot = options.workspaceRoot || process.cwd();
    this.port = options.port || 3500;
    this.pendingConfirms = new Map(); // confirmId -> resolve
    this.initAgents();
  }

  initAgents() {
    this.router = new ModelRouter({
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GROQ_API_KEY: process.env.GROQ_API_KEY,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
      OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL
    });

    this.sentinel = new SentinelGuard({
      workspaceRoot: this.workspaceRoot,
      confirmCallback: async (prompt) => {
        const confirmId = `conf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        this.broadcast({
          type: 'confirm_request',
          confirmId,
          action: prompt.action,
          riskLevel: prompt.riskLevel,
          reason: prompt.reason,
          params: prompt.params
        });

        return new Promise((resolve) => {
          this.pendingConfirms.set(confirmId, resolve);
        });
      }
    });

    this.museAgent = new MuseAgent({
      router: this.router,
      sentinel: this.sentinel,
      workspaceRoot: this.workspaceRoot,
      onStepUpdate: (event) => this.broadcast(event)
    });
  }

  broadcast(data) {
    if (!this.wss) return;
    const msg = JSON.stringify(data);
    for (const client of this.wss.clients) {
      if (client.readyState === 1) client.send(msg);
    }
  }

  async start() {
    this.server = http.createServer((req, res) => {
      let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
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
      const active = this.router.getActiveProviders()[0];
      ws.send(JSON.stringify({
        type: 'init',
        model: active ? active.name.split(' ')[0] + ' ' + (active.name.split(' ')[1] || '') : 'Ollama'
      }));

      ws.on('message', async (raw) => {
        try {
          const msg = JSON.parse(raw);
          if (msg.type === 'goal') {
            const result = await this.museAgent.runGoal(msg.text);
            this.broadcast({ type: 'complete', result: result.content });
          } else if (msg.type === 'confirm_response') {
            const resolve = this.pendingConfirms.get(msg.confirmId);
            if (resolve) {
              resolve(msg.approved);
              this.pendingConfirms.delete(msg.confirmId);
            }
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
