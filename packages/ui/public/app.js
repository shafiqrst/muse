// Muse AI - Personal Conversational Companion Client (Meta Muse-Inspired v2.0)

let socket = null;
let pendingConfirmId = null;
let voiceEnabled = true;
let isSpeaking = false;
let mouthAnimationInterval = null;
let userInControl = false;
let isTaskPaused = false;
let currentActiveTaskId = null;
let milestoneCount = 0;

// Application State
let state = {
  activeModel: 'Gemini Flash',
  conversations: [
    { id: 'conv_main', title: 'Main Muse Conversation', type: 'main', messages: [] }
  ],
  currentConversationId: 'conv_main',
  persona: { name: 'Muse', tone: 'friendly', voice: 'natural', proactivity: 'high' },
  memories: [],
  goals: [],
  tasks: [],
  activity: [],
  connections: []
};

const pendingApprovals = new Map();

// DOM Elements
const appShell = document.getElementById('app-shell');
const avatarWrapper = document.getElementById('avatar-head-wrapper');
const avatarSvg = document.getElementById('avatar-svg');
const pupilLeft = document.getElementById('pupil-left');
const pupilRight = document.getElementById('pupil-right');
const eyelidLeft = document.getElementById('eyelid-left');
const eyelidRight = document.getElementById('eyelid-right');
const avatarMouth = document.getElementById('avatar-mouth');
const agentStatus = document.getElementById('agent-status');
const agentStatusPill = document.getElementById('agent-status-pill');
const personaNameDisplay = document.getElementById('persona-name-display');
const avatarIdentityTrigger = document.getElementById('avatar-identity-trigger');
const approvalBadge = document.getElementById('approval-badge');

