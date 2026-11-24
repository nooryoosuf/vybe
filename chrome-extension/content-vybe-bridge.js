// ============================================================================
// VYBE Web App Bridge Content Script (content-vybe-bridge.js)
// Bridges window.postMessage between the VYBE Web App and the Chrome Extension
// ============================================================================

(function () {
  function safeSendMessage(payload, callback) {
    try {
      if (!chrome.runtime || !chrome.runtime.id) return;
      const res = chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          // Worker suspended, sleeping, or reloading — silently swallow
          return;
        }
        if (typeof callback === 'function') {
          callback(response);
        }
      });
      if (res && typeof res.catch === 'function') {
        res.catch(() => {
          // Swallow "Receiving end does not exist" when background worker is suspended
        });
      }
    } catch {
      // Extension context invalidated during browser extension reload
    }
  }

  // Listen for messages from VYBE Web App page
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.source !== 'VYBE_WEB_APP') return;

    if (event.data.type === 'VYBE_ROOM_INIT') {
      safeSendMessage({
        type: 'SET_ROOM_CONFIG',
        roomCode: event.data.roomCode,
        vybeBaseUrl: event.data.vybeBaseUrl || window.location.origin,
      });
    } else if (event.data.type === 'APPLY_REMOTE_SYNC') {
      safeSendMessage({
        type: 'APPLY_REMOTE_SYNC',
        roomCode: event.data.roomCode,
        watchId: event.data.watchId,
        isPlaying: event.data.isPlaying,
        currentTime: event.data.currentTime,
      });
    }
  });

  // Forward messages from background service worker to VYBE Web App
  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.source === 'VYBE_NETFLIX_EXTENSION') {
        window.postMessage(message, '*');
        if (typeof sendResponse === 'function') {
          sendResponse({ received: true });
        }
      }
    });
  } catch {
    // Ignore
  }
})();
