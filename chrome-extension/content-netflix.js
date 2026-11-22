// ============================================================================
// VYBE Teleparty-Style Content Script for Netflix (content-netflix.js)
// 1. Detects Netflix HTML5 <video> playback timestamps on /watch/* pages.
// 2. Synchronizes play, pause, and seek commands across the VYBE room.
// 3. Employs MutationObserver for resilient video element tracking.
// 4. Injects a Teleparty-style collapsible VYBE Watch Party dock & sidebar
//    directly onto netflix.com so users can host, invite, chat, and react.
// ============================================================================

(function () {
  let isApplyingRemoteSync = false;
  let remoteGuardTimeout = null;
  let boundVideoElement = null;
  let activeRoomCode = 'VYB-4K1';
  let vybeBaseUrl = 'https://vybe.nooryoosuf.com';
  let sidebarOpen = false;

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

  chrome.runtime.sendMessage({ type: 'GET_EXTENSION_STATE' }, (res) => {
    if (res && res.state) {
      if (res.state.roomCode) activeRoomCode = res.state.roomCode;
      if (res.state.vybeBaseUrl) vybeBaseUrl = res.state.vybeBaseUrl;
      ensureOverlayDock();
    }
  });

  function lockRemoteSync(ms = 1100) {
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

    const handlePlay = () => {
      if (isApplyingRemoteSync) return;
      const info = detectNetflixPageInfo();
      if (info.pageType !== 'watch') return;
      chrome.runtime.sendMessage({
        type: 'NETFLIX_LOCAL_ACTION',
        watchId: info.watchId,
        isPlaying: true,
        currentTime: video.currentTime,
      });
    };

    const handlePause = () => {
      if (isApplyingRemoteSync) return;
      const info = detectNetflixPageInfo();
      if (info.pageType !== 'watch') return;
      chrome.runtime.sendMessage({
        type: 'NETFLIX_LOCAL_ACTION',
        watchId: info.watchId,
        isPlaying: false,
        currentTime: video.currentTime,
      });
    };

    const handleSeeked = () => {
      if (isApplyingRemoteSync) return;
      const info = detectNetflixPageInfo();
      if (info.pageType !== 'watch') return;
      chrome.runtime.sendMessage({
        type: 'NETFLIX_LOCAL_ACTION',
        watchId: info.watchId,
        isPlaying: !video.paused,
        currentTime: video.currentTime,
      });
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeked', handleSeeked);

    return video;
  }

  // MutationObserver to detect when Netflix remounts the video element
  const observer = new MutationObserver(() => {
    bindToVideoElement();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== 'APPLY_TO_NETFLIX_VIDEO') return;
    const video = bindToVideoElement();
    if (!video) return;

    lockRemoteSync(1200);
    const targetTime = Number(msg.currentTime || 0);

    // Apply seek if drift exceeds threshold
    if (Math.abs(video.currentTime - targetTime) > 1.5) {
      video.currentTime = targetTime;
    }

    if (msg.isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!msg.isPlaying && !video.paused) {
      video.pause();
    }
  });

  // Regular telemetry heartbeat
  setInterval(() => {
    const info = detectNetflixPageInfo();
    const video = bindToVideoElement();
    ensureOverlayDock();
    chrome.runtime.sendMessage({
      type: 'NETFLIX_TAB_HEARTBEAT',
      pageType: info.pageType,
      watchId: info.watchId,
      isPlaying: video ? !video.paused : false,
      currentTime: video ? video.currentTime : 0,
    });
  }, 2000);

  // Floating dock & sidebar UI
  let rootDock = null;
  let sidebarFrame = null;

  function ensureOverlayDock() {
    if (rootDock) return;

    rootDock = document.createElement('div');
    rootDock.style.cssText =
      'position:fixed;top:16px;right:18px;z-index:2147483647;display:flex;align-items:center;gap:8px;background:rgba(13,15,24,0.92);backdrop-filter:blur(18px);color:#fff;border:1px solid rgba(255,255,255,0.16);border-radius:999px;padding:6px 14px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:700;box-shadow:0 12px 32px rgba(0,0,0,0.65);';

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
      const url = `${vybeBaseUrl}/room/${activeRoomCode}`;
      navigator.clipboard.writeText(url).catch(() => {});
      inviteBtn.textContent = 'Copied Link!';
      setTimeout(() => {
        inviteBtn.textContent = 'Copy Invite';
      }, 2000);
    };

    const toggleSidebarBtn = document.createElement('button');
    toggleSidebarBtn.textContent = 'Open Party Chat';
    toggleSidebarBtn.style.cssText =
      'background:linear-gradient(90deg,#6D5DFB,#7C3AED);color:#fff;border:none;border-radius:999px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;';
    toggleSidebarBtn.onclick = () => {
      sidebarOpen = !sidebarOpen;
      if (sidebarOpen) {
        toggleSidebarBtn.textContent = 'Hide Chat';
        openSidebarIframe();
      } else {
        toggleSidebarBtn.textContent = 'Open Party Chat';
        if (sidebarFrame) {
          sidebarFrame.remove();
          sidebarFrame = null;
        }
      }
    };

    rootDock.appendChild(statusDot);
    rootDock.appendChild(label);
    rootDock.appendChild(inviteBtn);
    rootDock.appendChild(toggleSidebarBtn);
    document.body.appendChild(rootDock);
  }

  function openSidebarIframe() {
    if (sidebarFrame) return;
    sidebarFrame = document.createElement('iframe');
    sidebarFrame.src = `${vybeBaseUrl}/room/${activeRoomCode}`;
    sidebarFrame.style.cssText =
      'position:fixed;top:0;right:0;bottom:0;width:390px;height:100vh;z-index:2147483646;border:none;border-left:1px solid rgba(255,255,255,0.14);background:#07080D;box-shadow:-16px 0 40px rgba(0,0,0,0.8);';
    document.body.appendChild(sidebarFrame);
  }
})();