const btnToggleDrawer = document.getElementById('btn-toggle-drawer');
const btnCloseDrawer = document.getElementById('btn-close-drawer');
const sideDrawer = document.getElementById('side-drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const conversationsListEl = document.getElementById('conversations-list');
const btnDrawerNewConv = document.getElementById('btn-drawer-new-conv');
const btnNewConversation = document.getElementById('btn-new-conversation');
const btnVoiceToggle = document.getElementById('btn-voice-toggle');
const btnToggleWorkspace = document.getElementById('btn-toggle-workspace');
const headerActiveTaskPill = document.getElementById('header-active-task-pill');
const headerTaskTitle = document.getElementById('header-task-title');

// Conversation Canvas & Composer
const timeline = document.getElementById('timeline');
const streamList = document.getElementById('stream');
const welcomeCard = document.getElementById('welcome-card');
const welcomeGreeting = document.getElementById('welcome-greeting');
const welcomeResumeSection = document.getElementById('welcome-resume-section');
const welcomeResumeList = document.getElementById('welcome-resume-list');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const btnMic = document.getElementById('btn-mic');

// Contextual Work Surface Drawer
const contextualWorkspace = document.getElementById('contextual-workspace');
const workspaceDrawerTitle = document.getElementById('workspace-drawer-title');
const btnCloseWorkspace = document.getElementById('btn-close-workspace');
const btnTakeControl = document.getElementById('btn-take-control');
const deckUrlBar = document.getElementById('deck-url-bar');
const deckBrowserUrl = document.getElementById('deck-browser-url');
const deckBrowserTitle = document.getElementById('deck-browser-title');
const deckBrowserContent = document.getElementById('deck-browser-content');
const deckMilestonesList = document.getElementById('deck-milestones-list');

// Modal Dialog
const viewsModalOverlay = document.getElementById('views-modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');
const btnCloseModal = document.getElementById('btn-close-modal');

// ==========================================
// 1. Navigation, Drawer & Conversations
// ==========================================
function toggleDrawer(open) {
  const shouldOpen = open !== undefined ? open : !sideDrawer.classList.contains('open');
  sideDrawer.classList.toggle('open', shouldOpen);
  drawerOverlay.classList.toggle('open', shouldOpen);
}

btnToggleDrawer?.addEventListener('click', () => toggleDrawer(true));
btnCloseDrawer?.addEventListener('click', () => toggleDrawer(false));
drawerOverlay?.addEventListener('click', () => toggleDrawer(false));

btnNewConversation?.addEventListener('click', () => handleNewConversation());
btnDrawerNewConv?.addEventListener('click', () => handleNewConversation());

function handleNewConversation() {
  const title = prompt('Name your project thread (or leave empty for a new chat):');
  if (title === null) return;
  const newTitle = title.trim() || `Project Chat ${state.conversations.length + 1}`;
  
  socket?.send(JSON.stringify({
    type: 'create_conversation',
    title: newTitle,
    type: 'project'
  }));

  const localConv = {
    id: `conv_${Date.now()}`,
    title: newTitle,
    type: 'project',
    messages: []
  };
  state.conversations.unshift(localConv);
  switchConversation(localConv.id);
  toggleDrawer(false);
}

function renderConversationsList() {
  if (!conversationsListEl) return;
  const list = state.conversations || [];
  conversationsListEl.innerHTML = list.map(c => {
    const isActive = c.id === state.currentConversationId;
    const isMain = c.id === 'conv_main';
    const icon = isMain ? '💬' : '📁';
    return `
      <div class="conv-item ${isActive ? 'active' : ''}" onclick="switchConversation('${c.id}')">
        <span style="font-size: 13px; margin-right: 6px;">${icon}</span>
        <span class="conv-title">${escapeHtml(c.title)}</span>
        ${!isMain ? `<button class="conv-del-btn" onclick="event.stopPropagation(); deleteConversation('${c.id}')" title="Delete thread">✕</button>` : ''}
      </div>
    `;
  }).join('');
}

window.switchConversation = function(convId) {
  state.currentConversationId = convId;
  renderConversationsList();
  toggleDrawer(false);

  const activeConv = (state.conversations || []).find(c => c.id === convId);
  if (personaNameDisplay) {
    personaNameDisplay.textContent = activeConv?.id === 'conv_main' ? (state.persona?.name || 'Muse') : activeConv?.title || 'Project';
  }

  // Clear current timeline and re-render conversation messages
  streamList.innerHTML = '';
  const messages = activeConv?.messages || [];
  if (messages.length === 0) {
    if (welcomeCard) welcomeCard.style.display = 'flex';
  } else {
    if (welcomeCard) welcomeCard.style.display = 'none';
    messages.forEach(m => {
      appendMessage(m.role, m.content, { skipSave: true });
    });
  }
};

window.deleteConversation = function(convId) {
  if (confirm('Delete this project conversation?')) {
    socket?.send(JSON.stringify({ type: 'delete_conversation', id: convId }));
    state.conversations = state.conversations.filter(c => c.id !== convId);
    if (state.currentConversationId === convId) {
      window.switchConversation('conv_main');
    } else {
      renderConversationsList();
    }
  }
};

// Drawer Sub-View Modals
document.querySelectorAll('.drawer-item').forEach(item => {
  item.addEventListener('click', () => {
    const view = item.dataset.view;
    toggleDrawer(false);
    if (view === 'goals') openModal('🎯 Tasks & Durable Goals', renderGoalsHtml());
    else if (view === 'activity') openModal('⚡ Activity & Audit Trail', renderActivityHtml());
    else if (view === 'approvals') openModal('🛡️ Sentinel Approvals', renderApprovalsHtml());
    else if (view === 'memory') openModal('🧠 Personal Memory & Preferences', renderMemoryHtml());
    else if (view === 'persona') openModal('✨ Personalize Muse', renderPersonaHtml());
    else if (view === 'connections') openModal('🔌 Connected Models & Sandboxes', renderConnectionsHtml());
  });
});

avatarIdentityTrigger?.addEventListener('click', () => {
  openModal('✨ Personalize Muse', renderPersonaHtml());
});

// Modal Helpers
function openModal(titleText, html) {
  if (!viewsModalOverlay) return;
  modalTitle.textContent = titleText;
  modalContent.innerHTML = html;
  viewsModalOverlay.style.display = 'flex';
}

function closeModal() {
  if (viewsModalOverlay) viewsModalOverlay.style.display = 'none';
}

btnCloseModal?.addEventListener('click', closeModal);
viewsModalOverlay?.addEventListener('click', (e) => {
  if (e.target === viewsModalOverlay) closeModal();
});

// ==========================================
// 2. Contextual Work Surface Drawer
// ==========================================
function openContextualWorkspace() {
  if (!contextualWorkspace) return;
  contextualWorkspace.style.display = 'flex';
  if (btnToggleWorkspace) btnToggleWorkspace.style.display = 'flex';
}

function closeContextualWorkspace() {
  if (!contextualWorkspace) return;
  contextualWorkspace.style.display = 'none';
}

btnToggleWorkspace?.addEventListener('click', () => {
  if (contextualWorkspace.style.display === 'none') openContextualWorkspace();
  else closeContextualWorkspace();
});

btnCloseWorkspace?.addEventListener('click', closeContextualWorkspace);
headerActiveTaskPill?.addEventListener('click', openContextualWorkspace);

// Live Takeover Intervention
btnTakeControl?.addEventListener('click', () => {
  userInControl = !userInControl;
  btnTakeControl.textContent = userInControl ? '🤖 Return to Muse' : '✋ Take Control';
  btnTakeControl.classList.toggle('active', userInControl);
  if (deckBrowserTitle) {
    deckBrowserTitle.textContent = userInControl ? 'Manual Control Active' : 'Agent Sandbox Active';
  }
});

function updateBrowserDeck(url, title, content) {
  if (url && url !== 'about:blank') {
    if (deckBrowserUrl) deckBrowserUrl.textContent = url;
    if (deckUrlBar) deckUrlBar.style.display = 'flex';
  }
  if (title && deckBrowserTitle) deckBrowserTitle.textContent = title;
  if (content && deckBrowserContent) deckBrowserContent.textContent = content;
}

function addBrowserMilestone(title, detail, status = 'done') {
  if (!deckMilestonesList) return;
  const empty = deckMilestonesList.querySelector('.empty-state');
  if (empty) empty.remove();

  milestoneCount++;
  const item = document.createElement('div');
  item.className = 'timeline-milestone';

  let icon = '🌐';
  if (title.toLowerCase().includes('search')) icon = '🔍';
  else if (title.toLowerCase().includes('dom') || title.toLowerCase().includes('extract')) icon = '📄';
  else if (title.toLowerCase().includes('security') || title.toLowerCase().includes('approval')) icon = '🛡️';
  else if (title.toLowerCase().includes('complete')) icon = '✅';

  const timeStr = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });

  item.innerHTML = `
    <div class="milestone-left">
      <span style="font-size:14px;">${icon}</span>
      <div>
        <div class="milestone-title">${escapeHtml(title)}</div>
        <div class="milestone-detail">${escapeHtml(detail)} <span style="font-size:10px; color:#64748b; margin-left:4px;">${timeStr}</span></div>
      </div>
    </div>
    <span class="milestone-badge ${status}">${status}</span>
  `;
  deckMilestonesList.insertBefore(item, deckMilestonesList.firstChild);
}

