document.addEventListener('DOMContentLoaded', () => {
  const roomInput = document.getElementById('roomCode');
  const urlInput = document.getElementById('baseUrl');
  const connectBtn = document.getElementById('connectBtn');
  const telemetry = document.getElementById('telemetry');

  chrome.runtime.sendMessage({ type: 'GET_EXTENSION_STATE' }, (res) => {
    if (res && res.state) {
      roomInput.value = res.state.roomCode || 'NFX-808';
      urlInput.value = res.state.vybeBaseUrl || 'http://localhost:3000';
      if (res.state.lastWatchId) {
        telemetry.textContent = `Detected Netflix Watch ID #${res.state.lastWatchId} @ ${Math.floor(
          res.state.currentTime || 0
        )}s`;
      }
    }
  });

  connectBtn.addEventListener('click', () => {
    const roomCode = roomInput.value.trim().toUpperCase() || 'NFX-808';
    const vybeBaseUrl = urlInput.value.trim() || 'http://localhost:3000';

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
