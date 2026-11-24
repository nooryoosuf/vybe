// ============================================================================
// VYBE Web App Bridge Content Script (content-vybe-bridge.js)
// Bridges window.postMessage between the VYBE Web App and the Chrome Extension
// ============================================================================

(function () {
  // Listen for messages from VYBE Web App page
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.source !== 'VYBE_WEB_APP') return;

    if (event.data.type === 'VYBE_ROOM_INIT') {
      chrome.runtime.sendMessage({
        type: 'SET_ROOM_CONFIG',
        roomCode: event.data.roomCode,
        vybeBaseUrl: event.data.vybeBaseUrl || window.location.origin,
      });
    } else if (event.data.type === 'APPLY_REMOTE_SYNC') {
      chrome.runtime.sendMessage({
        type: 'APPLY_REMOTE_SYNC',
        roomCode: event.data.roomCode,
        watchId: event.data.watchId,
        isPlaying: event.data.isPlaying,
        currentTime: event.data.currentTime,
      });
    }
  });

  // Forward messages from background service worker to VYBE Web App
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.source === 'VYBE_NETFLIX_EXTENSION') {
      window.postMessage(message, '*');
    }
  });
})();