// ==========================================
// 3. Living Avatar, Gaze & Lip-Sync
// ==========================================
const BASE_PUPIL_LEFT = { x: 36, y: 44 };
const BASE_PUPIL_RIGHT = { x: 64, y: 44 };
const MAX_OFFSET = 3.5;

window.addEventListener('mousemove', (e) => {
  if (!avatarWrapper || avatarWrapper.classList.contains('thinking')) return;

  const rect = avatarSvg.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const dx = e.clientX - centerX;
  const dy = e.clientY - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  const offX = (dx / dist) * Math.min(MAX_OFFSET, Math.abs(dx) / 25);
  const offY = (dy / dist) * Math.min(MAX_OFFSET, Math.abs(dy) / 25);

  pupilLeft.setAttribute('cx', BASE_PUPIL_LEFT.x + offX);
  pupilLeft.setAttribute('cy', BASE_PUPIL_LEFT.y + offY);
  pupilRight.setAttribute('cx', BASE_PUPIL_RIGHT.x + offX);
  pupilRight.setAttribute('cy', BASE_PUPIL_RIGHT.y + offY);
});

function blink() {
  if (!eyelidLeft || !eyelidRight) return;
  eyelidLeft.setAttribute('d', 'M 28 36 Q 36 52 44 36 L 44 52 Q 36 52 28 52 Z');
  eyelidRight.setAttribute('d', 'M 56 36 Q 64 52 72 36 L 72 52 Q 64 52 56 52 Z');

  setTimeout(() => {
    eyelidLeft.setAttribute('d', 'M 28 36 Q 36 36 44 36 L 44 36 Q 36 36 28 36 Z');
    eyelidRight.setAttribute('d', 'M 56 36 Q 64 36 72 36 L 72 36 Q 64 36 56 36 Z');
  }, 150);

  setTimeout(blink, Math.random() * 4000 + 2500);
}
setTimeout(blink, 2000);

function setAvatarState(stateKey) {
  if (!avatarWrapper) return;
  avatarWrapper.classList.remove('thinking', 'speaking', 'sentinel');

  switch (stateKey) {
    case 'thinking':
    case 'working':
      avatarWrapper.classList.add('thinking');
      agentStatusPill.textContent = 'Thinking';
      agentStatusPill.style.color = '#c084fc';
      agentStatusPill.style.borderColor = 'rgba(192, 132, 252, 0.4)';
      pupilLeft.setAttribute('cy', BASE_PUPIL_LEFT.y - 2);
      pupilRight.setAttribute('cy', BASE_PUPIL_RIGHT.y - 2);
      avatarMouth.setAttribute('d', 'M 42 68 Q 50 68 58 68');
      break;

    case 'speaking':
      avatarWrapper.classList.add('speaking');
      agentStatusPill.textContent = 'Speaking';
      agentStatusPill.style.color = '#65C8E8';
      agentStatusPill.style.borderColor = 'rgba(101, 200, 232, 0.4)';
      startMouthMorph();
      break;

    case 'sentinel':
      avatarWrapper.classList.add('sentinel');
      agentStatusPill.textContent = 'Review Required';
      agentStatusPill.style.color = '#F2B84B';
      agentStatusPill.style.borderColor = 'rgba(242, 184, 75, 0.4)';
      stopMouthMorph();
      break;

    case 'idle':
    default:
      agentStatusPill.textContent = 'Ready';
      agentStatusPill.style.color = '#32C98B';
      agentStatusPill.style.borderColor = 'rgba(50, 201, 139, 0.3)';
      pupilLeft.setAttribute('cy', BASE_PUPIL_LEFT.y);
      pupilRight.setAttribute('cy', BASE_PUPIL_RIGHT.y);
      stopMouthMorph();
      avatarMouth.setAttribute('d', 'M 40 68 Q 50 75 60 68');
      break;
  }
}

