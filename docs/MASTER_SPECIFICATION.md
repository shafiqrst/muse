# MUSE — MASTER UI/UX REDESIGN & ENGINEERING IMPROVEMENT SPECIFICATION

**Document Type:** Master Product Requirements, UI/UX Redesign, Architecture Improvement & Implementation Specification  
**Project:** Muse – Autonomous Personal AI Companion  
**Version:** 1.0  
**Date:** November 14, 2026  
**Status:** Approved Reference Specification  
**Primary Objective:** Transform Muse into a polished, reliable, secure, and genuinely useful autonomous personal AI companion.

---

# 1. PROJECT OVERVIEW

## 1.1 Product Vision
Muse is an autonomous personal AI companion designed to help users manage everyday activities, research information, interact with websites, automate repetitive tasks, manage personal goals, and execute multi-step operations.

Muse should feel like a personal digital companion rather than a conventional chatbot or administrative dashboard.

The product combines:
- Natural conversational interaction.
- Persistent personal memory.
- Autonomous task execution.
- Browser automation.
- Background task management.
- Goal-oriented assistance.
- External application integrations.
- Voice interaction.
- Human-in-the-loop authorization.
- Strong security and privacy controls.

*Important:* Muse is an independent open-source project. Do not represent it as an official Meta product or use proprietary assets.

## 1.2 Repository Separation
| Project | Purpose | Local Directory | GitHub |
| :--- | :--- | :--- | :--- |
| **Muse** | Autonomous personal AI companion | `D:\Mose-ai` | `https://github.com/shafiqrst/muse` |
| **OpenCode Chat** | Autonomous coding agent | `D:\opencode-vedio-etc` | `https://github.com/shafiqrst/opencode-chat` |

**Mandatory Separation Rules:**
1. Never merge the repositories.
2. Never combine their user interfaces.
3. Never combine their execution environments.
4. Never share credentials or browser profiles.
5. Maintain independent test suites and release tags.

---

# 2. APPLICATION FORM FACTOR & UX PRINCIPLES

## 2.1 Form Factor
- **Platform:** Windows 11 desktop companion.
- **Compact Companion Mode:** Docked to right edge, default width `440px`.
- **Expanded Workspace Mode:** Smooth 1-click expansion to `860px` dual-pane layout when inspecting live browser sessions or research reports.

## 2.2 Design Philosophy: Conversation-First
- Chat must remain the dominant living stage.
- Secondary management views (*Goals, Activity, Approvals, Apps, Memory, Settings*) are accessed via a slide-out navigation drawer `[☰]`.
- Subtle living mini-avatar (34px) in header with mouse gaze eye-tracking and natural blinking.
- Human-readable cards for task progress and Sentinel approvals (no raw JSON displays).

---

# 3. TECHNICAL SPECIFICATIONS & ENGINE REQUIREMENTS

## 3.1 Package Monorepo Architecture
```
packages/
├── core/       # @mose/core: Base agent, ModelRouter, SentinelGuard, MemoryStore
├── muse/       # @mose/muse: BrowserSandbox, ToolCreator, skills
└── ui/         # @mose/ui: Companion server, launcher, HTML/CSS/JS frontend
```

## 3.2 Security & Sandbox Isolation
1. **Isolated Browser Sandbox:** Uses `.mose/isolated_agent_profile/` completely decoupled from host browser sessions to eliminate cookie hijack and prompt injection vulnerabilities.
2. **Sentinel Human-in-the-Loop:** Policy-enforced interception of external payments, sensitive communications, and destructive operations with immutable append-only audit trail in `.mose/audit_trail.jsonl`.
3. **Hardened ToolCreator:** Static pattern scanning blocking destructive scripts (`rm -rf`, disk wipes, credential harvesting) and scrubbing environment variables during subprocess execution.
4. **Durable Task State Machine:** Task states (`queued`, `planning`, `running`, `waiting_approval`, `completed`, `failed`) persisted across restarts.

## 3.3 Free Multi-Model Router
- Priority 0: Google Gemini 2.0 Flash
- Priority 1: Groq LPUs
- Priority 2: OpenRouter Free Models
- Priority 3: Local Ollama (Offline)

---

# 4. COMPLIANCE CHECKLIST FOR CODING AGENTS

Before modifying code:
1. Inspect the existing repository.
2. Run `npm test` and verify 100% pass.
3. Follow Clean Architecture and TDD.
4. Do not rewrite from scratch; improve incrementally.
5. Never expose credentials or bypass Sentinel guardrails.
