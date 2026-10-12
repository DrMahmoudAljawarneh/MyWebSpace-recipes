const path = require('node:path');

module.exports = Ferdium => {
  // 1. Inject styling for banner and promotional ad hiding
  Ferdium.injectCSS(path.join(__dirname, 'service.css'));

  // 2. Inject main-world adblocker & player controller
  // This prunes adPlacements from YouTube's playerResponse and hooks the movie_player API
  Ferdium.injectJSUnsafe(path.join(__dirname, 'webview-unsafe.js'));

  // 3. Notification badge updater
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

  // 4. Keyboard shortcut: Alt+P toggles Picture-in-Picture
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
