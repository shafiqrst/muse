// Muse AI Desktop Companion Client - Conversation-First + Expandable Workspace

let socket = null;
let pendingConfirmId = null;
let voiceEnabled = true;
let isSpeaking = false;
let mouthAnimationInterval = null;
let currentTask = null;

// Application State
let state = {
  activeModel: 'Gemini Flash',
  memories: [],
  goals: [],
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
const modelNameEl = document.getElementById('model-name');
const approvalBadge = document.getElementById('approval-badge');

const btnExpandWorkspace = document.getElementById('btn-expand-workspace');
const btnToggleDrawer = document.getElementById('btn-toggle-drawer');
const btnCloseDrawer = document.getElementById('btn-close-drawer');
const sideDrawer = document.getElementById('side-drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const drawerItems = document.querySelectorAll('.drawer-item');

const activeTaskBanner = document.getElementById('active-task-banner');
const bannerTaskTitle = document.getElementById('banner-task-title');
const bannerTaskStep = document.getElementById('banner-task-step');
const bannerTaskFill = document.getElementById('banner-task-fill');
const bannerTaskDesc = document.getElementById('banner-task-desc');

const timeline = document.getElementById('timeline');
const streamList = document.getElementById('stream');
const welcomeCard = document.getElementById('welcome-card');
const quickChips = document.getElementById('quick-chips');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const btnMic = document.getElementById('btn-mic');
const btnVoiceToggle = document.getElementById('btn-voice-toggle');

const browserSheet = document.getElementById('browser-sheet');
const sheetUrl = document.getElementById('sheet-url');
const sheetTitle = document.getElementById('sheet-title');
const sheetSummary = document.getElementById('sheet-summary');
const btnCloseSheet = document.getElementById('btn-close-sheet');

const sentinelCard = document.getElementById('sentinel-card');
const sentinelTitle = document.getElementById('sentinel-action-title');
const sentinelDesc = document.getElementById('sentinel-action-desc');
const sentinelRiskPill = document.getElementById('sentinel-risk-pill');
const sentinelDetailsGrid = document.getElementById('sentinel-details-grid');
const btnApprove = document.getElementById('btn-sentinel-approve');
const btnReject = document.getElementById('btn-sentinel-reject');

// ==========================================
// 1. Navigation & Expandable Workspace Deck
// ==========================================
function toggleDrawer(open) {
  const shouldOpen = open !== undefined ? open : !sideDrawer.classList.contains('open');
  sideDrawer.classList.toggle('open', shouldOpen);
  drawerOverlay.classList.toggle('open', shouldOpen);
}

btnToggleDrawer?.addEventListener('click', () => toggleDrawer(true));
btnCloseDrawer?.addEventListener('click', () => toggleDrawer(false));
drawerOverlay?.addEventListener('click', () => toggleDrawer(false));

btnExpandWorkspace?.addEventListener('click', () => {
  appShell.classList.toggle('expanded');
  const isExpanded = appShell.classList.contains('expanded');
  btnExpandWorkspace.classList.toggle('active', isExpanded);
  if (isExpanded) {
    showSubView('activity');
  }
});

drawerItems.forEach(item => {
  item.addEventListener('click', () => {
    const viewName = item.dataset.view;
    drawerItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    toggleDrawer(false);

    if (viewName === 'chat') {
      if (!btnExpandWorkspace.classList.contains('active')) {
        appShell.classList.remove('expanded');
      }
    } else {
      appShell.classList.add('expanded');
      btnExpandWorkspace.classList.add('active');
      showSubView(viewName);
    }
  });
});

function showSubView(viewName) {
  document.querySelectorAll('.sub-view').forEach(v => v.style.display = 'none');
  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.style.display = 'block';
    if (viewName === 'goals') renderGoals();
    else if (viewName === 'activity') renderActivity();
    else if (viewName === 'approvals') renderApprovalsQueue();
    else if (viewName === 'connections') renderConnections();
    else if (viewName === 'memory') renderMemory();
  }
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

// ==========================================
// 2. Render Secondary Sub-Views
// ==========================================
function renderGoals() {
  const container = document.getElementById('goals-list');
  if (!container) return;
  const list = state.tasks && state.tasks.length > 0 ? state.tasks : state.goals;
  if (!list || list.length === 0) {
    container.innerHTML = '<div class="empty-state">No goals tracked yet. Type a goal in chat to begin!</div>';
    return;
  }
  container.innerHTML = list.map(g => {
    const isCompleted = g.status === 'completed';
    const statusClass = isCompleted ? 'completed' : 'active';
    const progress = Math.min(100, Math.max(0, g.progress || (isCompleted ? 100 : 25)));
    const canResume = !isCompleted && g.status !== 'failed';
    const checkpointCount = g.checkpoints ? g.checkpoints.length : 0;
    return `
      <div class="goal-card">
        <div class="goal-card-header">
          <span class="goal-title">${escapeHtml(g.title)}</span>
          <span class="goal-status-badge ${statusClass}">${g.status}</span>
        </div>
        <div class="goal-progress-bar" style="margin-bottom: 6px;">
          <div class="goal-progress-fill" style="width: ${progress}%"></div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:10.5px; color:#9AA9BC;">${checkpointCount > 0 ? `${checkpointCount} checkpoint(s)` : (g.step ? `Step ${g.step}` : 'Initialized')}</span>
          ${canResume ? `<button class="btn-small-add" style="padding:2px 8px; font-size:10px;" onclick="resumeTask('${g.id}')">▶ Resume</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

window.resumeTask = function(taskId) {
  socket?.send(JSON.stringify({ type: 'resume_task', taskId }));
  showTaskProgressBanner('Resuming Task', 'Rehydrating checkpoint messages...', 40, 1);
};

function renderActivity() {
  const container = document.getElementById('activity-feed');
  if (!container) return;
  if (!state.activity || state.activity.length === 0) {
    container.innerHTML = '<div class="empty-state">No activity recorded yet.</div>';
    return;
  }
  container.innerHTML = state.activity.map(item => {
    let icon = '⚡';
    if (item.type === 'tool_call') icon = '🌐';
    else if (item.type === 'tool_result') icon = '📄';
    else if (item.type === 'sentinel_interception') icon = '🛡️';
    else if (item.type === 'thinking') icon = '🧠';
    else if (item.type === 'complete') icon = '✅';

    const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

    return `
      <div class="activity-item">
        <span class="activity-icon">${icon}</span>
        <div style="flex:1;">
          <div class="activity-title">${escapeHtml(item.title || item.type)} <span style="font-size:10px; color:#64748b; font-weight:normal; margin-left:4px;">${timeStr}</span></div>
          <div class="activity-detail">${escapeHtml(item.detail || '')}</div>
        </div>
      </div>
    `;
  }).join('');
}

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
  renderApprovalsQueue();
}

function renderApprovalsQueue() {
  const container = document.getElementById('approvals-queue');
  if (!container) return;
  if (pendingApprovals.size === 0) {
    container.innerHTML = '<div class="empty-state">🛡️ No pending approvals. Your actions are safe.</div>';
    return;
  }
  container.innerHTML = Array.from(pendingApprovals.values()).map(req => {
    return `
      <div class="human-sentinel-card" style="margin: 0 0 10px 0;">
        <div class="sentinel-banner">
          <span class="sentinel-shield">🛡️</span>
          <div>
            <span class="sentinel-tag">AUTHORIZATION REQUIRED</span>
            <span class="risk-pill">${escapeHtml(req.riskLevel || 'HIGH RISK')}</span>
          </div>
        </div>
        <div class="sentinel-action-title">${escapeHtml(req.action)}</div>
        <p class="sentinel-action-desc">${escapeHtml(req.reason || 'Authorization required for outbound request.')}</p>
        <div class="sentinel-details-grid">
          ${renderHumanDetails(req.params)}
        </div>
        <div class="sentinel-actions">
          <button class="btn-reject" onclick="handleSentinelAction('${req.confirmId}', false)">✕ Reject</button>
          <button class="btn-approve" onclick="handleSentinelAction('${req.confirmId}', true)">✓ Authorize</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderHumanDetails(params = {}) {
  const entries = Object.entries(params);
  if (entries.length === 0) return '<div class="detail-row"><span class="detail-val">Standard parameters</span></div>';
  return entries.map(([key, val]) => `
    <div class="detail-row">
      <span class="detail-label">${escapeHtml(key)}:</span>
      <span class="detail-val">${escapeHtml(typeof val === 'object' ? JSON.stringify(val) : String(val))}</span>
    </div>
  `).join('');
}

window.handleSentinelAction = function(confirmId, approved) {
  socket?.send(JSON.stringify({ type: 'confirm_response', confirmId, approved }));
  pendingApprovals.delete(confirmId);
  if (pendingConfirmId === confirmId) {
    sentinelCard.style.display = 'none';
    pendingConfirmId = null;
  }
  updateApprovalBadge();
  setAvatarState(approved ? 'thinking' : 'idle');
};

function renderConnections() {
  const container = document.getElementById('connections-list');
  if (!container) return;
  const list = state.connections || [];
  container.innerHTML = list.map(item => `
    <div class="connection-row">
      <div class="connection-info">
        <span class="connection-icon">${item.icon || '🔌'}</span>
        <div>
          <div class="connection-name">${escapeHtml(item.name)}</div>
          <div class="connection-desc">${escapeHtml(item.detail || '')}</div>
        </div>
      </div>
      <span class="goal-status-badge ${item.status === 'Active' || item.status === 'Connected' ? 'active' : 'completed'}">${item.status}</span>
    </div>
  `).join('');
}

function renderMemory() {
  const container = document.getElementById('memory-list');
  if (!container) return;
  if (!state.memories || state.memories.length === 0) {
    container.innerHTML = '<div class="empty-state">No saved memories. Click "+ Add" to teach Muse your preferences.</div>';
    return;
  }

  container.innerHTML = state.memories.map(m => `
    <div class="memory-card">
      <div>
        <div class="memory-key">${escapeHtml(m.key)} <span style="font-size:10px; color:#64748b; font-weight:normal;">(${escapeHtml(m.category || 'general')})</span></div>
        <div class="memory-val">${escapeHtml(m.value)}</div>
      </div>
      <button class="btn-del-mem" onclick="handleDeleteMemory('${m.id}')" title="Delete Memory">🗑️</button>
    </div>
  `).join('');
}

window.handleDeleteMemory = function(id) {
  if (confirm('Delete this memory item?')) {
    socket?.send(JSON.stringify({ type: 'delete_memory', id }));
  }
};

const btnAddMemory = document.getElementById('btn-add-memory');
if (btnAddMemory) {
  btnAddMemory.addEventListener('click', () => {
    const key = prompt('Enter memory topic (e.g. "Coffee Preference", "Preferred Airline"):');
    if (!key) return;
    const value = prompt(`Enter details for "${key}":`);
    if (!value) return;
    socket?.send(JSON.stringify({
      type: 'add_memory',
      memory: { key, value, category: 'personal' }
    }));
  });
}

// ==========================================
// 3. Subtle Living Avatar & Blinking
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

// Avatar States
function setAvatarState(stateKey) {
  if (!avatarWrapper) return;
  avatarWrapper.classList.remove('thinking', 'speaking', 'sentinel');

  switch (stateKey) {
    case 'thinking':
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
      agentStatusPill.style.color = '#54C8E8';
      agentStatusPill.style.borderColor = 'rgba(84, 200, 232, 0.4)';
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

// Lip-Sync Mouth Morphing
const MOUTH_SHAPES = [
  'M 42 66 Q 50 76 58 66',
  'M 44 64 Q 50 78 56 64',
  'M 41 67 Q 50 71 59 67',
  'M 43 68 Q 50 77 57 68'
];

function startMouthMorph() {
  if (mouthAnimationInterval) return;
  let idx = 0;
  mouthAnimationInterval = setInterval(() => {
    idx = (idx + 1) % MOUTH_SHAPES.length;
    avatarMouth.setAttribute('d', MOUTH_SHAPES[idx]);
  }, 110);
}

function stopMouthMorph() {
  if (mouthAnimationInterval) {
    clearInterval(mouthAnimationInterval);
    mouthAnimationInterval = null;
  }
  avatarMouth.setAttribute('d', 'M 40 68 Q 50 75 60 68');
}

// ==========================================
// 4. Voice Audio (TTS & STT)
// ==========================================
function speakText(text) {
  if (!voiceEnabled || !('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();
  const clean = text.replace(/[*_#`~\[\]]/g, '').slice(0, 300);

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const naturalVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
  if (naturalVoice) utterance.voice = naturalVoice;

  utterance.onstart = () => {
    isSpeaking = true;
    setAvatarState('speaking');
    btnVoiceToggle?.classList.add('speaking');
  };

  utterance.onend = utterance.onerror = () => {
    isSpeaking = false;
    setAvatarState('idle');
    btnVoiceToggle?.classList.remove('speaking');
  };

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
    if (btnMic.classList.contains('listening')) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });
} else if (btnMic) {
  btnMic.style.display = 'none';
}

// ==========================================
// 5. WebSocket & Real-Time Task Execution
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
      if (modelNameEl) {
        modelNameEl.textContent = state.activeModel.split(' ')[0] + ' ' + (state.activeModel.split(' ')[1] || '');
      }
      state.memories = data.memories || [];
      state.goals = data.goals || [];
      state.tasks = data.tasks || [];
      state.incompleteTasks = data.incompleteTasks || [];
      state.activity = data.activity || [];
      state.connections = data.connections || [];
      renderGoals();
      renderActivity();
      renderConnections();
      renderMemory();
      break;

    case 'tasks_restored':
      if (data.tasks && data.tasks.length > 0) {
        const first = data.tasks[0];
        showTaskProgressBanner(first.title, `Restored checkpoint at step ${first.step}.`, first.progress || 35, first.step || 1);
        appendMessage('assistant', `🔄 Restored in-flight task: "${first.title}". You can click Resume in Tasks or continue chatting.`);
      }
      break;

    case 'task_resumed':
      setAvatarState('thinking');
      agentStatus.textContent = 'Resuming goal...';
      showTaskProgressBanner(data.title || 'Resumed Task', 'Executing next step from checkpoint...', 50, data.step || 1);
      break;

    case 'sync_state':
      if (data.state) {
        state = { ...state, ...data.state };
        if (modelNameEl && state.activeModel) {
          modelNameEl.textContent = state.activeModel.split(' ')[0] + ' ' + (state.activeModel.split(' ')[1] || '');
        }
        renderGoals();
        renderActivity();
        renderConnections();
        renderMemory();
      }
      break;

    case 'goal_created':
      if (data.goal) {
        state.goals = [data.goal, ...(state.goals || [])];
        renderGoals();
        showTaskProgressBanner(data.goal.title, 'Planning execution', 20, 1);
      }
      break;

    case 'thinking':
      setAvatarState('thinking');
      agentStatus.textContent = `Analyzing: Step ${data.step}...`;
      updateTaskBannerStep(`Step ${data.step}`, `Formulating plan and next tool...`, Math.min(85, (data.step || 1) * 25));
      break;

    case 'tool_call':
      setAvatarState('thinking');
      agentStatus.textContent = `Executing: ${data.name}...`;

      if (data.name === 'browser_navigate' && data.args?.url) {
        browserSheet.style.display = 'block';
        sheetUrl.textContent = data.args.url;
        sheetTitle.textContent = `Opening ${data.args.url}...`;
        sheetSummary.textContent = 'Navigating in isolated browser sandbox...';
        updateTaskBannerStep('Browser Action', `Navigating to ${data.args.url}`, 60);
      } else if (data.name === 'browser_search') {
        updateTaskBannerStep('Web Search', `Searching for: "${data.args.query}"`, 50);
      }
      break;

    case 'tool_result':
      if (data.name === 'browser_navigate' && data.result?.title) {
        sheetTitle.textContent = data.result.title;
        sheetSummary.textContent = `Loaded ${data.result.url}`;
      } else if (data.name === 'browser_extract' && data.result?.text) {
        sheetSummary.textContent = data.result.text.slice(0, 140) + '...';
      }
      break;

    case 'confirm_request':
      setAvatarState('sentinel');
      pendingConfirmId = data.confirmId;
      pendingApprovals.set(data.confirmId, data);
      
      // Populate Human-Readable Card
      sentinelTitle.textContent = data.action;
      sentinelDesc.textContent = data.reason || 'Authorization required for this outbound request.';
      sentinelRiskPill.textContent = data.riskLevel || 'HIGH RISK';
      sentinelDetailsGrid.innerHTML = renderHumanDetails(data.params);
      sentinelCard.style.display = 'block';
      
      updateApprovalBadge();
      updateTaskBannerStep('Approval Required', 'Waiting for your sign-off...', 80);
      break;

    case 'complete':
      setAvatarState('idle');
      agentStatus.textContent = 'Goal accomplished';
      hideTaskProgressBanner();
      appendMessage('assistant', data.result || 'Task completed.');
      if (data.result) speakText(data.result);
      break;

    case 'error':
      setAvatarState('idle');
      agentStatus.textContent = 'Ready';
      hideTaskProgressBanner();
      appendMessage('assistant', `❌ Error: ${data.message}`);
      break;
  }
}

