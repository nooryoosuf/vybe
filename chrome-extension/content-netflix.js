// ============================================================================
// VYBE Netflix Content Script (content-netflix.js) — Netflix-Only
//
// Detects Netflix playback on netflix.com/watch/* pages, reports heartbeats
// (position, playing state, buffering), and executes authorized remote
// play/pause/seek commands from VYBE rooms via APPLY_TO_NETFLIX_VIDEO.
//
// Title detection uses the /watch/{id} URL segment as the canonical title
// reference. Commands targeting a different title are rejected.
// ============================================================================

(function () {
  let isApplyingRemoteSync = false;
  let remoteGuardTimeout = null;
  let boundVideoElement = null;
  let activeRoomCode = 'VYB-4K1';
  let vybeBaseUrl = 'https://vybe.nooryoosuf.com';
  let sidebarOpen = false;
  let lastReported = '';

  function safeSendMessage(payload, callback) {
    try {
      if (!chrome.runtime || !chrome.runtime.id) return;
      const res = chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          // Worker sleeping or tab transitioning
          return;
        }
        if (typeof callback === 'function') {
          callback(response);
        }
      });
      if (res && typeof res.catch === 'function') {
        res.catch(() => {});
      }
    } catch {
      // Extension context invalidated during reload
    }
  }

  // ==========================================================================
  // Netflix playback detection
  // ==========================================================================

  function detectNetflixPageInfo() {
    const path = window.location.pathname || '';
    const match = path.match(/\/watch\/(\d+)/);
    if (match && match[1]) {
      return { pageType: 'watch', watchId: match[1] };
    }
    return { pageType: 'unsupported', watchId: null };
  }

  function getVideo() {
    return document.querySelector('video');
  }

  function isBufferingActive(video) {
    if (!video) return false;
    // Not enough data yet, or waiting on data while playing
    if (video.readyState < 2) return true;
    if (video.readyState < 3 && !video.paused) return true;
    // Paused with buffered data available — not buffering.
    if (video.paused) return false;
    return false;
  }

  function lockRemoteSync(ms = 2000) {
    isApplyingRemoteSync = true;
    if (remoteGuardTimeout) clearTimeout(remoteGuardTimeout);
    remoteGuardTimeout = setTimeout(() => {
      isApplyingRemoteSync = false;
    }, ms);
  }

  function reportPlayback(video, force = false) {
    const info = detectNetflixPageInfo();
    const playing = video ? !video.paused : false;
    const cur = video ? Number(video.currentTime || 0) : 0;
    const isBuffering = isBufferingActive(video);
    const key = JSON.stringify([
      info.watchId,
      playing,
      Math.round(cur * 2),
      isBuffering,
      info.pageType,
    ]);
    if (!force && lastReported === key) return;
    lastReported = key;

    safeSendMessage({
      type: 'NETFLIX_TAB_HEARTBEAT',
      roomCode: activeRoomCode,
      pageType: info.pageType,
      watchId: info.watchId,
      isPlaying: playing,
      isBuffering,
      currentTime: cur,
      detectedAt: Date.now(),
    });
  }

  function bindToVideoElement() {
    const video = getVideo();
    if (!video || video === boundVideoElement) return video;
    boundVideoElement = video;

    const handleUserAction = (wantPlay) => {
      if (isApplyingRemoteSync) return;
      const info = detectNetflixPageInfo();
      if (info.pageType !== 'watch') return;
      safeSendMessage({
        type: 'NETFLIX_LOCAL_ACTION',
        roomCode: activeRoomCode,
        watchId: info.watchId,
        isPlaying: wantPlay,
        currentTime: video.currentTime,
      });
    };

    video.addEventListener('play', () => handleUserAction(true));
    video.addEventListener('pause', () => handleUserAction(false));
    video.addEventListener('seeked', () => reportPlayback(video, true));
    video.addEventListener('waiting', () => reportPlayback(video, true));
    video.addEventListener('stalled', () => reportPlayback(video, true));
    video.addEventListener('playing', () => reportPlayback(video));
    video.addEventListener('timeupdate', () => reportPlayback(video));

    return video;
  }

  // MutationObserver as an extra fast path (Netflix remounts the video on
  // route changes); the 2s poll covers anything else.
  const observer = new MutationObserver(() => {
    bindToVideoElement();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // 2-second poll: covers tab changes, Netflix SPA route changes, and
  // recovery after the background worker is suspended.
  setInterval(() => {
    const video = bindToVideoElement();
    reportPlayback(video);
    ensureOverlayDock();
  }, 2000);

  // ==========================================================================
  // Extension state recovery (service-worker restarts)
  // ==========================================================================

  let lastStateRequest = 0;

  function requestExtensionState() {
    const now = Date.now();
    if (now - lastStateRequest < 15000) return;
    lastStateRequest = now;
    safeSendMessage({ type: 'GET_EXTENSION_STATE' }, (res) => {
      if (!res || !res.state) return;
      if (res.state.roomCode) {
        const nextCode = String(res.state.roomCode).toUpperCase();
        if (nextCode !== activeRoomCode) {
          activeRoomCode = nextCode;
          // Broadcast the (re-)paired room so the web app sees CONFIG_UPDATED
          safeSendMessage({
            source: 'VYBE_NETFLIX_EXTENSION',
            type: 'CONFIG_UPDATED',
            roomCode: activeRoomCode,
          });
        }
      }
      if (res.state.vybeBaseUrl) vybeBaseUrl = res.state.vybeBaseUrl;
      reportPlayback(bindToVideoElement(), true);
    });
  }

  requestExtensionState();
  setInterval(requestExtensionState, 15000);

  // Honor the room code pushed by the web app (?vybeRoom=...)
  try {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('vybeRoom');
    if (roomParam) {
      activeRoomCode = roomParam.toUpperCase();
      safeSendMessage({
        type: 'SET_ROOM_CONFIG',
        roomCode: activeRoomCode,
      });
    }
  } catch {
    // ignore
  }

  safeSendMessage({ type: 'GET_EXTENSION_STATE' }, (res) => {
    if (res && res.state) {
      if (res.state.roomCode) activeRoomCode = String(res.state.roomCode).toUpperCase();
      if (res.state.vybeBaseUrl) vybeBaseUrl = res.state.vybeBaseUrl;
      ensureOverlayDock();
      reportPlayback(bindToVideoElement(), true);
    }
  });

  // ==========================================================================
  // Authorized remote playback commands — executed on the Netflix tab
  // ==========================================================================

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== 'APPLY_TO_NETFLIX_VIDEO') return;

    const video = bindToVideoElement();
    if (!video) return;

    // Different-title guard: a command targeting another title is rejected.
    const currentInfo = detectNetflixPageInfo();
    const commandedId = String(msg.watchId || '').toUpperCase();
    if (commandedId && currentInfo.watchId && commandedId !== currentInfo.watchId) {
      safeSendMessage({
        source: 'VYBE_NETFLIX_EXTENSION',
        type: 'CMD_REJECTED_TITLE_MISMATCH',
        roomCode: activeRoomCode,
        expectedWatchId: currentInfo.watchId,
        commandedWatchId: commandedId,
      });
      return;
    }

    lockRemoteSync(2000);
    const targetTime = Number(msg.currentTime || 0);
    if (Math.abs(video.currentTime - targetTime) > 1.5) {
      video.currentTime = targetTime;
    }
    if (msg.isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!msg.isPlaying && !video.paused) {
      video.pause();
    }
  });

  // ==========================================================================
  // Injected "VYBE • ROOM — Open Party Chat" dock on netflix.com
  // ==========================================================================

  const SIDEBAR_WIDTH = 360;
  const STYLE_ID = 'vybe-viewport-compactor';
  let rootDock = null;
  let toggleSidebarBtn = null;
  let sidebarFrame = null;

  function injectViewportStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.vybe-chat-open {
        width: calc(100vw - ${SIDEBAR_WIDTH}px) !important;
        margin-right: ${SIDEBAR_WIDTH}px !important;
        overflow-x: hidden !important;
        transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1), margin-right 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
      }
      body.vybe-chat-open #appMountPoint,
      body.vybe-chat-open .watch-video {
        width: 100% !important;
        max-width: 100% !important;
      }
      body.vybe-chat-open video {
        max-width: 100% !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureOverlayDock() {
    if (rootDock) return;

    rootDock = document.createElement('div');
    rootDock.id = 'vybe-netflix-pill-dock';
    rootDock.style.cssText =
      'position:fixed;top:16px;right:18px;z-index:2147483647;display:flex;align-items:center;gap:8px;background:rgba(13,15,24,0.94);backdrop-filter:blur(18px);color:#fff;border:1px solid rgba(255,255,255,0.16);border-radius:999px;padding:6px 14px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:700;box-shadow:0 12px 32px rgba(0,0,0,0.65);transition:right 0.28s cubic-bezier(0.16,1,0.3,1);user-select:none;';

    const statusDot = document.createElement('span');
    statusDot.style.cssText =
      'width:8px;height:8px;border-radius:999px;background:#10B981;display:inline-block;';

    const label = document.createElement('span');
    label.textContent = `VYBE • ${activeRoomCode}`;

    const inviteBtn = document.createElement('button');
    inviteBtn.textContent = 'Copy Invite';
    inviteBtn.style.cssText =
      'background:rgba(109,93,251,0.28);color:#fff;border:1px solid rgba(109,93,251,0.6);border-radius:999px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;';
    inviteBtn.onclick = () => {
      const url = `${getEffectiveVybeUrl()}/room/${activeRoomCode}`;
      navigator.clipboard.writeText(url).catch(() => {});
      inviteBtn.textContent = 'Copied Link!';
      setTimeout(() => {
        inviteBtn.textContent = 'Copy Invite';
      }, 2000);
    };

    toggleSidebarBtn = document.createElement('button');
    toggleSidebarBtn.textContent = 'Open Party Chat';
    toggleSidebarBtn.style.cssText =
      'background:linear-gradient(90deg,#6D5DFB,#7C3AED);color:#fff;border:none;border-radius:999px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;';
    toggleSidebarBtn.onclick = () => {
      sidebarOpen = !sidebarOpen;
      if (sidebarOpen) {
        openSidebarIframe();
      } else {
        closeSidebarIframe();
      }
    };

    rootDock.appendChild(statusDot);
    rootDock.appendChild(label);
    rootDock.appendChild(inviteBtn);
    rootDock.appendChild(toggleSidebarBtn);

    const container = document.fullscreenElement || document.body;
    container.appendChild(rootDock);
  }

  function getEffectiveVybeUrl() {
    if (!vybeBaseUrl || vybeBaseUrl.includes('localhost:3100')) {
      return 'https://vybe.nooryoosuf.com';
    }
    return vybeBaseUrl;
  }

  function openSidebarIframe() {
    if (sidebarFrame) return;
    sidebarOpen = true;
    if (toggleSidebarBtn) {
      toggleSidebarBtn.textContent = 'Hide Chat';
    }
    // Reposition pill smoothly to the left of the sidebar so it never obscures chat
    if (rootDock) {
      rootDock.style.right = `${SIDEBAR_WIDTH + 14}px`;
    }

    injectViewportStyles();
    document.body.classList.add('vybe-chat-open');

    const base = getEffectiveVybeUrl();
    sidebarFrame = document.createElement('iframe');
    sidebarFrame.id = 'vybe-party-sidebar-frame';
    sidebarFrame.src = `${base}/room/${activeRoomCode}?embed=chat`;
    sidebarFrame.title = 'VYBE Watch Party Live Chat';
    sidebarFrame.allow = 'autoplay; clipboard-write';
    sidebarFrame.style.cssText =
      `position:fixed;top:0;right:0;bottom:0;width:${SIDEBAR_WIDTH}px;height:100vh;z-index:2147483646;border:none;border-left:1px solid rgba(255,255,255,0.14);background:#07080D;box-shadow:-16px 0 40px rgba(0,0,0,0.8);transition:opacity 0.2s ease;`;

    const container = document.fullscreenElement || document.body;
    container.appendChild(sidebarFrame);

    // Notify Netflix video canvas to adaptively resize to the compacted screen width
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }

  function closeSidebarIframe() {
    sidebarOpen = false;
    if (toggleSidebarBtn) {
      toggleSidebarBtn.textContent = 'Open Party Chat';
    }
    // Return pill to top-right edge
    if (rootDock) {
      rootDock.style.right = '18px';
    }
    if (sidebarFrame) {
      sidebarFrame.remove();
      sidebarFrame = null;
    }
    document.body.classList.remove('vybe-chat-open');

    // Notify Netflix video canvas to restore full width
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }

  // Handle messages from the embedded chat iframe (e.g. clicking the 'X' button inside the chat header)
  window.addEventListener('message', (event) => {
    if (event.data && event.data.source === 'VYBE_EMBED_CHAT') {
      if (event.data.type === 'CLOSE_SIDEBAR') {
        closeSidebarIframe();
      }
    }
  });

  // Keep dock and sidebar visible even if user toggles HTML5 full-screen on Netflix
  document.addEventListener('fullscreenchange', () => {
    const container = document.fullscreenElement || document.body;
    if (rootDock && rootDock.parentElement !== container) {
      container.appendChild(rootDock);
    }
    if (sidebarFrame && sidebarFrame.parentElement !== container) {
      container.appendChild(sidebarFrame);
    }
    window.dispatchEvent(new Event('resize'));
  });
})();
