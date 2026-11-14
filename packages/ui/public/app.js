// Meta Muse Interactive Realtime Avatar Companion Client

let socket = null;
let currentMode = 'muse';
let pendingConfirmId = null;
let voiceEnabled = true;
let isSpeaking = false;
let mouthAnimationInterval = null;

// DOM Elements
const avatarStage = document.getElementById('avatar-stage');
const avatarSvg = document.getElementById('avatar-svg');
const pupilLeft = document.getElementById('pupil-left');
const pupilRight = document.getElementById('pupil-right');
const eyelidLeft = document.getElementById('eyelid-left');
const eyelidRight = document.getElementById('eyelid-right');
const avatarMouth = document.getElementById('avatar-mouth');
const browLeft = document.getElementById('brow-left');
const browRight = document.getElementById('brow-right');
const badgeIcon = document.getElementById('badge-icon');
const badgeText = document.getElementById('badge-text');
const statusLabel = document.getElementById('agent-status');

const stream = document.getElementById('timeline');
const streamList = document.getElementById('stream');
const quickChips = document.getElementById('quick-chips');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const modelBadge = document.getElementById('model-name');
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
// 1. Avatar Visual Physics & Eye Tracking
// ==========================================
const BASE_PUPIL_LEFT = { x: 56, y: 68 };
const BASE_PUPIL_RIGHT = { x: 104, y: 68 };
const MAX_PUPIL_OFFSET = 5;

window.addEventListener('mousemove', (e) => {
  if (avatarStage.classList.contains('thinking')) return; // Look up when thinking

  const rect = avatarSvg.getBoundingClientRect();
  const avatarCenterX = rect.left + rect.width / 2;
  const avatarCenterY = rect.top + rect.height / 2;

  const dx = e.clientX - avatarCenterX;
  const dy = e.clientY - avatarCenterY;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;

  const offsetX = (dx / distance) * Math.min(MAX_PUPIL_OFFSET, Math.abs(dx) / 30);
  const offsetY = (dy / distance) * Math.min(MAX_PUPIL_OFFSET, Math.abs(dy) / 30);

  pupilLeft.setAttribute('cx', BASE_PUPIL_LEFT.x + offsetX);
  pupilLeft.setAttribute('cy', BASE_PUPIL_LEFT.y + offsetY);
  pupilRight.setAttribute('cx', BASE_PUPIL_RIGHT.x + offsetX);
  pupilRight.setAttribute('cy', BASE_PUPIL_RIGHT.y + offsetY);
});

// Natural Eyelid Blinking
function blink() {
  eyelidLeft.setAttribute('d', 'M 42 54 Q 56 78 70 54 L 70 78 Q 56 78 42 78 Z');
  eyelidRight.setAttribute('d', 'M 90 54 Q 104 78 118 54 L 118 78 Q 104 78 90 78 Z');

  setTimeout(() => {
    eyelidLeft.setAttribute('d', 'M 42 54 Q 56 54 70 54 L 70 54 Q 56 54 42 54 Z');
    eyelidRight.setAttribute('d', 'M 90 54 Q 104 54 118 54 L 118 54 Q 104 54 90 54 Z');
  }, 160);

  const nextBlink = Math.random() * 4000 + 2500;
  setTimeout(blink, nextBlink);
}
setTimeout(blink, 2000);