// Task Progress Banner Helpers
function showTaskProgressBanner(title, desc, percent, stepNum) {
  if (!activeTaskBanner) return;
  activeTaskBanner.style.display = 'block';
  bannerTaskTitle.textContent = title;
  bannerTaskDesc.textContent = desc;
  bannerTaskFill.style.width = `${percent}%`;
  bannerTaskStep.textContent = `Step ${stepNum || 1}`;
}

function updateTaskBannerStep(stepText, desc, percent) {
  if (!activeTaskBanner) return;
  bannerTaskStep.textContent = stepText;
  bannerTaskDesc.textContent = desc;
  bannerTaskFill.style.width = `${percent}%`;
}

function hideTaskProgressBanner() {
  if (!activeTaskBanner) return;
  bannerTaskFill.style.width = '100%';
  setTimeout(() => {
    activeTaskBanner.style.display = 'none';
  }, 2000);
}

// Append Chat Message Row
function appendMessage(role, content) {
  if (welcomeCard) welcomeCard.style.display = 'none';
  if (quickChips) quickChips.style.display = 'none';

  const row = document.createElement('div');
  row.className = `msg-row ${role}`;

  const icon = document.createElement('div');
  icon.className = 'msg-avatar-icon';
  icon.textContent = role === 'assistant' ? '✨' : '👤';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = content;

  row.appendChild(icon);
  row.appendChild(bubble);

  streamList.appendChild(row);
  timeline.scrollTop = timeline.scrollHeight;
}

// Quick Starter Chips
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    userInput.value = chip.dataset.prompt;
    chatForm.dispatchEvent(new Event('submit'));
  });
});

// Chat Form Submit
chatForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  appendMessage('user', text);
  userInput.value = '';
  setAvatarState('thinking');
  agentStatus.textContent = 'Working on your goal...';

  showTaskProgressBanner(text, 'Starting autonomous loop...', 15, 1);

  socket?.send(JSON.stringify({
    type: 'goal',
    text
  }));
});

// Inline Sentinel Buttons
btnApprove?.addEventListener('click', () => {
  if (!pendingConfirmId) return;
  window.handleSentinelAction(pendingConfirmId, true);
});

btnReject?.addEventListener('click', () => {
  if (!pendingConfirmId) return;
  window.handleSentinelAction(pendingConfirmId, false);
});

btnCloseSheet?.addEventListener('click', () => {
  browserSheet.style.display = 'none';
});

connect();
