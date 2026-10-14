function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

const _path = _interopRequireDefault(require('path'));

const presenceLabels = {
  available: ['Available', 'Available'],
  dnd: ['Do not disturb', 'Busy'],
  invisible: ['Appear offline', 'Appear offline'],
};

const getProfileButton = () =>
  [...document.querySelectorAll('button')].find(b =>
    (b.getAttribute('aria-label') || '').startsWith('Your profile'),
  ) || null;

const getCurrentPresence = () =>
  getProfileButton()?.getAttribute('aria-label') || '';

const clickByText = (root, selector, texts) => {
  const els = root.querySelectorAll(selector);
  for (const el of els) {
    // Skip the profile button itself ("Your profile, status Available"
    // contains "Available" — clicking it would just close the menu)
    if ((el.getAttribute?.('aria-label') || '').startsWith('Your profile')) {
      continue;
    }
    const t = (el.textContent || '').trim().toLowerCase();
    if (texts.some(want => t.includes(want.toLowerCase()))) {
      el.click();
      return true;
    }
  }
  return false;
};

const setTeamsPresence = status => {
  const wants = presenceLabels[status] || presenceLabels.available;
  // Idempotent: skip if already showing wanted presence
  if (getCurrentPresence().toLowerCase().includes(wants[0].toLowerCase())) {
    return;
  }
  const avatarBtn = getProfileButton();
  avatarBtn?.click();

  // Menu renders async — retry a few times
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    const opened =
      clickByText(document, '[role="menuitem"]', wants) ||
      clickByText(document, 'button', wants);
    if (opened || tries >= 10) {
      clearInterval(timer);
    }
  }, 300);
};

module.exports = Ferdium => {
  const getMessages = () => {
    let messages = 0;

    const isTeamsV2 =
      window.location.href.includes('/v2/') ||
      window.location.host == 'teams.cloud.microsoft';

    let badges = document.querySelectorAll(
      '.activity-badge.dot-activity-badge .activity-badge',
    );

    if (isTeamsV2) {
      badges = document.querySelectorAll('.fui-Badge');
    }

    if (badges) {
      Array.prototype.forEach.call(badges, badge => {
        messages += Ferdium.safeParseInt(badge.textContent);
      });
    }

    const indirectMessages =
      document.querySelectorAll('.app-bar-mention').length;

    Ferdium.setBadge(messages, indirectMessages);
  };

  window.addEventListener('beforeunload', async () => {
    Ferdium.releaseServiceWorkers();
  });

  Ferdium.loop(getMessages);

  Ferdium.handlePresence(setTeamsPresence);

  Ferdium.injectCSS(_path.default.join(__dirname, 'service.css'));
  Ferdium.injectJSUnsafe(_path.default.join(__dirname, 'webview-unsafe.js'));
};
