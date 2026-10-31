#!/usr/bin/env node
/**
 * Builds the native macOS desktop bundle (`.app` + `.zip` / `.dmg`)
 * wrapping the exported Web bundle (`dist/`) in a native Cocoa + WKWebView vibrancy shell
 * with a custom `WKURLSchemeHandler` (`app://localhost/...`) so root-relative `/_expo/...`
 * scripts and SPA routes load cleanly without a blank screen.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brandSource = readFileSync(path.join(ROOT, 'src', 'config', 'brand.ts'), 'utf8');
const displayName = brandSource.match(/displayName:\s*'([^']+)'/)?.[1] ?? 'App';

const OUT_DIR = path.resolve(process.env.MACOS_OUT_DIR ?? path.join(ROOT, 'web-build', 'macos'));
const APP_TITLE = displayName;
const APP_NAME = `${APP_TITLE}.app`;
const EXEC_NAME = displayName;
const APP_BUNDLE = path.join(OUT_DIR, APP_NAME);
const CONTENTS = path.join(APP_BUNDLE, 'Contents');
const MACOS_DIR = path.join(CONTENTS, 'MacOS');
const RESOURCES_DIR = path.join(CONTENTS, 'Resources');
const WEB_DEST = path.join(RESOURCES_DIR, 'web');

const INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>${EXEC_NAME}</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon.png</string>
  <key>CFBundleIdentifier</key>
  <string>com.viastela.app.mac</string>
  <key>CFBundleName</key>
  <string>${APP_TITLE}</string>
  <key>CFBundleDisplayName</key>
  <string>${APP_TITLE}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>2.0.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
  </dict>
</dict>
</plist>
`;

const ICON_SWIFT = `import Cocoa

func drawAstrolabeIcon(size: Int) -> Data? {
    let s = CGFloat(size)
    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: size,
        pixelsHigh: size,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else { return nil }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    guard let ctx = NSGraphicsContext.current?.cgContext else { return nil }

    let inset = s * 0.088
    let box = CGRect(x: inset, y: inset, width: s - inset * 2, height: s - inset * 2)
    let radius = box.width * 0.225
    let squircle = CGPath(roundedRect: box, cornerWidth: radius, cornerHeight: radius, transform: nil)

    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -s * 0.018), blur: s * 0.04, color: NSColor(calibratedWhite: 0, alpha: 0.35).cgColor)
    ctx.addPath(squircle)
    ctx.setFillColor(NSColor(calibratedRed: 0.969, green: 0.957, blue: 0.925, alpha: 1.0).cgColor)
    ctx.fillPath()
    ctx.restoreGState()

    ctx.saveGState()
    ctx.addPath(squircle)
    ctx.clip()
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let paperColors = [
        NSColor(calibratedRed: 0.976, green: 0.965, blue: 0.937, alpha: 1.0).cgColor,
        NSColor(calibratedRed: 0.918, green: 0.898, blue: 0.851, alpha: 1.0).cgColor
    ] as CFArray
    if let grad = CGGradient(colorsSpace: colorSpace, colors: paperColors, locations: [0.0, 1.0]) {
        ctx.drawLinearGradient(grad, start: CGPoint(x: s * 0.5, y: box.maxY), end: CGPoint(x: s * 0.5, y: box.minY), options: [])
    }
    ctx.addPath(squircle)
    ctx.setStrokeColor(NSColor(calibratedRed: 0.85, green: 0.82, blue: 0.76, alpha: 0.9).cgColor)
    ctx.setLineWidth(s * 0.008)
    ctx.strokePath()
    ctx.restoreGState()

    let center = CGPoint(x: s * 0.5, y: s * 0.5)
    let medRadius = s * 0.345
    let medRect = CGRect(x: center.x - medRadius, y: center.y - medRadius, width: medRadius * 2, height: medRadius * 2)

    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -s * 0.012), blur: s * 0.025, color: NSColor(calibratedWhite: 0, alpha: 0.42).cgColor)
    ctx.fillEllipse(in: medRect)
    ctx.restoreGState()

    ctx.saveGState()
    ctx.addEllipse(in: medRect)
    ctx.clip()
    let medColors = [
        NSColor(calibratedRed: 0.13, green: 0.135, blue: 0.155, alpha: 1.0).cgColor,
        NSColor(calibratedRed: 0.075, green: 0.078, blue: 0.09, alpha: 1.0).cgColor
    ] as CFArray
    if let medGrad = CGGradient(colorsSpace: colorSpace, colors: medColors, locations: [0.0, 1.0]) {
        ctx.drawLinearGradient(medGrad, start: CGPoint(x: center.x, y: medRect.maxY), end: CGPoint(x: center.x, y: medRect.minY), options: [])
    }
    ctx.restoreGState()

    let outerRingR = s * 0.295
    let innerRingR = s * 0.265
    let goldStroke = NSColor(calibratedRed: 0.86, green: 0.72, blue: 0.56, alpha: 0.55).cgColor
    ctx.setStrokeColor(goldStroke)
    ctx.setLineWidth(max(1.0, s * 0.003))
    ctx.strokeEllipse(in: CGRect(x: center.x - outerRingR, y: center.y - outerRingR, width: outerRingR * 2, height: outerRingR * 2))
    ctx.strokeEllipse(in: CGRect(x: center.x - innerRingR, y: center.y - innerRingR, width: innerRingR * 2, height: innerRingR * 2))

    for i in 0..<72 {
        let angle = CGFloat(i) * (.pi * 2.0 / 72.0)
        let isMajor = (i % 6 == 0)
        let isCardinal = (i % 18 == 0)
        let r1 = isCardinal ? (innerRingR - s * 0.012) : innerRingR
        let r2 = isCardinal ? (outerRingR + s * 0.012) : (isMajor ? outerRingR : (innerRingR + (outerRingR - innerRingR) * 0.55))
        ctx.setLineWidth(isCardinal ? max(1.5, s * 0.0045) : max(1.0, s * 0.0022))
        ctx.setStrokeColor(NSColor(calibratedRed: 0.88, green: 0.74, blue: 0.58, alpha: isCardinal ? 0.85 : (isMajor ? 0.55 : 0.32)).cgColor)
        ctx.move(to: CGPoint(x: center.x + cos(angle) * r1, y: center.y + sin(angle) * r1))
        ctx.addLine(to: CGPoint(x: center.x + cos(angle) * r2, y: center.y + sin(angle) * r2))
        ctx.strokePath()
    }

    let vPath = CGMutablePath()
    vPath.move(to: CGPoint(x: s * 0.355, y: s * 0.595))
    vPath.addLine(to: CGPoint(x: s * 0.500, y: s * 0.335))
    vPath.addLine(to: CGPoint(x: s * 0.645, y: s * 0.595))
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -s * 0.006), blur: s * 0.015, color: NSColor(calibratedWhite: 0, alpha: 0.5).cgColor)
    ctx.addPath(vPath)
    ctx.setStrokeColor(NSColor(calibratedRed: 0.969, green: 0.957, blue: 0.925, alpha: 1.0).cgColor)
    ctx.setLineWidth(s * 0.044)
    ctx.setLineCap(.round)
    ctx.setLineJoin(.round)
    ctx.strokePath()
    ctx.restoreGState()

    let starCenter = CGPoint(x: s * 0.500, y: s * 0.635)
    let outerS = s * 0.068
    let innerS = s * 0.021
    let starPath = CGMutablePath()
    for i in 0..<8 {
        let angle = CGFloat(i) * (.pi / 4.0) + (.pi / 2.0)
        let r = (i % 2 == 0) ? outerS : innerS
        let pt = CGPoint(x: starCenter.x + cos(angle) * r, y: starCenter.y + sin(angle) * r)
        if i == 0 { starPath.move(to: pt) } else { starPath.addLine(to: pt) }
    }
    starPath.closeSubpath()

    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: s * 0.032, color: NSColor(calibratedRed: 0.80, green: 0.47, blue: 0.36, alpha: 0.85).cgColor)
    ctx.addPath(starPath)
    ctx.setFillColor(NSColor(calibratedRed: 0.80, green: 0.47, blue: 0.36, alpha: 1.0).cgColor)
    ctx.fillPath()
    ctx.restoreGState()

    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])
}

if let data = drawAstrolabeIcon(size: 1024) {
    try? data.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
}
`;

const LOCAL_STANDALONE_BRIDGE_JS = `
(function installLocalStandaloneBackend() {
  var STORAGE_KEY = 'viastela.desktop.standalone.db.v1';
  var SESSION_KEY = 'sb-127-auth-token';
  var USER_ID = '00000000-0000-4000-8000-000000000001';

  function loadDb() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    var now = new Date();
    function isoDaysAgo(d, h) {
      var dt = new Date(now.getTime() - d * 86400000);
      dt.setHours(h || 8, 15, 0, 0);
      return dt.toISOString();
    }
    function dayStr(d) {
      var dt = new Date(now.getTime() - d * 86400000);
      var y = dt.getFullYear();
      var m = String(dt.getMonth() + 1).padStart(2, '0');
      var day = String(dt.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    }
    var seeded = {
      profiles: [{ user_id: USER_ID, day_switch: '04:00', updated_at: now.toISOString() }],
      weight_records: [
        { id: 'w-seed-6', user_id: USER_ID, weight_kg: 73.6, recorded_at: isoDaysAgo(6, 8), tz: 'Asia/Singapore', local_day: dayStr(6), updated_at: isoDaysAgo(6, 8), deleted_at: null },
        { id: 'w-seed-5', user_id: USER_ID, weight_kg: 73.4, recorded_at: isoDaysAgo(5, 8), tz: 'Asia/Singapore', local_day: dayStr(5), updated_at: isoDaysAgo(5, 8), deleted_at: null },
        { id: 'w-seed-4', user_id: USER_ID, weight_kg: 73.2, recorded_at: isoDaysAgo(4, 8), tz: 'Asia/Singapore', local_day: dayStr(4), updated_at: isoDaysAgo(4, 8), deleted_at: null },
        { id: 'w-seed-3', user_id: USER_ID, weight_kg: 73.0, recorded_at: isoDaysAgo(3, 8), tz: 'Asia/Singapore', local_day: dayStr(3), updated_at: isoDaysAgo(3, 8), deleted_at: null },
        { id: 'w-seed-2', user_id: USER_ID, weight_kg: 72.8, recorded_at: isoDaysAgo(2, 8), tz: 'Asia/Singapore', local_day: dayStr(2), updated_at: isoDaysAgo(2, 8), deleted_at: null },
        { id: 'w-seed-1', user_id: USER_ID, weight_kg: 72.6, recorded_at: isoDaysAgo(1, 8), tz: 'Asia/Singapore', local_day: dayStr(1), updated_at: isoDaysAgo(1, 8), deleted_at: null },
        { id: 'w-seed-0', user_id: USER_ID, weight_kg: 72.4, recorded_at: isoDaysAgo(0, 8), tz: 'Asia/Singapore', local_day: dayStr(0), updated_at: isoDaysAgo(0, 8), deleted_at: null }
      ],
      training_sets: [
        { id: 't-seed-1', user_id: USER_ID, exercise: '哑铃卧推', reps: 10, weight_kg: 32, band_level: null, recorded_at: isoDaysAgo(0, 9), tz: 'Asia/Singapore', local_day: dayStr(0), updated_at: isoDaysAgo(0, 9), deleted_at: null },
        { id: 't-seed-2', user_id: USER_ID, exercise: '深蹲', reps: 8, weight_kg: 60, band_level: null, recorded_at: isoDaysAgo(1, 18), tz: 'Asia/Singapore', local_day: dayStr(1), updated_at: isoDaysAgo(1, 18), deleted_at: null }
      ],
      study_records: [
        { id: 's-seed-1', user_id: USER_ID, topic: 'AI Infra', duration_minutes: 45, note: 'DeepSeek Harness 与多端本地架构', recorded_at: isoDaysAgo(0, 10), tz: 'Asia/Singapore', local_day: dayStr(0), updated_at: isoDaysAgo(0, 10), deleted_at: null }
      ],
      journal_entries: [
        { id: 'j-seed-1', user_id: USER_ID, body: '完成个人多端 App 原生桌面壳与离线同步队列升级', entry_day: dayStr(0), tz: 'Asia/Singapore', mood: 5, tags: ['架构', '时间块'], created_at: isoDaysAgo(0, 11), updated_at: isoDaysAgo(0, 11), deleted_at: null }
      ],
      asset_accounts: [
        { id: 'acc-seed-1', user_id: USER_ID, name: '主现金账户', kind: 'cash', currency: 'USD', created_at: isoDaysAgo(10, 9), updated_at: isoDaysAgo(0, 9), deleted_at: null },
        { id: 'acc-seed-2', user_id: USER_ID, name: '长线证券账户', kind: 'brokerage', currency: 'USD', created_at: isoDaysAgo(10, 9), updated_at: isoDaysAgo(0, 9), deleted_at: null }
      ],
      account_balances: [
        { id: 'bal-seed-1', user_id: USER_ID, account_id: 'acc-seed-1', amount: 85000, currency: 'USD', units_per_usd: 1, recorded_at: isoDaysAgo(0, 9), tz: 'Asia/Singapore', local_day: dayStr(0), updated_at: isoDaysAgo(0, 9), deleted_at: null }
      ],
      holdings: [
        { id: 'hold-seed-1', user_id: USER_ID, account_id: 'acc-seed-2', symbol: 'NVDA', quantity: 500, cost_basis_usd: 65000, created_at: isoDaysAgo(5, 9), updated_at: isoDaysAgo(0, 9), deleted_at: null }
      ],
      net_worth_goals: [
        { id: 'goal-seed-1', user_id: USER_ID, target_usd: 500000, target_date: null, updated_at: isoDaysAgo(0, 9) }
      ],
      projection_assumptions: [
        { id: 'assump-seed-1', user_id: USER_ID, start_usd: 155000, start_month: dayStr(0).slice(0, 7) + '-01', monthly_net_usd: 4500, return_rates: [0.03, 0.05, 0.07], main_rate_index: 2, updated_at: isoDaysAgo(0, 9) }
      ],
      net_worth_snapshots: [
        { id: 'snap-seed-1', user_id: USER_ID, snapshot_month: dayStr(30).slice(0, 7) + '-01', total_usd: 148000, cash_usd: 82000, securities_usd: 66000, updated_at: isoDaysAgo(30, 9) },
        { id: 'snap-seed-2', user_id: USER_ID, snapshot_month: dayStr(0).slice(0, 7) + '-01', total_usd: 155000, cash_usd: 85000, securities_usd: 70000, updated_at: isoDaysAgo(0, 9) }
      ],
      asset_events: [],
      push_subscriptions: [],
      reminder_settings: []
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  function saveDb(db) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {}
  }

  function ensureLocalSession() {
    try {
      if (localStorage.getItem('viastela.desktop.signed_out') === '1') return;
      if (localStorage.getItem(SESSION_KEY)) return;
      var nowSec = Math.floor(Date.now() / 1000);
      var payload = btoa(JSON.stringify({
        sub: USER_ID,
        email: 'yifeng@viastela.local',
        aud: 'authenticated',
        role: 'authenticated',
        iat: nowSec,
        exp: nowSec + 365 * 86400,
        amr: [{ method: 'otp', timestamp: nowSec }]
      })).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
      var fakeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + payload + '.local';
      var session = {
        access_token: fakeJwt,
        refresh_token: 'local-refresh',
        token_type: 'bearer',
        expires_in: 365 * 86400,
        expires_at: nowSec + 365 * 86400,
        user: {
          id: USER_ID,
          aud: 'authenticated',
          role: 'authenticated',
          email: 'yifeng@viastela.local',
          app_metadata: { provider: 'email' },
          user_metadata: {}
        }
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {}
  }

  ensureLocalSession();

  function buildTimelineRows(db) {
    var items = [];
    (db.journal_entries || []).forEach(function(j) {
      if (j.deleted_at) return;
      items.push({
        id: j.id,
        kind: 'journal',
        occurred_at: j.updated_at || j.created_at || new Date().toISOString(),
        local_day: j.entry_day,
        ref_id: j.id,
        payload: { body: j.body, mood: j.mood, tags: j.tags || [] }
      });
    });
    (db.account_balances || []).forEach(function(b) {
      if (b.deleted_at) return;
      items.push({
        id: b.id,
        kind: 'balance_recorded',
        occurred_at: b.recorded_at,
        local_day: b.local_day,
        ref_id: b.account_id,
        payload: { account_id: b.account_id, amount: b.amount, currency: b.currency }
      });
    });
    return items;
  }

  function handleLocalRest(urlObj, method, bodyText, headers) {
    var db = loadDb();
    var pathname = urlObj.pathname;
    if (pathname.indexOf('/auth/v1/user') !== -1 || pathname.indexOf('/auth/v1/token') !== -1 || pathname.indexOf('/auth/v1/verify') !== -1) {
      localStorage.removeItem('viastela.desktop.signed_out');
      ensureLocalSession();
      var sess = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
      return new Response(JSON.stringify(pathname.indexOf('/user') !== -1 ? sess.user : sess), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (pathname.indexOf('/auth/v1/otp') !== -1) {
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (pathname.indexOf('/auth/v1/logout') !== -1) {
      localStorage.setItem('viastela.desktop.signed_out', '1');
      localStorage.removeItem(SESSION_KEY);
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (pathname.indexOf('/functions/v1/quotes') !== -1) {
      var cashUsd = (db.account_balances || []).filter(function(b) { return !b.deleted_at; }).reduce(function(s, b) { return s + Number(b.amount || 0); }, 0);
      var secUsd = 0;
      var quotes = (db.holdings || []).filter(function(h) { return !h.deleted_at; }).map(function(h) {
        var price = 140;
        secUsd += Number(h.quantity || 0) * price;
        return { symbol: h.symbol, price: price, currency: 'USD', as_of: new Date().toISOString(), status: 'fresh', source: 'finnhub' };
      });
      return new Response(JSON.stringify({
        quotes: quotes,
        rates: [],
        source: 'finnhub',
        total_usd: cashUsd + secUsd,
        cash_usd: cashUsd,
        securities_usd: secUsd,
        unpriced: 0,
        stale: false,
        snapshot: 'written'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    var match = pathname.match(/\\/rest\\/v1\\/([a-z0-9_]+)/i);
    if (!match) return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    var table = match[1];
    var rows = table === 'timeline' ? buildTimelineRows(db) : (db[table] || []);

    if (method === 'GET') {
      var filtered = rows.slice();
      urlObj.searchParams.forEach(function(val, key) {
        if (key === 'select' || key === 'order' || key === 'limit' || key === 'on_conflict' || key === 'or') return;
        if (val === 'is.null') {
          filtered = filtered.filter(function(r) { return r[key] === null || r[key] === undefined; });
        } else if (val === 'not.is.null') {
          filtered = filtered.filter(function(r) { return r[key] !== null && r[key] !== undefined; });
        } else if (val.indexOf('eq.') === 0) {
          var target = val.slice(3);
          filtered = filtered.filter(function(r) { return String(r[key]) === target; });
        } else if (val.indexOf('gte.') === 0) {
          var minVal = val.slice(4);
          filtered = filtered.filter(function(r) { return String(r[key]) >= minVal; });
        } else if (val.indexOf('lte.') === 0) {
          var maxVal = val.slice(4);
          filtered = filtered.filter(function(r) { return String(r[key]) <= maxVal; });
        }
      });
      var orderParam = urlObj.searchParams.get('order');
      if (orderParam) {
        var firstOrder = orderParam.split(',')[0].split('.');
        var col = firstOrder[0];
        var desc = firstOrder[1] === 'desc';
        filtered.sort(function(a, b) {
          var va = String(a[col] || '');
          var vb = String(b[col] || '');
          return desc ? vb.localeCompare(va) : va.localeCompare(vb);
        });
      }
      var limitParam = urlObj.searchParams.get('limit');
      if (limitParam) filtered = filtered.slice(0, Number(limitParam));
      var accept = (headers && (headers['Accept'] || headers['accept'])) || '';
      if (accept.indexOf('vnd.pgrst.object+json') !== -1) {
        var single = filtered[0] || null;
        return new Response(JSON.stringify(single), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(filtered), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (method === 'POST') {
      var incoming = bodyText ? JSON.parse(bodyText) : {};
      var itemsToUpsert = Array.isArray(incoming) ? incoming : [incoming];
      if (!db[table]) db[table] = [];
      var conflictKey = urlObj.searchParams.get('on_conflict') || 'id';
      itemsToUpsert.forEach(function(item) {
        var nextItem = Object.assign({ deleted_at: null, updated_at: new Date().toISOString() }, item);
        var idx = db[table].findIndex(function(r) { return r[conflictKey] && r[conflictKey] === nextItem[conflictKey]; });
        if (idx >= 0) db[table][idx] = Object.assign({}, db[table][idx], nextItem);
        else db[table].push(nextItem);
      });
      saveDb(db);
      return new Response(JSON.stringify(itemsToUpsert), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    if (method === 'PATCH') {
      var patch = bodyText ? JSON.parse(bodyText) : {};
      if (!db[table]) db[table] = [];
      var updated = [];
      db[table] = db[table].map(function(r) {
        var matches = true;
        urlObj.searchParams.forEach(function(val, key) {
          if (val.indexOf('eq.') === 0 && String(r[key]) !== val.slice(3)) matches = false;
        });
        if (!matches) return r;
        var nextRow = Object.assign({}, r, patch, { updated_at: new Date().toISOString() });
        updated.push(nextRow);
        return nextRow;
      });
      saveDb(db);
      return new Response(JSON.stringify(updated), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  var origFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    var urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : String(input));
    if (urlStr.indexOf('127.0.0.1:54321') !== -1) {
      return origFetch(input, init).catch(function() {
        var urlObj = new URL(urlStr);
        var method = (init && init.method) || (input && input.method) || 'GET';
        var bodyText = init && typeof init.body === 'string' ? init.body : '';
        var headers = (init && init.headers) || {};
        return handleLocalRest(urlObj, method.toUpperCase(), bodyText, headers);
      });
    }
    return origFetch(input, init);
  };
})();
`;

const SWIFT_SOURCE = `import Cocoa
import WebKit

class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    let webRoot: URL

    init(webRoot: URL) {
        self.webRoot = webRoot
        super.init()
    }

    func mimeType(for ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js", "mjs": return "application/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json", "webmanifest", "map": return "application/json; charset=utf-8"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "ico": return "image/x-icon"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "ttf": return "font/ttf"
        default: return "application/octet-stream"
        }
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(NSError(domain: NSURLErrorDomain, code: NSURLErrorBadURL))
            return
        }
        var relPath = url.path
        if relPath.hasPrefix("/") {
            relPath.removeFirst()
        }
        if relPath.isEmpty {
            relPath = "index.html"
        }

        var fileURL = webRoot.appendingPathComponent(relPath)
        var isDir: ObjCBool = false
        if !FileManager.default.fileExists(atPath: fileURL.path, isDirectory: &isDir) || isDir.boolValue {
            fileURL = webRoot.appendingPathComponent("index.html")
        }

        guard let data = try? Data(contentsOf: fileURL) else {
            urlSchemeTask.didFailWithError(NSError(domain: NSURLErrorDomain, code: NSURLErrorFileDoesNotExist))
            return
        }

        let mime = mimeType(for: fileURL.pathExtension)
        let headers: [String: String] = [
            "Content-Type": mime,
            "Content-Length": "\\(data.count)",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache"
        ]
        if let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers) {
            urlSchemeTask.didReceive(response)
        }
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, NSWindowDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var statusItem: NSStatusItem!
    var schemeHandler: BundleSchemeHandler?

    func applicationDidFinishLaunching(_ notification: Notification) {
        if let iconURL = Bundle.main.url(forResource: "AppIcon", withExtension: "png"),
           let iconImage = NSImage(contentsOf: iconURL) {
            NSApp.applicationIconImage = iconImage
        }

        setupMainMenu()
        setupStatusItem()

        let screenRect = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let width: CGFloat = min(1320, screenRect.width * 0.90)
        let height: CGFloat = min(860, screenRect.height * 0.88)
        let frame = NSRect(
            x: screenRect.origin.x + (screenRect.width - width) / 2,
            y: screenRect.origin.y + (screenRect.height - height) / 2,
            width: width,
            height: height
        )

        window = NSWindow(
            contentRect: frame,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "${APP_TITLE}"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        if #available(macOS 11.0, *) {
            window.toolbarStyle = .unifiedCompact
            window.titlebarSeparatorStyle = .none
        }
        window.isMovableByWindowBackground = false
        window.backgroundColor = NSColor(calibratedRed: 0.969, green: 0.957, blue: 0.925, alpha: 1.0)
        window.minSize = NSSize(width: 390, height: 640)
        window.delegate = self
        window.setFrameAutosaveName("AppMainWindow")

        let visualEffect = NSVisualEffectView(frame: window.contentView!.bounds)
        visualEffect.autoresizingMask = [.width, .height]
        visualEffect.material = .underWindowBackground
        visualEffect.blendingMode = .behindWindow
        visualEffect.state = .followsWindowActiveState

        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        if let webRoot = Bundle.main.resourceURL?.appendingPathComponent("web") {
            let handler = BundleSchemeHandler(webRoot: webRoot)
            self.schemeHandler = handler
            config.setURLSchemeHandler(handler, forURLScheme: "app")
        }

        let standaloneBridge = ${JSON.stringify(LOCAL_STANDALONE_BRIDGE_JS)}
        let startScript = WKUserScript(source: standaloneBridge, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        config.userContentController.addUserScript(startScript)

        let injectCSS = """
        document.documentElement.style.overscrollBehavior = 'none';
        document.body.style.overscrollBehavior = 'none';
        """
        let endScript = WKUserScript(source: injectCSS, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        config.userContentController.addUserScript(endScript)

        webView = WKWebView(frame: visualEffect.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")

        visualEffect.addSubview(webView)
        window.contentView = visualEffect
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        loadAppBundle()
    }

    func loadAppBundle() {
        if Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") != nil {
            webView.load(URLRequest(url: URL(string: "app://localhost/")!))
        } else {
            webView.load(URLRequest(url: URL(string: "http://127.0.0.1:4173")!))
        }
    }

    func setupMainMenu() {
        let mainMenu = NSMenu()

        // App Menu
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu()
        appMenuItem.submenu = appMenu
        appMenu.addItem(withTitle: "关于 ${APP_TITLE}", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        let quickRecordItem = NSMenuItem(title: "快速记录…", action: #selector(openQuickRecord), keyEquivalent: "n")
        quickRecordItem.target = self
        appMenu.addItem(quickRecordItem)
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "隐藏 ${APP_TITLE}", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = NSMenuItem(title: "隐藏其他", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(hideOthers)
        appMenu.addItem(withTitle: "全部显示", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "退出 ${APP_TITLE}", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        // Edit Menu (essential for WKWebView Cmd+C/V/X/A/Z)
        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "编辑")
        editMenuItem.submenu = editMenu
        editMenu.addItem(withTitle: "撤销", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "重做", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "拷贝", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        // Navigate / View Menu
        let navMenuItem = NSMenuItem()
        mainMenu.addItem(navMenuItem)
        let navMenu = NSMenu(title: "视图")
        navMenuItem.submenu = navMenu
        let tabs: [(String, String, Selector)] = [
            ("今日", "1", #selector(navToday)),
            ("资产", "2", #selector(navAssets)),
            ("趋势", "3", #selector(navTrend)),
            ("时间线", "4", #selector(navTimeline)),
            ("我的", "5", #selector(navMe))
        ]
        for (title, key, sel) in tabs {
            let item = NSMenuItem(title: title, action: sel, keyEquivalent: key)
            item.target = self
            navMenu.addItem(item)
        }
        navMenu.addItem(NSMenuItem.separator())
        let reloadItem = NSMenuItem(title: "重新加载", action: #selector(reloadWebView), keyEquivalent: "r")
        reloadItem.target = self
        navMenu.addItem(reloadItem)

        // Window Menu
        let windowMenuItem = NSMenuItem()
        mainMenu.addItem(windowMenuItem)
        let windowMenu = NSMenu(title: "窗口")
        windowMenuItem.submenu = windowMenu
        windowMenu.addItem(withTitle: "最小化", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "缩放", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        let closeItem = NSMenuItem(title: "关闭窗口", action: #selector(hideWindow), keyEquivalent: "w")
        closeItem.target = self
        windowMenu.addItem(closeItem)

        NSApp.mainMenu = mainMenu
        NSApp.windowsMenu = windowMenu
    }

    func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.title = "✦"
            button.toolTip = "${APP_TITLE} — 点击打开或快速记录"
        }
        let menu = NSMenu()
        let showItem = NSMenuItem(title: "打开主窗口", action: #selector(showMainWindow), keyEquivalent: "")
        showItem.target = self
        menu.addItem(showItem)
        menu.addItem(NSMenuItem.separator())

        let recWeight = NSMenuItem(title: "记体重…", action: #selector(openQuickRecord), keyEquivalent: "k")
        recWeight.target = self
        menu.addItem(recWeight)

        let recTrain = NSMenuItem(title: "记训练…", action: #selector(openQuickTraining), keyEquivalent: "")
        recTrain.target = self
        menu.addItem(recTrain)

        let recStudy = NSMenuItem(title: "记学习…", action: #selector(openQuickStudy), keyEquivalent: "")
        recStudy.target = self
        menu.addItem(recStudy)

        let recBlock = NSMenuItem(title: "记时间块 / 随手记…", action: #selector(openQuickBlock), keyEquivalent: "")
        recBlock.target = self
        menu.addItem(recBlock)

        menu.addItem(NSMenuItem.separator())
        menu.addItem(withTitle: "退出", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        statusItem.menu = menu
    }

    @objc func showMainWindow() {
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func hideWindow() {
        window.orderOut(nil)
    }

    @objc func reloadWebView() {
        webView.reload()
    }

    func invokeBridge(_ js: String) {
        showMainWindow()
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    @objc func openQuickRecord() {
        invokeBridge("window.__viastelaDesktop && window.__viastelaDesktop.openRecord('weight');")
    }

    @objc func openQuickTraining() {
        invokeBridge("window.__viastelaDesktop && window.__viastelaDesktop.openRecord('training');")
    }

    @objc func openQuickStudy() {
        invokeBridge("window.__viastelaDesktop && window.__viastelaDesktop.openRecord('study');")
    }

    @objc func openQuickBlock() {
        invokeBridge("window.__viastelaDesktop && window.__viastelaDesktop.openRecord('block');")
    }

    @objc func navToday() { invokeBridge("window.__viastelaDesktop && window.__viastelaDesktop.navigate('today');") }
    @objc func navAssets() { invokeBridge("window.__viastelaDesktop && window.__viastelaDesktop.navigate('assets');") }
    @objc func navTrend() { invokeBridge("window.__viastelaDesktop && window.__viastelaDesktop.navigate('trend');") }
    @objc func navTimeline() { invokeBridge("window.__viastelaDesktop && window.__viastelaDesktop.navigate('timeline');") }
    @objc func navMe() { invokeBridge("window.__viastelaDesktop && window.__viastelaDesktop.navigate('me');") }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        window.orderOut(nil)
        return false
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag {
            showMainWindow()
        }
        return true
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
`;

function main() {
  if (process.platform !== 'darwin') {
    console.log('Skipping macOS native bundle compilation on non-darwin platform.');
    return;
  }

  rmSync(APP_BUNDLE, { recursive: true, force: true });
  mkdirSync(MACOS_DIR, { recursive: true });
  mkdirSync(RESOURCES_DIR, { recursive: true });
  writeFileSync(path.join(CONTENTS, 'Info.plist'), INFO_PLIST, 'utf8');

  const distDir = path.join(ROOT, 'dist');
  if (existsSync(distDir)) {
    execFileSync('cp', ['-R', distDir, WEB_DEST], { stdio: 'inherit' });
  }

  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'viastela-macos-'));
  const iconSwiftFile = path.join(tmpDir, 'RenderIcon.swift');
  const swiftFile = path.join(tmpDir, 'AppHost.swift');
  const binPath = path.join(MACOS_DIR, EXEC_NAME);
  const iconOutPath = path.join(RESOURCES_DIR, 'AppIcon.png');
  try {
    writeFileSync(iconSwiftFile, ICON_SWIFT, 'utf8');
    execFileSync('swift', [iconSwiftFile, iconOutPath], { stdio: 'inherit' });
    writeFileSync(swiftFile, SWIFT_SOURCE, 'utf8');
    execFileSync('swiftc', ['-O', swiftFile, '-framework', 'Cocoa', '-framework', 'WebKit', '-o', binPath], {
      stdio: 'inherit',
    });
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', APP_BUNDLE], { stdio: 'inherit' });
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  const zipPath = path.join(OUT_DIR, 'viastela-macos.zip');
  rmSync(zipPath, { force: true });
  execFileSync('ditto', ['-c', '-k', '--keepParent', APP_BUNDLE, zipPath], { stdio: 'inherit' });

  const dmgPath = path.join(OUT_DIR, 'viastela-macos.dmg');
  rmSync(dmgPath, { force: true });
  try {
    execFileSync(
      'hdiutil',
      ['create', '-volname', APP_TITLE, '-srcfolder', APP_BUNDLE, '-ov', '-format', 'UDZO', dmgPath],
      { stdio: 'inherit' },
    );
  } catch {
    console.log('Note: hdiutil .dmg creation skipped in restricted environment; .app and .zip are ready.');
  }

  console.log(`Built macOS packages in ${OUT_DIR}:`);
  console.log(`  - ${APP_BUNDLE}`);
  console.log(`  - ${zipPath}`);
  if (existsSync(dmgPath)) console.log(`  - ${dmgPath}`);
}

main();
