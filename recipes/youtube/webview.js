const path = require('node:path');

module.exports = Ferdium => {
  // 1. Inject styling for banner and promotional ad hiding
  Ferdium.injectCSS(path.join(__dirname, 'service.css'));

  // 2. Notification badge updater
  const getMessages = () => {
    try {
      const badge = document.querySelector(
        '#notification-button ytd-notification-topbar-button-renderer .yt-spec-icon-badge-shape__badge',
      );
      if (badge) {
        const count = Number.parseInt(badge.textContent.trim(), 10) || 0;
        Ferdium.setBadge(count, 0);
      } else {
        Ferdium.setBadge(0, 0);
      }
    } catch {
      Ferdium.setBadge(0, 0);
    }
  };
  Ferdium.loop(getMessages);

  // 3. Instant In-Player Ad Skipper
  // When an ad appears, fast-forward it at max speed and click skip immediately
  const skipSelectors = [
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-ad-skip-button-slot button',
    'button.ytp-ad-skip-button-modern',
    '.ytp-ad-overlay-close-button',
  ];

  const handleAds = () => {
    const player = document.querySelector('#movie_player, .html5-video-player');
    const isAdShowing =
      player &&
      (player.classList.contains('ad-showing') ||
        player.classList.contains('ad-interrupting'));

    if (isAdShowing) {
      // Click any visible skip button right away
      for (const selector of skipSelectors) {
        const btn = document.querySelector(selector);
        if (btn) {
          try {
            btn.click();
          } catch {
            // Ignore click error
          }
        }
      }

      // Find the active video element
      const video =
        document.querySelector('video.html5-main-video') ||
        document.querySelector('video');
      if (video) {
        try {
          video.muted = true;
          // Set to 16x speed so any 5-second countdown finishes in < 0.3 seconds
          video.playbackRate = 16;
          // Jump right to the end of the ad segment
          if (Number.isFinite(video.duration) && video.duration > 0.1) {
            video.currentTime = video.duration - 0.05;
          }
        } catch {
          // Ignore playback modification error
        }
      }
    }

    // Dismiss any anti-adblock modal
    const dialog = document.querySelector(
      'ytd-enforcement-message-view-model, tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)',
    );
    if (dialog) {
      const dismiss = dialog.querySelector(
        '#dismiss-button, button[aria-label="Dismiss"], button[aria-label="Close"]',
      );
      if (dismiss) {
        try {
          dismiss.click();
        } catch {
          // Ignore dismissal error
        }
      } else {
        try {
          dialog.remove();
          for (const b of document.querySelectorAll(
            'tp-yt-iron-overlay-backdrop',
          ))
            b.remove();
        } catch {
          // Ignore element removal error
        }
      }

      const video =
        document.querySelector('video.html5-main-video') ||
        document.querySelector('video');
      if (video && video.paused) {
        try {
          video.play();
        } catch {
          // Ignore video play error
        }
      }
    }
  };

  // Run at 100ms interval for near-instant response
  setInterval(handleAds, 100);

  // Keyboard shortcut: Alt+P toggles Picture-in-Picture
  document.addEventListener('keydown', event => {
    if (event.altKey && (event.key === 'p' || event.key === 'P')) {
      const video =
        document.querySelector('video.html5-main-video') ||
        document.querySelector('video');
      if (video) {
        event.preventDefault();
        try {
          if (document.pictureInPictureElement) {
            document.exitPictureInPicture();
          } else if (document.pictureInPictureEnabled) {
            video.requestPictureInPicture();
          }
        } catch {
          // Ignore PiP toggle error
        }
      }
    }
  });
};
