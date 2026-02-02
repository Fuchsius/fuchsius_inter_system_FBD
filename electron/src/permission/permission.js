const consentStatus = document.getElementById('consentStatus');
const accessStatus = document.getElementById('accessStatus');
const overallStatus = document.getElementById('overallStatus');
const summaryText = document.getElementById('summaryText');
const continueButton = document.getElementById('continueButton');
const consentButton = document.getElementById('consentButton');
const openAccessibility = document.getElementById('openAccessibility');
const refreshAccessibility = document.getElementById('refreshAccessibility');
const macBlock = document.getElementById('macBlock');
const linuxInfo = document.getElementById('linuxInfo');

const STATUS_COPY = {
  pending: 'Waiting for required permissions…',
  ready: 'All set! Launch the tracker.',
  wayland: 'Tracking unavailable on Wayland. Switch to an X11 session.'
};

function setStatus(element, state) {
  if (!element) return;
  element.classList.remove('pending', 'success', 'error');
  element.classList.add(state);
}

function updateUi(state) {
  if (consentStatus) {
    consentStatus.classList.toggle('success', state.consentGranted);
    consentStatus.classList.toggle('pending', !state.consentGranted);
  }

  const macNeeds = state.linuxWayland
    ? false
    : window.navigator.platform.includes('Mac') && !state.accessibilityGranted;

  if (macBlock) {
    macBlock.style.display = window.navigator.platform.includes('Mac') ? 'flex' : 'none';
  }
  if (window.navigator.platform.includes('Mac') && accessStatus) {
    accessStatus.classList.toggle('success', state.accessibilityGranted);
    accessStatus.classList.toggle('pending', !state.accessibilityGranted);
  }

  if (linuxInfo) {
    linuxInfo.classList.toggle('visible', state.linuxWayland);
  }

  const ready =
    state.consentGranted &&
    !state.linuxWayland &&
    (window.navigator.platform.includes('Mac') ? state.accessibilityGranted : true);

  setStatus(overallStatus, ready ? 'success' : 'pending');
  if (summaryText) {
    summaryText.textContent = ready ? STATUS_COPY.ready : state.linuxWayland ? STATUS_COPY.wayland : STATUS_COPY.pending;
  }
  if (continueButton) {
    continueButton.disabled = !ready;
  }
}

async function init() {
  const bridge = window.permissionBridge;
  const state = await bridge.getState();
  updateUi(state);

  bridge.onStateUpdate((payload) => {
    updateUi(payload);
  });

  consentButton?.addEventListener('click', () => bridge.updateConsent(true));
  continueButton?.addEventListener('click', () => bridge.showWindow());
  openAccessibility?.addEventListener('click', () => bridge.openAccessibilitySettings());
  refreshAccessibility?.addEventListener('click', () => bridge.requestAccessibility());
}

init();
