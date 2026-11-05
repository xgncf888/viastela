/**
 * 1. Deduplicates install head tags after hydration.
 * 2. Provides the built-in Local-First Standalone Database Engine (`viastela.desktop.standalone.db.v1`)
 *    so macOS (.app/.pkg/.dmg), Android (.apk), iOS (.ipa/.mobileconfig), and Web PWA can all run
 *    100% offline in No-Login Local Storage Mode (`免登录本地存储模式`).
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

  const STORAGE_KEY = 'viastela.desktop.standalone.db.v1';
  const SESSION_KEY = 'sb-127-auth-token';
  const LOCAL_MODE_KEY = 'viastela.local_mode';
  const SIGNED_OUT_KEY = 'viastela.desktop.signed_out';
  const USER_ID = '00000000-0000-4000-8000-000000000001';

  function isNativePackagedShell() {
    if (typeof window === 'undefined' || !window.location) return false;
    const proto = window.location.protocol || '';
    const host = window.location.hostname || '';
    const search = window.location.search || '';
    const isStandaloneWebClip =
      Boolean(window.navigator && window.navigator.standalone === true) ||
      search.indexOf('shell=native') !== -1;
    return (
      proto === 'app:' ||
      proto === 'file:' ||
      proto === 'viastela-local:' ||
      host === 'appassets.androidplatform.net' ||
      isStandaloneWebClip
    );
  }

  // Only normalize `/index.html` on regular HTTP(S) web origins (not Android WebView AssetLoader or file/app schemes)
  if (typeof window !== 'undefined' && window.location && window.location.pathname) {
    const proto = window.location.protocol || '';
    const host = window.location.hostname || '';
    const p = window.location.pathname;
    if ((proto === 'http:' || proto === 'https:') && host !== 'appassets.androidplatform.net' && p === '/index.html') {
      try {
        window.history.replaceState(null, '', '/' + (window.location.search || '') + (window.location.hash || ''));
      } catch {}
    }
  }

  function getConfiguredSupabaseUrl(urlHint) {
    if (typeof urlHint === 'string' && urlHint.trim()) return urlHint.trim();
    try {
      if (typeof localStorage !== 'undefined') {
        const custom = localStorage.getItem('viastela.custom_supabase_url');
        if (custom && custom.trim()) return custom.trim();
      }
    } catch {
      // Ignore storage errors
    }
    if (
      typeof window !== 'undefined' &&
      typeof window.__VIASTELA_SUPABASE_URL__ === 'string' &&
      window.__VIASTELA_SUPABASE_URL__.trim()
    ) {
      return window.__VIASTELA_SUPABASE_URL__.trim();
    }
    return 'http://127.0.0.1:54321';
  }

  function canUseFakeJwtAndSeedData(urlHint) {
    return isNativePackagedShell() && getConfiguredSupabaseUrl(urlHint).indexOf('127.0.0.1:54321') !== -1;
  }

  function isLocalModeEnabled() {
    try {
      if (typeof localStorage !== 'undefined') {
        if (localStorage.getItem(LOCAL_MODE_KEY) === '1') return true;
        if (
          localStorage.getItem(SIGNED_OUT_KEY) !== '1' &&
          typeof window !== 'undefined' &&
          ((window.navigator && window.navigator.standalone === true) ||
            (window.location && (window.location.search || '').indexOf('shell=native') !== -1))
        ) {
          localStorage.setItem(LOCAL_MODE_KEY, '1');
          return true;
        }
      }
    } catch {
      // Ignore storage errors
    }
    return false;
  }

  function createEmptyDb() {
    return {
      profiles: [],
      weight_records: [],
      training_sets: [],
      study_records: [],
      journal_entries: [],
      asset_accounts: [],
      account_balances: [],
      holdings: [],
      net_worth_goals: [],
      projection_assumptions: [],
      net_worth_snapshots: [],
      asset_events: [],
      push_subscriptions: [],
      reminder_settings: [],
    };
  }

  function stripSeedRows(db) {
    if (!db || typeof db !== 'object') return createEmptyDb();
    const tables = [
      'weight_records',
      'training_sets',
      'study_records',
      'journal_entries',
      'asset_accounts',
      'account_balances',
      'holdings',
      'net_worth_goals',
      'projection_assumptions',
      'net_worth_snapshots',
    ];
    let dirty = false;
    tables.forEach((t) => {
      if (Array.isArray(db[t])) {
        const before = db[t].length;
        db[t] = db[t].filter((r) => !r || typeof r.id !== 'string' || r.id.indexOf('-seed-') === -1);
        if (db[t].length !== before) dirty = true;
      } else {
        db[t] = [];
      }
    });
    if (!Array.isArray(db.profiles) || db.profiles.length === 0) {
      db.profiles = [{ user_id: USER_ID, day_switch: '04:00', updated_at: new Date().toISOString() }];
      dirty = true;
    }
    if (dirty) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      } catch {
        // Ignore storage errors
      }
    }
    return db;
  }

  function loadDb(urlHint) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return stripSeedRows(JSON.parse(raw));
    } catch {
      // Ignore parse errors
    }
    if (!canUseFakeJwtAndSeedData(urlHint)) {
      return createEmptyDb();
    }
    const cleanDb = createEmptyDb();
    cleanDb.profiles = [{ user_id: USER_ID, day_switch: '04:00', updated_at: new Date().toISOString() }];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanDb));
    } catch {
      // Ignore storage errors
    }
    return cleanDb;
  }

  function saveDb(db) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // Ignore storage errors
    }
  }

  function buildLocalSessionObj(urlHint) {
    if (!canUseFakeJwtAndSeedData(urlHint)) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    const payload = btoa(
      JSON.stringify({
        sub: USER_ID,
        email: 'local@device.offline',
        aud: 'authenticated',
        role: 'authenticated',
        iat: nowSec,
        exp: nowSec + 365 * 86400,
        amr: [{ method: 'otp', timestamp: nowSec }],
      }),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const fakeJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.local`;
    return {
      access_token: fakeJwt,
      refresh_token: 'local-refresh',
      token_type: 'bearer',
      expires_in: 365 * 86400,
      expires_at: nowSec + 365 * 86400,
      user: {
        id: USER_ID,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'local@device.offline',
        app_metadata: { provider: 'local' },
        user_metadata: { mode: 'local-only' },
      },
    };
  }

  function clearStaleFakeLocalToken() {
    try {
      if (typeof localStorage === 'undefined') return;
      const existing = localStorage.getItem(SESSION_KEY);
      if (!existing) return;
      const parsed = JSON.parse(existing);
      if (
        parsed &&
        parsed.user &&
        (parsed.user.id === USER_ID || parsed.user.email === 'local@device.offline')
      ) {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }

  function ensureLocalSession(urlHint) {
    try {
      if (!canUseFakeJwtAndSeedData(urlHint)) {
        clearStaleFakeLocalToken();
        return null;
      }
      if (!isLocalModeEnabled()) return null;
      loadDb(urlHint);
      const existing = localStorage.getItem(SESSION_KEY);
      if (existing) return JSON.parse(existing);
      const session = buildLocalSessionObj(urlHint);
      if (session) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
      return session;
    } catch {
      return null;
    }
  }

  ensureLocalSession();

  window.__VIASTELA_ENTER_LOCAL_MODE__ = function enterLocal() {
    try {
      localStorage.removeItem(SIGNED_OUT_KEY);
      localStorage.setItem(LOCAL_MODE_KEY, '1');
      if (canUseFakeJwtAndSeedData()) {
        const session = buildLocalSessionObj();
        if (session && !localStorage.getItem(SESSION_KEY)) {
          localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        }
        loadDb();
      }
      return { userId: USER_ID, email: 'local@device.offline' };
    } catch {
      return { userId: USER_ID, email: 'local@device.offline' };
    }
  };

  window.__VIASTELA_EXIT_LOCAL_MODE__ = function exitLocal() {
    try {
      localStorage.setItem(SIGNED_OUT_KEY, '1');
      localStorage.removeItem(LOCAL_MODE_KEY);
      clearStaleFakeLocalToken();
    } catch {
      // Ignore storage errors
    }
  };

  function buildTimelineRows(db) {
    const items = [];
    (db.journal_entries || []).forEach((j) => {
      if (j.deleted_at) return;
      items.push({
        id: j.id,
        kind: 'journal',
        occurred_at: j.updated_at || j.created_at || new Date().toISOString(),
        local_day: j.entry_day,
        ref_id: j.id,
        payload: { body: j.body, mood: j.mood, tags: j.tags || [] },
      });
    });
    (db.account_balances || []).forEach((b) => {
      if (b.deleted_at) return;
      items.push({
        id: b.id,
        kind: 'balance_recorded',
        occurred_at: b.recorded_at,
        local_day: b.local_day,
        ref_id: b.account_id,
        payload: { account_id: b.account_id, amount: b.amount, currency: b.currency },
      });
    });
    return items;
  }

  function handleLocalRest(urlObj, method, bodyText, headers) {
    const db = loadDb(urlObj.href);
    const pathname = urlObj.pathname;
    if (
      pathname.indexOf('/auth/v1/user') !== -1 ||
      pathname.indexOf('/auth/v1/token') !== -1 ||
      pathname.indexOf('/auth/v1/verify') !== -1
    ) {
      const sess = ensureLocalSession(urlObj.href) || buildLocalSessionObj(urlObj.href);
      if (!sess) {
        return new Response(JSON.stringify({ message: 'Not authenticated' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(pathname.indexOf('/user') !== -1 ? sess.user : sess), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (pathname.indexOf('/auth/v1/otp') !== -1) {
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (pathname.indexOf('/auth/v1/logout') !== -1) {
      window.__VIASTELA_EXIT_LOCAL_MODE__();
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (pathname.indexOf('/functions/v1/quotes') !== -1) {
      const cashUsd = (db.account_balances || [])
        .filter((b) => !b.deleted_at)
        .reduce((s, b) => s + Number(b.amount || 0), 0);
      let secUsd = 0;
      const livePrices = window.__VIASTELA_LIVE_QUOTES__ || {};
      const quotes = (db.holdings || [])
        .filter((h) => !h.deleted_at)
        .map((h) => {
          const live = Number(livePrices[h.symbol]);
          const price = Number.isFinite(live) && live > 0 ? live : 140;
          secUsd += Number(h.quantity || 0) * price;
          return {
            symbol: h.symbol,
            price,
            currency: 'USD',
            as_of: new Date().toISOString(),
            status: 'fresh',
            source: 'finnhub',
          };
        });
      return new Response(
        JSON.stringify({
          quotes,
          rates: [],
          source: 'finnhub',
          total_usd: cashUsd + secUsd,
          cash_usd: cashUsd,
          securities_usd: secUsd,
          unpriced: 0,
          stale: false,
          snapshot: 'written',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const match = pathname.match(/\/rest\/v1\/([a-z0-9_]+)/i);
    if (!match) return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    const table = match[1];
    const rows = table === 'timeline' ? buildTimelineRows(db) : db[table] || [];

    if (method === 'GET') {
      let filtered = rows.slice();
      urlObj.searchParams.forEach((val, key) => {
        if (key === 'select' || key === 'order' || key === 'limit' || key === 'on_conflict' || key === 'or') return;
        if (val === 'is.null') {
          filtered = filtered.filter((r) => r[key] === null || r[key] === undefined);
        } else if (val === 'not.is.null') {
          filtered = filtered.filter((r) => r[key] !== null && r[key] !== undefined);
        } else if (val.indexOf('eq.') === 0) {
          const target = val.slice(3);
          filtered = filtered.filter((r) => String(r[key]) === target);
        } else if (val.indexOf('gte.') === 0) {
          const minVal = val.slice(4);
          filtered = filtered.filter((r) => String(r[key]) >= minVal);
        } else if (val.indexOf('lte.') === 0) {
          const maxVal = val.slice(4);
          filtered = filtered.filter((r) => String(r[key]) <= maxVal);
        }
      });
      const orderParam = urlObj.searchParams.get('order');
      if (orderParam) {
        const firstOrder = orderParam.split(',')[0].split('.');
        const col = firstOrder[0];
        const desc = firstOrder[1] === 'desc';
        filtered.sort((a, b) => {
          const va = String(a[col] || '');
          const vb = String(b[col] || '');
          return desc ? vb.localeCompare(va) : va.localeCompare(vb);
        });
      }
      const limitParam = urlObj.searchParams.get('limit');
      if (limitParam) filtered = filtered.slice(0, Number(limitParam));
      const accept = (headers && (headers.Accept || headers.accept)) || '';
      if (accept.indexOf('vnd.pgrst.object+json') !== -1) {
        const single = filtered[0] || null;
        return new Response(JSON.stringify(single), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(filtered), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (method === 'POST') {
      const incoming = bodyText ? JSON.parse(bodyText) : {};
      const itemsToUpsert = Array.isArray(incoming) ? incoming : [incoming];
      if (!db[table]) db[table] = [];
      const conflictKey = urlObj.searchParams.get('on_conflict') || 'id';
      itemsToUpsert.forEach((item) => {
        const nextItem = Object.assign({ deleted_at: null, updated_at: new Date().toISOString() }, item);
        const idx = db[table].findIndex((r) => r[conflictKey] && r[conflictKey] === nextItem[conflictKey]);
        if (idx >= 0) db[table][idx] = Object.assign({}, db[table][idx], nextItem);
        else db[table].push(nextItem);
      });
      saveDb(db);
      return new Response(JSON.stringify(itemsToUpsert), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    if (method === 'PATCH') {
      const patch = bodyText ? JSON.parse(bodyText) : {};
      if (!db[table]) db[table] = [];
      const updated = [];
      db[table] = db[table].map((r) => {
        let matches = true;
        urlObj.searchParams.forEach((val, key) => {
          if (val.indexOf('eq.') === 0 && String(r[key]) !== val.slice(3)) matches = false;
        });
        if (!matches) return r;
        const nextRow = Object.assign({}, r, patch, { updated_at: new Date().toISOString() });
        updated.push(nextRow);
        return nextRow;
      });
      saveDb(db);
      return new Response(JSON.stringify(updated), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    const origFetch = window.fetch.bind(window);
    window.fetch = function interceptFetch(input, init) {
      const urlStr = typeof input === 'string' ? input : input && input.url ? input.url : String(input);
      if (urlStr.indexOf('127.0.0.1:54321') !== -1 && isLocalModeEnabled() && canUseFakeJwtAndSeedData(urlStr)) {
        const urlObj = new URL(urlStr);
        const method = (init && init.method) || (input && input.method) || 'GET';
        const bodyText = init && typeof init.body === 'string' ? init.body : '';
        const headers = (init && init.headers) || {};
        return Promise.resolve(handleLocalRest(urlObj, method.toUpperCase(), bodyText, headers));
      }
      return origFetch(input, init);
    };
  }
})();
