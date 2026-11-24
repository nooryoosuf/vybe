document.addEventListener('DOMContentLoaded', () => {
  const roomInput = document.getElementById('roomCode');
  const urlInput = document.getElementById('baseUrl');
  const connectBtn = document.getElementById('connectBtn');
  const telemetry = document.getElementById('telemetry');

  chrome.runtime.sendMessage({ type: 'GET_EXTENSION_STATE' }, (res) => {
    if (res && res.state) {
      roomInput.value = res.state.roomCode || 'VYB-4K1';
      urlInput.value = res.state.vybeBaseUrl || 'https://vybe.nooryoosuf.com';
      if (res.state.lastWatchId) {
        telemetry.textContent = `Detected Netflix Watch ID #${res.state.lastWatchId} @ ${Math.floor(
          res.state.currentTime || 0
        )}s`;
      }
    }
  });

  connectBtn.addEventListener('click', () => {
    const roomCode = roomInput.value.trim().toUpperCase() || 'VYB-4K1';
    const vybeBaseUrl = urlInput.value.trim() || 'https://vybe.nooryoosuf.com';

    chrome.runtime.sendMessage(
      {
        type: 'SET_ROOM_CONFIG',
        roomCode,
        vybeBaseUrl,
      },
      () => {
        telemetry.textContent = `Synchronized with VYBE Room ${roomCode}.`;
      }
    );
  });
});