const MOUTH_SHAPES = [
  'M 42 66 Q 50 76 58 66',
  'M 44 64 Q 50 78 56 64',
  'M 41 67 Q 50 71 59 67',
  'M 40 68 Q 50 75 60 68'
];

function startMouthMorph() {
  if (mouthAnimationInterval) return;
  let idx = 0;
  mouthAnimationInterval = setInterval(() => {
    avatarMouth.setAttribute('d', MOUTH_SHAPES[idx % MOUTH_SHAPES.length]);
    idx++;
  }, 140);
}

function stopMouthMorph() {
  if (mouthAnimationInterval) {
    clearInterval(mouthAnimationInterval);
    mouthAnimationInterval = null;
    avatarMouth.setAttribute('d', 'M 40 68 Q 50 75 60 68');
  }
}

function speakText(text) {
  if (!voiceEnabled || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/[*#`_~\[\]]/g, '').slice(0, 300);
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;
  utterance.onstart = () => { isSpeaking = true; setAvatarState('speaking'); };
  utterance.onend = utterance.onerror = () => { isSpeaking = false; setAvatarState('idle'); };
  window.speechSynthesis.speak(utterance);
}

btnVoiceToggle?.addEventListener('click', () => {
  voiceEnabled = !voiceEnabled;
  btnVoiceToggle.classList.toggle('active', voiceEnabled);
  if (!voiceEnabled && isSpeaking) {
    window.speechSynthesis.cancel();
    setAvatarState('idle');
  }
});

// Voice Dictation (Speech Recognition)
let recognition = null;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    btnMic.classList.add('listening');
    agentStatus.textContent = 'Listening to voice...';
  };

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    userInput.value = transcript;
    btnMic.classList.remove('listening');
    chatForm.dispatchEvent(new Event('submit'));
  };

  recognition.onerror = recognition.onend = () => {
    btnMic.classList.remove('listening');
    agentStatus.textContent = 'Your personal companion';
  };

  btnMic?.addEventListener('click', () => {
    if (btnMic.classList.contains('listening')) recognition.stop();
    else recognition.start();
  });
} else if (btnMic) {
  btnMic.style.display = 'none';
}

function updateGreeting() {
  const hour = new Date().getHours();
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  else if (hour >= 17 || hour < 4) greeting = 'Good evening';
  if (welcomeGreeting) welcomeGreeting.textContent = greeting;
}

// ==========================================
// 4. Inline Tasks & Conversational Stream
// ==========================================
if (window.marked) {
  try {
    marked.setOptions({ gfm: true, breaks: true });
  } catch (e) {}
}

function formatMarkdown(content) {
  if (window.marked) {
    try {
      return marked.parse(content);
    } catch (e) {}
  }
  return escapeHtml(content).replace(/\n/g, '<br>');
}

function appendMessage(role, content, options = {}) {
  if (welcomeCard) welcomeCard.style.display = 'none';

  // Save to active conversation state unless restoring
  if (!options.skipSave) {
    const activeConv = state.conversations.find(c => c.id === state.currentConversationId);
    if (activeConv) {
      if (!activeConv.messages) activeConv.messages = [];
      activeConv.messages.push({ role, content, timestamp: new Date().toISOString() });
      socket?.send(JSON.stringify({
        type: 'save_conversation_messages',
        id: activeConv.id,
        messages: activeConv.messages
      }));
    }
  }

  const row = document.createElement('div');
  row.className = `msg-row ${role}`;

  const icon = document.createElement('div');
  icon.className = 'msg-avatar-icon';
  icon.textContent = role === 'assistant' ? '✨' : '👤';

  const bubbleWrapper = document.createElement('div');
  bubbleWrapper.className = 'msg-bubble-wrapper';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  if (role === 'assistant') {
    bubble.innerHTML = formatMarkdown(content);

    // Code blocks with header and 1-click copy
    bubble.querySelectorAll('pre code').forEach((codeBlock) => {
      const pre = codeBlock.parentElement;
      const langClass = Array.from(codeBlock.classList).find(c => c.startsWith('language-'));
      const lang = langClass ? langClass.replace('language-', '') : 'code';

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';

      const header = document.createElement('div');
      header.className = 'code-header';
      header.innerHTML = `
        <span class="code-lang">${lang}</span>
        <button class="code-copy-btn" title="Copy snippet">📋 Copy</button>
      `;

      const copyBtn = header.querySelector('.code-copy-btn');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(codeBlock.innerText);
        copyBtn.textContent = '✓ Copied';
        setTimeout(() => copyBtn.textContent = '📋 Copy', 2000);
      });

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);

      if (window.hljs) {
        try { hljs.highlightElement(codeBlock); } catch {}
      }
    });

    // Assistant Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'msg-toolbar';
    toolbar.innerHTML = `
      <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      <button class="msg-action-btn btn-copy" title="Copy response">📋</button>
      <button class="msg-action-btn btn-speak" title="Read aloud">🔊</button>
    `;

    toolbar.querySelector('.btn-copy').addEventListener('click', (e) => {
      navigator.clipboard.writeText(content);
      e.currentTarget.textContent = '✓';
      setTimeout(() => e.currentTarget.textContent = '📋', 1500);
    });

    toolbar.querySelector('.btn-speak').addEventListener('click', () => {
      speakText(content);
    });

    bubbleWrapper.appendChild(bubble);
    bubbleWrapper.appendChild(toolbar);
  } else {
    bubble.textContent = content;
    bubbleWrapper.appendChild(bubble);
  }

  row.appendChild(icon);
  row.appendChild(bubbleWrapper);
  streamList.appendChild(row);

  timeline.scrollTop = timeline.scrollHeight;
}

