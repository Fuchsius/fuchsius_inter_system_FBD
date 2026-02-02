const iframe = document.getElementById('previewFrame');
const idleValue = document.getElementById('overlayIdle');
const activityDot = document.getElementById('overlayActivityDot');
const loggedUserName = document.getElementById('loggedUserName');
const loggedUserMeta = document.getElementById('loggedUserMeta');
const loggedUserCard = document.getElementById('loggedUserCard');
const FLASH_DELAY_MS = 1000;
const FLASH_DURATION_MS = 1000;
const FLASH_TOTAL_MS = FLASH_DELAY_MS + FLASH_DURATION_MS;
const IDLE_THRESHOLD_SECONDS = 5 * 60; // 5 minutes
let activityTimeout;
let idleNotificationBucket = 0;

const params = new URLSearchParams(window.location.search);
// const previewUrl = params.get('url') || 'http://localhost:5173/';
const previewUrl = params.get('url') || 'https://intersystem.fuchsius.com/';
iframe.src = previewUrl;

let previewOrigin = null;
try {
  previewOrigin = new URL(previewUrl).origin;
} catch (error) {
  previewOrigin = null;
}
const targetOrigin = previewOrigin || '*';
let iframeLoaded = false;

function formatIdle(seconds) {
  if (!seconds || seconds < 1) return '0s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts = [];
  if (hrs) parts.push(`${hrs}h`);
  if (mins) parts.push(`${mins}m`);
  if (secs || parts.length === 0) parts.push(`${secs}s`);
  return parts.join(' ');
}

function flashActivity(extra) {
  if (!activityDot) return;
  activityDot.classList.remove('flash-green', 'flash-red');

  const hasInput = Boolean(extra && extra.type);
  activityDot.classList.add(hasInput ? 'flash-green' : 'flash-red');

  clearTimeout(activityTimeout);
  activityTimeout = setTimeout(() => {
    activityDot.classList.remove('flash-green', 'flash-red');
  }, 800);
}

function updateOverlay(state) {
  idleValue.textContent = formatIdle(state.idleSeconds);
  flashActivity(state.extra);
  maybeNotifyIdleThreshold(state);
}

function maybeNotifyIdleThreshold(state) {
  if (!iframeLoaded || !iframe?.contentWindow) return;
  const idleSeconds = state?.idleSeconds || 0;
  const hasCrossed = idleSeconds >= IDLE_THRESHOLD_SECONDS;
  const currentBucket = hasCrossed ? Math.floor(idleSeconds / IDLE_THRESHOLD_SECONDS) : 0;

  if (hasCrossed && currentBucket > idleNotificationBucket) {
    iframe.contentWindow.postMessage(
      {
        source: 'activity-overlay',
        type: 'idle:threshold',
        payload: {
          idleSeconds: state.idleSeconds,
          lastActivityTs: state.lastActivityTs,
          status: state.status
        }
      },
      targetOrigin
    );
    idleNotificationBucket = currentBucket;
    return;
  }

  if (!hasCrossed && idleNotificationBucket !== 0) {
    idleNotificationBucket = 0;
  }
}

function formatUserName(user) {
  if (!user) return 'No active session';
  const first = user.firstName?.trim();
  const last = user.lastName?.trim();
  if (first || last) {
    return [first, last].filter(Boolean).join(' ');
  }
  return user.email || user.employeeId || 'Active user';
}

function formatUserMeta(user) {
  if (!user) return 'Sign in inside the preview window';
  const bits = [];
  if (user.employeeId) bits.push(user.employeeId);
  if (user.role) bits.push(user.role.toUpperCase());
  if (!bits.length && user.email) bits.push(user.email);
  return bits.join(' • ');
}

function setLoggedUser(user) {
  if (!loggedUserCard || !loggedUserName || !loggedUserMeta) return;
  if (!user) {
    loggedUserCard.dataset.status = 'offline';
    loggedUserName.textContent = 'No active session';
    loggedUserMeta.textContent = 'Sign in inside the preview window';
    return;
  }

  loggedUserCard.dataset.status = 'online';
  loggedUserName.textContent = formatUserName(user);
  loggedUserMeta.textContent = formatUserMeta(user);
}

function handleHostMessage(event) {
  if (!event?.data || event.data.source !== 'fuchsio-app') return;
  if (previewOrigin && event.origin !== previewOrigin) return;

  const { type, payload } = event.data;
  if (type === 'auth:status' || type === 'auth:login') {
    setLoggedUser(payload?.user || null);
  } else if (type === 'auth:logout') {
    setLoggedUser(null);
  }
}

function requestAuthSnapshot() {
  if (!iframeLoaded || !iframe?.contentWindow) return;
  iframe.contentWindow.postMessage({ source: 'activity-overlay', type: 'auth:status-request' }, targetOrigin);
}

window.addEventListener('message', handleHostMessage);

iframe?.addEventListener('load', () => {
  iframeLoaded = true;
  setTimeout(requestAuthSnapshot, 350);
});

async function init() {
  const firstState = await window.activityBridge.getState();
  updateOverlay(firstState);

  window.activityBridge.onStateUpdate((payload) => {
    updateOverlay(payload);
  });

  requestAuthSnapshot();
}

init();
