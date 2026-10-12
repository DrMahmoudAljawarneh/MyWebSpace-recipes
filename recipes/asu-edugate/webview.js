module.exports = Ferdium => {
  const getMessages = () => {
    // Edugate runs Moodle with Microsoft OIDC login
    const countContainers = [
      ...document.querySelectorAll('[data-region="count-container"]'),
    ];
    let totalMessages = countContainers.reduce(
      (count, item) => count + Ferdium.safeParseInt(item.textContent),
      0,
    );

    // Fallback badge selectors for notification icons
    if (totalMessages === 0) {
      const badge = document.querySelector('.popover-region-notifications .count-container, .badge.badge-danger');
      if (badge) {
        totalMessages = Ferdium.safeParseInt(badge.textContent);
      }
    }

    Ferdium.setBadge(totalMessages, 0);
  };

  Ferdium.loop(getMessages);
};