// Inline Task Card Generator
function createInlineTaskCard(taskId, title, status = 'Planning', progress = 15, stepDesc = 'Initializing task') {
  currentActiveTaskId = taskId;
  const existing = document.getElementById(`inline-task-${taskId}`);
  if (existing) return existing;

  const card = document.createElement('div');
  card.className = 'inline-task-card';
  card.id = `inline-task-${taskId}`;
  card.innerHTML = `
    <div class="task-card-header">
      <div class="task-card-left">
        <span class="pulse-dot purple"></span>
        <div>
          <span class="task-card-eyebrow">AUTONOMOUS TASK</span>
          <h4 class="task-card-title">${escapeHtml(title)}</h4>
        </div>
      </div>
      <span class="task-card-status" id="task-status-${taskId}">${escapeHtml(status)}</span>
    </div>
    <div class="task-card-bar">
      <div class="task-card-fill" id="task-fill-${taskId}" style="width: ${progress}%;"></div>
    </div>
    <div class="task-card-footer">
      <span class="task-card-step" id="task-step-${taskId}">${escapeHtml(stepDesc)}</span>
      <div class="task-card-btns">
        <button class="btn-task-action" id="btn-pause-${taskId}" onclick="toggleTaskPause('${taskId}')">⏸ Pause</button>
        <button class="btn-task-action" onclick="openContextualWorkspace()">🌐 View Surface</button>
      </div>
    </div>
  `;

  streamList.appendChild(card);
  timeline.scrollTop = timeline.scrollHeight;

  // Also update topbar active task pill
  if (headerActiveTaskPill) {
    headerActiveTaskPill.style.display = 'flex';
    headerTaskTitle.textContent = title;
  }
  if (btnToggleWorkspace) {
    btnToggleWorkspace.style.display = 'flex';
  }

  return card;
}

function updateInlineTaskCard(taskId, status, progress, stepDesc) {
  const statusEl = document.getElementById(`task-status-${taskId}`);
  const fillEl = document.getElementById(`task-fill-${taskId}`);
  const stepEl = document.getElementById(`task-step-${taskId}`);
  if (status && statusEl) {
    statusEl.textContent = status;
    if (status.toLowerCase().includes('done') || status.toLowerCase().includes('complete')) {
      statusEl.className = 'task-card-status done';
    }
  }
  if (progress !== undefined && fillEl) {
    fillEl.style.width = `${progress}%`;
  }
  if (stepDesc && stepEl) {
    stepEl.textContent = stepDesc;
  }
}

window.toggleTaskPause = function(taskId) {
  isTaskPaused = !isTaskPaused;
  const btn = document.getElementById(`btn-pause-${taskId}`);
  if (btn) btn.textContent = isTaskPaused ? '▶ Resume' : '⏸ Pause';
  updateInlineTaskCard(taskId, isTaskPaused ? 'Paused' : 'Working', undefined, isTaskPaused ? 'Execution paused by user' : 'Resuming steps...');
};

// Inline Sentinel Authorization Card
function renderInlineSentinelCard(data) {
  const card = document.createElement('div');
  card.className = 'sentinel-approval-card';
  card.id = `sentinel-req-${data.confirmId}`;
  card.innerHTML = `
    <div class="sentinel-banner">
      <span class="sentinel-tag">🛡️ AUTHORIZATION REQUIRED</span>
      <span class="risk-pill">${escapeHtml(data.riskLevel || 'HIGH RISK')}</span>
    </div>
    <div class="sentinel-title">${escapeHtml(data.action)}</div>
    <div class="sentinel-desc">${escapeHtml(data.reason || 'Muse requires your authorization for this outbound operation.')}</div>
    <div class="sentinel-details">
      ${Object.entries(data.params || {}).map(([k, v]) => `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(typeof v === 'object' ? JSON.stringify(v) : String(v))}</div>`).join('') || 'Standard parameters'}
    </div>
    <div class="sentinel-actions">
      <button class="btn-reject" onclick="handleSentinelAction('${data.confirmId}', false)">✕ Reject Action</button>
      <button class="btn-approve" onclick="handleSentinelAction('${data.confirmId}', true)">✓ Authorize Action</button>
    </div>
  `;
  streamList.appendChild(card);
  timeline.scrollTop = timeline.scrollHeight;
}

