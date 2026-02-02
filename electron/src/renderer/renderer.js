const idleTimer = document.getElementById('idleTimer');

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

function updateUI(state) {
  idleTimer.textContent = formatIdle(state.idleSeconds);
}

async function init() {
  const initialState = await window.activityBridge.getState();
  updateUI(initialState);

  window.activityBridge.onStateUpdate((payload) => {
    updateUI(payload);
  });
}

init();
