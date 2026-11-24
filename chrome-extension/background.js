// ============================================================================
// VYBE Manifest V3 Service Worker (background.js) — Netflix-Only
//
// Coordinates playback synchronization between Netflix tabs and VYBE Rooms.
// Hardened against MV3 service-worker suspensions: session state is
// persisted to chrome.storage.local and re-requested from Netflix tabs
// after a restart.
// ============================================================================

const DEFAULT_SESSION_STATE = {
  vybeBaseUrl: 'https://vybe.nooryoosuf.com',
  roomCode: 'NFX-808',
  connected: true,
  lastWatchId: null,
  isPlaying: false,
  currentTime: 0,
  isBuffering: false,
  pageType: 'idle',
};

// Target URL match patterns — never message unrelated websites.
const TARGET_URL_PATTERNS = [
  '*://*.netflix.com/*',
  'https://vybe.nooryoosuf.com/*',
  'http://localhost:*/*',
  'http://127.0.0.1:*/*',
  'https://*.pages.dev/*',
  'https://*.workers.dev/*',
];

const NETFLIX_TAB_PATTERNS = ['*://*.netflix.com/*'];

/**
 * Get session state from chrome.storage.local, initializing with defaults if missing.
 */
async function getSessionState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['vybeSession'], (result) => {
      let state = { ...DEFAULT_SESSION_STATE };
      if (result && result.vybeSession) {
        state = { ...DEFAULT_SESSION_STATE, ...result.vybeSession };
      }
      // Migrate any stale localhost:3100 stored during earlier testing
      if (!state.vybeBaseUrl || state.vybeBaseUrl.includes('localhost:3100')) {
        state.vybeBaseUrl = 'https://vybe.nooryoosuf.com';
        chrome.storage.local.set({ vybeSession: state });
      } else if (!result || !result.vybeSession) {
        chrome.storage.local.set({ vybeSession: state });
      }
      resolve(state);
    });
  });
}

/**
 * Save updated session state to chrome.storage.local.
 */
async function saveSessionState(state) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ vybeSession: state }, () => {
      resolve();
    });
  });
}

/**
 * Hydrate session state from storage when the worker (re)starts.
 */
async function hydrateSessionStateFromStorage() {
  const saved = await new Promise((resolve) => {
    chrome.storage.local.get(['vybeSession'], (result) => {
      resolve(result && result.vybeSession);
    });
  });
  if (saved) {
    await saveSessionState({ ...DEFAULT_SESSION_STATE, ...saved });
  }
}

/**
 * Ask Netflix tabs to push their current state to us (worker-restart recovery).
 */
function reRequestStateFromNetflixTabs() {
  chrome.tabs.query({ url: NETFLIX_TAB_PATTERNS }, (tabs) => {
    if (!tabs) return;
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        const p = chrome.tabs.sendMessage(tab.id, { type: 'GET_EXTENSION_STATE' }, () => {
          if (chrome.runtime.lastError) {
            // Content script not loaded or tab closed
          }
        });
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch {
        // Ignore frames where the content script is not injected
      }
    }
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await saveSessionState(DEFAULT_SESSION_STATE);
  reRequestStateFromNetflixTabs();
});

chrome.runtime.onStartup.addListener(async () => {
  // Worker was suspended or the browser restarted — restore session + re-sync.
  await hydrateSessionStateFromStorage();
  reRequestStateFromNetflixTabs();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  (async () => {
    const sessionState = await getSessionState();

    if (message.type === 'GET_EXTENSION_STATE') {
      sendResponse({ state: sessionState });
      return;
    }

    if (message.type === 'SET_ROOM_CONFIG') {
      sessionState.roomCode = (message.roomCode || 'NFX-808').toUpperCase();
      if (message.vybeBaseUrl) {
        sessionState.vybeBaseUrl = message.vybeBaseUrl;
      }
      sessionState.connected = true;
      await saveSessionState(sessionState);

      broadcastToTargetTabs({
        source: 'VYBE_NETFLIX_EXTENSION',
        type: 'CONFIG_UPDATED',
        state: sessionState,
      });

      sendResponse({ ok: true, state: sessionState });
      return;
    }

    // Telemetry heartbeat from Netflix Content Script
    if (message.type === 'NETFLIX_TAB_HEARTBEAT') {
      sessionState.pageType = message.pageType || 'watch';
      sessionState.lastWatchId = message.watchId || sessionState.lastWatchId;
      sessionState.isPlaying = Boolean(message.isPlaying);
      sessionState.isBuffering = Boolean(message.isBuffering);
      sessionState.currentTime = Number(message.currentTime || 0);
      await saveSessionState(sessionState);

      // Forward heartbeat only to VYBE Web App tabs
      broadcastToTargetTabs({
        source: 'VYBE_NETFLIX_EXTENSION',
        type: 'EXTENSION_HEARTBEAT',
        roomCode: sessionState.roomCode,
        pageType: sessionState.pageType,
        watchId: sessionState.lastWatchId,
        isPlaying: sessionState.isPlaying,
        isBuffering: sessionState.isBuffering,
        currentTime: sessionState.currentTime,
      });

      sendResponse({ ok: true });
      return;
    }

    // User triggered play/pause/seek inside Netflix player
    if (message.type === 'NETFLIX_LOCAL_ACTION') {
      sessionState.isPlaying = Boolean(message.isPlaying);
      sessionState.currentTime = Number(message.currentTime || 0);
      sessionState.lastWatchId = message.watchId || sessionState.lastWatchId;
      await saveSessionState(sessionState);

      broadcastToTargetTabs({
        source: 'VYBE_NETFLIX_EXTENSION',
        type: 'NETFLIX_PLAYBACK_EVENT',
        roomCode: sessionState.roomCode,
        watchId: sessionState.lastWatchId,
        isPlaying: sessionState.isPlaying,
        currentTime: sessionState.currentTime,
      });

      // Also publish directly to the VYBE Server Realtime API
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
              videoId: String(sessionState.lastWatchId || '81446667'),
              videoTitle: `Netflix Title #${sessionState.lastWatchId || '81446667'}`,
              netflixWatchId: String(sessionState.lastWatchId || '81446667'),
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
      return;
    }

    // Authoritative sync command from VYBE Web App -> forward to Netflix tab
    if (message.type === 'APPLY_REMOTE_SYNC') {
      if (message.roomCode) {
        sessionState.roomCode = String(message.roomCode).toUpperCase();
        await saveSessionState(sessionState);
      }
      broadcastToTargetTabs({
        source: 'VYBE_NETFLIX_EXTENSION',
        type: 'APPLY_TO_NETFLIX_VIDEO',
        roomCode: sessionState.roomCode,
        watchId: message.watchId,
        isPlaying: message.isPlaying,
        currentTime: message.currentTime,
      });
      sendResponse({ ok: true });
      return;
    }
  })();

  return true; // Keep channel open for async response
});

/**
 * Broadcast payload only to matching tabs to eliminate console noise and security leakages.
 */
function broadcastToTargetTabs(payload) {
  chrome.tabs.query({ url: TARGET_URL_PATTERNS }, (tabs) => {
    if (!tabs || !tabs.length) return;
    for (const tab of tabs) {
      if (tab.id) {
        try {
          const p = chrome.tabs.sendMessage(tab.id, payload, () => {
            if (chrome.runtime.lastError) {
              // Frame without content script
            }
          });
          if (p && typeof p.catch === 'function') {
            p.catch(() => {});
          }
        } catch {
          // Tab or extension context error
        }
      }
    }
  });
}
