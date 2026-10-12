module.exports = Ferdium => {
  const getMessages = () => {
    let unreadCount = 0;
    // Overleaf project dashboard notification badges or unread markers
    const notificationBadge = document.querySelector(
      '.unread-notifications-badge, [data-unread-count], .badge.badge-danger, .badge.badge-primary',
    );

    if (notificationBadge) {
      unreadCount = Ferdium.safeParseInt(notificationBadge.textContent);
    }

    Ferdium.setBadge(unreadCount);
  };

  Ferdium.loop(getMessages);
};