window.handleSentinelAction = function(confirmId, approved) {
  socket?.send(JSON.stringify({ type: 'confirm_response', confirmId, approved }));
  const card = document.getElementById(`sentinel-req-${confirmId}`);
  if (card) {
    card.innerHTML = `
      <div style="font-size:12px; color:${approved ? '#32C98B' : '#F16B77'}; font-weight:600;">
        ${approved ? '✓ Action Authorized' : '✕ Action Rejected'}
      </div>
    `;
  }
  pendingApprovals.delete(confirmId);
  updateApprovalBadge();
  setAvatarState(approved ? 'working' : 'idle');
};

function updateApprovalBadge() {
  const count = pendingApprovals.size;
  if (approvalBadge) {
    if (count > 0) {
      approvalBadge.textContent = count;
      approvalBadge.style.display = 'inline-block';
    } else {
      approvalBadge.style.display = 'none';
    }
  }
}

// Starter Prompts Click
document.querySelectorAll('.starter-card').forEach(btn => {
  btn.addEventListener('click', () => {
    userInput.value = btn.dataset.prompt;
    chatForm.dispatchEvent(new Event('submit'));
  });
});

// Auto-expand Textarea & Submit
userInput?.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
});

userInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.dispatchEvent(new Event('submit'));
  }
});

chatForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  appendMessage('user', text);
  userInput.value = '';
  userInput.style.height = 'auto';

  setAvatarState('thinking');
  agentStatus.textContent = 'Working on your goal...';

  const taskId = `task_${Date.now()}`;
  createInlineTaskCard(taskId, text, 'Planning', 20, 'Analyzing goal and formulating plan...');

  socket?.send(JSON.stringify({
    type: 'goal',
    text
  }));
});

// ==========================================
// 5. WebSocket & Real-Time Event Handlers
// ==========================================
function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${window.location.host}`);

  socket.onopen = () => {
    agentStatus.textContent = 'Your personal companion';
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleServerEvent(data);
    } catch (e) {
      console.error('Malformed WS message:', e);
    }
  };

  socket.onclose = () => {
    agentStatus.textContent = 'Reconnecting...';
    setTimeout(connect, 2000);
  };
}

function handleServerEvent(data) {
  switch (data.type) {
    case 'init_state':
      state.activeModel = data.activeModel || 'Gemini Flash';
      state.memories = data.memories || [];
      state.goals = data.goals || [];
      state.tasks = data.tasks || [];
      state.activity = data.activity || [];
      state.connections = data.connections || [];
      if (data.conversations && data.conversations.length > 0) {
        state.conversations = data.conversations;
      }
      if (data.persona) {
        state.persona = data.persona;
        if (personaNameDisplay) personaNameDisplay.textContent = state.persona.name || 'Muse';
      }
      renderConversationsList();
      renderWelcomeResume();
      updateGreeting();
      break;

    case 'tasks_restored':
      if (data.tasks && data.tasks.length > 0) {
        state.tasks = data.tasks;
        renderWelcomeResume();
        const first = data.tasks[0];
        appendMessage('assistant', `🔄 Restored in-flight task: "${first.title}". Click Resume to continue.`);
      }
      break;

    case 'goal_created':
      if (data.task) {
        currentActiveTaskId = data.task.id;
        updateInlineTaskCard(data.task.id, 'Running', 30, 'Plan formulated. Executing first step...');
      }
      break;

    case 'thinking':
      setAvatarState('thinking');
      agentStatus.textContent = `Analyzing: Step ${data.step}...`;
      if (currentActiveTaskId) {
        updateInlineTaskCard(currentActiveTaskId, 'Running', Math.min(85, (data.step || 1) * 25), `Executing Step ${data.step}...`);
      }
      break;

    case 'tool_call':
      setAvatarState('working');
      agentStatus.textContent = `Executing: ${data.name}...`;

      if (data.name === 'browser_navigate' && data.args?.url) {
        updateInlineTaskCard(currentActiveTaskId, 'Browsing', 60, `Browsing ${data.args.url}`);
        updateBrowserDeck(data.args.url, `Navigating to ${data.args.url}`, 'Loading remote page in isolated profile...');
        addBrowserMilestone('Browser Navigation', `Navigated to ${data.args.url}`, 'running');
        if (btnTakeControl) btnTakeControl.style.display = 'inline-flex';
      } else if (data.name === 'browser_search') {
        updateInlineTaskCard(currentActiveTaskId, 'Searching', 50, `Searching for "${data.args.query}"`);
        const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(data.args.query || '')}`;
        updateBrowserDeck(searchUrl, `Search: ${data.args.query}`, 'Querying search index...');
        addBrowserMilestone('Search Query', `Searched for "${data.args.query}"`, 'running');
        if (btnTakeControl) btnTakeControl.style.display = 'inline-flex';
      } else if (data.name === 'browser_extract') {
        updateInlineTaskCard(currentActiveTaskId, 'Extracting', 75, 'Extracting structured DOM tables & text');
        addBrowserMilestone('DOM Extraction', 'Extracting structured data from current page', 'running');
      }
      break;

    case 'tool_result':
      if (data.name === 'browser_navigate' && data.result?.title) {
        updateBrowserDeck(data.result.url, data.result.title, `Loaded successfully (${data.result.status || 200})`);
        addBrowserMilestone('Page Loaded', `${data.result.title} (${data.result.url})`, 'done');
      } else if (data.name === 'browser_extract' && data.result?.text) {
        updateBrowserDeck(null, null, data.result.text.slice(0, 400) + '...');
        addBrowserMilestone('Data Extracted', `Extracted ${data.result.text.length} characters of structured DOM`, 'done');
      }
      break;

    case 'confirm_request':
      setAvatarState('sentinel');
      pendingConfirmId = data.confirmId;
      pendingApprovals.set(data.confirmId, data);
      updateApprovalBadge();
      renderInlineSentinelCard(data);
      if (currentActiveTaskId) {
        updateInlineTaskCard(currentActiveTaskId, 'Review Required', 80, 'Waiting for your sign-off...');
      }
      break;

    case 'complete':
      setAvatarState('idle');
      agentStatus.textContent = 'Goal accomplished';
      if (currentActiveTaskId) {
        updateInlineTaskCard(currentActiveTaskId, 'Done', 100, 'Goal completed successfully.');
      }
      if (headerActiveTaskPill) {
        headerActiveTaskPill.style.display = 'none';
      }
      if (btnTakeControl) {
        btnTakeControl.style.display = 'none';
      }
      appendMessage('assistant', data.result || 'Task completed.');
      if (data.result) speakText(data.result);
      break;

    case 'error':
      setAvatarState('idle');
      agentStatus.textContent = 'Ready';
      if (currentActiveTaskId) {
        updateInlineTaskCard(currentActiveTaskId, 'Failed', 100, `Error: ${data.message}`);
      }
      appendMessage('assistant', `❌ Error: ${data.message}`);
      break;
  }
}

