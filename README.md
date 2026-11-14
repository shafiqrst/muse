# 🌟 Muse AI • Autonomous Personal Desktop Companion

> **An open-source, private alternative to Meta Muse (`muse.ai`). Built as a package-based monorepo with autonomous web browsing, dynamic self-tool creation, Sentinel security guardrails, living avatar persona, and an expandable desktop floating companion chatbox.**

Inspired by [Meta Muse](https://ai.meta.com/muse/) and the [Meta Muse UI/UX Specification](https://chatgpt.com/share/6af7e552-ce0c-83ee-9afe-eaf8011062cb), this system provides a dedicated personal AI companion that runs locally on your PC, operates an isolated browser to accomplish real-world tasks, and checks with you before sensitive actions.

---

## 🎨 UI/UX Design System: Conversation-First & Expandable Workspace

Following extensive product review, the interface has been redesigned to be a true **conversational companion** rather than an admin dashboard:

1. **Conversation-First Living Canvas:**  
   The primary screen is conversational chat. Secondary management screens (*Goals, Activity, Approvals, Apps, Memory, Settings*) are accessed cleanly via a slide-out navigation drawer `[☰]`, keeping your screen uncluttered.
2. **1-Click Expandable Workspace (`440px` ⟷ `860px`):**  
   Click `[ ⤢ ]` in the header anytime to expand the companion from a compact sidecar (`440px`) into a split dual-pane workspace (`860px`), providing ample room for live browser inspection and research reports.
3. **Subtle Living Mini-Avatar (34px):**  
   A refined mini-avatar in the header with mathematical cursor eye-tracking, natural blinking, SVG lip-sync mouth morphing, and Web Speech API TTS voice responses.
4. **Inline Human-Readable Task & Sentinel Cards:**  
   - **Task Banner:** Real-time step tracker and progress bar during active web exploration.
   - **Sentinel Authorization Card:** High-visibility approval prompt with formatted action details, recipient/target metadata, and **Approve / Reject** buttons (no raw JSON dumps).
   - **Live Browser Sheet:** Inline collapsible sheet showing live web navigation URLs, page titles, and DOM summaries.

---

## 🏗️ Package-Based Monorepo Architecture

The project is structured into three clean, decoupled packages:

```
muse/
├── packages/
│   ├── core/           # @mose/core: Base agent loop, LLM router, Sentinel guard & MemoryStore
│   ├── muse/           # @mose/muse: Playwright isolated sandbox & hardened self-tool creator
│   └── ui/             # @mose/ui: Expandable companion sidecar, slide-out drawer, server & avatar
├── tests/
│   └── runner.js       # Unified monorepo test suite (4 passing tests)
├── .mose/              # Local memory, goals, isolated browser profile & audit logs
├── package.json        # Root npm workspaces monorepo
├── .gitignore
└── README.md
```

### 1. `@mose/core`
* **Base Autonomous Loop:** Perceive-plan-act reasoning engine with function calling.
* **Multi-Model Router:** Auto-failover across **Google Gemini (2.0 / 1.5 Flash)** (Priority 0), **Groq**, **OpenRouter**, **NVIDIA NIM**, and **Local Ollama**.
* **The Sentinel:** Security guardrail that classifies action risk (Low / Medium / High), halts execution on sensitive operations, and logs an immutable audit trail to `.mose/audit_trail.jsonl`.
* **MemoryStore:** Manages persistent memory entries and a durable task state machine (`queued` → `planning` → `running` → `waiting_approval` → `completed`).

### 2. `@mose/muse`
* **Isolated Browser Sandbox:** Headless or headed automation using native **Microsoft Edge** or **Google Chrome** (via `playwright-core`). Operates inside `.mose/isolated_agent_profile/` to ensure your personal browsing cookies and logins are strictly protected from external web injection.
* **Hardened Self-Tool Creator:** Automatically writes, verifies, and executes custom Node.js/Python tools with static safety inspection (preventing dangerous commands or secret exfiltration).
* **Web Skills:** Real-time web search, price comparison, flight/hotel research, article summarization, and form filling.

### 3. `@mose/ui`
* **Desktop Companion Sidecar:** Opens as a sleek native app docked to the side of your desktop (`width: 440px`), expanding to `860px` on demand.
* **Slide-out Navigation Drawer:** Clean access to all 7 functional areas without crowding the main window.
* **Living Mini Avatar Persona:** Real-time pupil tracking following mouse coordinates, natural blinking intervals, SVG lip-sync mouth morphing, and Web Speech API TTS.

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
The native companion window will appear docked neatly on the right side of your desktop.

---

## 🛡️ Privacy & Safety
* **100% Local Control:** Runs on your machine, not on Meta's cloud servers.
* **Isolated Browser Profile:** Uses a dedicated sandbox profile preventing access to your personal browser cookies.
* **Zero Data Scraping:** No conversation data is logged or used to train corporate models.
* **Sentinel Gate:** Your money, credentials, and accounts are protected by mandatory human sign-off before external requests leave the sandbox.

---

## 📄 License
MIT License.
