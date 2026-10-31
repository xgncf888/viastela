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

  dedupeHead();
  new MutationObserver(dedupeHead).observe(document.head, { childList: true });

  // Live-patch parent local preview workbench (/__workbench) to eliminate iframe white border & reload flash
  try {
    if (window.parent && window.parent !== window && window.parent.location.pathname === '/__workbench') {
      const pwin = window.parent;
      const pdoc = pwin.document;
      if (!pdoc.getElementById('workbench-zero-flash-patch')) {
        const style = pdoc.createElement('style');
        style.id = 'workbench-zero-flash-patch';
        style.textContent = `
          .frame-card { background: #232321 !important; }
          .viewport-shell {
            position: relative;
            border-radius: 8px;
            overflow: hidden;
            background: #F7F4EC;
            box-shadow: 0 0 0 1px #3A3934;
          }
          iframe {
            border: 0 !important;
            outline: none !important;
            border-radius: 0 !important;
            background: #F7F4EC !important;
            display: block;
          }
        `;
        pdoc.head.appendChild(style);
        ['phone-frame', 'desktop-frame'].forEach((id) => {
          const frame = pdoc.getElementById(id);
          if (frame && !frame.parentElement.classList.contains('viewport-shell')) {
            const shell = pdoc.createElement('div');
            shell.className = 'viewport-shell';
            shell.style.width = frame.getAttribute('width') + 'px';
            shell.style.height = frame.getAttribute('height') + 'px';
            frame.parentElement.insertBefore(shell, frame);
            shell.appendChild(frame);
          }
        });
      }

      const ROUTE_LABELS = { '/': '今日', '/trend': '趋势', '/assets': '资产', '/timeline': '时间线', '/me': '我的' };
      function clickInAppNav(win, route) {
        try {
          const label = ROUTE_LABELS[route];
          const doc = win.document;
          const buttons = Array.from(doc.querySelectorAll('[role="button"], button, a'));
          const target = buttons.find((el) => (el.getAttribute('aria-label') || (el.textContent || '').trim()) === label);
          if (target) {
            target.click();
            return true;
          }
        } catch {}
        return false;
      }

      function seamlessReloadFrame(id) {
        const oldFrame = pdoc.getElementById(id);
        if (!oldFrame || !oldFrame.parentElement) return;
        const shell = oldFrame.parentElement;
        let currentPath = '/';
        try {
          currentPath = oldFrame.contentWindow.location.pathname || '/';
        } catch {}
        const nextFrame = pdoc.createElement('iframe');
        nextFrame.width = oldFrame.width;
        nextFrame.height = oldFrame.height;
        nextFrame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:#F7F4EC;opacity:0;transition:opacity 80ms ease-out;pointer-events:none;';
        nextFrame.src = currentPath;
        shell.appendChild(nextFrame);
        nextFrame.addEventListener('load', () => {
          setTimeout(() => {
            nextFrame.style.opacity = '1';
            nextFrame.style.pointerEvents = 'auto';
            nextFrame.style.position = 'static';
            oldFrame.remove();
            nextFrame.id = id;
            if (typeof pwin.checkBaseline === 'function') setTimeout(pwin.checkBaseline, 200);
          }, 90);
        });
      }

      pwin.go = function (route, btn) {
        pdoc.querySelectorAll('.route-btn').forEach((b) => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        const pf = pdoc.getElementById('phone-frame');
        const df = pdoc.getElementById('desktop-frame');
        if (pf && !clickInAppNav(pf.contentWindow, route)) pf.src = route;
        if (df && !clickInAppNav(df.contentWindow, route)) df.src = route;
        if (typeof pwin.checkBaseline === 'function') setTimeout(pwin.checkBaseline, 250);
      };

      pwin.setSim = async function (mode, btn) {
        pdoc.querySelectorAll('.sim-btn').forEach((b) => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        await fetch('http://127.0.0.1:54321/__sim?mode=' + mode);
        seamlessReloadFrame('phone-frame');
        seamlessReloadFrame('desktop-frame');
      };
    }
  } catch {}
})();
