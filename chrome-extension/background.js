// ============================================================================
// VYBE Manifest V3 Service Worker (background.js)
// Coordinates playback synchronization between Netflix tabs and VYBE Rooms
// ============================================================================

let sessionState = {
  vybeBaseUrl: 'http://localhost:3000',
  roomCode: 'NFX-808',
  connected: true,
  lastWatchId: null,
  isPlaying: false,
  currentTime: 0,
  pageType: 'idle',
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ vybeSession: sessionState });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === 'GET_EXTENSION_STATE') {
    sendResponse({ state: sessionState });
    return true;
  }

  if (message.type === 'SET_ROOM_CONFIG') {
    sessionState.roomCode = (message.roomCode || 'NFX-808').toUpperCase();
    if (message.vybeBaseUrl) {
      sessionState.vybeBaseUrl = message.vybeBaseUrl;
    }
    sessionState.connected = true;
    chrome.storage.local.set({ vybeSession: sessionState });
    broadcastToAllTabs({
      source: 'VYBE_NETFLIX_EXTENSION',
      type: 'CONFIG_UPDATED',
      state: sessionState,
    });
    sendResponse({ ok: true, state: sessionState });
    return true;
  }

  // Telemetry heartbeat from Netflix Content Script
  if (message.type === 'NETFLIX_TAB_HEARTBEAT') {
    sessionState.pageType = message.pageType;
    sessionState.lastWatchId = message.watchId || null;
    sessionState.isPlaying = Boolean(message.isPlaying);
    sessionState.currentTime = Number(message.currentTime || 0);

    // Forward heartbeat to any open VYBE Web App tab
    broadcastToAllTabs({
      source: 'VYBE_NETFLIX_EXTENSION',
      type: 'EXTENSION_HEARTBEAT',
      roomCode: sessionState.roomCode,
      pageType: sessionState.pageType,
      watchId: sessionState.lastWatchId,
      isPlaying: sessionState.isPlaying,
      currentTime: sessionState.currentTime,
    });
    sendResponse({ ok: true });
    return true;
  }

  // User triggered play/pause/seek inside Netflix player
  if (message.type === 'NETFLIX_LOCAL_ACTION') {
    sessionState.isPlaying = Boolean(message.isPlaying);
    sessionState.currentTime = Number(message.currentTime || 0);
    sessionState.lastWatchId = message.watchId || sessionState.lastWatchId;

    broadcastToAllTabs({
      source: 'VYBE_NETFLIX_EXTENSION',
      type: 'NETFLIX_PLAYBACK_EVENT',
      roomCode: sessionState.roomCode,
      watchId: sessionState.lastWatchId,
      isPlaying: sessionState.isPlaying,
      currentTime: sessionState.currentTime,
    });

    // Also publish directly to VYBE Server Realtime API
    fetch(`${sessionState.vybeBaseUrl}/api/realtime/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: `room:${sessionState.roomCode}`,
        event: {
          type: 'PLAYBACK_SYNC',
          roomCode: sessionState.roomCode,
          senderId: 'netflix-extension',
          playback: {
            roomId: `room-${sessionState.roomCode.toLowerCase()}`,
            platform: 'netflix',
            videoId: String(sessionState.lastWatchId || '80057281'),
            videoTitle: `Netflix Title #${sessionState.lastWatchId || '80057281'}`,
            netflixWatchId: String(sessionState.lastWatchId || '80057281'),
            isPlaying: sessionState.isPlaying,
            currentTime: sessionState.currentTime,
            playbackRate: 1,
            seq: Date.now(),
            updatedBy: 'netflix-extension',
            updatedByName: 'Netflix Extension',
            updatedAt: Date.now(),
          },
        },
      }),
    }).catch(() => {});

    sendResponse({ ok: true });
    return true;
  }

  // Authoritative sync command coming from VYBE Web App -> forward to Netflix tab
  if (message.type === 'APPLY_REMOTE_SYNC') {
    if (message.roomCode) {
      sessionState.roomCode = String(message.roomCode).toUpperCase();
    }
    broadcastToAllTabs({
      source: 'VYBE_NETFLIX_EXTENSION',
      type: 'APPLY_TO_NETFLIX_VIDEO',
      roomCode: sessionState.roomCode,
      watchId: message.watchId,
      isPlaying: message.isPlaying,
      currentTime: message.currentTime,
    });
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

function broadcastToAllTabs(payload) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, payload).catch(() => {});
      }
    }
  });
}
