# 🌟 Muse AI • Autonomous Personal Desktop Companion

> **An open-source, private alternative to Meta Muse (`muse.ai`). Built as a package-based monorepo with autonomous web browsing, dynamic self-tool creation, Sentinel security guardrails, living avatar persona, and a native desktop floating sidecar chatbox.**

Inspired by [Meta Muse](https://ai.meta.com/muse/) and the [Meta Muse UI/UX Specification](https://chatgpt.com/share/6af7e552-ce0c-83ee-9afe-eaf8011062cb), this system provides a dedicated personal AI companion that runs locally on your PC, operates a persistent browser to accomplish real-world tasks, and checks with you before sensitive actions.

---

## 🎨 7 Core Functional Areas (Meta Muse UI/UX Spec)

Muse implements the 7 core functional views as defined in the Meta Muse architecture:

| View | Purpose & Capabilities |
| :--- | :--- |
| **💬 1. Chat & Home** | Lightweight desktop floating chatbox (`440x940px`) docked to the right edge. Features a **Living Mini-Avatar** in the header with cursor eye-tracking, natural blinking, SVG lip-sync mouth morphing, voice TTS & speech mic dictation, and an inline collapsible **Live Browser Preview Sheet**. |
| **🎯 2. Tasks & Goals** | Manages autonomous, long-running goals that Muse executes in the background. Tracks live progress percentages (`0%` to `100%`) and status badges (`active`, `completed`). |
| **⚡ 3. Activity Feed** | Full audit visibility into what Muse is browsing and executing in real-time (browser navigation, DOM extraction, dynamic tool synthesis, thinking cycles, and Sentinel events). |
| **🛡️ 4. Sentinel Approvals** | Security guardrail that halts sensitive actions (payments, outbound emails, file operations, purchases) and displays authorization cards with **Approve / Reject** buttons and a dynamic tab notification badge. |
| **🔌 5. Connections (Apps)** | Monitors active integrations and connected services, including the **Persistent Browser Sandbox** (Edge/Chrome) and multi-model failover engines. |
| **🧠 6. Personal Memory** | Long-term memory store (`.mose/memory.json`) persisting user preferences (travel habits, dietary rules, UI settings) across sessions with full CRUD (+Add / Delete) operations. |
| **⚙️ 7. Settings & Controls** | Configure primary AI reasoning model (Gemini 2.0 Flash, Groq, OpenRouter, Ollama), Sentinel security strictness, and cookie retention. |

---

## 🏗️ Package-Based Monorepo Architecture

The project is structured into three clean, decoupled packages:

```
muse/
├── packages/
│   ├── core/           # @mose/core: Base agent loop, LLM router, Sentinel guard & MemoryStore
│   ├── muse/           # @mose/muse: Playwright browser sandbox & self-tool creator
│   └── ui/             # @mose/ui: 7-tab desktop companion chatbox, server & avatar
├── tests/
│   └── runner.js       # Unified monorepo test suite (4 passing tests)
├── .mose/              # Local memory, goals, browser cookies & audit logs
├── package.json        # Root npm workspaces monorepo
├── .gitignore
└── README.md
```

### 1. `@mose/core`
* **Base Autonomous Loop:** Perceive-plan-act reasoning engine with function calling.
* **Multi-Model Router:** Auto-failover across **Google Gemini (2.0 / 1.5 Flash)** (Priority 0), **Groq**, **OpenRouter**, **NVIDIA NIM**, and **Local Ollama**.
* **The Sentinel:** Security guardrail that classifies action risk (Low / Medium / High), halts execution on sensitive operations, and logs an immutable audit trail to `.mose/audit_trail.jsonl`.
* **MemoryStore:** Manages persistent memory entries and background goal states in `.mose/memory.json` and `.mose/goals.json`.

### 2. `@mose/muse`
* **Persistent Browser Sandbox:** Headless or headed automation using native **Microsoft Edge** or **Google Chrome** (via `playwright-core` with zero heavy binary downloads). Retains user sessions, logins, and cookies securely on your machine.
* **Self-Tool Creator:** Automatically writes, verifies, and executes custom Node.js/Python tools when an existing tool or API does not exist.
* **Web Skills:** Real-time web search, price comparison, flight/hotel research, article summarization, and form filling.

### 3. `@mose/ui`
* **Desktop Companion Sidecar:** Opens as a sleek native app docked to the side of your desktop (`width: 440px`), letting you work unobstructed without taking over your main browser.
* **Living Mini Avatar Persona:** Real-time pupil tracking following mouse coordinates, natural blinking intervals, SVG lip-sync mouth morphing, and Web Speech API TTS.
* **7 Core Navigation Views:** Instant switching across Chat, Goals, Activity, Approvals, Connections, Memory, and Settings.
* **Live Browser Mirror:** Shows real-time web navigation states and page summaries in an embedded preview sheet.

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

*(If no keys are provided, Muse will automatically route to local **Ollama** if available)*

### 3. Run Test Suite
```bash
npm test
```
Verifies model routing, Sentinel classification, MemoryStore persistence, dynamic tool creation, and browser sandbox launch.

### 4. Launch Muse Companion
```bash
npm start
```
* Or launch the native desktop floating sidecar directly:
```bash
npm run companion
```
The native companion window will appear docked neatly on the right side of your desktop (`440x940px`).

---

## 🛡️ Privacy & Safety
* **100% Local Control:** Runs on your machine, not on Meta's cloud servers.
* **Zero Data Scraping:** No conversation data is logged or used to train corporate models.
* **Sentinel Gate:** Your money, credentials, and accounts are protected by mandatory human sign-off before external requests leave the sandbox.

---

## 📄 License
MIT License.
