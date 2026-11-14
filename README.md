# 🌟 Muse AI • Autonomous Personal Desktop Companion

> **An open-source, private alternative to Meta Muse (`muse.ai`). Built as a package-based monorepo with autonomous web browsing, dynamic self-tool creation, Sentinel security guardrails, and a sleek native desktop companion sidecar.**

Inspired by [Meta Muse](https://ai.meta.com/muse/), this system provides a dedicated personal AI companion that runs locally on your PC, operates a persistent browser to accomplish real-world tasks, and checks with you before sensitive actions.

---

## 🏗️ Package-Based Monorepo Architecture

The project is structured into three clean, decoupled packages:

```
mose-ai/
├── packages/
│   ├── core/           # @mose/core: Base agent loop, LLM router & Sentinel guardrail
│   ├── muse/           # @mose/muse: Playwright browser sandbox & self-tool creator
│   └── ui/             # @mose/ui: Meta Muse inspired desktop companion & Webview
├── package.json        # Root npm workspaces monorepo
├── .gitignore
└── README.md
```

### 1. `@mose/core`
* **Base Autonomous Loop:** Perceive-plan-act reasoning engine with function calling.
* **Multi-Model Router:** Auto-failover across **Google Gemini (2.0 / 1.5 Flash)**, **Groq**, **OpenRouter**, **NVIDIA NIM**, and **Local Ollama**.
* **The Sentinel:** Security guardrail that detects high-risk actions (purchases, payments, communications, deletions), pauses the agent, and prompts for explicit user authorization.

### 2. `@mose/muse`
* **Persistent Browser Sandbox:** Headless/headed automation using native **Microsoft Edge** or **Google Chrome** (via `playwright-core`). Retains user sessions, logins, and cookies securely on your machine.
* **Self-Tool Creator:** Automatically writes, verifies, and runs custom Node.js/Python tools when an existing tool or API does not exist.
* **Web Skills:** Real-time web search, price comparison, flight/hotel research, article summarization, and form filling.

### 3. `@mose/ui`
* **Desktop Companion Sidecar:** Opens as a sleek native app docked to the side of your desktop (`width: 440px`), letting you work unobstructed without a full browser window.
* **Fluid Ambient Orb:** Pulsating ambient visualizer reflecting agent thinking and activity.
* **Live Browser Mirror:** Shows real-time web navigation states and page summaries.
* **Sentinel Cards:** Interactive popup cards with **Approve / Reject** buttons for sensitive tasks.
* **Dual Agent Switcher:** Switch between **Muse Personal Companion** and **Coder Studio** in one click.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
git clone https://github.com/shafiqrst/muse.git
cd muse
npm install
```

### 2. Configure Free API Keys
Copy `.env.example` to `.env`:
```bash
copy .env.example .env
```
Paste your free API keys:
* **Google Gemini (Recommended)**: [aistudio.google.com](https://aistudio.google.com)
* **Groq**: [console.groq.com/keys](https://console.groq.com/keys)
* **OpenRouter**: [openrouter.ai/keys](https://openrouter.ai/keys)
* **NVIDIA NIM**: [build.nvidia.com](https://build.nvidia.com)

### 3. Launch Muse Companion
```bash
npm start
```
* Or directly launch the desktop sidecar:
```bash
npm run companion
```
The native companion window will appear docked neatly on the right side of your desktop!

---

## 🛡️ Privacy & Safety
* **100% Local Control:** Runs on your machine, not on Meta's cloud servers.
* **Zero Data Scraping:** No conversation data is logged or used to train corporate models.
* **Sentinel Gate:** Your money and accounts are protected by mandatory human sign-off.

---

## 📄 License
MIT License.