// Avatar Expression States
function setAvatarState(state) {
  avatarStage.classList.remove('thinking', 'speaking', 'sentinel');

  switch (state) {
    case 'thinking':
      avatarStage.classList.add('thinking');
      badgeIcon.textContent = '🧠';
      badgeText.textContent = 'Thinking...';
      pupilLeft.setAttribute('cy', BASE_PUPIL_LEFT.y - 4);
      pupilRight.setAttribute('cy', BASE_PUPIL_RIGHT.y - 4);
      browLeft.setAttribute('d', 'M 44 51 Q 56 46 68 53');
      browRight.setAttribute('d', 'M 92 53 Q 104 46 116 51');
      avatarMouth.setAttribute('d', 'M 68 106 Q 80 106 92 106'); // flat mouth
      break;

    case 'speaking':
      avatarStage.classList.add('speaking');
      badgeIcon.textContent = '🗣️';
      badgeText.textContent = 'Speaking';
      startMouthMorph();
      break;

    case 'sentinel':
      avatarStage.classList.add('sentinel');
      badgeIcon.textContent = '🛡️';
      badgeText.textContent = 'Review Required';
      browLeft.setAttribute('d', 'M 44 48 Q 56 48 68 54');
      browRight.setAttribute('d', 'M 92 54 Q 104 48 116 48');
      stopMouthMorph();
      avatarMouth.setAttribute('d', 'M 66 104 Q 80 108 94 104');
      break;

    case 'idle':
    default:
      badgeIcon.textContent = '✨';
      badgeText.textContent = 'Muse Active';
      browLeft.setAttribute('d', 'M 44 54 Q 56 49 68 53');
      browRight.setAttribute('d', 'M 92 53 Q 104 49 116 54');
      pupilLeft.setAttribute('cy', BASE_PUPIL_LEFT.y);
      pupilRight.setAttribute('cy', BASE_PUPIL_RIGHT.y);
      stopMouthMorph();
      avatarMouth.setAttribute('d', 'M 64 104 Q 80 114 96 104'); // smile
      break;
  }
}

// Lip-Sync Mouth Morphing
const MOUTH_SHAPES = [
  'M 66 102 Q 80 116 94 102', // open smile
  'M 68 99 Q 80 120 92 99',   // open O / A
  'M 65 103 Q 80 109 95 103', // narrow
  'M 68 104 Q 80 118 92 104'  // wide open
];

function startMouthMorph() {
  if (mouthAnimationInterval) return;
  let idx = 0;
  mouthAnimationInterval = setInterval(() => {
    idx = (idx + 1) % MOUTH_SHAPES.length;
    avatarMouth.setAttribute('d', MOUTH_SHAPES[idx]);
  }, 120);
}

function stopMouthMorph() {
  if (mouthAnimationInterval) {
    clearInterval(mouthAnimationInterval);
    mouthAnimationInterval = null;
  }
  avatarMouth.setAttribute('d', 'M 64 104 Q 80 114 96 104');
}

// ==========================================
// 2. Text-to-Speech (TTS) Voice Engine
// ==========================================
function speakText(text) {
  if (!voiceEnabled || !('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();
  // Strip markdown symbols for clean speech
  const clean = text.replace(/[*_#`~\[\]]/g, '').slice(0, 300);

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;

  // Try picking a natural English voice
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

// Voice Toggle Button
btnVoiceToggle.addEventListener('click', () => {
  voiceEnabled = !voiceEnabled;
  btnVoiceToggle.classList.toggle('active', voiceEnabled);
  if (!voiceEnabled && isSpeaking) {
    window.speechSynthesis.cancel();
    setAvatarState('idle');
  }
});

// ==========================================
// 3. Speech-to-Text (Voice Mic Input)
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
    statusLabel.textContent = 'Listening to your voice...';
  };

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    userInput.value = transcript;
    btnMic.classList.remove('listening');
    chatForm.dispatchEvent(new Event('submit'));
  };

  recognition.onerror = recognition.onend = () => {
    btnMic.classList.remove('listening');
    statusLabel.textContent = 'Ready to assist you';
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
      setAvatarState('thinking');
      statusLabel.textContent = `Analyzing: Step ${data.step}...`;
      break;

    case 'tool_call':
      setAvatarState('thinking');
      statusLabel.textContent = `Browsing: ${data.name}...`;

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
      statusLabel.textContent = 'Goal accomplished';
      appendMessage('assistant', data.result || 'Task completed.');
      if (data.result) speakText(data.result);
      break;

    case 'error':
      setAvatarState('idle');
      statusLabel.textContent = 'Action failed';
      appendMessage('assistant', `❌ Error: ${data.message}`);
      break;
  }
}

// Append Chat Message Row with Avatar Icon
function appendMessage(role, content) {
  quickChips.style.display = 'none';

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
  stream.scrollTop = stream.scrollHeight;
}

// Mode Switcher
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
  statusLabel.textContent = 'Working on your goal...';

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
