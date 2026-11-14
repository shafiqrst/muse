// Muse AI Desktop Chatbox Client

let socket = null;
let currentMode = 'muse';
let pendingConfirmId = null;
let voiceEnabled = true;
let isSpeaking = false;
let mouthAnimationInterval = null;

// DOM Elements
const avatarWrapper = document.getElementById('avatar-head-wrapper');
const avatarSvg = document.getElementById('avatar-svg');
const pupilLeft = document.getElementById('pupil-left');
const pupilRight = document.getElementById('pupil-right');
const eyelidLeft = document.getElementById('eyelid-left');
const eyelidRight = document.getElementById('eyelid-right');
const avatarMouth = document.getElementById('avatar-mouth');
const agentStatus = document.getElementById('agent-status');
const agentStatusPill = document.getElementById('agent-status-pill');

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
const sentinelParams = document.getElementById('sentinel-params');
const btnApprove = document.getElementById('btn-sentinel-approve');
const btnReject = document.getElementById('btn-sentinel-reject');

// ==========================================
// 1. Avatar Eye Tracking & Blinking in Header
// ==========================================
const BASE_PUPIL_LEFT = { x: 36, y: 44 };
const BASE_PUPIL_RIGHT = { x: 64, y: 44 };
const MAX_OFFSET = 3.5;

window.addEventListener('mousemove', (e) => {
  if (avatarWrapper.classList.contains('thinking')) return;

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
function setAvatarState(state) {
  avatarWrapper.classList.remove('thinking', 'speaking', 'sentinel');

  switch (state) {
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
      agentStatusPill.style.color = '#38bdf8';
      agentStatusPill.style.borderColor = 'rgba(56, 189, 248, 0.4)';
      startMouthMorph();
      break;

    case 'sentinel':
      avatarWrapper.classList.add('sentinel');
      agentStatusPill.textContent = 'Review Required';
      agentStatusPill.style.color = '#f59e0b';
      agentStatusPill.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      stopMouthMorph();
      break;

    case 'idle':
    default:
      agentStatusPill.textContent = 'Active';
      agentStatusPill.style.color = '#34d399';
      agentStatusPill.style.borderColor = 'rgba(16, 185, 129, 0.3)';
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
// 2. Text-to-Speech (TTS) Voice Engine
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
    btnVoiceToggle.classList.add('speaking');
  };

  utterance.onend = utterance.onerror = () => {
    isSpeaking = false;
    setAvatarState('idle');
    btnVoiceToggle.classList.remove('speaking');
  };

  window.speechSynthesis.speak(utterance);
}

btnVoiceToggle.addEventListener('click', () => {
  voiceEnabled = !voiceEnabled;
  btnVoiceToggle.classList.toggle('active', voiceEnabled);
  if (!voiceEnabled && isSpeaking) {
    window.speechSynthesis.cancel();
    setAvatarState('idle');
  }
});

// ==========================================
// 3. Speech-to-Text (Voice Mic Dictation)
// ==========================================
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
    agentStatus.textContent = 'Ready to assist';
  };

  btnMic.addEventListener('click', () => {
    if (btnMic.classList.contains('listening')) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });
} else {
  btnMic.style.display = 'none';
}

// ==========================================
// 4. WebSocket Realtime Communication
// ==========================================
function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${window.location.host}`);

  socket.onopen = () => {
    agentStatus.textContent = 'Connected & ready';
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
    case 'thinking':
      setAvatarState('thinking');
      agentStatus.textContent = `Analyzing: Step ${data.step}...`;
      break;

    case 'tool_call':
      setAvatarState('thinking');
      agentStatus.textContent = `Browsing: ${data.name}...`;

      if (data.name === 'browser_navigate' && data.args?.url) {
        browserSheet.style.display = 'block';
        sheetUrl.textContent = data.args.url;
        sheetTitle.textContent = `Opening ${data.args.url}...`;
        sheetSummary.textContent = 'Navigating in sandbox browser...';
      }
      break;

    case 'tool_result':
      if (data.name === 'browser_navigate' && data.result?.title) {
        sheetTitle.textContent = data.result.title;
        sheetSummary.textContent = `Loaded ${data.result.url}`;
      } else if (data.name === 'browser_extract' && data.result?.text) {
        sheetSummary.textContent = data.result.text.slice(0, 150) + '...';
      }
      break;

    case 'confirm_request':
      setAvatarState('sentinel');
      pendingConfirmId = data.confirmId;
      sentinelTitle.textContent = data.action;
      sentinelDesc.textContent = data.reason || 'Authorization required for this outbound request.';
      sentinelParams.textContent = JSON.stringify(data.params || {}, null, 2);
      sentinelCard.style.display = 'block';
      break;

    case 'complete':
      setAvatarState('idle');
      agentStatus.textContent = 'Goal accomplished';
      appendMessage('assistant', data.result || 'Task completed.');
      if (data.result) speakText(data.result);
      break;

    case 'error':
      setAvatarState('idle');
      agentStatus.textContent = 'Action failed';
      appendMessage('assistant', `❌ Error: ${data.message}`);
      break;
  }
}

// Append Chat Message Row with Avatar Icon
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

// Mode Switcher
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    agentStatus.textContent = currentMode === 'muse' ? 'Muse Active' : 'Coder Active';
    socket?.send(JSON.stringify({ type: 'switch_mode', mode: currentMode }));
  });
});

// Quick Chips
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    userInput.value = chip.dataset.prompt;
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
  setAvatarState('thinking');
  agentStatus.textContent = 'Working on your goal...';

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
  setAvatarState('thinking');
});

btnReject.addEventListener('click', () => {
  if (!pendingConfirmId) return;
  socket.send(JSON.stringify({ type: 'confirm_response', confirmId: pendingConfirmId, approved: false }));
  sentinelCard.style.display = 'none';
  pendingConfirmId = null;
  setAvatarState('idle');
});

btnCloseSheet.addEventListener('click', () => {
  browserSheet.style.display = 'none';
});

connect();