// "Pick up where you left off" Section in Welcome Screen
function renderWelcomeResume() {
  if (!welcomeResumeSection || !welcomeResumeList) return;
  const active = (state.tasks || []).filter(t => t.status === 'running' || t.status === 'waiting_approval' || t.status === 'queued' || t.status === 'active');
  if (active.length === 0) {
    welcomeResumeSection.style.display = 'none';
    return;
  }
  welcomeResumeSection.style.display = 'block';
  welcomeResumeList.innerHTML = active.slice(0, 2).map(t => `
    <div class="resume-card">
      <div>
        <div class="resume-card-title">${escapeHtml(t.title)}</div>
        <div class="resume-card-step">Status: ${escapeHtml(t.status)} • Step ${t.step || 1}</div>
      </div>
      <button class="btn-task-action" onclick="resumeTask('${t.id}')">▶ Resume</button>
    </div>
  `).join('');
}

window.resumeTask = function(taskId) {
  socket?.send(JSON.stringify({ type: 'resume_task', taskId }));
  const task = (state.tasks || []).find(t => t.id === taskId);
  createInlineTaskCard(taskId, task?.title || 'Resumed Task', 'Resuming', 45, 'Rehydrating checkpoint messages...');
};

// ==========================================
// 6. Sub-View HTML Generators for Modal
// ==========================================
function renderGoalsHtml() {
  const list = state.goals || [];
  if (list.length === 0) return '<div class="empty-state">No goals tracked yet. Tell Muse what you want to achieve!</div>';
  return `
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${list.map(g => `
        <div class="resume-card" style="margin:0;">
          <div style="flex:1;">
            <div style="font-weight:600; font-size:13px; color:#fff;">${escapeHtml(g.title)}</div>
            <div style="font-size:11px; color:#9AA9BC; margin-top:2px;">Status: ${g.status} • Progress: ${g.progress || 0}%</div>
          </div>
          <span class="milestone-badge ${g.status === 'completed' ? 'done' : 'running'}">${g.status}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderActivityHtml() {
  const list = state.activity || [];
  if (list.length === 0) return '<div class="empty-state">No activity logged yet.</div>';
  return `
    <div style="display:flex; flex-direction:column; gap:8px;">
      ${list.map(item => `
        <div style="padding:8px 10px; background:#151D2A; border-radius:8px; border:1px solid #202B3C; font-size:12px;">
          <div style="font-weight:600; color:#fff; display:flex; justify-content:space-between;">
            <span>${escapeHtml(item.title || item.type)}</span>
            <span style="font-size:10px; color:#64748b;">${item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''}</span>
          </div>
          <div style="color:#9AA9BC; font-size:11px; margin-top:2px;">${escapeHtml(item.detail || '')}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderApprovalsHtml() {
  if (pendingApprovals.size === 0) return '<div class="empty-state">🛡️ No pending approvals. Sentinel is active and guarding your actions.</div>';
  return `
    <div style="display:flex; flex-direction:column; gap:12px;">
      ${Array.from(pendingApprovals.values()).map(r => `
        <div class="sentinel-approval-card" style="margin:0;">
          <div class="sentinel-title">${escapeHtml(r.action)}</div>
          <div class="sentinel-desc">${escapeHtml(r.reason || 'Authorization required')}</div>
          <div class="sentinel-actions">
            <button class="btn-reject" onclick="handleSentinelAction('${r.confirmId}', false); closeModal();">✕ Reject</button>
            <button class="btn-approve" onclick="handleSentinelAction('${r.confirmId}', true); closeModal();">✓ Authorize</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderMemoryHtml() {
  const list = state.memories || [];
  return `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <span style="font-size:12px; color:#9AA9BC;">Personal preferences remembered across sessions</span>
        <button class="btn-task-action" onclick="handleAddMemoryPrompt()">+ Add Memory</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${list.map(m => `
          <div class="resume-card" style="margin:0;">
            <div>
              <div style="font-weight:600; font-size:12px; color:#65C8E8;">${escapeHtml(m.key)}</div>
              <div style="font-size:12px; color:#fff;">${escapeHtml(m.value)}</div>
            </div>
            <button style="background:none; border:none; color:#F16B77; cursor:pointer;" onclick="deleteMemoryItem('${m.id}')">🗑️</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

window.handleAddMemoryPrompt = function() {
  const key = prompt('Memory Topic (e.g. Airline Preference, Coffee, Tone):');
  if (!key) return;
  const value = prompt(`Details for "${key}":`);
  if (!value) return;
  socket?.send(JSON.stringify({ type: 'add_memory', memory: { key, value, category: 'personal' } }));
  state.memories.push({ id: `mem_${Date.now()}`, key, value, category: 'personal' });
  openModal('🧠 Personal Memory & Preferences', renderMemoryHtml());
};

window.deleteMemoryItem = function(id) {
  if (confirm('Delete this memory?')) {
    socket?.send(JSON.stringify({ type: 'delete_memory', id }));
    state.memories = state.memories.filter(m => m.id !== id);
    openModal('🧠 Personal Memory & Preferences', renderMemoryHtml());
  }
};

function renderPersonaHtml() {
  const p = state.persona || { name: 'Muse', tone: 'friendly', voice: 'natural', proactivity: 'high' };
  return `
    <form id="persona-form" onsubmit="event.preventDefault(); savePersonaSettings();">
      <div class="persona-group">
        <label class="persona-label">Companion Display Name</label>
        <input type="text" id="persona-name-input" class="persona-input" value="${escapeHtml(p.name || 'Muse')}" />
      </div>

      <div class="persona-group">
        <label class="persona-label">Personality & Communication Style</label>
        <select id="persona-tone-input" class="persona-select">
          <option value="friendly" ${p.tone === 'friendly' ? 'selected' : ''}>Warm & Friendly (Conversational, encouraging)</option>
          <option value="professional" ${p.tone === 'professional' ? 'selected' : ''}>Professional & Concise (Executive, clear summaries)</option>
          <option value="analytical" ${p.tone === 'analytical' ? 'selected' : ''}>Deep & Analytical (Technical, thorough research)</option>
        </select>
      </div>

      <div class="persona-group">
        <label class="persona-label">Proactivity Level</label>
        <select id="persona-proactivity-input" class="persona-select">
          <option value="high" ${p.proactivity === 'high' ? 'selected' : ''}>High (Offers ideas, tracks goals in background)</option>
          <option value="balanced" ${p.proactivity === 'balanced' ? 'selected' : ''}>Balanced (Answers requests and proposes plans)</option>
          <option value="reactive" ${p.proactivity === 'reactive' ? 'selected' : ''}>Reactive (Executes only when asked)</option>
        </select>
      </div>

      <button type="submit" class="btn-save-persona">Save Preferences</button>
    </form>
  `;
}

window.savePersonaSettings = function() {
  const name = document.getElementById('persona-name-input')?.value.trim() || 'Muse';
  const tone = document.getElementById('persona-tone-input')?.value || 'friendly';
  const proactivity = document.getElementById('persona-proactivity-input')?.value || 'high';

  state.persona = { ...state.persona, name, tone, proactivity };
  if (personaNameDisplay) personaNameDisplay.textContent = name;

  socket?.send(JSON.stringify({
    type: 'update_persona',
    updates: state.persona
  }));

  closeModal();
};

function renderConnectionsHtml() {
  const list = state.connections || [];
  return `
    <div style="display:flex; flex-direction:column; gap:8px;">
      ${list.map(c => `
        <div class="resume-card" style="margin:0;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:18px;">${c.icon || '🔌'}</span>
            <div>
              <div style="font-weight:600; font-size:13px; color:#fff;">${escapeHtml(c.name)}</div>
              <div style="font-size:11px; color:#9AA9BC;">${escapeHtml(c.detail || '')}</div>
            </div>
          </div>
          <span class="milestone-badge ${c.status === 'Active' || c.status === 'Connected' ? 'done' : 'pending'}">${c.status}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Start connection
connect();
