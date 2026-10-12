module.exports = Ferdium => {
  const getMessages = () => {
    // Check for unread notification badge counters or alerts in the ASU portal
    const badgeElement = document.querySelector('.badge.badge-danger, .badge-pill, [data-badge], .notification-count');
    let count = 0;
    if (badgeElement) {
      count = Ferdium.safeParseInt(badgeElement.textContent);
    }
    Ferdium.setBadge(count);
  };

  Ferdium.loop(getMessages);
};
