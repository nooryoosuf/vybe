// ============================================================================
// VYBE Content Script for Netflix (content-netflix.js)
// Detects Netflix HTML5 <video> playback timestamps on supported /watch/* pages
// and synchronizes play, pause, and seek commands without bypassing DRM.
// ============================================================================

(function () {
  let isApplyingRemoteSync = false;
  let remoteGuardTimeout = null;
  let boundVideoElement = null;
  let activeRoomCode = 'NFX-808';

  // Extract ?vybeRoom=CODE if launched from VYBE Companion Deck
  try {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('vybeRoom');
    if (roomParam) {
      activeRoomCode = roomParam.toUpperCase();
      chrome.runtime.sendMessage({
        type: 'SET_ROOM_CONFIG',
        roomCode: activeRoomCode,
      });
    }
  } catch {
    // Ignore
  }

  function lockRemoteSync(ms = 900) {
    isApplyingRemoteSync = true;
    if (remoteGuardTimeout) clearTimeout(remoteGuardTimeout);
    remoteGuardTimeout = setTimeout(() => {
      isApplyingRemoteSync = false;
    }, ms);
  }

  function detectNetflixPageInfo() {
    const path = window.location.pathname || '';
    const match = path.match(/\/watch\/(\d+)/);
    if (match && match[1]) {
      return { pageType: 'watch', watchId: match[1] };
    }
    return { pageType: 'unsupported', watchId: null };
  }

  function bindToVideoElement() {
    const video = document.querySelector('video');
    if (!video || video === boundVideoElement) return video;

    boundVideoElement = video;

    video.addEventListener('play', () => {
      if (isApplyingRemoteSync) return;
      const info = detectNetflixPageInfo();
      if (info.pageType !== 'watch') return;
      chrome.runtime.sendMessage({
        type: 'NETFLIX_LOCAL_ACTION',
        watchId: info.watchId,
        isPlaying: true,
        currentTime: video.currentTime,
      });
    });

    video.addEventListener('pause', () => {
      if (isApplyingRemoteSync) return;
      const info = detectNetflixPageInfo();
      if (info.pageType !== 'watch') return;
      chrome.runtime.sendMessage({
        type: 'NETFLIX_LOCAL_ACTION',
        watchId: info.watchId,
        isPlaying: false,
        currentTime: video.currentTime,
      });
    });

    video.addEventListener('seeked', () => {
      if (isApplyingRemoteSync) return;
      const info = detectNetflixPageInfo();
      if (info.pageType !== 'watch') return;
      chrome.runtime.sendMessage({
        type: 'NETFLIX_LOCAL_ACTION',
        watchId: info.watchId,
        isPlaying: !video.paused,
        currentTime: video.currentTime,
      });
    });

    return video;
  }

  // Apply incoming authoritative sync command from VYBE room
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== 'APPLY_TO_NETFLIX_VIDEO') return;
    const video = bindToVideoElement();
    if (!video) return;

    lockRemoteSync(1000);
    const targetTime = Number(msg.currentTime || 0);
    if (Math.abs(video.currentTime - targetTime) > 1.8) {
      video.currentTime = targetTime;
    }
    if (msg.isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!msg.isPlaying && !video.paused) {
      video.pause();
    }
    updateStatusBadge(
      `VYBE ${activeRoomCode} • ${msg.isPlaying ? 'Synced Playing' : 'Synced Paused'}`
    );
  });

  // Periodic heartbeat to report Netflix page state and timestamp
  setInterval(() => {
    const info = detectNetflixPageInfo();
    const video = bindToVideoElement();
    chrome.runtime.sendMessage({
      type: 'NETFLIX_TAB_HEARTBEAT',
      pageType: info.pageType,
      watchId: info.watchId,
      isPlaying: video ? !video.paused : false,
      currentTime: video ? video.currentTime : 0,
    });
  }, 1500);

  // Inject non-intrusive VYBE Status Pill on Netflix watch pages
  let badgeEl = null;
  function updateStatusBadge(text) {
    if (!badgeEl) {
      badgeEl = document.createElement('div');
      badgeEl.style.cssText =
        'position:fixed;top:16px;right:16px;z-index:999999;background:rgba(13,15,24,0.92);color:#fff;border:1px solid rgba(109,93,251,0.5);border-radius:12px;padding:6px 12px;font-family:system-ui,sans-serif;font-size:12px;font-weight:600;box-shadow:0 10px 25px rgba(0,0,0,0.6);pointer-events:none;';
      document.body.appendChild(badgeEl);
    }
    badgeEl.textContent = text;
  }
})();
