document.addEventListener('DOMContentLoaded', () => {
  const roomInput = document.getElementById('roomCode');
  const urlInput = document.getElementById('baseUrl');
  const connectBtn = document.getElementById('connectBtn');
  const telemetry = document.getElementById('telemetry');

  function safeSendMessage(payload, callback) {
    try {
      if (!chrome.runtime || !chrome.runtime.id) return;
      const res = chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) return;
        if (typeof callback === 'function') callback(response);
      });
      if (res && typeof res.catch === 'function') {
        res.catch(() => {});
      }
    } catch {
      // Ignore
    }
  }

  safeSendMessage({ type: 'GET_EXTENSION_STATE' }, (res) => {
    if (res && res.state) {
      roomInput.value = res.state.roomCode || 'NFX-808';
      urlInput.value = res.state.vybeBaseUrl || 'https://vybe.nooryoosuf.com';
      if (res.state.lastWatchId) {
        telemetry.textContent = `Detected Netflix Watch ID #${res.state.lastWatchId} @ ${Math.floor(
          res.state.currentTime || 0
        )}s`;
      }
    }
  });

  connectBtn.addEventListener('click', () => {
    const roomCode = roomInput.value.trim().toUpperCase() || 'NFX-808';
    const vybeBaseUrl = urlInput.value.trim() || 'https://vybe.nooryoosuf.com';

    safeSendMessage(
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
