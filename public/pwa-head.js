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
    return (
      proto === 'app:' ||
      proto === 'viastela-local:' ||
      host === 'appassets.androidplatform.net'
    );
  }

  if (isNativePackagedShell() && typeof window !== 'undefined') {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      }).catch(() => {});
    }
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((k) => caches.delete(k));
      }).catch(() => {});
    }
  }

  function isLocalModeEnabled() {
    try {
      if (localStorage.getItem(LOCAL_MODE_KEY) === '1') return true;
      if (isNativePackagedShell() && localStorage.getItem(SIGNED_OUT_KEY) !== '1') {
        localStorage.setItem(LOCAL_MODE_KEY, '1');
        return true;
      }
    } catch {
      // Ignore storage errors
    }
    return false;
  }

  function loadDb() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignore parse errors
    }
    const now = new Date();
    function isoDaysAgo(d, h) {
      const dt = new Date(now.getTime() - d * 86400000);
      dt.setHours(h || 8, 15, 0, 0);
      return dt.toISOString();
    }
    function dayStr(d) {
      const dt = new Date(now.getTime() - d * 86400000);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    const tz = (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Asia/Singapore';
    const seeded = {
      profiles: [{ user_id: USER_ID, day_switch: '04:00', updated_at: now.toISOString() }],
      weight_records: [
        { id: 'w-seed-6', user_id: USER_ID, weight_kg: 73.6, recorded_at: isoDaysAgo(6, 8), tz, local_day: dayStr(6), updated_at: isoDaysAgo(6, 8), deleted_at: null },
        { id: 'w-seed-5', user_id: USER_ID, weight_kg: 73.4, recorded_at: isoDaysAgo(5, 8), tz, local_day: dayStr(5), updated_at: isoDaysAgo(5, 8), deleted_at: null },
        { id: 'w-seed-4', user_id: USER_ID, weight_kg: 73.2, recorded_at: isoDaysAgo(4, 8), tz, local_day: dayStr(4), updated_at: isoDaysAgo(4, 8), deleted_at: null },
        { id: 'w-seed-3', user_id: USER_ID, weight_kg: 73.0, recorded_at: isoDaysAgo(3, 8), tz, local_day: dayStr(3), updated_at: isoDaysAgo(3, 8), deleted_at: null },
        { id: 'w-seed-2', user_id: USER_ID, weight_kg: 72.8, recorded_at: isoDaysAgo(2, 8), tz, local_day: dayStr(2), updated_at: isoDaysAgo(2, 8), deleted_at: null },
        { id: 'w-seed-1', user_id: USER_ID, weight_kg: 72.6, recorded_at: isoDaysAgo(1, 8), tz, local_day: dayStr(1), updated_at: isoDaysAgo(1, 8), deleted_at: null },
        { id: 'w-seed-0', user_id: USER_ID, weight_kg: 72.4, recorded_at: isoDaysAgo(0, 8), tz, local_day: dayStr(0), updated_at: isoDaysAgo(0, 8), deleted_at: null },
      ],
      training_sets: [
        { id: 't-seed-1', user_id: USER_ID, exercise: '哑铃卧推', reps: 10, weight_kg: 32, band_level: null, recorded_at: isoDaysAgo(0, 9), tz, local_day: dayStr(0), updated_at: isoDaysAgo(0, 9), deleted_at: null },
        { id: 't-seed-2', user_id: USER_ID, exercise: '深蹲', reps: 8, weight_kg: 60, band_level: null, recorded_at: isoDaysAgo(1, 18), tz, local_day: dayStr(1), updated_at: isoDaysAgo(1, 18), deleted_at: null },
      ],
      study_records: [
        { id: 's-seed-1', user_id: USER_ID, topic: 'AI Infra', duration_minutes: 45, note: '多端本地存储与个人工作台', recorded_at: isoDaysAgo(0, 10), tz, local_day: dayStr(0), updated_at: isoDaysAgo(0, 10), deleted_at: null },
      ],
      journal_entries: [
        { id: 'j-seed-1', user_id: USER_ID, body: '开启免登录本地存储模式，所有记录直接保存在本机设备中。', entry_day: dayStr(0), tz, mood: 5, tags: ['本地模式', '工作台'], created_at: isoDaysAgo(0, 11), updated_at: isoDaysAgo(0, 11), deleted_at: null },
      ],
      asset_accounts: [
        { id: 'acc-seed-1', user_id: USER_ID, name: '主现金账户', kind: 'cash', currency: 'USD', created_at: isoDaysAgo(10, 9), updated_at: isoDaysAgo(0, 9), deleted_at: null },
        { id: 'acc-seed-2', user_id: USER_ID, name: '长线证券账户', kind: 'brokerage', currency: 'USD', created_at: isoDaysAgo(10, 9), updated_at: isoDaysAgo(0, 9), deleted_at: null },
      ],
      account_balances: [
        { id: 'bal-seed-1', user_id: USER_ID, account_id: 'acc-seed-1', amount: 85000, currency: 'USD', units_per_usd: 1, recorded_at: isoDaysAgo(0, 9), tz, local_day: dayStr(0), updated_at: isoDaysAgo(0, 9), deleted_at: null },
      ],
      holdings: [
        { id: 'hold-seed-1', user_id: USER_ID, account_id: 'acc-seed-2', symbol: 'NVDA', quantity: 500, cost_basis_usd: 65000, created_at: isoDaysAgo(5, 9), updated_at: isoDaysAgo(0, 9), deleted_at: null },
      ],
      net_worth_goals: [
        { id: 'goal-seed-1', user_id: USER_ID, target_usd: 500000, target_date: null, updated_at: isoDaysAgo(0, 9) },
      ],
      projection_assumptions: [
        { id: 'assump-seed-1', user_id: USER_ID, start_usd: 155000, start_month: `${dayStr(0).slice(0, 7)}-01`, monthly_net_usd: 4500, return_rates: [0.03, 0.05, 0.07], main_rate_index: 2, updated_at: isoDaysAgo(0, 9) },
      ],
      net_worth_snapshots: [
        { id: 'snap-seed-1', user_id: USER_ID, snapshot_month: `${dayStr(30).slice(0, 7)}-01`, total_usd: 148000, cash_usd: 82000, securities_usd: 66000, updated_at: isoDaysAgo(30, 9) },
        { id: 'snap-seed-2', user_id: USER_ID, snapshot_month: `${dayStr(0).slice(0, 7)}-01`, total_usd: 155000, cash_usd: 85000, securities_usd: 70000, updated_at: isoDaysAgo(0, 9) },
      ],
      asset_events: [],
      push_subscriptions: [],
      reminder_settings: [],
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    } catch {
      // Ignore storage errors
    }
    return seeded;
  }

  function saveDb(db) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // Ignore storage errors
    }
  }

  function buildLocalSessionObj() {
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

  function ensureLocalSession() {
    try {
      if (!isLocalModeEnabled()) return null;
      loadDb();
      const existing = localStorage.getItem(SESSION_KEY);
      if (existing) return JSON.parse(existing);
      const session = buildLocalSessionObj();
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
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
      const session = buildLocalSessionObj();
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      loadDb();
      return { userId: USER_ID, email: 'local@device.offline' };
    } catch {
      return { userId: USER_ID, email: 'local@device.offline' };
    }
  };

  window.__VIASTELA_EXIT_LOCAL_MODE__ = function exitLocal() {
    try {
      localStorage.setItem(SIGNED_OUT_KEY, '1');
      localStorage.removeItem(LOCAL_MODE_KEY);
      localStorage.removeItem(SESSION_KEY);
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
    const db = loadDb();
    const pathname = urlObj.pathname;
    if (
      pathname.indexOf('/auth/v1/user') !== -1 ||
      pathname.indexOf('/auth/v1/token') !== -1 ||
      pathname.indexOf('/auth/v1/verify') !== -1
    ) {
      const sess = ensureLocalSession() || buildLocalSessionObj();
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
      if (urlStr.indexOf('127.0.0.1:54321') !== -1 && isLocalModeEnabled()) {
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
