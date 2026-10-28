/**
 * The root layout repeats install tags after hydration.
 * Keep the first copy of each tag so theme-color still has its color-scheme media.
 */
(function dedupeInstallHead() {
  function dedupeHead() {
    document.querySelectorAll('meta[name="theme-color"]').forEach((node) => {
      if (!node.getAttribute('media')) node.remove();
    });
    const themeSeen = Object.create(null);
    document.querySelectorAll('meta[name="theme-color"]').forEach((node) => {
      const media = node.getAttribute('media') || '';
      if (themeSeen[media]) node.remove();
      else themeSeen[media] = true;
    });
    for (const selector of [
      'meta[name="apple-mobile-web-app-capable"]',
      'meta[name="apple-mobile-web-app-status-bar-style"]',
      'meta[name="apple-mobile-web-app-title"]',
      'link[rel="manifest"]',
      'link[rel="apple-touch-icon"]',
    ]) {
      const nodes = document.querySelectorAll(selector);
      for (let index = 1; index < nodes.length; index += 1) nodes[index].remove();
    }
    const splashSeen = Object.create(null);
    document.querySelectorAll('link[rel="apple-touch-startup-image"]').forEach((node) => {
      const id = `${node.getAttribute('href') || ''} ${node.getAttribute('media') || ''}`;
      if (splashSeen[id]) node.remove();
      else splashSeen[id] = true;
    });
  }

  dedupeHead();
  new MutationObserver(dedupeHead).observe(document.head, { childList: true });
})();
