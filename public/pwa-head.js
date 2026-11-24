/**
 * Deduplicates install head tags after hydration and normalizes `/index.html`
 * on ordinary HTTP(S) origins so mobile WebViews do not miss the route.
 * Local mode does not live here: there is no fake session, no seeded database,
 * and no fetch interceptor.
 */
(function initPwaHead() {
  function dedupeHead() {
    if (!document.head) return;
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
    const iconSeen = Object.create(null);
    document.querySelectorAll('link[rel="icon"]').forEach((node) => {
      const href = node.getAttribute('href') || '';
      if (iconSeen[href]) node.remove();
      else iconSeen[href] = true;
    });
    const splashSeen = Object.create(null);
    document.querySelectorAll('link[rel="apple-touch-startup-image"]').forEach((node) => {
      const id = `${node.getAttribute('href') || ''} ${node.getAttribute('media') || ''}`;
      if (splashSeen[id]) node.remove();
      else splashSeen[id] = true;
    });
  }

  if (typeof document !== 'undefined' && document.head) {
    dedupeHead();
    new MutationObserver(dedupeHead).observe(document.head, { childList: true });
    if (!document.getElementById('vs-silky-motion')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'vs-silky-motion';
      styleEl.textContent = `
        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        [role="button"] {
          cursor: pointer;
          user-select: none;
          -webkit-user-select: none;
          transition: background-color 140ms cubic-bezier(0.2, 0, 0, 1),
                      border-color 140ms cubic-bezier(0.2, 0, 0, 1),
                      box-shadow 180ms cubic-bezier(0.2, 0, 0, 1),
                      transform 140ms cubic-bezier(0.2, 0, 0, 1),
                      opacity 140ms cubic-bezier(0.2, 0, 0, 1);
        }
        [role="button"]:active:not([aria-disabled="true"]) {
          transform: scale(0.985);
        }
        @keyframes vsSheetSpringIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes studioPulseDash {
          to {
            stroke-dashoffset: -48;
          }
        }
        svg path[stroke-dasharray] {
          animation: studioPulseDash 1.4s linear infinite;
        }
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(120, 115, 105, 0.22);
          border-radius: 999px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(120, 115, 105, 0.38);
        }
      `;
      document.head.appendChild(styleEl);
    }
  }

  // Only normalize `/index.html` on regular HTTP(S) web origins (not Android WebView AssetLoader or file/app schemes)
  if (typeof window !== 'undefined' && window.location && window.location.pathname) {
    const proto = window.location.protocol || '';
    const host = window.location.hostname || '';
    const p = window.location.pathname;
    if ((proto === 'http:' || proto === 'https:') && host !== 'appassets.androidplatform.net' && p === '/index.html') {
      try {
        window.history.replaceState(null, '', '/' + (window.location.search || '') + (window.location.hash || ''));
      } catch {
        // Ignore history errors
      }
    }
  }

  function stripSeedRows(raw) {
    try {
      const db = JSON.parse(raw);
      if (!db || typeof db !== 'object') return null;
      let dirty = false;
      Object.keys(db).forEach((key) => {
        if (!Array.isArray(db[key])) return;
        const next = db[key].filter((row) => !row || typeof row.id !== 'string' || row.id.indexOf('-seed-') === -1);
        if (next.length !== db[key].length) {
          db[key] = next;
          dirty = true;
        }
      });
      return dirty ? JSON.stringify(db) : null;
    } catch {
      return null;
    }
  }

  try {
    ['viastela.local.engine.db.v1', 'viastela.desktop.standalone.db.v1'].forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const next = stripSeedRows(raw);
      if (next) localStorage.setItem(key, next);
    });
  } catch {
    // Ignore storage errors
  }
})();
