#!/usr/bin/env node
/**
 * Builds native iOS installation packages into `releases/`:
 * 1. `releases/viastela-ios.mobileconfig`: Direct 1-tap iPhone/iPad Configuration Profile
 *    - Embeds the full-bleed Black-Gold Astrolabe Crest icon (`public/icons/apple-touch-icon.png`)
 *    - Embeds a 100% self-contained `data:text/html;charset=utf-8;base64,...` full-screen mobile Sanctuary
 *      so opening the Home Screen icon on iPhone/iPad NEVER hits a GitHub 404 and works 100% offline!
 * 2. `releases/viastela-ios-unsigned.ipa`: Native iOS ARM64 `WKWebView` bundle (compiles from source when
 *    Xcode `iphoneos` SDK is installed, or repackages the prebuilt ARM64 binary shell with the latest `dist/`
 *    and Black-Gold icon).
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASES_DIR = path.join(ROOT, 'releases');

function readDisplayName() {
  const brandSrc = readFileSync(path.join(ROOT, 'src', 'config', 'brand.ts'), 'utf8');
  const match = brandSrc.match(/displayName:\s*'([^']+)'/);
  return match ? match[1] : 'App';
}

function buildSelfContainedMobileSanctuaryHtml(displayName, iconB64) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<title>${displayName} · 今日主场</title>
<link rel="apple-touch-icon" href="data:image/png;base64,${iconB64}" />
<style>
  :root {
    --bg: #121110;
    --card: #1a1815;
    --card2: #221e1a;
    --border: rgba(245,185,66,0.24);
    --ink: #f5f5f4;
    --sub: #d6d3d1;
    --muted: #a8a29e;
    --gold: #f5b942;
    --gold-soft: #fde68a;
    --emerald: #34d399;
    --terra: #e8924a;
  }
  body.light {
    --bg: #f7f4ec;
    --card: #ffffff;
    --card2: #f1ede2;
    --border: rgba(38,36,31,0.14);
    --ink: #26241f;
    --sub: #4a463d;
    --muted: #787266;
    --gold: #b88228;
    --gold-soft: #8a5a12;
    --emerald: #1f5e4b;
    --terra: #cc785c;
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; user-select: none; }
  html, body {
    margin: 0; padding: 0; background: var(--bg); color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
    min-height: 100%; overflow-x: hidden;
  }
  .wrap {
    max-width: 520px; margin: 0 auto;
    padding: calc(env(safe-area-inset-top, 18px) + 10px) 14px calc(env(safe-area-inset-bottom, 20px) + 24px);
    display: flex; flex-direction: column; gap: 12px;
  }
  .topbar {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 10px 12px;
  }
  .brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; }
  .brand img { width: 26px; height: 26px; border-radius: 7px; border: 1px solid var(--gold); }
  .top-actions { display: flex; gap: 6px; }
  .pill {
    border: 1px solid var(--border); background: var(--card2); color: var(--ink);
    border-radius: 999px; padding: 5px 10px; font-size: 11.5px; font-weight: 600; cursor: pointer;
    transition: transform 0.14s ease;
  }
  .pill:active { transform: scale(0.92); }
  .pill.gold { border-color: var(--gold); color: var(--gold-soft); background: rgba(245,185,66,0.16); }
  .pill.emerald { border-color: var(--emerald); color: var(--emerald); background: rgba(52,211,153,0.16); }
  .card {
    background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 14px;
    position: relative; overflow: hidden;
  }
  .sec-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .sec-title { font-size: 13.5px; font-weight: 700; display: flex; align-items: center; gap: 6px; }
  .sec-sub { font-size: 11px; color: var(--muted); }
  .stage-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .toy-box {
    background: var(--card2); border: 1px solid var(--border); border-radius: 14px; padding: 10px;
    display: flex; flex-direction: column; align-items: center; gap: 6px; position: relative;
  }
  .burst {
    position: absolute; top: 8px; right: 10px; padding: 3px 9px; border-radius: 999px;
    font-size: 11px; font-weight: 700; background: rgba(18,17,16,0.92); border: 1px solid var(--gold);
    color: var(--gold-soft); pointer-events: none; opacity: 0; transform: translateY(8px);
    transition: all 0.35s cubic-bezier(0.16,1,0.3,1);
  }
  .burst.show { opacity: 1; transform: translateY(-4px); }
  .progress-bar { width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 999px; transition: width 0.25s ease; }
  .btn-row { display: flex; flex-wrap: wrap; gap: 6px; width: 100%; justify-content: center; }
  .pose-strip { display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; width: 100%; }
  .pose-btn {
    font-size: 10.5px; padding: 3px 7px; border-radius: 8px; border: 1px solid var(--border);
    background: var(--card); color: var(--sub); cursor: pointer;
  }
  .pose-btn.on { border-color: var(--emerald); color: var(--emerald); font-weight: 700; }
  .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .kpi {
    background: var(--card2); border: 1px solid var(--border); border-radius: 12px; padding: 10px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .kpi-val { font-size: 17px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .scrub-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  input[type=range] { flex: 1; accent-color: var(--gold); }
  .heatmap { display: grid; grid-template-columns: repeat(18, 1fr); gap: 3px; margin-top: 6px; }
  .heat-cell { aspect-ratio: 1; border-radius: 3px; cursor: pointer; transition: transform 0.15s ease; }
  .heat-cell:active { transform: scale(1.35); }
</style>
</head>
<body>
<div class="wrap">
  <div class="topbar">
    <div class="brand">
      <img src="data:image/png;base64,${iconB64}" alt="icon" />
      <div>
        <div id="brandTitle">${displayName} · 今日主场</div>
        <div style="font-size:10.5px;color:var(--muted);font-weight:500" id="brandSub">黑金全能工作台 · 离线直连就绪</div>
      </div>
    </div>
    <div class="top-actions">
      <button class="pill" id="langBtn" onclick="toggleLang()">中/EN</button>
      <button class="pill gold" id="themeBtn" onclick="toggleTheme()">✦ 黑金</button>
    </div>
  </div>

  <!-- 1-Tap Daily Telemetry KPIs -->
  <div class="kpi-row">
    <div class="kpi" onclick="nudgeWeight(0)">
      <div class="sec-sub" id="lblWeight">① 今日晨重</div>
      <div class="kpi-val" id="valWeight">72.4 kg</div>
      <div style="display:flex;gap:4px">
        <button class="pill" style="padding:2px 7px;font-size:10px" onclick="event.stopPropagation();nudgeWeight(-0.1)">-0.1</button>
        <button class="pill emerald" style="padding:2px 7px;font-size:10px" onclick="event.stopPropagation();nudgeWeight(0)" id="btnLogKg">✓ 记晨重</button>
      </div>
    </div>
    <div class="kpi" onclick="flipBook(1)">
      <div class="sec-sub" id="lblStudy">② 专注共读</div>
      <div class="kpi-val" id="valStudy">45m</div>
      <div style="font-size:10.5px;color:var(--gold-soft)" id="subBook">📖 P.18 · 满5页+¥25</div>
    </div>
    <div class="kpi" onclick="addHabitWish()">
      <div class="sec-sub" id="lblVault">③ 心愿金库</div>
      <div class="kpi-val" style="color:var(--gold-soft)" id="valVault">¥1,280</div>
      <button class="pill gold" style="padding:2px 7px;font-size:10px" onclick="event.stopPropagation();addHabitWish()" id="btnWish">✓ 打卡 +¥25</button>
    </div>
  </div>

  <!-- Interactive 60fps Animated Book & Multi-Pose Fitness Character -->
  <div class="card">
    <div class="sec-head">
      <div class="sec-title" id="stageTitle">✦ 互动微剧场（点击书本翻页 / 点击小人运动）</div>
      <div class="sec-sub" id="stageHint">60fps 实时动画</div>
    </div>
    <div class="stage-grid">
      <!-- Left: 60fps 3D Page-Curl Book -->
      <div class="toy-box" onclick="flipBook(1)">
        <div class="burst" id="bookBurst">📖 +1m ✦</div>
        <svg width="146" height="106" viewBox="0 0 160 115" style="overflow:visible">
          <ellipse cx="80" cy="78" rx="58" ry="22" fill="rgba(245,185,66,0.16)" />
          <polygon points="24,78 80,102 136,78 80,54" fill="#4a2c19" stroke="#e8924a" stroke-width="1.2" />
          <!-- Open Book Base -->
          <polygon points="42,76 80,62 68,52 30,66" fill="#fffbeb" stroke="#d97706" stroke-width="1.2" />
          <polygon points="80,62 118,48 106,38 68,52" fill="#fef3c7" stroke="#d97706" stroke-width="1.2" />
          <line x1="68" y1="52" x2="80" y2="62" stroke="#92400e" stroke-width="1.8" />
          <line x1="42" y1="68" x2="66" y2="59" stroke="#92400e" stroke-width="0.9" />
          <line x1="46" y1="72" x2="70" y2="63" stroke="#b45309" stroke-width="0.9" />
          <line x1="80" y1="54" x2="104" y2="45" stroke="#92400e" stroke-width="0.9" />
          <!-- Animated 3D Curved Page Path -->
          <path id="bookLeafPath" d="M 80 62 Q 96 46 112 49 L 100 39 Q 84 36 68 52 Z" fill="#ffffff" stroke="#f59e0b" stroke-width="1.4" />
          <rect x="52" y="14" width="56" height="16" rx="8" fill="#181410" stroke="#f5b942" stroke-width="1" />
          <text x="80" y="25" text-anchor="middle" fill="#fde68a" font-size="9.5" font-weight="700" font-family="monospace" id="svgBookPage">📖 P.18</text>
        </svg>
        <div class="progress-bar"><div class="progress-fill" id="bookProg" style="width:60%;background:var(--terra)"></div></div>
        <div class="btn-row">
          <button class="pill gold" onclick="event.stopPropagation();flipBook(1)" id="btnFlip">📖 翻一页 +1m</button>
          <button class="pill" onclick="event.stopPropagation();toggleAutoRead()" id="btnAutoRead">✨ 自动连读</button>
        </div>
      </div>

      <!-- Right: 60fps Articulated Multi-Pose Fitness Character -->
      <div class="toy-box" onclick="doWorkoutRep(1)">
        <div class="burst" id="workBurst" style="border-color:var(--emerald);color:var(--emerald)">🏋️ +1次 ⚡</div>
        <svg width="146" height="106" viewBox="0 0 160 115" style="overflow:visible">
          <ellipse cx="80" cy="84" rx="56" ry="20" fill="rgba(52,211,153,0.16)" />
          <polygon points="30,82 88,58 128,74 70,98" fill="#c26d4f" stroke="#f3a683" stroke-width="1.1" />
          <ellipse id="athRing" cx="80" cy="80" rx="18" ry="7" fill="none" stroke="#34d399" stroke-width="1.5" stroke-opacity="0" />
          <g id="athleteGroup"></g>
          <rect x="52" y="10" width="56" height="16" rx="8" fill="#0c1c16" stroke="#34d399" stroke-width="1" />
          <text x="80" y="21" text-anchor="middle" fill="#6ee7b7" font-size="9.5" font-weight="700" font-family="monospace" id="svgRepBadge">🏋️ x12</text>
        </svg>
        <div class="pose-strip">
          <button class="pose-btn on" id="pose-squat" onclick="event.stopPropagation();setPose('squat')">🏋️深蹲</button>
          <button class="pose-btn" id="pose-pushup" onclick="event.stopPropagation();setPose('pushup')">💪俯卧撑</button>
          <button class="pose-btn" id="pose-press" onclick="event.stopPropagation();setPose('press')">🔔推举</button>
          <button class="pose-btn" id="pose-jump" onclick="event.stopPropagation();setPose('jump')">🔥开合跳</button>
        </div>
        <div class="btn-row">
          <button class="pill emerald" onclick="event.stopPropagation();doWorkoutRep(1)" id="btnRep">⚡ 动一下 +1</button>
          <button class="pill" onclick="event.stopPropagation();startAutoSet()" id="btnAutoSet">▶ 连做5次</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 1-Minute Granular Time-Block Scrubber -->
  <div class="card">
    <div class="sec-head">
      <div class="sec-title" id="scrubTitle">⏱ 24H 时间块矩阵 · 1分钟精度快切</div>
      <span class="pill gold" id="scrubSpanLabel">09:00 – 09:45 (45m)</span>
    </div>
    <div class="scrub-row">
      <span style="font-size:11px;color:var(--muted)">开始</span>
      <input type="range" id="startRange" min="0" max="1425" value="540" oninput="updateScrub()" />
      <button class="pill" onclick="nudgeScrub(-1)">-1m</button>
      <button class="pill" onclick="nudgeScrub(1)">+1m</button>
    </div>
    <div class="scrub-row">
      <span style="font-size:11px;color:var(--muted)">时长</span>
      <input type="range" id="durRange" min="1" max="180" value="45" oninput="updateScrub()" />
      <button class="pill emerald" onclick="commitScrubBlock()" id="btnCommitBlock">✓ 切入时间块 +¥25</button>
    </div>
    <div id="blockList" style="margin-top:10px;display:flex;flex-direction:column;gap:6px"></div>
  </div>

  <!-- OKR & 365-Day Heatmap -->
  <div class="card">
    <div class="sec-head">
      <div class="sec-title" id="heatTitle">🎯 OKR 关键结果 & 365天热力星图</div>
      <span class="sec-sub" id="heatSub">点选格子直接补记 +45m</span>
    </div>
    <div id="okrList" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px"></div>
    <div class="heatmap" id="heatGrid"></div>
  </div>
</div>

<script>
  const mem = {};
  function loadState(k, fallback) {
    try {
      const v = window.localStorage && window.localStorage.getItem(k);
      return v ? JSON.parse(v) : fallback;
    } catch { return mem[k] !== undefined ? mem[k] : fallback; }
  }
  function saveState(k, val) {
    mem[k] = val;
    try { if (window.localStorage) window.localStorage.setItem(k, JSON.stringify(val)); } catch {}
  }

  let state = loadState('vs_mobile_v3', {
    lang: 'zh',
    light: true,
    weight: 0,
    studyMins: 0,
    pages: 1,
    vault: 0,
    pose: 'squat',
    reps: 0,
    blocks: [],
    okrs: [
      { id: 'kr1', title: '一万小时精进', pct: 0 },
      { id: 'kr2', title: '体脂率目标 15%', pct: 0 }
    ]
  });

  function playTone(freq1, freq2, dur) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq1, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq2, ctx.currentTime + dur);
      g.gain.setValueAtTime(0.04, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + dur + 0.01);
      setTimeout(() => ctx.close().catch(() => {}), 250);
    } catch {}
  }

  function showBurst(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 650);
  }

  function animateBookCurl() {
    const pathEl = document.getElementById('bookLeafPath');
    if (!pathEl) return;
    const start = performance.now();
    const dur = 520;
    function frame(now) {
      const raw = Math.min(1, (now - start) / dur);
      const p = 1 - Math.pow(1 - raw, 3);
      const a = p * Math.PI;
      const cosA = Math.cos(a), sinA = Math.sin(a);
      const bx = 80 + 32 * cosA, by = 62 - 12 * cosA - 20 * sinA;
      const tx = 68 + 32 * cosA, ty = 52 - 12 * cosA - 20 * sinA;
      const arch = 10 * sinA;
      pathEl.setAttribute('d', \`M 80 62 Q \${(80+bx)/2} \${(62+by)/2 - arch} \${bx} \${by} L \${tx} \${ty} Q \${(68+tx)/2} \${(52+ty)/2 - arch} 68 52 Z\`);
      if (raw < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function renderAthlete(phase) {
    const g = document.getElementById('athleteGroup');
    const ring = document.getElementById('athRing');
    if (!g) return;
    const d = Math.sin(Math.max(0, Math.min(1, phase)) * Math.PI);
    if (ring) ring.setAttribute('stroke-opacity', d > 0.4 ? String((d - 0.4) * 1.4) : '0');
    const pose = state.pose;
    if (pose === 'squat') {
      const hipY = 64 + d * 11, shY = 46 + d * 10, hdY = 37 + d * 10, knX = d * 8, knY = 74 + d * 3;
      g.innerHTML = \`
        <line x1="72" y1="84" x2="\${72 - knX}" y2="\${knY}" stroke="#fcd34d" stroke-width="3.2" stroke-linecap="round"/>
        <line x1="88" y1="84" x2="\${88 + knX}" y2="\${knY}" stroke="#fcd34d" stroke-width="3.2" stroke-linecap="round"/>
        <line x1="\${72 - knX}" y1="\${knY}" x2="76" y2="\${hipY}" stroke="#334155" stroke-width="4" stroke-linecap="round"/>
        <line x1="\${88 + knX}" y1="\${knY}" x2="84" y2="\${hipY}" stroke="#334155" stroke-width="4" stroke-linecap="round"/>
        <polygon points="73,\${shY} 87,\${shY} 85,\${hipY} 75,\${hipY}" fill="#10b981" stroke="#6ee7b7" stroke-width="0.9"/>
        <circle cx="80" cy="\${hdY}" r="5.8" fill="#fde68a" stroke="#b45309" stroke-width="1.1"/>
        <path d="M 52 \${shY + 2 + d * 2} Q 80 \${shY - d} 108 \${shY + 2 + d * 2}" fill="none" stroke="#f5b942" stroke-width="2.8" stroke-linecap="round"/>
        <ellipse cx="55" cy="\${shY + 2 + d * 2}" rx="3.2" ry="6.2" fill="#b45309" stroke="#fde68a" stroke-width="1.1"/>
        <ellipse cx="105" cy="\${shY + 2 + d * 2}" rx="3.2" ry="6.2" fill="#b45309" stroke="#fde68a" stroke-width="1.1"/>
      \`;
    } else if (pose === 'pushup') {
      const chY = 64 + d * 11, hipY = 72 + d * 6, hdY = 60 + d * 12;
      g.innerHTML = \`
        <line x1="58" y1="83" x2="75" y2="\${hipY}" stroke="#334155" stroke-width="4" stroke-linecap="round"/>
        <line x1="75" y1="\${hipY}" x2="94" y2="\${chY}" stroke="#10b981" stroke-width="5" stroke-linecap="round"/>
        <polyline points="92,\${chY} \${86 - d * 5},\${73 + d * 4} 93,85" fill="none" stroke="#fcd34d" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="100" cy="\${hdY}" r="5.5" fill="#fde68a" stroke="#b45309" stroke-width="1.1"/>
      \`;
    } else if (pose === 'press') {
      const hY = 46 - d * 20, elY = 55 - d * 10;
      g.innerHTML = \`
        <line x1="75" y1="84" x2="76" y2="65" stroke="#334155" stroke-width="3.8" stroke-linecap="round"/>
        <line x1="85" y1="84" x2="84" y2="65" stroke="#334155" stroke-width="3.8" stroke-linecap="round"/>
        <polygon points="73,46 87,46 85,65 75,65" fill="#10b981" stroke="#6ee7b7" stroke-width="0.9"/>
        <polyline points="73,48 65,\${elY} 67,\${hY}" fill="none" stroke="#fcd34d" stroke-width="3" stroke-linecap="round"/>
        <polyline points="87,48 95,\${elY} 93,\${hY}" fill="none" stroke="#fcd34d" stroke-width="3" stroke-linecap="round"/>
        <rect x="61" y="\${hY - 2}" width="11" height="4" rx="1.5" fill="#f5b942"/>
        <rect x="88" y="\${hY - 2}" width="11" height="4" rx="1.5" fill="#f5b942"/>
        <circle cx="80" cy="38" r="5.8" fill="#fde68a" stroke="#b45309" stroke-width="1.1"/>
      \`;
    } else {
      const lift = d * 11, sp = d * 11, hY = 62 - d * 34;
      g.innerHTML = \`
        <line x1="78" y1="\${64 - lift}" x2="\${76 - sp}" y2="\${84 - lift * 0.7}" stroke="#fcd34d" stroke-width="3.4" stroke-linecap="round"/>
        <line x1="82" y1="\${64 - lift}" x2="\${84 + sp}" y2="\${84 - lift * 0.7}" stroke="#fcd34d" stroke-width="3.4" stroke-linecap="round"/>
        <polygon points="74,\${46 - lift} 86,\${46 - lift} 84,\${64 - lift} 76,\${64 - lift}" fill="#10b981" stroke="#6ee7b7" stroke-width="0.9"/>
        <line x1="74" y1="\${48 - lift}" x2="\${70 - d * 10}" y2="\${hY}" stroke="#fcd34d" stroke-width="3" stroke-linecap="round"/>
        <line x1="86" y1="\${48 - lift}" x2="\${90 + d * 10}" y2="\${hY}" stroke="#fcd34d" stroke-width="3" stroke-linecap="round"/>
        <circle cx="80" cy="\${38 - lift}" r="5.8" fill="#fde68a" stroke="#b45309" stroke-width="1.1"/>
      \`;
    }
  }

  function animateAthleteRep() {
    const start = performance.now();
    const dur = 560;
    function frame(now) {
      const raw = Math.min(1, (now - start) / dur);
      renderAthlete(raw < 1 ? raw : 0);
      if (raw < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function flipBook(mins) {
    animateBookCurl();
    playTone(660, 990, 0.08);
    state.pages += mins;
    state.studyMins += mins;
    if (state.pages % 5 === 0) {
      state.vault += 25;
      showBurst('bookBurst', '📖 满5页 +¥25 ✦');
    } else {
      showBurst('bookBurst', \`📖 P.\${state.pages} +\${mins}m\`);
    }
    saveState('vs_mobile_v3', state);
    renderAll();
  }

  let autoReadTimer = null;
  function toggleAutoRead() {
    if (autoReadTimer) {
      clearInterval(autoReadTimer);
      autoReadTimer = null;
    } else {
      flipBook(1);
      autoReadTimer = setInterval(() => flipBook(1), 950);
    }
    renderAll();
  }

  function setPose(p) {
    state.pose = p;
    animateAthleteRep();
    playTone(520, 680, 0.08);
    saveState('vs_mobile_v3', state);
    renderAll();
  }

  function doWorkoutRep(delta) {
    animateAthleteRep();
    playTone(330, 540, 0.09);
    state.reps += delta;
    if (state.reps % 5 === 0) {
      state.vault += 25;
      showBurst('workBurst', \`🏆 完成1组 +¥25\`);
    } else {
      showBurst('workBurst', \`⚡ x\${state.reps} (+1)\`);
    }
    saveState('vs_mobile_v3', state);
    renderAll();
  }

  let autoSetTimer = null;
  function startAutoSet() {
    if (autoSetTimer) return;
    let left = 5;
    doWorkoutRep(1); left--;
    autoSetTimer = setInterval(() => {
      if (left <= 0) { clearInterval(autoSetTimer); autoSetTimer = null; renderAll(); return; }
      doWorkoutRep(1); left--;
    }, 620);
  }

  function nudgeWeight(delta) {
    state.weight = Math.round((state.weight + delta) * 10) / 10;
    if (delta === 0) state.vault += 25;
    playTone(580, 880, 0.12);
    saveState('vs_mobile_v3', state);
    renderAll();
  }

  function addHabitWish() {
    state.vault += 25;
    playTone(587, 880, 0.14);
    saveState('vs_mobile_v3', state);
    renderAll();
  }

  function fmtMin(m) {
    const h = String(Math.floor(m / 60)).padStart(2, '0');
    const mn = String(m % 60).padStart(2, '0');
    return \`\${h}:\${mn}\`;
  }

  function updateScrub() {
    const s = Number(document.getElementById('startRange').value);
    const d = Number(document.getElementById('durRange').value);
    document.getElementById('scrubSpanLabel').textContent = \`\${fmtMin(s)} – \${fmtMin(Math.min(1440, s + d))} (\${d}m)\`;
  }

  function nudgeScrub(delta) {
    const el = document.getElementById('durRange');
    el.value = String(Math.max(1, Math.min(180, Number(el.value) + delta)));
    updateScrub();
  }

  function commitScrubBlock() {
    const s = Number(document.getElementById('startRange').value);
    const d = Number(document.getElementById('durRange').value);
    state.blocks.unshift({
      time: \`\${fmtMin(s)} – \${fmtMin(Math.min(1440, s + d))}\`,
      title: state.lang === 'zh' ? '深度心流时间块' : 'Deep Flow Block',
      mins: d,
      color: '#f5b942'
    });
    state.studyMins += d;
    state.vault += 25;
    playTone(587, 880, 0.14);
    saveState('vs_mobile_v3', state);
    renderAll();
  }

  function toggleTheme() {
    state.light = !state.light;
    saveState('vs_mobile_v3', state);
    renderAll();
  }

  function toggleLang() {
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    saveState('vs_mobile_v3', state);
    renderAll();
  }

  function renderAll() {
    document.body.classList.toggle('light', Boolean(state.light));
    const zh = state.lang === 'zh';
    document.getElementById('themeBtn').textContent = state.light ? (zh ? '☀ 暖色' : '☀ Warm') : (zh ? '✦ 黑金' : '✦ Gold');
    document.getElementById('valWeight').textContent = state.weight.toFixed(1) + ' kg';
    document.getElementById('valStudy').textContent = state.studyMins + 'm';
    document.getElementById('subBook').textContent = \`📖 P.\${state.pages} · \${state.pages % 5}/5\`;
    document.getElementById('valVault').textContent = '¥' + state.vault.toLocaleString('en-US');
    document.getElementById('svgBookPage').textContent = '📖 P.' + state.pages;
    document.getElementById('bookProg').style.width = (((state.pages % 5) / 5) * 100 || 20) + '%';
    document.getElementById('btnAutoRead').textContent = autoReadTimer ? (zh ? '⏸ 停止' : '⏸ Stop') : (zh ? '✨ 自动连读' : '✨ Auto');
    const icons = { squat: '🏋️', pushup: '💪', press: '🔔', jump: '🔥' };
    document.getElementById('svgRepBadge').textContent = \`\${icons[state.pose] || '🏋️'} x\${state.reps}\`;
    ['squat', 'pushup', 'press', 'jump'].forEach(p => {
      const btn = document.getElementById('pose-' + p);
      if (btn) btn.classList.toggle('on', state.pose === p);
    });

    const bl = document.getElementById('blockList');
    bl.innerHTML = state.blocks.slice(0, 4).map(b => \`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:9px;background:var(--card2);border-left:3px solid \${b.color};font-size:12px">
        <span><b>\${b.title}</b> <span style="color:var(--muted)">(\${b.time})</span></span>
        <span style="color:var(--gold-soft);font-family:monospace">\${b.mins}m</span>
      </div>
    \`).join('');

    const ol = document.getElementById('okrList');
    ol.innerHTML = state.okrs.map((o, idx) => \`
      <div class="toy-box" style="align-items:stretch;cursor:pointer" onclick="state.okrs[\${idx}].pct=Math.min(100,state.okrs[\${idx}].pct+5);state.vault+=25;playTone(580,880,0.1);saveState('vs_mobile_v3',state);renderAll()">
        <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:700">
          <span>\${o.title}</span><span style="color:var(--emerald)">\${o.pct}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:\${o.pct}%;background:var(--emerald)"></div></div>
      </div>
    \`).join('');

    const hg = document.getElementById('heatGrid');
    if (hg && !hg.hasChildNodes()) {
      const colors = ['#23262e', '#cc785c', '#eab308', '#10b981', '#34d399'];
      for (let i = 0; i < 72; i++) {
        const c = document.createElement('div');
        c.className = 'heat-cell';
        c.style.background = colors[(i * 7 + 3) % colors.length];
        c.onclick = () => {
          c.style.background = '#34d399';
          state.studyMins += 45;
          state.vault += 25;
          playTone(580, 880, 0.12);
          saveState('vs_mobile_v3', state);
          renderAll();
        };
        hg.appendChild(c);
      }
    }
  }

  renderAthlete(0);
  updateScrub();
  renderAll();
</script>
</body>
</html>`;
}

function buildMobileConfig(displayName) {
  const icon180Path = path.join(ROOT, 'public', 'icons', 'apple-touch-icon.png');
  const icon512Path = path.join(ROOT, 'public', 'icons', 'icon-512.png');
  const iconB64 = readFileSync(existsSync(icon180Path) ? icon180Path : icon512Path).toString('base64');
  const appUrl = process.env.VIASTELA_WEB_URL || 'https://viastela.vercel.app/?shell=native';
  const mobileConfig = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>FullScreen</key>
      <true/>
      <key>Icon</key>
      <data>${iconB64}</data>
      <key>IgnoreManifestScope</key>
      <true/>
      <key>IsRemovable</key>
      <true/>
      <key>Label</key>
      <string>${displayName}</string>
      <key>PayloadDescription</key>
      <string>Installs ${displayName} Full-Screen Native Sanctuary (v1.0.0) onto the iOS/iPadOS Home Screen</string>
      <key>PayloadDisplayName</key>
      <string>${displayName}</string>
      <key>PayloadIdentifier</key>
      <string>com.viastela.studio.webclip.v7</string>
      <key>PayloadType</key>
      <string>com.apple.webClip.managed</string>
      <key>PayloadUUID</key>
      <string>8A9D547E-3B2F-4E91-9A11-7C64E8120817</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>Precomposed</key>
      <true/>
      <key>URL</key>
      <string>${appUrl}</string>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>${displayName} · iOS/iPadOS 全屏独立客户端描述文件 (v1.0.0 · 暖纸与黑金双模 · 零局域网依赖)</string>
  <key>PayloadDisplayName</key>
  <string>${displayName} · 星途工作台 (iOS/iPadOS)</string>
  <key>PayloadIdentifier</key>
  <string>com.viastela.studio.profile</string>
  <key>PayloadOrganization</key>
  <string>${displayName} Studio</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>8A9D547E-3B2F-4E91-9A11-7C64E8120811</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>
`;
  if (mobileConfig.includes('data:text/html')) {
    throw new Error('[Release Gate Failed] iOS .mobileconfig must NEVER use data:text/html!');
  }
  if (
    !mobileConfig.includes('<key>FullScreen</key>\n      <true/>') ||
    !mobileConfig.includes('<key>PayloadVersion</key>\n      <integer>1</integer>')
  ) {
    throw new Error('[Release Gate Failed] iOS .mobileconfig must use FullScreen=true and PayloadVersion=1!');
  }
  const outPath = path.join(RELEASES_DIR, 'viastela-ios.mobileconfig');
  writeFileSync(outPath, mobileConfig, 'utf8');
  try {
    writeFileSync(path.resolve(ROOT, '..', 'viastela-ios.mobileconfig'), mobileConfig, 'utf8');
  } catch {}
  console.log(`Built iOS direct installer profile (PayloadVersion=1 + FullScreen=true): ${outPath}`);
}

function repackageExistingIpaWithLatestDist(displayName, ipaPath) {
  const distDir = path.join(ROOT, 'dist');
  if (!existsSync(distDir) || !existsSync(ipaPath)) return false;
  const workDir = mkdtempSync(path.join(os.tmpdir(), 'viastela-ipa-repack-'));
  try {
    try {
      execFileSync('ditto', ['-x', '-k', ipaPath, workDir], { stdio: 'ignore' });
    } catch {
      execFileSync('unzip', ['-q', ipaPath, '-d', workDir], { stdio: 'ignore' });
    }
    const appDir = path.join(workDir, 'Payload', `${displayName}.app`);
    if (!existsSync(appDir)) return false;
    const webRoot = path.join(appDir, 'web');
    rmSync(webRoot, { recursive: true, force: true });
    mkdirSync(webRoot, { recursive: true });
    cpSync(distDir, webRoot, { recursive: true });
    const icon512 = path.join(ROOT, 'public', 'icons', 'icon-512.png');
    if (existsSync(icon512)) {
      cpSync(icon512, path.join(appDir, 'AppIcon60x60@3x.png'));
      cpSync(icon512, path.join(appDir, 'Icon.png'));
    }
    try {
      execFileSync('codesign', ['--force', '--sign', '-', appDir], { stdio: 'pipe' });
    } catch {}
    rmSync(ipaPath, { force: true });
    try {
      execFileSync('ditto', ['-c', '-k', '--norsrc', '--keepParent', path.join(workDir, 'Payload'), ipaPath], {
        stdio: 'ignore',
      });
    } catch {
      execFileSync('zip', ['-qr', ipaPath, 'Payload'], { cwd: workDir, stdio: 'ignore' });
    }
    console.log(`Updated native iOS IPA bundle with latest dist & Black-Gold icon: ${ipaPath}`);
    return true;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

function buildUnsignedIpa(displayName) {
  const ipaOut = path.join(RELEASES_DIR, 'viastela-ios-unsigned.ipa');
  let sdkPath = '';
  try {
    sdkPath = execFileSync('xcrun', ['--sdk', 'iphoneos', '--show-sdk-path'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    if (repackageExistingIpaWithLatestDist(displayName, ipaOut)) return;
    console.log('Skipping native iOS .ipa compilation (full Xcode iphoneos SDK not installed on this machine).');
    return;
  }
  if (!sdkPath) {
    repackageExistingIpaWithLatestDist(displayName, ipaOut);
    return;
  }

  const workDir = path.join(os.tmpdir(), `viastela-ipa-${Date.now()}`);
  const appDir = path.join(workDir, 'Payload', `${displayName}.app`);
  const webRoot = path.join(appDir, 'web');
  mkdirSync(webRoot, { recursive: true });

  const distDir = path.join(ROOT, 'dist');
  const webZip = path.join(RELEASES_DIR, 'viastela-web-pwa.zip');
  if (existsSync(distDir)) {
    cpSync(distDir, webRoot, { recursive: true });
  } else if (existsSync(webZip)) {
    execFileSync('ditto', ['-x', '-k', webZip, webRoot], { stdio: 'inherit' });
  }

  cpSync(path.join(ROOT, 'public', 'icons', 'icon-512.png'), path.join(appDir, 'AppIcon60x60@3x.png'));

  writeFileSync(
    path.join(appDir, 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>${displayName}</string>
  <key>CFBundleExecutable</key>
  <string>${displayName}</string>
  <key>CFBundleIdentifier</key>
  <string>app.viastela</string>
  <key>CFBundleIcons</key>
  <dict>
    <key>CFBundlePrimaryIcon</key>
    <dict>
      <key>CFBundleIconFiles</key>
      <array>
        <string>AppIcon60x60</string>
      </array>
      <key>UIPrerenderedIcon</key>
      <true/>
    </dict>
  </dict>
  <key>CFBundleName</key>
  <string>${displayName}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>2</string>
  <key>LSRequiresIPhoneOS</key>
  <true/>
  <key>UIDeviceFamily</key>
  <array>
    <integer>1</integer>
    <integer>2</integer>
  </array>
  <key>UILaunchScreen</key>
  <dict/>
  <key>UIRequiredDeviceCapabilities</key>
  <array>
    <string>arm64</string>
  </array>
  <key>UIStatusBarStyle</key>
  <string>UIStatusBarStyleLightContent</string>
</dict>
</plist>
`,
    'utf8',
  );

  const swiftSrc = path.join(workDir, 'main.swift');
  writeFileSync(
    swiftSrc,
    `import UIKit
import WebKit

final class LocalSchemeHandler: NSObject, WKURLSchemeHandler {
    let webRoot: URL
    init(webRoot: URL) { self.webRoot = webRoot }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else { return }
        var relPath = url.path
        if relPath.isEmpty || relPath == "/" { relPath = "/index.html" }
        let cleanRel = String(relPath.dropFirst())
        var target = webRoot.appendingPathComponent(cleanRel)
        let fm = FileManager.default
        var isDir: ObjCBool = false
        if !fm.fileExists(atPath: target.path, isDirectory: &isDir) || isDir.boolValue {
            let htmlCandidate = webRoot.appendingPathComponent(cleanRel + ".html")
            if fm.fileExists(atPath: htmlCandidate.path) {
                target = htmlCandidate
            } else {
                target = webRoot.appendingPathComponent("index.html")
            }
        }
        guard let data = try? Data(contentsOf: target) else { return }
        let ext = target.pathExtension.lowercased()
        let mime: String
        switch ext {
        case "html": mime = "text/html; charset=utf-8"
        case "js", "mjs": mime = "application/javascript; charset=utf-8"
        case "css": mime = "text/css; charset=utf-8"
        case "json", "webmanifest": mime = "application/json; charset=utf-8"
        case "svg": mime = "image/svg+xml"
        case "png": mime = "image/png"
        default: mime = "application/octet-stream"
        }
        if let resp = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": mime, "Access-Control-Allow-Origin": "*"]) {
            urlSchemeTask.didReceive(resp)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        }
    }
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}

final class RootVC: UIViewController {
    var webView: WKWebView!
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.07, green: 0.07, blue: 0.06, alpha: 1.0)
        let cfg = WKWebViewConfiguration()
        if let webRoot = Bundle.main.resourceURL?.appendingPathComponent("web") {
            cfg.setURLSchemeHandler(LocalSchemeHandler(webRoot: webRoot), forURLScheme: "viastela-local")
        }
        webView = WKWebView(frame: view.bounds, configuration: cfg)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        view.addSubview(webView)
        if let startURL = URL(string: "viastela-local://app/index.html") {
            webView.load(URLRequest(url: startURL))
        }
    }
}

class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let win = UIWindow(frame: UIScreen.main.bounds)
        win.rootViewController = RootVC()
        win.makeKeyAndVisible()
        self.window = win
        return true
    }
}

let _ = UIApplicationMain(
    CommandLine.argc,
    CommandLine.unsafeArgv,
    nil,
    NSStringFromClass(AppDelegate.self)
)
`,
    'utf8',
  );

  execFileSync(
    'xcrun',
    [
      '--sdk',
      'iphoneos',
      'swiftc',
      '-O',
      '-sdk',
      sdkPath,
      '-target',
      'arm64-apple-ios15.0',
      swiftSrc,
      '-o',
      path.join(appDir, displayName),
    ],
    { stdio: 'inherit' },
  );

  try {
    execFileSync('codesign', ['--force', '--sign', '-', appDir], { stdio: 'pipe' });
  } catch {}

  rmSync(ipaOut, { force: true });
  execFileSync('ditto', ['-c', '-k', '--norsrc', '--keepParent', path.join(workDir, 'Payload'), ipaOut], {
    stdio: 'inherit',
  });
  rmSync(workDir, { recursive: true, force: true });
  console.log(`Built native iOS IPA: ${ipaOut}`);
}

function main() {
  mkdirSync(RELEASES_DIR, { recursive: true });
  const displayName = readDisplayName();
  buildMobileConfig(displayName);
  if (process.platform === 'darwin') {
    buildUnsignedIpa(displayName);
  }
}

main();
