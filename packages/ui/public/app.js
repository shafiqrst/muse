// Meta Muse Companion UI Client
let socket = null;
let currentMode = 'muse';
let pendingConfirmId = null;

const orb = document.getElementById('ambient-orb');
const statusLabel = document.getElementById('agent-status');
const stream = document.getElementById('stream');
const quickChips = document.getElementById('quick-chips');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const modelBadge = document.getElementById('model-name');

const browserSheet = document.getElementById('browser-sheet');
const sheetUrl = document.getElementById('sheet-url');
const sheetTitle = document.getElementById('sheet-title');
const sheetSummary = document.getElementById('sheet-summary');
const btnCloseSheet = document.getElementById('btn-close-sheet');

const sentinelCard = document.getElementById('sentinel-card');
const sentinelTitle = document.getElementById('sentinel-action-title');
const sentinelDesc = document.getElementById('sentinel-action-desc');
const sentinelParams = document.getElementById('sentinel-params');
const btnApprove = document.getElementById('btn-sentinel-approve');
const btnReject = document.getElementById('btn-sentinel-reject');

function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${window.location.host}`);

  socket.onopen = () => {
    statusLabel.textContent = 'Connected & ready';
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
    statusLabel.textContent = 'Reconnecting...';
    setTimeout(connect, 2000);
  };
}

function handleServerEvent(data) {
  switch (data.type) {
    case 'init':
      if (data.model) modelBadge.textContent = data.model;
      break;

    case 'thinking':
      setOrbState(true);
      statusLabel.textContent = `Thinking: Step ${data.step}...`;
      break;

    case 'tool_call':
      setOrbState(true);
      statusLabel.textContent = `Action: ${data.name}...`;

      // Live Browser Sheet display
      if (data.name === 'browser_navigate' && data.args?.url) {
        browserSheet.style.display = 'block';
        sheetUrl.textContent = data.args.url;
        sheetTitle.textContent = `Navigating to ${data.args.url}...`;
        sheetSummary.textContent = 'Loading DOM and assets...';
      }
      break;

    case 'tool_result':
      if (data.name === 'browser_navigate' && data.result?.title) {
        sheetTitle.textContent = data.result.title;
        sheetSummary.textContent = `Loaded ${data.result.url}`;
      } else if (data.name === 'browser_extract' && data.result?.text) {
        sheetSummary.textContent = data.result.text.slice(0, 160) + '...';
      }
      break;

    case 'confirm_request':
      // Sentinel Interception Card
      setOrbState(true);
      pendingConfirmId = data.confirmId;
      sentinelTitle.textContent = data.action;
      sentinelDesc.textContent = data.reason || 'Approval required for this outbound request.';
      sentinelParams.textContent = JSON.stringify(data.params || {}, null, 2);
      sentinelCard.style.display = 'block';
      break;

    case 'complete':
      setOrbState(false);
      statusLabel.textContent = 'Goal accomplished';
      appendMessage('assistant', data.result || 'Task complete.');
      break;

    case 'error':
      setOrbState(false);
      statusLabel.textContent = 'Action failed';
      appendMessage('assistant', `❌ Error: ${data.message}`);
      break;
  }
}

function setOrbState(isThinking) {
  if (isThinking) {
    orb.classList.add('thinking');
  } else {
    orb.classList.remove('thinking');
  }
}

function appendMessage(role, content) {
  quickChips.style.display = 'none';
  const msgEl = document.createElement('div');
  msgEl.className = `msg ${role}`;
  
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = content;
  
  msgEl.appendChild(bubble);
  stream.appendChild(msgEl);
  stream.scrollTop = stream.scrollHeight;
}

// Mode Switcher (Muse vs Coder)
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    statusLabel.textContent = currentMode === 'muse' ? 'Muse Companion Active' : 'Coder Studio Active';
    socket?.send(JSON.stringify({ type: 'switch_mode', mode: currentMode }));
  });
});

// Quick Chips
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const prompt = chip.dataset.prompt;
    userInput.value = prompt;
    chatForm.dispatchEvent(new Event('submit'));
  });
});

// Chat Form Submit
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  appendMessage('user', text);
  userInput.value = '';
  setOrbState(true);
  statusLabel.textContent = 'Working on goal...';

  socket.send(JSON.stringify({
    type: 'goal',
    mode: currentMode,
    text
  }));
});

// Sentinel Buttons
btnApprove.addEventListener('click', () => {
  if (!pendingConfirmId) return;
  socket.send(JSON.stringify({ type: 'confirm_response', confirmId: pendingConfirmId, approved: true }));
  sentinelCard.style.display = 'none';
  pendingConfirmId = null;
});

btnReject.addEventListener('click', () => {
  if (!pendingConfirmId) return;
  socket.send(JSON.stringify({ type: 'confirm_response', confirmId: pendingConfirmId, approved: false }));
  sentinelCard.style.display = 'none';
  pendingConfirmId = null;
});

btnCloseSheet.addEventListener('click', () => {
  browserSheet.style.display = 'none';
});

connect();
