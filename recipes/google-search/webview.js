module.exports = () => {
  // Intercept all clicked links and open within the same webview in MyWebSpace
  document.addEventListener(
    'click',
    event => {
      const target = event.target;
      if (!target) return;

      const link = target.closest('a[href]');
      if (!link) return;

      const href = link.getAttribute('href');
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('javascript:') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      ) {
        return;
      }

      // Check if target opens in new window/tab (_blank) or external link
      const targetAttr = link.getAttribute('target');
      if (targetAttr === '_blank' || targetAttr === '_new') {
        event.preventDefault();
        event.stopPropagation();
        window.location.href = link.href;
      }
    },
    true,
  );

  // Override window.open to keep navigation within the same webview
  const originalOpen = window.open;
  window.open = function (url, target, features) {
    if (url && typeof url === 'string') {
      window.location.href = url;
      return window;
    }
    return originalOpen.call(window, url, target, features);
  };
};
