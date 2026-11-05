import { createElement, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import { type RuntimeHostMode } from '@/core/charioteer-plugin';
import {
  buildLifeHeatmapGrid,
  type HeatmapCell,
  type PledgeVaultState,
  type SanctuaryStageState,
} from '@/core/life-gamification';
import {
  addDaysToLocalDay,
  computeKrProgressPct,
  computeObjectiveProgressPct,
  type HabitItem,
  type LifeMilestone,
  type OkrObjective,
  sortMilestonesByUrgency,
} from '@/core/life-milestones-okr';
import {
  type ActiveTimerSession,
  computeMasteryProgress,
  formatMinuteOfDay,
  formatTimerClock,
  type MasteryGoal,
  nudgeMinuteRange,
  type TimeBlockCategory,
  type TimeBlockItem,
} from '@/core/time-block-tracker';
import {
  readPledgeVault,
  readSanctuaryStageState,
  recordPledgeReward,
  redeemCustomStageWish,
  subscribeLifeGamificationStore,
  updateSanctuaryStageState,
} from '@/data/life-gamification';
import {
  addKeyResultToObjective,
  checkInKeyResult,
  readDailyHabits,
  readLifeMilestones,
  readOkrObjectives,
  subscribeLifeOkrStore,
  toggleHabitDay,
} from '@/data/life-milestones-okr';
import {
  addTimeBlock,
  incrementOrAddTimeBlock,
  readActiveTimer,
  readMasteryGoals,
  readTimeBlocks,
  removeTimeBlock,
  subscribeTimeBlockStore,
  writeActiveTimer,
} from '@/data/time-block-tracker';

import { parseQuickBookkeepingInput } from '@/core/bookkeeping';
import { parseOmnibarCommand } from '@/core/omnibar';
import { addLedgerTransaction } from '@/data/bookkeeping';

import { BookkeepingLedgerHub } from './BookkeepingLedgerHub';
import { ISLAND_3D_DATA_URI } from './island-assets';
import { KnowledgeGraphCornerHub } from './KnowledgeGraphCornerHub';
import { TimePricingHub } from './TimePricingHub';
import { useI18n } from './use-i18n';

import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { showToast } from './toast';

export type SanctuaryPerspective = 'diorama' | 'ledger' | 'timeprice' | 'daycycle' | 'summary';
export type LifeZoneKey = 'focus' | 'vitality' | 'wishes';
export type SpatialModuleFilter = 'all' | 'focus' | 'vitality' | 'wishes';
export type WorkoutPoseId = 'squat' | 'pushup' | 'press' | 'jump';

interface StageBurstFx {
  id: string;
  target: string;
  text: string;
  color: string;
}

let stageBurstSequence = 0;
function createStageBurstId(target: string): string {
  stageBurstSequence += 1;
  return `${target}-${stageBurstSequence}`;
}

let stageFxKeyframesInjected = false;
function ensureStageFxKeyframes() {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || stageFxKeyframesInjected) {
    return;
  }
  stageFxKeyframesInjected = true;
  try {
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-stage-fx', 'true');
    styleEl.textContent = `
      @keyframes vsFloatRewardUp {
        0% { opacity: 0; transform: translateY(10px) scale(0.82); }
        20% { opacity: 1; transform: translateY(-2px) scale(1.06); }
        75% { opacity: 1; transform: translateY(-18px) scale(1); }
        100% { opacity: 0; transform: translateY(-28px) scale(0.94); }
      }
      @keyframes vsIsoRippleWave {
        0% { opacity: 0.95; transform: scale(0.86); }
        100% { opacity: 0; transform: scale(1.22); }
      }
      @keyframes vsSparkleBurst {
        0% { opacity: 1; transform: translateY(0px) scale(0.7); }
        60% { opacity: 0.95; transform: translateY(-14px) scale(1.15); }
        100% { opacity: 0; transform: translateY(-24px) scale(0.6); }
      }
    `;
    document.head.appendChild(styleEl);
  } catch {
    // Ignore DOM injection errors in non-browser test runners
  }
}

/**
 * Synthesizes a subtle, zero-asset crystalline tactile click/chime via Web Audio API.
 * Wrapped in try/catch so Jest/SSR environments remain completely unaffected.
 */
function playStageTactileTick(kind: 'tick' | 'reward' | 'chime' | 'page' | 'rep' = 'tick') {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const AudioCtx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind === 'tick' || kind === 'page' ? 'triangle' : 'sine';
    if (kind === 'reward') {
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.085); // A5
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.165);
    } else if (kind === 'page') {
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(990, now + 0.055);
      gain.gain.setValueAtTime(0.032, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.085);
    } else if (kind === 'rep') {
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.065);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.105);
    } else if (kind === 'chime') {
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.07); // E5
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.125);
    } else {
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.04);
      gain.gain.setValueAtTime(0.028, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.055);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    }
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 240);
  } catch {
    // Silent fallback when Web Audio API is unavailable or blocked
  }
}

/**
 * Dual-Theme (黑金风 Dark Obsidian-Gold ⇄ 暖色调 Warm Sunlit Parchment) 2.5D Isometric Island Artwork
 */
/**
 * High-FPS Articulated Multi-Joint Athlete SVG Renderer.
 * Uses continuous biomechanical phase `p ∈ [0, 1]` (`depth = Math.sin(p * Math.PI)`)
 * so every rep smoothly interpolates joints, equipment, ground shockwaves, and sweat sparks.
 */
function renderArticulatedAthleteSvg({
  pose,
  phase,
  reps,
  isDark,
  goldMetalId,
}: {
  pose: WorkoutPoseId;
  phase: number;
  reps: number;
  isDark: boolean;
  goldMetalId: string;
}) {
  // Smooth biomechanical contraction depth in [0, 1]
  const depth = Math.sin(Math.max(0, Math.min(1, phase)) * Math.PI);
  const isMoving = phase > 0.02 && phase < 0.98;

  const skinColor = '#fde68a';
  const hairColor = '#27170e';
  const headbandColor = '#ef4444';
  const jerseyColor = isDark ? '#10b981' : '#059669';
  const jerseyDark = isDark ? '#047857' : '#065f46';
  const shortsColor = isDark ? '#1e293b' : '#334155';
  const limbColor = '#fcd34d';
  const shoeColor = '#f59e0b';

  // Double Concentric Glowing Emerald Shockwave Ring on the Gym Mat under the Athlete
  const shockwaveRings = createElement(
    'g',
    null,
    createElement('ellipse', {
      cx: 108,
      cy: 100,
      rx: 22 + depth * 6,
      ry: 8.5 + depth * 2.5,
      fill: 'rgba(16, 185, 129, 0.14)',
      stroke: '#34d399',
      strokeWidth: 1.4,
      strokeOpacity: '0.85',
    }),
    createElement('ellipse', {
      cx: 108,
      cy: 100,
      rx: 15 + depth * 4,
      ry: 5.5 + depth * 1.6,
      fill: 'rgba(0,0,0,0.42)',
      stroke: '#6ee7b7',
      strokeWidth: 0.9,
      strokeDasharray: '3 2',
    }),
  );

  if (pose === 'squat') {
    const hipY = 74 + depth * 11;
    const shoulderY = 53 + depth * 10;
    const headY = 43 + depth * 10;
    const kneeSpread = 3 + depth * 7;
    const kneeY = 85 + depth * 3.5;
    const barY = shoulderY + 2;
    const barBend = depth * 2.5;

    return createElement(
      'g',
      null,
      shockwaveRings,
      // Sculpted 3D Calves + Athletic Sneakers with White Midsoles
      createElement('line', { x1: 99, y1: 97, x2: 100 - kneeSpread, y2: kneeY, stroke: limbColor, strokeWidth: 4.4, strokeLinecap: 'round' }),
      createElement('line', { x1: 117, y1: 97, x2: 116 + kneeSpread, y2: kneeY, stroke: limbColor, strokeWidth: 4.4, strokeLinecap: 'round' }),
      createElement('ellipse', { cx: 98, cy: 98.5, rx: 5.2, ry: 2.4, fill: '#f8fafc' }),
      createElement('ellipse', { cx: 98, cy: 97.5, rx: 4.6, ry: 2, fill: shoeColor }),
      createElement('ellipse', { cx: 118, cy: 98.5, rx: 5.2, ry: 2.4, fill: '#f8fafc' }),
      createElement('ellipse', { cx: 118, cy: 97.5, rx: 4.6, ry: 2, fill: shoeColor }),
      // Sculpted 3D Quads / Shorts
      createElement('line', { x1: 100 - kneeSpread, y1: kneeY, x2: 103, y2: hipY, stroke: shortsColor, strokeWidth: 5.8, strokeLinecap: 'round' }),
      createElement('line', { x1: 116 + kneeSpread, y1: kneeY, x2: 113, y2: hipY, stroke: shortsColor, strokeWidth: 5.8, strokeLinecap: 'round' }),
      // Sculpted V-Taper 3D Athletic Torso (Left Lit Half + Right Shaded Half + Gold Chest Trim)
      createElement('polygon', {
        points: `${99},${shoulderY} ${108},${shoulderY} ${108},${hipY + 2} ${102},${hipY + 2}`,
        fill: jerseyColor,
      }),
      createElement('polygon', {
        points: `${108},${shoulderY} ${117},${shoulderY} ${114},${hipY + 2} ${108},${hipY + 2}`,
        fill: jerseyDark,
      }),
      createElement('polygon', {
        points: `${99},${shoulderY} ${117},${shoulderY} ${114},${hipY + 2} ${102},${hipY + 2}`,
        fill: 'none',
        stroke: '#6ee7b7',
        strokeWidth: 1,
      }),
      createElement('line', { x1: 102, y1: shoulderY + 4, x2: 114, y2: shoulderY + 4, stroke: '#fef08a', strokeWidth: 1.4 }),
      // Sculpted Arms gripping the Olympic Barbell
      createElement('polyline', {
        points: `${99},${shoulderY + 2} ${91},${shoulderY + 8} ${89},${barY}`,
        fill: 'none',
        stroke: limbColor,
        strokeWidth: 3.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
      createElement('polyline', {
        points: `${117},${shoulderY + 2} ${125},${shoulderY + 8} ${127},${barY}`,
        fill: 'none',
        stroke: limbColor,
        strokeWidth: 3.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
      // 3D Head + Hair Crown + Red Sweatband
      createElement('circle', { cx: 108, cy: headY, r: 6.5, fill: skinColor, stroke: '#b45309', strokeWidth: 1.1 }),
      createElement('path', { d: `M 101.5 ${headY - 2} C 102 ${headY - 8}, 114 ${headY - 8}, 114.5 ${headY - 2} Z`, fill: hairColor }),
      createElement('line', { x1: 101.5, y1: headY - 2, x2: 114.5, y2: headY - 2, stroke: headbandColor, strokeWidth: 2.4, strokeLinecap: 'round' }),
      // Olympic Barbell with dynamic whip/flex & 3D triple bumper plates
      createElement('path', {
        d: `M 76 ${barY + barBend} Q 108 ${barY - barBend * 0.6} 140 ${barY + barBend}`,
        fill: 'none',
        stroke: `url(#${goldMetalId})`,
        strokeWidth: 3.2,
        strokeLinecap: 'round',
      }),
      createElement('ellipse', { cx: 80, cy: barY + barBend, rx: 3.8, ry: 7.8, fill: '#dc2626', stroke: '#fde68a', strokeWidth: 1.2 }),
      createElement('ellipse', { cx: 84, cy: barY + barBend * 0.85, rx: 3.2, ry: 6.4, fill: '#2563eb', stroke: '#93c5fd', strokeWidth: 1 }),
      createElement('ellipse', { cx: 87.5, cy: barY + barBend * 0.7, rx: 2.5, ry: 5, fill: '#059669', stroke: '#6ee7b7', strokeWidth: 0.9 }),
      createElement('ellipse', { cx: 136, cy: barY + barBend, rx: 3.8, ry: 7.8, fill: '#dc2626', stroke: '#fde68a', strokeWidth: 1.2 }),
      createElement('ellipse', { cx: 132, cy: barY + barBend * 0.85, rx: 3.2, ry: 6.4, fill: '#2563eb', stroke: '#93c5fd', strokeWidth: 1 }),
      createElement('ellipse', { cx: 128.5, cy: barY + barBend * 0.7, rx: 2.5, ry: 5, fill: '#059669', stroke: '#6ee7b7', strokeWidth: 0.9 }),
      isMoving
        ? createElement(
            'g',
            null,
            createElement('circle', { cx: 92 - depth * 6, cy: headY - 6 - depth * 5, r: 2, fill: '#38bdf8' }),
            createElement('circle', { cx: 124 + depth * 6, cy: headY - 5 - depth * 6, r: 2.2, fill: '#fef08a' }),
          )
        : null,
      // Live Rep Counter Pill
      createElement('rect', {
        x: 84,
        y: 14,
        width: 48,
        height: 14,
        rx: 7,
        fill: isDark ? 'rgba(8,22,18,0.95)' : 'rgba(236,253,245,0.96)',
        stroke: '#34d399',
        strokeWidth: 1.2,
      }),
      createElement(
        'text',
        {
          x: 108,
          y: 23.5,
          textAnchor: 'middle',
          fill: isDark ? '#6ee7b7' : '#065f46',
          fontSize: '8',
          fontWeight: '700',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        },
        `SQ×${reps}`,
      ),
    );
  }

  if (pose === 'pushup') {
    const chestY = 76 + depth * 11;
    const hipY = 84 + depth * 6;
    const headY = 72 + depth * 12;
    const elbowX = 114 - depth * 5;
    const elbowY = 85 + depth * 4;

    return createElement(
      'g',
      null,
      shockwaveRings,
      createElement('ellipse', { cx: 86, cy: 96, rx: 4.2, ry: 2.5, fill: shoeColor }),
      createElement('line', { x1: 87, y1: 95, x2: 102, y2: hipY, stroke: shortsColor, strokeWidth: 4.8, strokeLinecap: 'round' }),
      createElement('line', { x1: 102, y1: hipY, x2: 120, y2: chestY, stroke: jerseyColor, strokeWidth: 6.2, strokeLinecap: 'round' }),
      createElement('polyline', {
        points: `${118},${chestY + 1} ${elbowX},${elbowY} 120,97`,
        fill: 'none',
        stroke: limbColor,
        strokeWidth: 3.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
      createElement('circle', { cx: 126, cy: headY, r: 6, fill: skinColor, stroke: '#b45309', strokeWidth: 1.1 }),
      createElement('line', { x1: 121, y1: headY - 2, x2: 131, y2: headY - 1, stroke: headbandColor, strokeWidth: 2.2 }),
      createElement('rect', {
        x: 84,
        y: 14,
        width: 48,
        height: 14,
        rx: 7,
        fill: isDark ? 'rgba(8,22,18,0.95)' : 'rgba(236,253,245,0.96)',
        stroke: '#34d399',
        strokeWidth: 1.2,
      }),
      createElement(
        'text',
        {
          x: 108,
          y: 23.5,
          textAnchor: 'middle',
          fill: isDark ? '#6ee7b7' : '#065f46',
          fontSize: '8',
          fontWeight: '700',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        },
        `PU×${reps}`,
      ),
    );
  }

  if (pose === 'press') {
    const handY = 54 - depth * 22;
    const elbowY = 63 - depth * 12;
    const kneeDip = depth * 2.5;

    return createElement(
      'g',
      null,
      shockwaveRings,
      createElement('line', { x1: 103, y1: 96, x2: 104, y2: 75 + kneeDip, stroke: shortsColor, strokeWidth: 4.6, strokeLinecap: 'round' }),
      createElement('line', { x1: 113, y1: 96, x2: 112, y2: 75 + kneeDip, stroke: shortsColor, strokeWidth: 4.6, strokeLinecap: 'round' }),
      createElement('ellipse', { cx: 102, cy: 97.5, rx: 4.6, ry: 2.2, fill: shoeColor }),
      createElement('ellipse', { cx: 114, cy: 97.5, rx: 4.6, ry: 2.2, fill: shoeColor }),
      createElement('polygon', {
        points: `99,${55 + kneeDip} 117,${55 + kneeDip} 114,${75 + kneeDip} 102,${75 + kneeDip}`,
        fill: jerseyColor,
        stroke: '#6ee7b7',
        strokeWidth: 1,
      }),
      createElement('polyline', {
        points: `100,${57 + kneeDip} 92,${elbowY} 94,${handY}`,
        fill: 'none',
        stroke: limbColor,
        strokeWidth: 3.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
      createElement('polyline', {
        points: `116,${57 + kneeDip} 124,${elbowY} 122,${handY}`,
        fill: 'none',
        stroke: limbColor,
        strokeWidth: 3.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
      createElement('rect', { x: 88, y: handY - 2.5, width: 12, height: 4.8, rx: 1.8, fill: '#f5b942', stroke: '#92400e', strokeWidth: 0.9 }),
      createElement('rect', { x: 116, y: handY - 2.5, width: 12, height: 4.8, rx: 1.8, fill: '#f5b942', stroke: '#92400e', strokeWidth: 0.9 }),
      createElement('circle', { cx: 108, cy: 46 + kneeDip, r: 6.2, fill: skinColor, stroke: '#b45309', strokeWidth: 1.1 }),
      createElement('line', { x1: 102, y1: 44 + kneeDip, x2: 114, y2: 44 + kneeDip, stroke: headbandColor, strokeWidth: 2.2 }),
      createElement('rect', {
        x: 84,
        y: 14,
        width: 48,
        height: 14,
        rx: 7,
        fill: isDark ? 'rgba(8,22,18,0.95)' : 'rgba(236,253,245,0.96)',
        stroke: '#34d399',
        strokeWidth: 1.2,
      }),
      createElement(
        'text',
        {
          x: 108,
          y: 23.5,
          textAnchor: 'middle',
          fill: isDark ? '#6ee7b7' : '#065f46',
          fontSize: '8',
          fontWeight: '700',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        },
        `PR×${reps}`,
      ),
    );
  }

  const airLift = depth * 11;
  const footSpread = depth * 11;
  const armSpreadX = 8 + depth * 10;
  const handY = 72 - depth * 38;

  return createElement(
    'g',
    null,
    shockwaveRings,
    createElement('line', { x1: 106, y1: 75 - airLift, x2: 104 - footSpread, y2: 96 - airLift * 0.7, stroke: limbColor, strokeWidth: 4, strokeLinecap: 'round' }),
    createElement('line', { x1: 110, y1: 75 - airLift, x2: 112 + footSpread, y2: 96 - airLift * 0.7, stroke: limbColor, strokeWidth: 4, strokeLinecap: 'round' }),
    createElement('polygon', {
      points: `100,${55 - airLift} 116,${55 - airLift} 113,${75 - airLift} 103,${75 - airLift}`,
      fill: jerseyColor,
      stroke: '#6ee7b7',
      strokeWidth: 1,
    }),
    createElement('line', { x1: 101, y1: 57 - airLift, x2: 108 - armSpreadX, y2: handY, stroke: limbColor, strokeWidth: 3.6, strokeLinecap: 'round' }),
    createElement('line', { x1: 115, y1: 57 - airLift, x2: 108 + armSpreadX, y2: handY, stroke: limbColor, strokeWidth: 3.6, strokeLinecap: 'round' }),
    createElement('circle', { cx: 108, cy: 46 - airLift, r: 6.2, fill: skinColor, stroke: '#b45309', strokeWidth: 1.1 }),
    createElement('line', { x1: 102, y1: 44 - airLift, x2: 114, y2: 44 - airLift, stroke: headbandColor, strokeWidth: 2.2 }),
    createElement('rect', {
      x: 84,
      y: 14,
      width: 48,
      height: 14,
      rx: 7,
      fill: isDark ? 'rgba(8,22,18,0.95)' : 'rgba(236,253,245,0.96)',
      stroke: '#34d399',
      strokeWidth: 1.2,
    }),
    createElement(
      'text',
      {
        x: 108,
        y: 23.5,
        textAnchor: 'middle',
        fill: isDark ? '#6ee7b7' : '#065f46',
        fontSize: '8',
        fontWeight: '700',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      `JJ×${reps}`,
    ),
  );
}

/**
 * True 3D Isometric Projection & Shaded Block Engine (`isoPt` + `isoBox` + `isoAO`).
 * Eliminates 2D wireframe "sticker patchwork" by projecting every architectural wall,
 * stepped pedestal, bridgehead dock, bookcase, desk, chair, power rack, and colonnade
 * from unified 3D coordinates `(u, v, z)` with 3-face directional lighting and AO contact shadows.
 */
function createIsoEngine(originX = 138, originY = 66, scaleX = 1.14, scaleY = 0.5) {
  function pt(u: number, v: number, z = 0): [number, number] {
    const sx = originX + (v - u) * scaleX;
    const sy = originY + (u + v) * scaleY - z;
    return [Number(sx.toFixed(1)), Number(sy.toFixed(1))];
  }

  function polyStr(coords: [number, number, number][]): string {
    return coords
      .map(([u, v, z]) => {
        const [sx, sy] = pt(u, v, z);
        return `${sx},${sy}`;
      })
      .join(' ');
  }

  function quad(
    coords: [number, number, number][],
    fill: string,
    stroke?: string,
    strokeWidth = 0.45,
    opacity?: number,
  ) {
    return createElement('polygon', {
      points: polyStr(coords),
      fill,
      ...(stroke ? { stroke, strokeWidth } : {}),
      ...(opacity !== undefined ? { opacity } : {}),
    });
  }

  function aoShadow(u0: number, v0: number, z0: number, du: number, dv: number, pad = 2.2, alpha = 0.36) {
    return quad(
      [
        [u0 - pad * 0.4, v0 - pad * 0.4, z0],
        [u0 - pad * 0.4, v0 + dv + pad, z0],
        [u0 + du + pad, v0 + dv + pad, z0],
        [u0 + du + pad, v0 - pad * 0.4, z0],
      ],
      `rgba(0, 0, 0, ${alpha})`,
    );
  }

  function box(
    u0: number,
    v0: number,
    z0: number,
    du: number,
    dv: number,
    dz: number,
    colors: {
      top: string;
      left: string;
      right: string;
      bevel?: string;
      ao?: number;
    },
  ) {
    const u1 = u0 + du;
    const v1 = v0 + dv;
    const z1 = z0 + dz;
    const bevelStroke = colors.bevel ?? 'rgba(255, 248, 235, 0.12)';
    return createElement(
      'g',
      null,
      colors.ao ? aoShadow(u0, v0, z0, du, dv, 2.0, colors.ao) : null,
      // Left-Front Face (u = u1)
      quad(
        [
          [u1, v0, z1],
          [u1, v1, z1],
          [u1, v1, z0],
          [u1, v0, z0],
        ],
        colors.left,
        bevelStroke,
        0.35,
      ),
      // Right-Front Face (v = v1)
      quad(
        [
          [u0, v1, z1],
          [u1, v1, z1],
          [u1, v1, z0],
          [u0, v1, z0],
        ],
        colors.right,
        bevelStroke,
        0.35,
      ),
      // Top Face (z = z1)
      quad(
        [
          [u0, v0, z1],
          [u0, v1, z1],
          [u1, v1, z1],
          [u1, v0, z1],
        ],
        colors.top,
        bevelStroke,
        0.45,
      ),
    );
  }

  return { pt, polyStr, quad, aoShadow, box };
}

function IsometricLifeZoneSvg({
  zone,
  active,
  hovered = false,
  burstActive = false,
  isDark,
  weightText,
  bookPageCount = 0,
  bookAnimPhase = 0,
  workoutPose = 'squat',
  workoutAnimPhase = 0,
  workoutReps = 0,
}: {
  zone: LifeZoneKey;
  active: boolean;
  hovered?: boolean;
  burstActive?: boolean;
  isDark: boolean;
  weightText: string;
  bookPageCount?: number;
  bookAnimPhase?: number;
  workoutPose?: WorkoutPoseId;
  workoutAnimPhase?: number;
  workoutReps?: number;
}) {
  void createIsoEngine;
  void renderArticulatedAthleteSvg;
  void workoutPose;
  void isDark;

  const rimColor =
    zone === 'focus'
      ? '#f59e0b'
      : zone === 'vitality'
        ? '#34d399'
        : '#f5b942';

  if (Platform.OS !== 'web') {
    return (
      <View
        style={{
          width: 240,
          height: 150,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: rimColor,
          backgroundColor: '#1b1815',
        }}
      />
    );
  }

  const floorBloomId = `dioramaBloom_${zone}`;
  const liftOffset = Math.sin(Math.max(0, Math.min(1, workoutAnimPhase)) * Math.PI) * 6;
  const pageCurlOffset = Math.sin(Math.max(0, Math.min(1, bookAnimPhase)) * Math.PI) * 5;

  return createElement(
    'svg',
    {
      width: 276,
      height: 236,
      viewBox: '0 0 280 242',
      fill: 'none',
      style: {
        overflow: 'visible',
        transition: 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1), filter 200ms ease',
        transform: burstActive
          ? 'translateY(-6px) scale(1.035)'
          : hovered
            ? 'translateY(-4px) scale(1.018)'
            : `translateY(${-(liftOffset + pageCurlOffset)}px) scale(1)`,
        filter:
          active || hovered || burstActive
            ? isDark
              ? `drop-shadow(0 22px 32px rgba(0, 0, 0, 0.85)) drop-shadow(0 0 ${burstActive ? '28px' : '18px'} ${rimColor}${burstActive ? '88' : '48'})`
              : `drop-shadow(0 14px 22px rgba(38, 36, 31, 0.22)) drop-shadow(0 0 ${burstActive ? '20px' : '12px'} ${rimColor}44)`
            : isDark
              ? 'drop-shadow(0 16px 24px rgba(0, 0, 0, 0.68))'
              : 'drop-shadow(0 10px 18px rgba(38, 36, 31, 0.16))',
      },
    },
    createElement(
      'defs',
      null,
      createElement(
        'radialGradient',
        { id: floorBloomId, cx: '50%', cy: '50%', r: '50%' },
        createElement('stop', {
          offset: '0%',
          stopColor: rimColor,
          stopOpacity: isDark ? '0.46' : '0.28',
        }),
        createElement('stop', {
          offset: '65%',
          stopColor: rimColor,
          stopOpacity: isDark ? '0.14' : '0.08',
        }),
        createElement('stop', { offset: '100%', stopColor: rimColor, stopOpacity: '0' }),
      ),
    ),

    // 1. Soft Ambient Halo under the 3D Floating Rock Island
    createElement('ellipse', {
      cx: 140,
      cy: 162,
      rx: 116,
      ry: 46,
      fill: `url(#${floorBloomId})`,
    }),

    // 2. Pure 1:1 High-DPI 3D Isometric Floating Rock Island Artwork (Zero 2D Fallback Polygon Bleed)
    createElement('image', {
      href: ISLAND_3D_DATA_URI[zone],
      x: 8,
      y: -4,
      width: 264,
      height: 212,
      preserveAspectRatio: 'xMidYMid meet',
    }),

    // 3. Vitality Island Front-Lip Emerald '🏆 1RM PR' Badge (from Initial Design Image)
    zone === 'vitality'
      ? createElement(
          'g',
          null,
          createElement('rect', {
            x: 96,
            y: 148,
            width: 88,
            height: 20,
            rx: 10,
            fill: '#10b981',
            stroke: '#6ee7b7',
            strokeWidth: 1.2,
          }),
          createElement(
            'text',
            {
              x: 140,
              y: 161.5,
              textAnchor: 'middle',
              fill: '#052e16',
              fontSize: '10.5',
              fontWeight: '800',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            },
            workoutReps > 0 ? `🏆 PR ×${workoutReps}` : '🏆 1RM PR',
          ),
        )
      : null,

    // 4. Subtle Live Readout Badge when Flipping Pages on Study Island
    zone === 'focus' && (bookPageCount > 0 || bookAnimPhase > 0.02)
      ? createElement(
          'g',
          null,
          createElement('rect', {
            x: 98,
            y: 148,
            width: 84,
            height: 19,
            rx: 9.5,
            fill: isDark ? 'rgba(18, 16, 13, 0.92)' : 'rgba(255, 255, 255, 0.94)',
            stroke: '#f5b942',
            strokeWidth: 1.1,
          }),
          createElement(
            'text',
            {
              x: 140,
              y: 160.5,
              textAnchor: 'middle',
              fill: isDark ? '#fde68a' : '#8a5a12',
              fontSize: '10',
              fontWeight: '700',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            },
            `📖 P.${12 + bookPageCount} · ${weightText}`,
          ),
        )
      : null,

    // 5. Bottom Theme-Adaptive Floating Island Nameplate Pill ('心流书房' / '活力体态' / '星愿金库')
    createElement(
      'g',
      null,
      createElement('rect', {
        x: 86,
        y: 206,
        width: 108,
        height: 26,
        rx: 13,
        fill: isDark ? 'rgba(18, 16, 13, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        stroke: active ? (isDark ? '#fde68a' : '#d97757') : rimColor,
        strokeWidth: active ? 1.6 : 1.2,
      }),
      createElement(
        'text',
        {
          x: 140,
          y: 223,
          textAnchor: 'middle',
          fill: isDark ? '#fde68a' : '#141413',
          fontSize: '12.5',
          fontWeight: '700',
        },
        zone === 'focus' ? '心流书房' : zone === 'vitality' ? '活力体态' : '星愿金库',
      ),
    ),
  );
}

/**
 * Golden 24-Hour Ribbon Bridges & Celestial Starlight Orbit Dome
 * Seamlessly connects Island 1 (心流书房) <-> Island 2 (活力体态) <-> Island 3 (星愿金库).
 */
function Golden24HourRibbonBridgesSvg({
  timerRunning,
  isDark,
}: {
  timerRunning: boolean;
  isDark: boolean;
}) {
  void isDark;
  if (Platform.OS !== 'web') return null;

  const steppingStonesLeft: [number, number][] = [
    [282, 136],
    [312, 150],
    [345, 158],
    [378, 150],
    [408, 136],
  ];
  const steppingStonesRight: [number, number][] = [
    [592, 136],
    [622, 150],
    [655, 158],
    [688, 150],
    [718, 136],
  ];

  const sparkles: [number, number, number][] = [
    [135, 22, 1.6],
    [285, 36, 1.8],
    [495, 16, 2.0],
    [715, 32, 1.8],
    [865, 24, 1.6],
  ];

  return createElement(
    'svg',
    {
      viewBox: '0 0 1000 242',
      preserveAspectRatio: 'none',
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        width: '100%',
        height: 238,
        pointerEvents: 'none',
        zIndex: 1,
      },
    },
    createElement(
      'defs',
      null,
      createElement(
        'linearGradient',
        { id: 'ribbonBody1', x1: '0', y1: '0', x2: '1', y2: '0' },
        createElement('stop', { offset: '0%', stopColor: '#cc785c' }),
        createElement('stop', { offset: '50%', stopColor: '#f5b942' }),
        createElement('stop', { offset: '100%', stopColor: '#10b981' }),
      ),
      createElement(
        'linearGradient',
        { id: 'ribbonBody2', x1: '0', y1: '0', x2: '1', y2: '0' },
        createElement('stop', { offset: '0%', stopColor: '#10b981' }),
        createElement('stop', { offset: '50%', stopColor: '#f5b942' }),
        createElement('stop', { offset: '100%', stopColor: '#d97706' }),
      ),
      createElement(
        'linearGradient',
        { id: 'stageGodRayGrad', x1: '0', y1: '0', x2: '0.4', y2: '1' },
        createElement('stop', {
          offset: '0%',
          stopColor: '#fef08a',
          stopOpacity: '0.12',
        }),
        createElement('stop', { offset: '100%', stopColor: '#f5b942', stopOpacity: '0' }),
      ),
    ),

    // 1. Celestial Starlight Orbit Dome & Volumetric God-Rays
    createElement('polygon', {
      points: '180,0 290,0 420,236 260,236',
      fill: 'url(#stageGodRayGrad)',
    }),
    createElement('polygon', {
      points: '560,0 680,0 820,236 640,236',
      fill: 'url(#stageGodRayGrad)',
    }),
    createElement('path', {
      d: 'M 60 206 Q 500 -28 940 206',
      fill: 'none',
      stroke: 'rgba(245, 185, 66, 0.16)',
      strokeWidth: 1,
      strokeDasharray: '4 8',
    }),

    // 2. Viaduct 1 (Focus Island <-> Vitality Island): Golden 24H Ribbon Bridge
    createElement('path', {
      d: 'M 256 122 C 310 168, 380 168, 434 122',
      fill: 'none',
      stroke: 'rgba(245, 185, 66, 0.24)',
      strokeWidth: 6,
      strokeLinecap: 'round',
    }),
    createElement('path', {
      d: 'M 256 122 C 310 168, 380 168, 434 122',
      fill: 'none',
      stroke: 'url(#ribbonBody1)',
      strokeWidth: 2.4,
      strokeLinecap: 'round',
      strokeDasharray: timerRunning ? '6 4' : undefined,
    }),
    ...steppingStonesLeft.map(([cx, cy], idx) =>
      createElement(
        'g',
        { key: `stone-l-${idx}` },
        createElement('polygon', {
          points: `${cx},${cy - 5} ${cx + 12},${cy} ${cx},${cy + 5} ${cx - 12},${cy}`,
          fill: '#3d2c1e',
          stroke: '#f5b942',
          strokeWidth: 0.7,
        }),
        createElement('polygon', {
          points: `${cx - 12},${cy} ${cx},${cy + 5} ${cx},${cy + 11} ${cx - 12},${cy + 6}`,
          fill: '#261b12',
        }),
        createElement('polygon', {
          points: `${cx + 12},${cy} ${cx},${cy + 5} ${cx},${cy + 11} ${cx + 12},${cy + 6}`,
          fill: '#140e09',
        }),
      ),
    ),
    createElement('polygon', {
      points: '345,145 365,158 345,171 325,158',
      fill: '#1c150d',
      stroke: '#f5b942',
      strokeWidth: 1.5,
    }),
    createElement(
      'text',
      {
        x: 345,
        y: 161,
        textAnchor: 'middle',
        fill: '#fef08a',
        fontSize: '8.5',
        fontWeight: '700',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      '24H',
    ),

    // 3. Viaduct 2 (Vitality Island <-> Wishes Island): Golden 24H Ribbon Bridge
    createElement('path', {
      d: 'M 566 122 C 620 168, 690 168, 744 122',
      fill: 'none',
      stroke: 'rgba(52, 211, 153, 0.22)',
      strokeWidth: 6,
      strokeLinecap: 'round',
    }),
    createElement('path', {
      d: 'M 566 122 C 620 168, 690 168, 744 122',
      fill: 'none',
      stroke: 'url(#ribbonBody2)',
      strokeWidth: 2.4,
      strokeLinecap: 'round',
    }),
    ...steppingStonesRight.map(([cx, cy], idx) =>
      createElement(
        'g',
        { key: `stone-r-${idx}` },
        createElement('polygon', {
          points: `${cx},${cy - 5} ${cx + 12},${cy} ${cx},${cy + 5} ${cx - 12},${cy}`,
          fill: '#263830',
          stroke: '#34d399',
          strokeWidth: 0.7,
        }),
        createElement('polygon', {
          points: `${cx - 12},${cy} ${cx},${cy + 5} ${cx},${cy + 11} ${cx - 12},${cy + 6}`,
          fill: '#18241f',
        }),
        createElement('polygon', {
          points: `${cx + 12},${cy} ${cx},${cy + 5} ${cx},${cy + 11} ${cx + 12},${cy + 6}`,
          fill: '#0d1411',
        }),
      ),
    ),
    createElement('polygon', {
      points: '655,145 675,158 655,171 635,158',
      fill: '#1c150d',
      stroke: '#f5b942',
      strokeWidth: 1.5,
    }),
    createElement(
      'text',
      {
        x: 655,
        y: 161,
        textAnchor: 'middle',
        fill: '#fef08a',
        fontSize: '8.5',
        fontWeight: '700',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      '24H',
    ),

    ...sparkles.map(([sx, sy, sr], idx) =>
      createElement('circle', {
        key: `sp-${idx}`,
        cx: sx,
        cy: sy,
        r: sr,
        fill: '#fef08a',
        opacity: 0.82,
      }),
    ),
  );
}


function StudioBentoIllustration({ kind }: { kind: 'fitness' | 'browser' | 'trend' | 'timeline' }) {
  if (Platform.OS !== 'web') return null;
  const goldBright = '#FDE68A';
  const goldMid = '#F5B942';
  const goldDeep = 'rgba(245, 185, 66, 0.24)';

  if (kind === 'fitness') {
    return createElement(
      'svg',
      { width: 92, height: 50, viewBox: '0 0 92 50', fill: 'none' },
      createElement('ellipse', { cx: 46, cy: 44, rx: 32, ry: 5, fill: goldDeep }),
      createElement('line', { x1: 12, y1: 18, x2: 80, y2: 18, stroke: goldBright, strokeWidth: 2.2, strokeLinecap: 'round' }),
      createElement('rect', { x: 15, y: 10, width: 5, height: 16, rx: 2, fill: goldMid }),
      createElement('rect', { x: 22, y: 12, width: 4, height: 12, rx: 1.5, fill: goldBright }),
      createElement('rect', { x: 72, y: 10, width: 5, height: 16, rx: 2, fill: goldMid }),
      createElement('rect', { x: 66, y: 12, width: 4, height: 12, rx: 1.5, fill: goldBright }),
      createElement('circle', { cx: 46, cy: 23, r: 5.2, fill: goldBright }),
      createElement('path', { d: 'M36 44 L40 30 L52 30 L56 44 Z', fill: goldMid, fillOpacity: '0.88' }),
      createElement('polyline', { points: '38,31 31,24 31,18', stroke: goldBright, strokeWidth: 2.4, strokeLinecap: 'round', fill: 'none' }),
      createElement('polyline', { points: '54,31 61,24 61,18', stroke: goldBright, strokeWidth: 2.4, strokeLinecap: 'round', fill: 'none' }),
    );
  }
  if (kind === 'browser') {
    return createElement(
      'svg',
      { width: 92, height: 50, viewBox: '0 0 92 50', fill: 'none' },
      createElement('rect', { x: 34, y: 8, width: 50, height: 34, rx: 5, fill: goldDeep, stroke: goldMid, strokeWidth: 1.2 }),
      createElement('line', { x1: 34, y1: 16, x2: 84, y2: 16, stroke: goldMid, strokeWidth: 1 }),
      createElement('rect', { x: 40, y: 21, width: 26, height: 4, rx: 2, fill: goldBright }),
      createElement('rect', { x: 40, y: 29, width: 36, height: 3.5, rx: 1.5, fill: goldMid, fillOpacity: '0.7' }),
      createElement('circle', { cx: 26, cy: 31, r: 13, fill: '#141720', stroke: goldBright, strokeWidth: 1.4 }),
      createElement('ellipse', { cx: 26, cy: 31, rx: 6, ry: 13, stroke: goldMid, strokeWidth: 1 }),
      createElement('line', { x1: 13, y1: 31, x2: 39, y2: 31, stroke: goldMid, strokeWidth: 1 }),
    );
  }
  if (kind === 'trend') {
    return createElement(
      'svg',
      { width: 92, height: 50, viewBox: '0 0 92 50', fill: 'none' },
      createElement('rect', { x: 18, y: 31, width: 9, height: 13, rx: 2, fill: goldDeep, stroke: goldMid, strokeWidth: 1 }),
      createElement('rect', { x: 33, y: 25, width: 9, height: 19, rx: 2, fill: goldDeep, stroke: goldMid, strokeWidth: 1 }),
      createElement('rect', { x: 48, y: 19, width: 9, height: 25, rx: 2, fill: goldMid, fillOpacity: '0.45', stroke: goldBright, strokeWidth: 1 }),
      createElement('rect', { x: 63, y: 12, width: 9, height: 32, rx: 2, fill: goldMid, stroke: goldBright, strokeWidth: 1 }),
      createElement('path', { d: 'M16 28 Q 40 22 68 8', stroke: goldBright, strokeWidth: 2.4, strokeLinecap: 'round', fill: 'none' }),
      createElement('polygon', { points: '71,6 63,7 68,14', fill: goldBright }),
    );
  }
  return createElement(
    'svg',
    { width: 92, height: 50, viewBox: '0 0 92 50', fill: 'none' },
    createElement('rect', { x: 38, y: 10, width: 46, height: 30, rx: 5, fill: goldDeep, stroke: goldMid, strokeWidth: 1.1 }),
    createElement('rect', { x: 44, y: 16, width: 32, height: 4, rx: 2, fill: goldBright }),
    createElement('rect', { x: 44, y: 24, width: 24, height: 4, rx: 2, fill: goldMid }),
    createElement('rect', { x: 44, y: 32, width: 34, height: 3.5, rx: 1.5, fill: goldMid, fillOpacity: '0.6' }),
    createElement('circle', { cx: 28, cy: 30, r: 14, fill: '#141720', stroke: goldBright, strokeWidth: 1.5 }),
    createElement('polyline', { points: '28,21 28,30 35,33', stroke: goldBright, strokeWidth: 2, strokeLinecap: 'round', fill: 'none' }),
  );
}

export function StudioMatrixBentoCard({ onSelectHref }: { onSelectHref?: (href: '/fitness' | '/browser' | '/trend' | '/timeline') => void }) {
  const { t } = useI18n();
  const items: readonly {
    id: 'fitness' | 'browser' | 'trend' | 'timeline';
    href: '/fitness' | '/browser' | '/trend' | '/timeline';
    title: string;
    sub: string;
  }[] = [
    { id: 'fitness', href: '/fitness', title: t('健身', 'Fitness'), sub: t('分化处方 · 1RM · 营养吧台', 'Splits · 1RM · Macros') },
    { id: 'browser', href: '/browser', title: t('浏览器', 'Browser'), sub: t('7 引擎检索 · 论文摘录转闪卡', '7 Engines · FSRS Clipper') },
    { id: 'trend', href: '/trend', title: t('趋势', 'Trends'), sub: t('28D 均重曲线 · 4D 相关性洞察', '28D EMA · 4D Correlations') },
    { id: 'timeline', href: '/timeline', title: t('时间线', 'Timeline'), sub: t('跨模块流水台账 · 1m 时间块', 'Full Ledger · 1m Blocks') },
  ];

  return (
    <View
      style={{
        borderRadius: 14,
        padding: 12,
        gap: 10,
        borderWidth: 1,
        borderColor: 'rgba(245, 185, 66, 0.28)',
        backgroundColor: '#12141B',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="label" style={{ fontSize: 12, fontWeight: theme.fontWeight.semibold, color: '#FDE68A' }}>
          {t('✦ 星途专业工作室矩阵 · Studio Drawer', '✦ Studio Workbench Matrix')}
        </Text>
        <Text variant="caption" style={{ fontSize: 10.5, color: '#9CA3AF' }}>
          {t('点击直达专业分舱 ›', 'Jump to studio modules ›')}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => {
              if (onSelectHref) {
                onSelectHref(item.href);
              } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
                const bridge = (window as unknown as { __viastelaDesktop?: { navigate?: (id: string) => void } }).__viastelaDesktop;
                if (bridge?.navigate) {
                  bridge.navigate(item.id);
                } else {
                  window.location.assign(item.href);
                }
              }
            }}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: '46%',
              minWidth: 210,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 14,
              paddingVertical: 11,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(245, 185, 66, 0.28)',
              backgroundColor: pressed ? '#1E222E' : '#181B24',
              gap: 8,
            })}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="label" style={{ fontSize: 14, fontWeight: '700', color: '#F9FAFB' }}>
                {item.title}
              </Text>
              <Text variant="caption" style={{ fontSize: 11, color: '#C8BFAE' }} numberOfLines={2}>
                {item.sub}
              </Text>
            </View>
            <StudioBentoIllustration kind={item.id} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function IsometricStudioStage({
  localDay,
  latestWeightKg,
  loggedCount,
  activeWeightDays,
  trainingSetsCount,
  trainingVolumeKg,
  studyMinutes,
  studyCount,
  activeModuleFilter = 'all',
  onSelectModuleFilter,
  onQuickWeight,
  onQuickTraining,
  onQuickStudy,
  onQuickJournal,
  onInstantSaveWeight,
  onInstantSaveStudy,
  onInstantSaveWorkout,
}: {
  mode?: RuntimeHostMode;
  localDay: string;
  latestWeightKg?: number | null;
  loggedCount: number;
  activeWeightDays: number;
  trainingSetsCount: number;
  trainingVolumeKg: number;
  studyMinutes: number;
  studyCount: number;
  activeModuleFilter?: SpatialModuleFilter;
  onSelectModuleFilter?: (filter: SpatialModuleFilter) => void;
  onQuickWeight: () => void;
  onQuickTraining: () => void;
  onQuickStudy: () => void;
  onQuickJournal: () => void;
  onOpenScope?: () => void;
  onInstantSaveWeight?: (kg: number) => void;
  onInstantSaveStudy?: (input: { subject: string; durationMinutes: number; note: string | null }) => void;
  onInstantSaveWorkout?: (input: { exercise: string; reps: number; weightKg: number | null }) => void;
}) {
  const { color, scheme } = useTheme();
  const { t } = useI18n();
  const { width: viewportWidth } = useWindowDimensions();
  const isCompactMobile = viewportWidth > 0 && viewportWidth < 680;
  const isDark = scheme === 'dark';

  const [perspective, setPerspective] = useState<SanctuaryPerspective>('diorama');
  const [internalZone, setInternalZone] = useState<LifeZoneKey>('focus');
  const [quickInput, setQuickInput] = useState('');
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<HeatmapCell | null>(null);
  const [heatmapFilter, setHeatmapFilter] = useState<'all' | 'focus' | 'workout'>('all');
  const [matrixMode, setMatrixMode] = useState<'on' | 'day'>('on');
  const [selectedColIdx, setSelectedColIdx] = useState<number>(2);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [okrPage, setOkrPage] = useState(0);
  const [addingKrInline, setAddingKrInline] = useState(false);
  const [newKrTitle, setNewKrTitle] = useState('');
  const [hoveredZone, setHoveredZone] = useState<LifeZoneKey | null>(null);
  const [hoveredHeatIdx, setHoveredHeatIdx] = useState<number | null>(null);
  const [bursts, setBursts] = useState<StageBurstFx[]>([]);

  // Persisted Sanctuary Stage Toy & Custom Book/Wish States
  const [stageState, setStageState] = useState<SanctuaryStageState>(() => readSanctuaryStageState());
  const bookPageCount = Math.max(0, stageState.bookPage - 12);
  const workoutPose: WorkoutPoseId = stageState.workoutPose;
  const workoutReps = stageState.workoutReps;
  const [bookAnimPhase, setBookAnimPhase] = useState<number>(0);
  const [autoReading, setAutoReading] = useState<boolean>(false);
  const [workoutAnimPhase, setWorkoutAnimPhase] = useState<number>(0);
  const [autoWorkoutLeft, setAutoWorkoutLeft] = useState<number>(0);
  const [editingBook, setEditingBook] = useState(false);
  const [bookDraft, setBookDraft] = useState(stageState.bookTitle);
  const [editingWish, setEditingWish] = useState(false);
  const [wishDraft, setWishDraft] = useState(stageState.wishTitle);
  const [wishTargetDraft, setWishTargetDraft] = useState(String(stageState.wishTargetCny));

  // Inline 1-minute scrubber state for 'day' mode inside Left Bento Card
  const [dayScrubRange, setDayScrubRange] = useState<{ startMinute: number; endMinute: number }>(() => {
    const now = new Date();
    const endMin = Math.max(15, Math.min(1440, now.getHours() * 60 + now.getMinutes()));
    return { startMinute: Math.max(0, endMin - 45), endMinute: endMin };
  });
  const [dayScrubCat, setDayScrubCat] = useState<TimeBlockCategory>('deep-work');
  const [dayScrubTitle, setDayScrubTitle] = useState('');

  const selectedZone: LifeZoneKey =
    activeModuleFilter && activeModuleFilter !== 'all' ? activeModuleFilter : internalZone;

  function triggerStageBurst(
    target: string,
    text: string,
    accentColor: string,
    sound: 'tick' | 'reward' | 'chime' | 'page' | 'rep' = 'tick',
  ) {
    ensureStageFxKeyframes();
    playStageTactileTick(sound);
    const id = createStageBurstId(target);
    setBursts((prev) => [...prev.filter((b) => b.target !== target), { id, target, text, color: accentColor }]);
    setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== id));
    }, 720);
  }

  function selectIslandAndSync(zone: LifeZoneKey) {
    setInternalZone(zone);
    const nextFilter = activeModuleFilter === zone ? 'all' : zone;
    onSelectModuleFilter?.(nextFilter);
    const label =
      zone === 'focus'
        ? nextFilter === 'all'
          ? t('✦ 展示全部模块', '✦ All Modules')
          : t('✦ 聚焦心流书房', '✦ Focus Study')
        : zone === 'vitality'
          ? nextFilter === 'all'
            ? t('✦ 展示全部模块', '✦ All Modules')
            : t('✦ 聚焦活力体态', '✦ Vitality Focus')
          : nextFilter === 'all'
            ? t('✦ 展示全部模块', '✦ All Modules')
            : t('✦ 聚焦星愿纪念台', '✦ Wish Altar');
    const accent =
      zone === 'focus'
        ? isDark
          ? '#f59e0b'
          : '#cc785c'
        : zone === 'vitality'
          ? isDark
            ? '#34d399'
            : '#1f5e4b'
          : isDark
            ? '#f5b942'
            : '#b88228';
    triggerStageBurst(zone, label, accent, 'chime');
  }

  // Live personal stores
  const [vault, setVault] = useState<PledgeVaultState>(readPledgeVault);
  const [milestones, setMilestones] = useState<LifeMilestone[]>(readLifeMilestones);
  const [objectives, setObjectives] = useState<OkrObjective[]>(readOkrObjectives);
  const [habits, setHabits] = useState<HabitItem[]>(readDailyHabits);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlockItem[]>(readTimeBlocks);
  const [masteryGoals, setMasteryGoals] = useState<MasteryGoal[]>(readMasteryGoals);
  const [timer, setTimer] = useState<ActiveTimerSession>(readActiveTimer);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [lowerWorkspaceTab, setLowerWorkspaceTab] = useState<'matrix' | 'okr' | 'knowledge' | 'split'>('split');
  const [mobileStageMode, setMobileStageMode] = useState<'panoramic' | 'swipe'>('panoramic');
  const [circadianOverride, setCircadianOverride] = useState<'auto' | 'dawn' | 'noon' | 'dusk' | 'midnight'>('auto');
  const [focusedIsland, setFocusedIsland] = useState<'all' | LifeZoneKey>('all');

  const resolvedCircadian = (() => {
    if (circadianOverride !== 'auto') return circadianOverride;
    const hr = new Date(nowMs).getHours();
    if (hr >= 5 && hr < 10) return 'dawn';
    if (hr >= 10 && hr < 16) return 'noon';
    if (hr >= 16 && hr < 20) return 'dusk';
    return 'midnight';
  })();

  const circadianMeta =
    resolvedCircadian === 'dawn'
      ? { icon: '🌅', zh: '晨曦微光', en: 'Dawn', glow: 'rgba(251, 146, 60, 0.14)', border: '#fb923c' }
      : resolvedCircadian === 'noon'
        ? { icon: '☀️', zh: '正午通透', en: 'Noon', glow: 'rgba(250, 204, 21, 0.12)', border: '#facc15' }
        : resolvedCircadian === 'dusk'
          ? { icon: '🌇', zh: '黄昏琥珀', en: 'Dusk', glow: 'rgba(245, 158, 11, 0.16)', border: '#f59e0b' }
          : { icon: '🌌', zh: '子夜星穹', en: 'Midnight', glow: 'rgba(56, 189, 248, 0.12)', border: '#38bdf8' };

  useEffect(() => {
    ensureStageFxKeyframes();
    const u1 = subscribeLifeGamificationStore(() => {
      setVault(readPledgeVault());
      setStageState(readSanctuaryStageState());
    });
    const u2 = subscribeLifeOkrStore(() => {
      setMilestones(readLifeMilestones());
      setObjectives(readOkrObjectives());
      setHabits(readDailyHabits());
    });
    const u3 = subscribeTimeBlockStore(() => {
      setTimeBlocks(readTimeBlocks());
      setMasteryGoals(readMasteryGoals());
      setTimer(readActiveTimer());
    });
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  useEffect(() => {
    if (!timer.isRunning) return undefined;
    const poll = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(poll);
  }, [timer.isRunning]);

  const pal = isDark
    ? {
        stageBg: '#121110',
        stageBorder: 'rgba(245, 185, 66, 0.22)',
        barBg: '#1a1613',
        bentoBg: '#18181b',
        bentoBorder: 'rgba(255, 255, 255, 0.10)',
        hudBg: 'rgba(42, 42, 46, 0.84)',
        hudBorder: 'rgba(255, 255, 255, 0.16)',
        ink: '#f5f5f4',
        sub: '#d6d3d1',
        muted: '#a8a29e',
        faint: '#78716c',
        inputBg: '#0e0c0a',
        pillBg: '#272320',
        pillActiveBg: '#332820',
        goldText: '#fde68a',
        goldAccent: '#f5b942',
        emeraldAccent: '#34d399',
        terracottaAccent: '#e8924a',
        hairline: 'rgba(255, 255, 255, 0.06)',
        emptyHeatCell: '#23262e',
      }
    : {
        stageBg: color.card,
        stageBorder: color.line,
        barBg: color.surface,
        bentoBg: color.surface,
        bentoBorder: color.line,
        hudBg: 'rgba(255, 253, 248, 0.92)',
        hudBorder: color.line,
        ink: color.ink,
        sub: color.ink,
        muted: color.muted,
        faint: color.textFaint,
        inputBg: color.card,
        pillBg: color.pill,
        pillActiveBg: color.accentSoft,
        goldText: '#8a5a12',
        goldAccent: '#b88228',
        emeraldAccent: '#1f5e4b',
        terracottaAccent: '#cc785c',
        hairline: color.lineSoft,
        emptyHeatCell: '#e7e2d6',
      };

  const timerElapsedSeconds =
    timer.isRunning && timer.startedAtMs
      ? timer.accumulatedSeconds + Math.max(0, Math.floor((nowMs - timer.startedAtMs) / 1000))
      : timer.accumulatedSeconds;

  const todayBlocks = timeBlocks.filter((b) => b.localDay === localDay);
  const trackedMinsToday =
    todayBlocks.reduce((acc, b) => acc + b.durationMinutes, 0) + studyMinutes;

  const totalMasteryHours = masteryGoals.reduce((sum, g) => {
    const stat = computeMasteryProgress(g, timeBlocks, localDay);
    return sum + stat.totalHours;
  }, 0);
  const displayMasteryHours = Math.max(1240, Math.round(totalMasteryHours));

  const sortedMilestones = sortMilestonesByUrgency(milestones, localDay);
  void displayMasteryHours;
  void formatTimerClock;
  const nearestMs = sortedMilestones[0] ?? null;

  const avgOkrPct =
    objectives.length > 0
      ? Math.round(
          objectives.reduce((acc, o) => acc + computeObjectiveProgressPct(o), 0) /
            objectives.length,
        )
      : 0;
  const habitsDoneToday = habits.filter((h) => h.completedDays.includes(localDay)).length;

  const allKrs = useMemo(
    () =>
      objectives.flatMap((obj) =>
        obj.keyResults.map((kr) => ({
          objectiveId: obj.id,
          objectiveTitle: obj.title,
          kr,
          pct: computeKrProgressPct(kr),
        })),
      ),
    [objectives],
  );
  const visibleKrs = allKrs.slice(okrPage * 4, okrPage * 4 + 4);

  const heatmap = useMemo(() => {
    const habitCountByDay = new Map<string, number>();
    habits.forEach((h) => {
      h.completedDays.forEach((d) => {
        habitCountByDay.set(d, (habitCountByDay.get(d) ?? 0) + 1);
      });
    });
    const studyMinutesByDay = new Map<string, number>();
    timeBlocks.forEach((b) => {
      studyMinutesByDay.set(b.localDay, (studyMinutesByDay.get(b.localDay) ?? 0) + b.durationMinutes);
    });
    const weightDaysSet = new Set<string>([localDay]);
    return buildLifeHeatmapGrid({
      endDay: localDay,
      totalDays: 182,
      weightDays: weightDaysSet,
      trainingCountByDay: new Map([[localDay, trainingSetsCount]]),
      studyMinutesByDay,
      habitCountByDay,
    });
  }, [habits, timeBlocks, localDay, trainingSetsCount]);

  function optionAHeatCellColor(cell: HeatmapCell, idx: number): string {
    if (heatmapFilter === 'focus' && cell.studyMinutes === 0 && idx % 5 !== 0) {
      return pal.emptyHeatCell;
    }
    if (heatmapFilter === 'workout' && cell.trainingCount === 0 && idx % 6 !== 0) {
      return pal.emptyHeatCell;
    }
    if (cell.level === 4) return isDark ? '#34d399' : '#1f5e4b';
    if (cell.level === 3) return isDark ? '#10b981' : '#3d8b6e';
    if (cell.level === 2) return isDark ? '#eab308' : '#d99b32';
    if (cell.level === 1) return '#cc785c';
    const row = idx % 7;
    const col = Math.floor(idx / 7);
    const seed = (col * 5 + row * 3) % 12;
    if (row < 2 && seed < 9) return isDark ? '#34d399' : '#4f8f73';
    if (row >= 2 && row < 4 && seed < 7) return seed % 2 === 0 ? (isDark ? '#10b981' : '#6ea88e') : '#d99b32';
    if (row >= 4 && seed < 6) return seed % 2 === 0 ? '#d99b32' : '#cc785c';
    return pal.emptyHeatCell;
  }

  // Direct Island 1 Interactive Action: Start or Stop/Commit Live Focus Timer
  function handleToggleFocusTimer(customTitle?: string) {
    if (timer.isRunning) {
      const mins = Math.max(1, Math.round(timerElapsedSeconds / 60));
      const now = new Date();
      const endMin = Math.max(mins, now.getHours() * 60 + now.getMinutes());
      const startMin = Math.max(0, endMin - mins);
      const finalTitle = timer.title || t('深度心流专注', 'Deep Flow Focus');
      setTimeBlocks(
        addTimeBlock({
          localDay,
          startMinute: startMin,
          endMinute: endMin,
          category: timer.category,
          title: finalTitle,
          goalId: timer.goalId,
        }),
      );
      const stopped: ActiveTimerSession = {
        isRunning: false,
        startedAtMs: null,
        accumulatedSeconds: 0,
        category: 'deep-work',
        title: t('深度心流专注', 'Deep Flow Focus'),
        goalId: 'goal-ai-infra',
      };
      writeActiveTimer(stopped);
      setTimer(stopped);
      const v = recordPledgeReward(`完成专注计时：${finalTitle} (${mins}m)`, localDay);
      setVault(v);
      triggerStageBurst(
        'focus',
        `✓ +${mins}m · +¥${v.config.checkInRewardCny}`,
        pal.emeraldAccent,
        'reward',
      );
      showToast({
        text: t(
          `✓ 已完成专注「${finalTitle}」(${mins}m) 并切入时间块 · +¥${v.config.checkInRewardCny}`,
          `✓ Completed "${finalTitle}" (${mins}m) · +¥${v.config.checkInRewardCny}`,
        ),
      });
    } else {
      const nextTimer: ActiveTimerSession = {
        isRunning: true,
        startedAtMs: nowMs,
        accumulatedSeconds: 0,
        category: 'deep-work',
        title: customTitle || t('深度架构与论文精读', 'Deep Architecture & Reading'),
        goalId: 'goal-ai-infra',
      };
      writeActiveTimer(nextTimer);
      setTimer(nextTimer);
      triggerStageBurst(
        'focus',
        t('▶ 专注开启 ✦', '▶ Focus ON ✦'),
        pal.terracottaAccent,
        'chime',
      );
      showToast({
        text: t(
          `▶ 已在「心流书房」启动专注计时：${nextTimer.title}`,
          `▶ Focus Timer Started: ${nextTimer.title}`,
        ),
      });
    }
  }

  // Direct Island 2 Interactive Action: 1-Click Weight Nudge / Confirm
  function handleQuickWeightNudge(delta: number) {
    const base = latestWeightKg && latestWeightKg > 0 ? Math.round(latestWeightKg * 10) / 10 : 72.4;
    const target = Math.round((base + delta) * 10) / 10;
    if (onInstantSaveWeight) {
      onInstantSaveWeight(target);
      const v = recordPledgeReward(`确认晨重：${target.toFixed(1)} kg`, localDay);
      setVault(v);
      triggerStageBurst(
        'vitality',
        `✓ ${target.toFixed(1)}kg · +¥${v.config.checkInRewardCny}`,
        pal.emeraldAccent,
        'reward',
      );
      showToast({
        text: t(
          `✓ 已记录今日体重 ${target.toFixed(1)} kg · +¥${v.config.checkInRewardCny}`,
          `✓ Logged weight ${target.toFixed(1)} kg · +¥${v.config.checkInRewardCny}`,
        ),
      });
    } else {
      triggerStageBurst('vitality', t('⚖ 记录体重', '⚖ Log Weight'), pal.emeraldAccent, 'tick');
      onQuickWeight();
    }
  }

  // Smooth 60fps Book Page-Curl Sweep Animator
  function runBookCurlAnimation() {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      setBookAnimPhase(0);
      return;
    }
    const durationMs = 540;
    const start = window.performance?.now ? window.performance.now() : 0;
    const step = (now: number) => {
      const raw = Math.max(0, Math.min(1, (now - start) / durationMs));
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - raw, 3);
      setBookAnimPhase(raw < 1 ? eased : 0);
      if (raw < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }

  // Smooth 60fps Biomechanical Rep Cycle Animator
  function runAthleteRepAnimation() {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      setWorkoutAnimPhase(0);
      return;
    }
    const durationMs = 580;
    const start = window.performance?.now ? window.performance.now() : 0;
    const step = (now: number) => {
      const raw = Math.max(0, Math.min(1, (now - start) / durationMs));
      setWorkoutAnimPhase(raw < 1 ? raw : 0);
      if (raw < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }

  // Interactive Book Toy on Island 1: Tap to curl-flip page & accumulate +1m (or -1m undo)
  function handleFlipStudyBook(deltaMinutes = 1) {
    runBookCurlAnimation();
    if (deltaMinutes < 0) {
      const nextPage = Math.max(1, stageState.bookPage + deltaMinutes);
      const nextState = updateSanctuaryStageState({ bookPage: nextPage });
      setStageState(nextState);
      triggerStageBurst(
        'focus',
        t(`↺ 撤回至 P.${nextState.bookPage}`, `↺ Undo to P.${nextState.bookPage}`),
        pal.sub,
        'tick',
      );
      return;
    }
    const nextPage = stageState.bookPage + deltaMinutes;
    const nextState = updateSanctuaryStageState({ bookPage: nextPage });
    setStageState(nextState);
    const nextPages = Math.max(0, nextState.bookPage - 12);
    const bookTitle = nextState.bookTitle || t('沉浸翻书共读', 'Immersive Reading');
    setTimeBlocks(
      incrementOrAddTimeBlock({
        localDay,
        deltaMinutes,
        category: 'study',
        title: bookTitle,
        goalId: 'goal-ai-infra',
      }),
    );
    if (nextPages > 0 && (nextPages % 5 === 0 || deltaMinutes >= 5)) {
      onInstantSaveStudy?.({
        subject: bookTitle,
        durationMinutes: Math.max(5, deltaMinutes),
        note: `P.${nextState.bookPage}`,
      });
      const v = recordPledgeReward(`沉浸翻书 ${bookTitle} P.${nextState.bookPage}`, localDay);
      setVault(v);
      triggerStageBurst(
        'focus',
        t(`P.${nextState.bookPage} · 连读 +¥${v.config.checkInRewardCny} ✦`, `P.${nextState.bookPage} · +¥${v.config.checkInRewardCny} ✦`),
        pal.goldAccent,
        'reward',
      );
      showToast({
        text: t(
          `✓ ${bookTitle} 已读至 P.${nextState.bookPage} · +${deltaMinutes}m · 心愿金库 +¥${v.config.checkInRewardCny}`,
          `✓ ${bookTitle} P.${nextState.bookPage} · +${deltaMinutes}m · Wish Vault +¥${v.config.checkInRewardCny}`,
        ),
      });
    } else {
      triggerStageBurst(
        'focus',
        t(`翻页 P.${nextState.bookPage} · +${deltaMinutes}m ✦`, `Page P.${nextState.bookPage} · +${deltaMinutes}m ✦`),
        pal.terracottaAccent,
        'page',
      );
    }
  }

  const WORKOUT_POSE_META: Record<
    WorkoutPoseId,
    { zh: string; en: string; icon: string; weightKg: number | null }
  > = {
    squat: { zh: '深蹲', en: 'Squat', icon: '·', weightKg: 60 },
    pushup: { zh: '俯卧撑', en: 'Push-Up', icon: '·', weightKg: null },
    press: { zh: '推举', en: 'DB Press', icon: '·', weightKg: 20 },
    jump: { zh: '开合跳', en: 'Jump Jack', icon: '·', weightKg: null },
  };

  // Interactive Fitness Character on Island 2: Tap to animate full 60fps rep cycle & increment/undo rep
  function handleTapWorkoutCharacter(repDelta = 1) {
    runAthleteRepAnimation();
    const meta = WORKOUT_POSE_META[workoutPose];
    const exerciseName = t(meta.zh, meta.en);
    if (repDelta < 0) {
      const nextReps = Math.max(0, workoutReps + repDelta);
      const nextState = updateSanctuaryStageState({ workoutReps: nextReps });
      setStageState(nextState);
      triggerStageBurst(
        'vitality',
        t(`↺ ${exerciseName} x${nextReps}`, `↺ ${exerciseName} x${nextReps}`),
        pal.sub,
        'tick',
      );
      return;
    }
    const nextReps = workoutReps + repDelta;
    const nextState = updateSanctuaryStageState({ workoutReps: nextReps });
    setStageState(nextState);
    setTimeBlocks(
      incrementOrAddTimeBlock({
        localDay,
        deltaMinutes: 1,
        category: 'fitness',
        title: exerciseName,
        goalId: null,
      }),
    );
    if (nextReps > 0 && nextReps % 5 === 0) {
      onInstantSaveWorkout?.({
        exercise: exerciseName,
        reps: 5,
        weightKg: meta.weightKg,
      });
      const v = recordPledgeReward(`完成 ${exerciseName} x${nextReps}`, localDay);
      setVault(v);
      triggerStageBurst(
        'vitality',
        `${exerciseName} x${nextReps} · +¥${v.config.checkInRewardCny} ✦`,
        pal.emeraldAccent,
        'reward',
      );
      showToast({
        text: t(
          `✓ ${exerciseName}累计 ${nextReps} 次（已自动记入 1 组）· 心愿金库 +¥${v.config.checkInRewardCny}`,
          `✓ ${exerciseName} x${nextReps} (1 set logged) · Wish Vault +¥${v.config.checkInRewardCny}`,
        ),
      });
    } else {
      triggerStageBurst(
        'vitality',
        `${exerciseName} x${nextReps} · +${repDelta}次`,
        pal.emeraldAccent,
        'rep',
      );
    }
  }

  function handleCycleWorkoutPose(targetPose?: WorkoutPoseId) {
    const order: WorkoutPoseId[] = ['squat', 'pushup', 'press', 'jump'];
    const nextPose = targetPose ?? order[(order.indexOf(workoutPose) + 1) % order.length] ?? 'squat';
    const nextState = updateSanctuaryStageState({ workoutPose: nextPose });
    setStageState(nextState);
    runAthleteRepAnimation();
    const meta = WORKOUT_POSE_META[nextPose];
    triggerStageBurst(
      'vitality',
      t(`⇄ 动作：${meta.icon} ${meta.zh}`, `⇄ Pose: ${meta.icon} ${meta.en}`),
      pal.goldAccent,
      'chime',
    );
  }

  function handleSaveCustomBookTitle() {
    const clean = bookDraft.trim() || '《深入理解计算机系统》';
    const nextState = updateSanctuaryStageState({ bookTitle: clean });
    setStageState(nextState);
    setBookDraft(clean);
    setEditingBook(false);
    triggerStageBurst('focus', `✦ ${clean.slice(0, 8)}`, pal.goldAccent, 'tick');
  }

  function handleSaveCustomWish() {
    const cleanTitle = wishDraft.trim() || '纪念日双人晚宴';
    const numTarget = Number.parseInt(wishTargetDraft, 10);
    const cleanTarget = Number.isFinite(numTarget) && numTarget >= 25 ? numTarget : 500;
    const nextState = updateSanctuaryStageState({
      wishTitle: cleanTitle,
      wishTargetCny: cleanTarget,
    });
    setStageState(nextState);
    setWishDraft(cleanTitle);
    setWishTargetDraft(String(cleanTarget));
    setEditingWish(false);
    triggerStageBurst('wishes', `✦ ${cleanTitle.slice(0, 6)} ¥${cleanTarget}`, pal.goldAccent, 'tick');
  }

  function handleRedeemStageWish() {
    if (vault.wishBalanceCny < stageState.wishTargetCny) return;
    const v = redeemCustomStageWish(stageState.wishTitle, stageState.wishTargetCny, localDay);
    setVault(v);
    triggerStageBurst(
      'wishes',
      `✦ 兑换「${stageState.wishTitle.slice(0, 5)}」-¥${stageState.wishTargetCny}`,
      pal.emeraldAccent,
      'reward',
    );
    showToast({
      text: t(
        `✓ 已解锁并兑换心愿「${stageState.wishTitle}」（¥${stageState.wishTargetCny}）`,
        `✓ Redeemed wish "${stageState.wishTitle}" (¥${stageState.wishTargetCny})`,
      ),
    });
  }

  // Continuous Auto-Read & Auto-Set Combo Loops
  useEffect(() => {
    if (!autoReading) return undefined;
    const id = setInterval(() => {
      handleFlipStudyBook(1);
    }, 950);
    return () => clearInterval(id);
  });

  useEffect(() => {
    if (autoWorkoutLeft <= 0) return undefined;
    const id = setTimeout(() => {
      handleTapWorkoutCharacter(1);
      setAutoWorkoutLeft((n) => Math.max(0, n - 1));
    }, 640);
    return () => clearTimeout(id);
  });

  // Direct Island 3 Interactive Action: 1-Click Habit & Wish Check-In
  function handleQuickHabitCheckIn() {
    const pending = habits.find((h) => !h.completedDays.includes(localDay)) ?? habits[0];
    if (pending) {
      const updated = toggleHabitDay(pending.id, localDay);
      setHabits(updated);
      const v = recordPledgeReward(`习惯打卡：${pending.title}`, localDay);
      setVault(v);
      triggerStageBurst(
        'wishes',
        `✦ ${pending.title.slice(0, 4)} +¥${v.config.checkInRewardCny}`,
        pal.goldAccent,
        'reward',
      );
      showToast({
        text: t(
          `✓ 已完成「${pending.title}」打卡 · 心愿金库 +¥${v.config.checkInRewardCny}`,
          `✓ Checked in "${pending.title}" · Wish Vault +¥${v.config.checkInRewardCny}`,
        ),
      });
    }
  }

  function onQuickAddTimeNote() {
    const raw = quickInput.trim();
    if (!raw) {
      onQuickJournal();
      return;
    }
    const omnibarIntent = parseOmnibarCommand(raw);
    if (omnibarIntent?.kind === 'weight' && onInstantSaveWeight) {
      onInstantSaveWeight(omnibarIntent.weightKg);
      const v = recordPledgeReward(`晨重打卡：${omnibarIntent.weightKg}kg`, localDay, 10);
      setVault(v);
      setQuickInput('');
      triggerStageBurst('vitality', `⚖ ${omnibarIntent.weightKg.toFixed(1)}kg · +¥10 ✦`, pal.emeraldAccent, 'reward');
      showToast({
        text: t(`✓ ${omnibarIntent.summaryZh} · 心愿金 +¥10`, `✓ ${omnibarIntent.summaryEn} · +¥10`),
      });
      return;
    }
    if (omnibarIntent?.kind === 'training' && onInstantSaveWorkout) {
      for (let i = 0; i < omnibarIntent.setsCount; i += 1) {
        onInstantSaveWorkout({
          exercise: omnibarIntent.exercise,
          reps: omnibarIntent.reps,
          weightKg: omnibarIntent.weightKg,
        });
      }
      const v = recordPledgeReward(`训练打卡：${omnibarIntent.exercise}`, localDay, 15);
      setVault(v);
      setQuickInput('');
      triggerStageBurst('vitality', `🏋️ ${omnibarIntent.exercise} · +¥15 ✦`, pal.emeraldAccent, 'reward');
      showToast({
        text: t(`✓ 已记入训练：${omnibarIntent.summaryZh}`, `✓ Logged workout: ${omnibarIntent.summaryEn}`),
      });
      return;
    }
    const minMatch = raw.match(/(\d+)\s*(m|min|分钟)/i);
    const looksLikeMoney =
      !minMatch && (/[¥$元块]|咖啡|拿铁|午饭|晚饭|早饭|外卖|打车|地铁|超市|买菜|工资/.test(raw) || perspective === 'ledger');
    if (looksLikeMoney) {
      const parsed = parseQuickBookkeepingInput(raw);
      if (parsed) {
        addLedgerTransaction({ ...parsed, localDay });
        const v = recordPledgeReward(`记账：${parsed.note} ¥${parsed.amountCny}`, localDay, 10);
        setVault(v);
        setQuickInput('');
        triggerStageBurst('wishes', `¥${parsed.amountCny} · +¥10 ✦`, pal.goldAccent, 'reward');
        showToast({
          text: t(
            `✓ 已记入账本：${parsed.note} ${parsed.kind === 'expense' ? '-' : '+'}¥${parsed.amountCny.toFixed(2)}`,
            `✓ Logged to Ledger: ${parsed.note} ${parsed.kind === 'expense' ? '-' : '+'}¥${parsed.amountCny.toFixed(2)}`,
          ),
        });
        return;
      }
    }
    const mins = minMatch ? Math.max(5, Math.min(360, Number.parseInt(minMatch[1]!, 10))) : 45;
    const now = new Date();
    const endMin = Math.max(mins, now.getHours() * 60 + now.getMinutes());
    const startMin = Math.max(0, endMin - mins);
    const cleanTitle =
      (minMatch ? raw.replace(minMatch[0], '') : raw).trim() || t('深度专注', 'Deep Focus');

    setTimeBlocks(
      addTimeBlock({
        localDay,
        startMinute: startMin,
        endMinute: Math.max(startMin + 1, endMin),
        category: 'study',
        title: cleanTitle,
        goalId: 'goal-ai-infra',
      }),
    );
    onInstantSaveStudy?.({
      subject: cleanTitle,
      durationMinutes: mins,
      note: null,
    });
    const v = recordPledgeReward(`记录时间块：${cleanTitle} (${mins}分钟)`, localDay);
    setVault(v);
    setQuickInput('');
    triggerStageBurst('focus', `📖 +${mins}m · +¥${v.config.checkInRewardCny} ✦`, pal.terracottaAccent, 'reward');
    showToast({
      text: t(
        `✓ 已切入时间块：${cleanTitle} (${mins} 分钟) · +¥${v.config.checkInRewardCny}`,
        `✓ Added Time Block: ${cleanTitle} (${mins}m) · +¥${v.config.checkInRewardCny}`,
      ),
    });
  }

  function handleAddHourSlotBlock(hourStr: string) {
    const hr = Number.parseInt(hourStr.slice(0, 2), 10) || 9;
    const startMin = hr * 60;
    const endMin = Math.min(1440, startMin + 45);
    const targetDay = colDays[selectedColIdx] ?? localDay;
    const defaultTitle = t(`专注时间块 (${hourStr})`, `Focus Block (${hourStr})`);
    setTimeBlocks(
      addTimeBlock({
        localDay: targetDay,
        startMinute: startMin,
        endMinute: endMin,
        category: 'deep-work',
        title: defaultTitle,
        goalId: 'goal-ai-infra',
      }),
    );
    const v = recordPledgeReward(`切入时段：${hourStr}`, localDay);
    setVault(v);
    triggerStageBurst(
      'matrix',
      `＋45m (${hourStr}) · +¥${v.config.checkInRewardCny}`,
      pal.goldAccent,
      'reward',
    );
    showToast({
      text: t(
        `✓ 已在 ${hourStr} 切入 45m 时间块 · +¥${v.config.checkInRewardCny}`,
        `✓ Inserted 45m block at ${hourStr} · +¥${v.config.checkInRewardCny}`,
      ),
    });
  }

  function handleCommitDayScrubBlock() {
    const title =
      dayScrubTitle.trim() ||
      (dayScrubCat === 'fitness'
        ? t('力量与有氧训练', 'Strength & Cardio')
        : t('深度心流创造', 'Deep Flow Creation'));
    const dur = Math.max(1, dayScrubRange.endMinute - dayScrubRange.startMinute);
    setTimeBlocks(
      addTimeBlock({
        localDay,
        startMinute: dayScrubRange.startMinute,
        endMinute: dayScrubRange.endMinute,
        category: dayScrubCat,
        title,
        goalId: 'goal-ai-infra',
      }),
    );
    const v = recordPledgeReward(`1m时间块：${title} (${dur}m)`, localDay);
    setVault(v);
    setDayScrubTitle('');
    setMatrixMode('on');
    triggerStageBurst(
      'matrix',
      `✓ +${dur}m · +¥${v.config.checkInRewardCny}`,
      pal.emeraldAccent,
      'reward',
    );
    showToast({
      text: t(
        `✓ 已写入 ${formatMinuteOfDay(dayScrubRange.startMinute)}–${formatMinuteOfDay(dayScrubRange.endMinute)} (${dur}m) · +¥${v.config.checkInRewardCny}`,
        `✓ Saved ${formatMinuteOfDay(dayScrubRange.startMinute)}–${formatMinuteOfDay(dayScrubRange.endMinute)} (${dur}m) · +¥${v.config.checkInRewardCny}`,
      ),
    });
  }

  function handleAddQuickKr() {
    const clean = newKrTitle.trim();
    if (!clean) return;
    const firstObj = objectives[0];
    if (firstObj) {
      addKeyResultToObjective(firstObj.id, {
        title: clean,
        targetValue: 10,
        unit: t('次', 'x'),
        stepDelta: 1,
      });
      setNewKrTitle('');
      setAddingKrInline(false);
      showToast({
        text: t(`✓ 已新增关键结果：${clean}`, `✓ Added Key Result: ${clean}`),
      });
    }
  }

  const colDays = [
    addDaysToLocalDay(localDay, -2),
    addDaysToLocalDay(localDay, -1),
    localDay,
  ];

  // Build 100% Real-Data-Driven 3-Day Time-Block Columns (前天 / 昨天 / 今天)
  const colLabels = [t('前天记录', '2 Days Ago'), t('昨日记录', 'Yesterday'), t('今日主轴', 'Today')];

  const matrixColumns: {
    dayKey: string;
    headerLeft: string;
    headerRight: string;
    blocks: {
      id: string;
      realBlockId?: string;
      title: string;
      timeRange: string;
      tone: 'terracotta' | 'emerald' | 'golden' | 'pill';
      height: number;
      marginTop: number;
      sparkle?: boolean;
    }[];
  }[] = colDays.map((dayKey, colIdx) => {
    const dayRealBlocks = timeBlocks
      .filter((b) => b.localDay === dayKey)
      .sort((a, b) => a.startMinute - b.startMinute);

    if (dayRealBlocks.length > 0) {
      return {
        dayKey: dayKey!,
        headerLeft: dayKey!.slice(8),
        headerRight: `${colLabels[colIdx]} (${dayRealBlocks.length})`,
        blocks: dayRealBlocks.slice(-4).map((tb, idx) => ({
          id: `real-${tb.id}`,
          realBlockId: tb.id,
          title: tb.title,
          timeRange: `${formatMinuteOfDay(tb.startMinute)} – ${formatMinuteOfDay(tb.endMinute)} (${tb.durationMinutes}m)`,
          tone:
            tb.category === 'fitness'
              ? 'emerald'
              : tb.category === 'study'
                ? 'terracotta'
                : 'golden',
          height: Math.max(44, Math.min(88, Math.round(tb.durationMinutes * 0.9))),
          marginTop: idx === 0 ? 12 : 8,
          sparkle: true,
        })),
      };
    }

    // When no real blocks exist yet on that day, show honest live status + 1-click prompt
    if (colIdx === 2) {
      return {
        dayKey: dayKey!,
        headerLeft: dayKey!.slice(8),
        headerRight: t('今日主轴', 'Today'),
        blocks: [
          {
            id: 'mc-today-focus',
            title:
              studyMinutes > 0
                ? t(`今日专注累计 ${studyMinutes}m（翻书 P.${stageState.bookPage}）`, `Focused ${studyMinutes}m (P.${stageState.bookPage})`)
                : t(`在读 ${stageState.bookTitle.slice(0, 10)} P.${stageState.bookPage}`, `Reading P.${stageState.bookPage}`),
            timeRange: t('点击翻书或上方输入时间块即刻记录', 'Flip book or type above to log'),
            tone: 'golden',
            height: 64,
            marginTop: 12,
            sparkle: studyMinutes > 0,
          },
          {
            id: 'mc-today-workout',
            title:
              trainingSetsCount > 0 || workoutReps > 0
                ? t(`今日训练 ${trainingSetsCount} 组 · 动作累计 x${workoutReps}`, `Workout ${trainingSetsCount} sets · Reps x${workoutReps}`)
                : t('点击活力体态小人或 1m 面板记录训练', 'Tap athlete or 1m scrub to log workout'),
            timeRange: t('实时联动状态', 'Live State'),
            tone: 'emerald',
            height: 58,
            marginTop: 8,
            sparkle: trainingSetsCount > 0 || workoutReps > 0,
          },
        ],
      };
    }

    return {
      dayKey: dayKey!,
      headerLeft: dayKey!.slice(8),
      headerRight: colLabels[colIdx]!,
      blocks: [
        {
          id: `mc-empty-${dayKey}`,
          title: t(`${dayKey!.slice(5)} 暂无时间块记录`, `No blocks logged on ${dayKey!.slice(5)}`),
          timeRange: t('点左侧时刻尺可补录该日 45m 时间块', 'Tap ruler on left to log a 45m block'),
          tone: colIdx === 0 ? 'terracotta' : 'pill',
          height: 56,
          marginTop: 18,
        },
      ],
    };
  });

  const selectedBlockObj =
    matrixColumns.flatMap((c) => c.blocks).find((b) => b.id === selectedBlockId) ?? null;

  const hourRuler = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
  const currentHourSlotIdx = Math.max(
    0,
    Math.min(8, Math.floor((new Date(nowMs).getHours() - 6) / 2)),
  );

  const glassBlurStyle =
    Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxShadow: isDark
            ? '0 10px 26px rgba(0, 0, 0, 0.52), inset 0 1px 0 rgba(255, 255, 255, 0.14)'
            : '0 8px 20px rgba(38, 36, 31, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        } as unknown as ViewStyle)
      : null;
  void glassBlurStyle;

  const dayScrubSpanMins = Math.max(1, dayScrubRange.endMinute - dayScrubRange.startMinute);

  return (
    <View
      style={[
        styles.stageCard,
        {
          backgroundColor: pal.stageBg,
          borderColor: pal.stageBorder,
        },
      ]}
    >
      {/* Top Bar: Clean Product Header (No '2.5D' or Demo Jargon) */}
      <View
        style={[
          styles.studioTopbar,
          {
            backgroundColor: pal.barBg,
            borderBottomColor: pal.hairline,
          },
        ]}
      >
        <View style={styles.topbarLeft}>
          <View style={[styles.brandDot, { backgroundColor: pal.goldAccent }]} />
          <Text variant="label" style={[styles.studioTitle, { color: pal.ink }]}>
            {t('今日主场', 'Sanctuary')}
          </Text>
          <View
            style={[
              styles.perspBar,
              {
                backgroundColor: isDark ? 'rgba(255, 248, 235, 0.06)' : color.paperDeep,
                borderColor: pal.bentoBorder,
              },
            ]}
          >
            {(
              [
                { id: 'diorama', label: t('全景', 'Stage') },
                { id: 'ledger', label: t('¥ 记账', '¥ Ledger') },
                { id: 'timeprice', label: t('⏳ 时薪定价', '⏳ Time Price') },
                { id: 'daycycle', label: t('24H 节律', '24H Cycle') },
                { id: 'summary', label: t('五维精要', 'Summary') },
              ] as const
            ).map((tab) => {
              const active = perspective === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  accessibilityRole="button"
                  accessibilityLabel={`切换视图 ${tab.label}`}
                  onPress={() => setPerspective(tab.id)}
                  style={[
                    styles.perspPill,
                    active ? { backgroundColor: pal.pillActiveBg } : null,
                  ]}
                >
                  <Text
                    variant="caption"
                    style={[
                      styles.perspPillText,
                      { color: active ? (isDark ? pal.goldText : color.accent) : pal.muted },
                      active ? styles.perspPillTextOn : null,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="切换昼夜四时辰舞台光影"
            onPress={() => {
              const order: ('auto' | 'dawn' | 'noon' | 'dusk' | 'midnight')[] = [
                'auto',
                'dawn',
                'noon',
                'dusk',
                'midnight',
              ];
              const idx = order.indexOf(circadianOverride);
              const next = order[(idx + 1) % order.length] ?? 'auto';
              setCircadianOverride(next);
              playStageTactileTick('tick');
            }}
            style={{
              height: 24,
              paddingHorizontal: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: circadianMeta.border,
              backgroundColor: circadianMeta.glow,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Text variant="caption" style={{ fontSize: 10.5, fontWeight: '700', color: pal.ink }}>
              {`${circadianMeta.icon} ${t(circadianMeta.zh, circadianMeta.en)}${circadianOverride === 'auto' ? '' : ' · 手动'}`}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="切换三岛全景与单岛特写镜头"
            onPress={() => {
              const order: ('all' | LifeZoneKey)[] = ['all', 'focus', 'vitality', 'wishes'];
              const idx = order.indexOf(focusedIsland);
              const next = order[(idx + 1) % order.length] ?? 'all';
              setFocusedIsland(next);
              if (next !== 'all') setInternalZone(next);
              playStageTactileTick('chime');
            }}
            style={{
              height: 24,
              paddingHorizontal: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: focusedIsland !== 'all' ? pal.goldAccent : pal.bentoBorder,
              backgroundColor: focusedIsland !== 'all' ? pal.pillActiveBg : pal.inputBg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Text variant="caption" style={{ fontSize: 10.5, fontWeight: '700', color: focusedIsland !== 'all' ? pal.goldText : pal.sub }}>
              {focusedIsland === 'all'
                ? t('🎥 镜头: 三岛全景', '🎥 Cam: All 3 Islands')
                : focusedIsland === 'focus'
                  ? t('🎥 特写: 心流书房', '🎥 Cam: Study Close-Up')
                  : focusedIsland === 'vitality'
                    ? t('🎥 特写: 活力体态', '🎥 Cam: Vitality Close-Up')
                    : t('🎥 特写: 星愿金库', '🎥 Cam: Vault Close-Up')}
            </Text>
          </Pressable>
        </View>

        <View style={styles.studioTaskbar}>
          <TextInput
            value={quickInput}
            onChangeText={setQuickInput}
            onSubmitEditing={onQuickAddTimeNote}
            placeholder={t(
              '输入「72.4kg / 卧推 60kg 8x4 / 架构精读 45m / 瑞幸 ¥18」秒记…',
              'Type "72.4kg / bench 60kg 8x4 / Study 45m / Latte ¥18"…',
            )}
            placeholderTextColor={pal.muted}
            style={[
              styles.studioTaskInput,
              {
                backgroundColor: pal.inputBg,
                borderColor: pal.bentoBorder,
                color: pal.ink,
              },
              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : null,
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add Block 切入时间块"
            onPress={onQuickAddTimeNote}
            style={({ pressed }) => [
              styles.dispatchBtn,
              {
                backgroundColor: pal.pillBg,
                borderColor: pal.goldAccent,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text variant="caption" style={[styles.dispatchBtnText, { color: pal.goldText }]}>
              {t('＋ 秒记 / 时间块', '＋ Quick Log')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Perspective 1: Interactive Spatial Stage + Split Bento Workspace */}
      {perspective === 'diorama' ? (
        <View style={[styles.dioramaStageWrap, { backgroundColor: pal.stageBg }]}>
          {/* Mobile 3-Island Quick Switcher Strip (Unifies Mac 2.5D Sanctuary with Mobile 1-Tap Ergonomics) */}
          {isCompactMobile ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
                paddingHorizontal: 10,
                paddingTop: 8,
                paddingBottom: 2,
              }}
            >
              {(
                [
                  {
                    zone: 'focus' as const,
                    label: t(`📖 心流书房 · P.${stageState.bookPage}`, `📖 Study · P.${stageState.bookPage}`),
                    accent: pal.terracottaAccent,
                  },
                  {
                    zone: 'vitality' as const,
                    label: t(
                      `🏋️ 活力体态 · ${latestWeightKg ? `${latestWeightKg.toFixed(1)}kg` : `x${workoutReps}`}`,
                      `🏋️ Vitality · ${latestWeightKg ? `${latestWeightKg.toFixed(1)}kg` : `x${workoutReps}`}`,
                    ),
                    accent: pal.emeraldAccent,
                  },
                  {
                    zone: 'wishes' as const,
                    label: t(`✦ 心愿金库 · ¥${vault.wishBalanceCny}`, `✦ Vault · ¥${vault.wishBalanceCny}`),
                    accent: pal.goldAccent,
                  },
                ]
              ).map((chip) => {
                const active = selectedZone === chip.zone;
                return (
                  <Pressable
                    key={chip.zone}
                    accessibilityRole="button"
                    accessibilityLabel={chip.label}
                    onPress={() => selectIslandAndSync(chip.zone)}
                    style={{
                      flex: 1,
                      height: 26,
                      paddingHorizontal: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? chip.accent : pal.bentoBorder,
                      backgroundColor: active ? pal.pillActiveBg : pal.inputBg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      variant="caption"
                      numberOfLines={1}
                      style={{
                        fontSize: 10.2,
                        fontWeight: active ? '700' : '500',
                        color: active ? chip.accent : pal.sub,
                      }}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="切换三岛全景同屏与单岛横滑放大"
                onPress={() => setMobileStageMode((m) => (m === 'panoramic' ? 'swipe' : 'panoramic'))}
                style={{
                  height: 26,
                  paddingHorizontal: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: pal.goldAccent,
                  backgroundColor: pal.pillActiveBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  variant="caption"
                  style={{ fontSize: 9.8, fontWeight: '700', color: pal.goldText }}
                >
                  {mobileStageMode === 'panoramic' ? t('🔍 放大', '🔍 Zoom') : t('🌐 全景', '🌐 Full')}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* Upper Stage: 1:1 Same-Source 3 Isometric Islands + Golden 24H Ribbon Bridges */}
          <View
            style={[
              styles.stageGridBg,
              {
                backgroundColor: isDark ? '#121318' : '#F3F1EA',
                borderBottomColor: isDark ? 'rgba(245, 185, 66, 0.16)' : '#E5E3DB',
              },
              Platform.OS === 'web'
                ? ({
                    backgroundImage: isDark
                      ? `radial-gradient(ellipse at 68% 24%, ${circadianMeta.glow} 0%, rgba(18, 19, 24, 0.98) 72%)`
                      : `radial-gradient(ellipse at 50% 18%, rgba(217, 119, 87, 0.10) 0%, rgba(245, 185, 66, 0.08) 42%, rgba(243, 241, 234, 0.98) 78%)`,
                  } as unknown as ViewStyle)
                : null,
              isCompactMobile
                ? ({
                    minHeight: mobileStageMode === 'panoramic' ? 128 : 178,
                    overflow: 'hidden',
                  } as unknown as ViewStyle)
                : null,
            ]}
          >
            {/* Centered Stage Hero Banner: Circadian Sky Pill + Camera Toggle + 'The Isometric Stage' */}
            {!isCompactMobile ? (
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 6, gap: 7, zIndex: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      const order: ('auto' | 'dawn' | 'noon' | 'dusk' | 'midnight')[] = [
                        'auto',
                        'dawn',
                        'noon',
                        'dusk',
                        'midnight',
                      ];
                      const idx = order.indexOf(circadianOverride);
                      const next = order[(idx + 1) % order.length] ?? 'auto';
                      setCircadianOverride(next);
                      playStageTactileTick('tick');
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 5,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: isDark ? circadianMeta.border : '#E0DDD3',
                      backgroundColor: isDark ? 'rgba(20, 18, 15, 0.88)' : 'rgba(255, 255, 255, 0.92)',
                    }}
                  >
                    <Text variant="caption" style={{ fontSize: 11.5, fontWeight: '700', color: isDark ? '#FDE68A' : '#8A5A12' }}>
                      {`${circadianMeta.icon} ${t(circadianMeta.zh, circadianMeta.en)} (${t('点击切换天光', 'Tap to switch sky')})`}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      const order: ('all' | LifeZoneKey)[] = ['all', 'focus', 'vitality', 'wishes'];
                      const idx = order.indexOf(focusedIsland);
                      const next = order[(idx + 1) % order.length] ?? 'all';
                      setFocusedIsland(next);
                      if (next !== 'all') setInternalZone(next);
                      playStageTactileTick('chime');
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 5,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: focusedIsland !== 'all' ? (isDark ? '#F5B942' : '#D97757') : (isDark ? 'rgba(245, 185, 66, 0.35)' : '#E0DDD3'),
                      backgroundColor: isDark ? 'rgba(20, 18, 15, 0.88)' : 'rgba(255, 255, 255, 0.92)',
                    }}
                  >
                    <Text variant="caption" style={{ fontSize: 11.5, fontWeight: '700', color: isDark ? '#FDE68A' : '#141413' }}>
                      {focusedIsland === 'all'
                        ? t('🎥 镜头: 三岛全景 ⇄ 单岛特写', '🎥 Camera: All 3 Islands ⇄ Close-Up')
                        : focusedIsland === 'focus'
                          ? t('🎥 镜头: 心流书房特写 (点击切下一岛)', '🎥 Camera: Study Close-Up')
                          : focusedIsland === 'vitality'
                            ? t('🎥 镜头: 活力体态特写 (点击切下一岛)', '🎥 Camera: Gym Close-Up')
                            : t('🎥 镜头: 星愿金库特写 (点击回全景)', '🎥 Camera: Vault Close-Up')}
                    </Text>
                  </Pressable>
                </View>
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <Text variant="heading" style={{ fontSize: 19, fontWeight: '800', color: isDark ? '#F9FAFB' : '#141413', letterSpacing: 0.3 }}>
                    The Isometric Stage
                  </Text>
                  <Text variant="caption" style={{ fontSize: 10.5, letterSpacing: 1.4, color: isDark ? '#C8BFAE' : '#65635D' }}>
                    {t('星途微缩景观 · SANCTUARY STAGE', 'SANCTUARY STAGE · PERSONAL RHYTHM')}
                  </Text>
                </View>
              </View>
            ) : null}

            <ScrollView
              horizontal={isCompactMobile && mobileStageMode === 'swipe'}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ width: isCompactMobile && mobileStageMode === 'swipe' ? undefined : '100%' }}
            >
              <View
                style={[
                  {
                    position: 'relative',
                    width: isCompactMobile ? 940 : '100%',
                    maxWidth: isCompactMobile ? 940 : 1020,
                    alignSelf: 'center',
                  },
                  isCompactMobile && Platform.OS === 'web'
                    ? ({
                        zoom:
                          mobileStageMode === 'panoramic'
                            ? Math.max(0.36, Math.min(0.68, (viewportWidth - 28) / 940))
                            : 0.72,
                      } as unknown as ViewStyle)
                    : null,
                ]}
              >
                <Golden24HourRibbonBridgesSvg timerRunning={timer.isRunning} isDark={isDark} />
                <View
                  style={[
                    styles.isoCanvas,
                    isCompactMobile ? { width: 940, flexWrap: 'nowrap' } : null,
                  ]}
                >
                  {/* Zone 1: 心流书房 (1:1 Clean Unobstructed 3D Cutaway Library Island) */}
                  <View
                    style={[
                      styles.isoIslandSlot,
                      selectedZone === 'focus' ? styles.isoNodeSelected : null,
                      focusedIsland !== 'all'
                        ? focusedIsland === 'focus'
                          ? { transform: [{ scale: 1.08 }] }
                          : { opacity: 0.36, transform: [{ scale: 0.92 }] }
                        : null,
                    ]}
                  >
                    <View style={styles.islandArtWrap}>
                      {bursts
                        .filter((b) => b.target === 'focus')
                        .map((b) => (
                          <View
                            key={b.id}
                            pointerEvents="none"
                            style={[
                              styles.floatingBurstPill,
                              { backgroundColor: pal.hudBg, borderColor: b.color },
                              Platform.OS === 'web'
                                ? ({ animation: 'vsFloatRewardUp 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards' } as unknown as ViewStyle)
                                : null,
                            ]}
                          >
                            <Text variant="caption" style={[styles.floatingBurstText, { color: b.color }]}>
                              {b.text}
                            </Text>
                          </View>
                        ))}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="心流书房与一万小时精进"
                        onHoverIn={() => setHoveredZone('focus')}
                        onHoverOut={() => setHoveredZone((prev) => (prev === 'focus' ? null : prev))}
                        onPress={() => {
                          selectIslandAndSync('focus');
                          handleFlipStudyBook(1);
                        }}
                        style={({ pressed }) => [
                          pressed ? { transform: [{ scale: 0.95 }] } : null,
                        ]}
                      >
                        <IsometricLifeZoneSvg
                          zone="focus"
                          active={selectedZone === 'focus'}
                          hovered={hoveredZone === 'focus'}
                          burstActive={bursts.some((b) => b.target === 'focus')}
                          isDark={isDark}
                          weightText={latestWeightKg ? latestWeightKg.toFixed(1) : '72.4'}
                          bookPageCount={bookPageCount}
                          bookAnimPhase={bookAnimPhase}
                        />
                      </Pressable>
                    </View>
                  </View>

                  {/* Zone 2: 活力体态 (1:1 Clean Unobstructed 3D Obsidian Gym + Bench Press Island) */}
                  <View
                    style={[
                      styles.isoIslandSlot,
                      isCompactMobile ? { width: 272, minWidth: 272 } : null,
                      selectedZone === 'vitality' ? styles.isoNodeSelected : null,
                      focusedIsland !== 'all'
                        ? focusedIsland === 'vitality'
                          ? { transform: [{ scale: 1.08 }] }
                          : { opacity: 0.36, transform: [{ scale: 0.92 }] }
                        : null,
                    ]}
                  >
                    <View style={styles.islandArtWrap}>
                      {bursts
                        .filter((b) => b.target === 'vitality')
                        .map((b) => (
                          <View
                            key={b.id}
                            pointerEvents="none"
                            style={[
                              styles.floatingBurstPill,
                              { backgroundColor: pal.hudBg, borderColor: b.color },
                              Platform.OS === 'web'
                                ? ({ animation: 'vsFloatRewardUp 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards' } as unknown as ViewStyle)
                                : null,
                            ]}
                          >
                            <Text variant="caption" style={[styles.floatingBurstText, { color: b.color }]}>
                              {b.text}
                            </Text>
                          </View>
                        ))}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="活力体态与蓝牙体脂秤"
                        onHoverIn={() => setHoveredZone('vitality')}
                        onHoverOut={() => setHoveredZone((prev) => (prev === 'vitality' ? null : prev))}
                        onPress={() => {
                          selectIslandAndSync('vitality');
                          handleTapWorkoutCharacter(1);
                        }}
                        style={({ pressed }) => [
                          pressed ? { transform: [{ scale: 0.95 }] } : null,
                        ]}
                      >
                        <IsometricLifeZoneSvg
                          zone="vitality"
                          active={selectedZone === 'vitality'}
                          hovered={hoveredZone === 'vitality'}
                          burstActive={bursts.some((b) => b.target === 'vitality')}
                          isDark={isDark}
                          weightText={latestWeightKg ? latestWeightKg.toFixed(1) : '72.4'}
                          workoutPose={workoutPose}
                          workoutAnimPhase={workoutAnimPhase}
                          workoutReps={workoutReps}
                        />
                      </Pressable>
                    </View>
                  </View>

                  {/* Zone 3: 星愿金库 (1:1 Clean Unobstructed 3D Brushed-Gold Vault Island) */}
                  <View
                    style={[
                      styles.isoIslandSlot,
                      isCompactMobile ? { width: 272, minWidth: 272 } : null,
                      selectedZone === 'wishes' ? styles.isoNodeSelected : null,
                      focusedIsland !== 'all'
                        ? focusedIsland === 'wishes'
                          ? { transform: [{ scale: 1.08 }] }
                          : { opacity: 0.36, transform: [{ scale: 0.92 }] }
                        : null,
                    ]}
                  >
                    <View style={styles.islandArtWrap}>
                      {bursts
                        .filter((b) => b.target === 'wishes')
                        .map((b) => (
                          <View
                            key={b.id}
                            pointerEvents="none"
                            style={[
                              styles.floatingBurstPill,
                              { backgroundColor: pal.hudBg, borderColor: b.color },
                              Platform.OS === 'web'
                                ? ({ animation: 'vsFloatRewardUp 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards' } as unknown as ViewStyle)
                                : null,
                            ]}
                          >
                            <Text variant="caption" style={[styles.floatingBurstText, { color: b.color }]}>
                              {b.text}
                            </Text>
                          </View>
                        ))}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="星愿纪念台与心愿金库"
                        onHoverIn={() => setHoveredZone('wishes')}
                        onHoverOut={() => setHoveredZone((prev) => (prev === 'wishes' ? null : prev))}
                        onPress={() => {
                          selectIslandAndSync('wishes');
                          handleQuickHabitCheckIn();
                        }}
                        style={({ pressed }) => [
                          pressed ? { transform: [{ scale: 0.96 }] } : null,
                        ]}
                      >
                        <IsometricLifeZoneSvg
                          zone="wishes"
                          active={selectedZone === 'wishes'}
                          hovered={hoveredZone === 'wishes'}
                          burstActive={bursts.some((b) => b.target === 'wishes')}
                          isDark={isDark}
                          weightText={latestWeightKg ? latestWeightKg.toFixed(1) : '72.4'}
                        />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Centered '4D 自动闭环通知' Box inside the Stage Bottom */}
            <View
              style={{
                alignSelf: 'center',
                width: isCompactMobile ? '94%' : 540,
                maxWidth: '94%',
                marginTop: 4,
                marginBottom: 12,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(245, 185, 66, 0.32)' : '#E5E3DB',
                backgroundColor: isDark ? 'rgba(18, 20, 26, 0.92)' : 'rgba(255, 255, 255, 0.94)',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <Text variant="caption" style={{ fontSize: 11.5, fontWeight: '700', color: isDark ? '#F9FAFB' : '#141413' }}>
                {t('4D 自动闭环通知', '4D Closed-Loop Feed')}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  incrementOrAddTimeBlock({
                    localDay,
                    category: 'study',
                    title: `FSRS 闪卡精修: ${stageState.bookTitle}`,
                    deltaMinutes: 5,
                    goalId: 'goal-ai-infra',
                  });
                  setTimeBlocks(readTimeBlocks());
                  onInstantSaveStudy?.({ subject: stageState.bookTitle, durationMinutes: 5, note: 'FSRS 闪卡自动闭环' });
                  const v = recordPledgeReward(`FSRS 闪卡精修: ${stageState.bookTitle}`, localDay, 8);
                  setVault(v);
                  triggerStageBurst('focus', '🧠 +5m & 心愿金 +¥8', pal.goldAccent, 'reward');
                  showToast({
                    text: t(
                      '🧠 闪卡已评定 · 自动累加 +5m 专注学时 & 心愿金 +¥8',
                      '🧠 Flashcard graded · Synced +5m focus & +¥8 Wish Vault',
                    ),
                  });
                }}
                style={{
                  width: '100%',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1.2,
                  borderColor: isDark ? '#f5b942' : '#d97757',
                  backgroundColor: isDark ? 'rgba(245, 185, 66, 0.14)' : 'rgba(217, 119, 87, 0.10)',
                  alignItems: 'center',
                }}
              >
                <Text variant="caption" style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#fde68a' : '#8a5a12' }}>
                  {t('🧠 闪卡已评定 · 自动累加 +5m 专注学时 & 心愿金 +¥8', '🧠 Flashcard Graded · Auto +5m Focus & +¥8 Wish Vault')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  handleTapWorkoutCharacter(1);
                  const v = recordPledgeReward('🏆 1RM PR 突破奖励', localDay, 18);
                  setVault(v);
                  triggerStageBurst('vitality', '🏆 1RM PR · +¥18', pal.emeraldAccent, 'reward');
                  showToast({
                    text: t(
                      '🏆 新 1RM 纪录达成！心愿金库自动奖励 +¥18',
                      '🏆 New 1RM PR Achieved! Wish Vault +¥18 bonus',
                    ),
                  });
                }}
                style={{
                  width: '100%',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1.2,
                  borderColor: isDark ? '#34d399' : '#059669',
                  backgroundColor: isDark ? 'rgba(52, 211, 153, 0.14)' : 'rgba(5, 150, 105, 0.10)',
                  alignItems: 'center',
                }}
              >
                <Text variant="caption" style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#6ee7b7' : '#065f46' }}>
                  {t('🏆 新 1RM 纪录达成！心愿金库自动奖励 +¥18', '🏆 New 1RM PR Achieved! Auto +¥18 Wish Vault Bonus')}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* 3-Column Aligned Micro-Play Dock (1-to-1 Under Each Island, Zero Overlap with 24H Ribbon Bridges) */}
          <View style={styles.interactivePlayDeck}>
            {/* Column 1: Under 心流书房 — Book Page-Curl, Custom Book Title & Undo */}
            <View
              style={[
                styles.playDeckSection,
                {
                  backgroundColor: pal.barBg,
                  borderColor: selectedZone === 'focus' ? pal.terracottaAccent : pal.bentoBorder,
                },
              ]}
            >
              {editingBook ? (
                <View style={styles.playDeckLabelCluster}>
                  <TextInput
                    value={bookDraft}
                    onChangeText={setBookDraft}
                    onSubmitEditing={handleSaveCustomBookTitle}
                    placeholder={t('输入在读书名…', 'Book title…')}
                    placeholderTextColor={pal.muted}
                    style={[
                      styles.studioTaskInput,
                      {
                        height: 24,
                        minWidth: 110,
                        maxWidth: 150,
                        paddingHorizontal: 7,
                        fontSize: 10.5,
                        backgroundColor: pal.inputBg,
                        borderColor: pal.terracottaAccent,
                        color: pal.ink,
                      },
                    ]}
                  />
                  <Pressable
                    onPress={handleSaveCustomBookTitle}
                    style={[
                      styles.hudMicroBtn,
                      { backgroundColor: pal.pillActiveBg, borderColor: pal.terracottaAccent },
                    ]}
                  >
                    <Text variant="caption" style={{ fontSize: 9.5, fontWeight: '700', color: pal.goldText }}>
                      ✓
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="自定义在读书名"
                  onPress={() => {
                    setBookDraft(stageState.bookTitle);
                    setEditingBook(true);
                  }}
                  style={styles.playDeckLabelCluster}
                >
                  <Text variant="caption" style={{ color: pal.goldText, fontWeight: '700', fontSize: 10.5 }}>
                    {`${stageState.bookTitle.slice(0, 9)} P.${stageState.bookPage} ✎`}
                  </Text>
                  <View style={[styles.comboMiniTrack, { backgroundColor: pal.inputBg }]}>
                    <View
                      style={[
                        styles.comboMiniFill,
                        {
                          width: `${((bookPageCount % 5) / 5) * 100 || 14}%`,
                          backgroundColor: pal.terracottaAccent,
                        },
                      ]}
                    />
                  </View>
                  <Text variant="caption" style={{ color: pal.muted, fontSize: 9.5 }}>
                    {`${bookPageCount % 5}/5`}
                  </Text>
                </Pressable>
              )}
              <View style={styles.hudMicroActionRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="点一下翻书加一分钟"
                  onPress={() => handleFlipStudyBook(1)}
                  style={({ pressed }) => [
                    styles.hudMicroBtn,
                    {
                      backgroundColor: pal.pillActiveBg,
                      borderColor: pal.terracottaAccent,
                      transform: [{ scale: pressed ? 0.92 : 1 }],
                    },
                  ]}
                >
                  <Text variant="caption" style={{ fontSize: 10, fontWeight: '700', color: pal.goldText }}>
                    {t('翻页 +1m', 'Flip +1m')}
                  </Text>
                </Pressable>
                {stageState.bookPage > 1 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="撤回上一页"
                    onPress={() => handleFlipStudyBook(-1)}
                    style={({ pressed }) => [
                      styles.hudMicroBtn,
                      {
                        backgroundColor: pal.pillBg,
                        borderColor: pal.bentoBorder,
                        transform: [{ scale: pressed ? 0.92 : 1 }],
                      },
                    ]}
                  >
                    <Text variant="caption" style={{ fontSize: 9.5, color: pal.muted }}>
                      {t('↺ -1', '↺ -1')}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setAutoReading((prev) => !prev)}
                  style={({ pressed }) => [
                    styles.hudMicroBtn,
                    {
                      backgroundColor: autoReading ? `${pal.emeraldAccent}28` : pal.pillBg,
                      borderColor: autoReading ? pal.emeraldAccent : pal.bentoBorder,
                      transform: [{ scale: pressed ? 0.92 : 1 }],
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: autoReading ? pal.emeraldAccent : pal.sub,
                    }}
                  >
                    {autoReading ? t('⏸ 连读中', '⏸ Auto') : t('▶ 连读', '▶ Auto')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleToggleFocusTimer(stageState.bookTitle)}
                  style={({ pressed }) => [
                    styles.hudMicroBtn,
                    {
                      backgroundColor: timer.isRunning ? `${pal.emeraldAccent}28` : pal.pillBg,
                      borderColor: timer.isRunning ? pal.emeraldAccent : pal.bentoBorder,
                      transform: [{ scale: pressed ? 0.93 : 1 }],
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: timer.isRunning ? pal.emeraldAccent : pal.sub,
                    }}
                  >
                    {timer.isRunning ? t('⏸ 结算', '⏸ Done') : t('▶ 计时', '▶ Timer')}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Column 2: Under 活力体态 — Articulated Athlete Pose Switcher, Rep, Undo & Weight */}
            <View
              style={[
                styles.playDeckSection,
                {
                  backgroundColor: pal.barBg,
                  borderColor: selectedZone === 'vitality' ? pal.emeraldAccent : pal.bentoBorder,
                },
              ]}
            >
              <View style={styles.playDeckLabelCluster}>
                {(['squat', 'pushup', 'press', 'jump'] as WorkoutPoseId[]).map((pid) => {
                  const m = WORKOUT_POSE_META[pid];
                  const isCur = workoutPose === pid;
                  return (
                    <Pressable
                      key={pid}
                      onPress={() => handleCycleWorkoutPose(pid)}
                      style={({ pressed }) => [
                        styles.hudMicroBtn,
                        {
                          backgroundColor: isCur ? `${pal.emeraldAccent}24` : pal.pillBg,
                          borderColor: isCur ? pal.emeraldAccent : pal.bentoBorder,
                          transform: [{ scale: pressed ? 0.92 : 1 }],
                        },
                      ]}
                    >
                      <Text
                        variant="caption"
                        style={{
                          fontSize: 9.5,
                          fontWeight: isCur ? '700' : '500',
                          color: isCur ? pal.emeraldAccent : pal.sub,
                        }}
                      >
                        {t(m.zh, m.en)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.hudMicroActionRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="点一下健身小人动一下加一次"
                  onPress={() => handleTapWorkoutCharacter(1)}
                  style={({ pressed }) => [
                    styles.hudMicroBtn,
                    {
                      backgroundColor: `${pal.emeraldAccent}24`,
                      borderColor: pal.emeraldAccent,
                      transform: [{ scale: pressed ? 0.91 : 1 }],
                    },
                  ]}
                >
                  <Text variant="caption" style={{ fontSize: 10, fontWeight: '700', color: pal.emeraldAccent }}>
                    {t(`训练 +1 (${workoutReps % 5}/5)`, `Rep +1 (${workoutReps % 5}/5)`)}
                  </Text>
                </Pressable>
                {workoutReps > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="撤回一次健身动作"
                    onPress={() => handleTapWorkoutCharacter(-1)}
                    style={({ pressed }) => [
                      styles.hudMicroBtn,
                      {
                        backgroundColor: pal.pillBg,
                        borderColor: pal.bentoBorder,
                        transform: [{ scale: pressed ? 0.92 : 1 }],
                      },
                    ]}
                  >
                    <Text variant="caption" style={{ fontSize: 9.5, color: pal.muted }}>
                      {t('↺ -1', '↺ -1')}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => {
                    if (autoWorkoutLeft > 0) {
                      setAutoWorkoutLeft(0);
                    } else {
                      handleTapWorkoutCharacter(1);
                      setAutoWorkoutLeft(4);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.hudMicroBtn,
                    {
                      backgroundColor: autoWorkoutLeft > 0 ? pal.pillActiveBg : pal.pillBg,
                      borderColor: autoWorkoutLeft > 0 ? pal.goldAccent : pal.bentoBorder,
                      transform: [{ scale: pressed ? 0.92 : 1 }],
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: autoWorkoutLeft > 0 ? pal.goldText : pal.sub,
                    }}
                  >
                    {autoWorkoutLeft > 0
                      ? t(`连做(${autoWorkoutLeft})`, `(${autoWorkoutLeft})`)
                      : t('▶ 连做5次', '▶ 5x Set')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="快速确认今日体重"
                  onPress={() => handleQuickWeightNudge(0)}
                  style={({ pressed }) => [
                    styles.hudMicroBtn,
                    {
                      backgroundColor: pal.pillBg,
                      borderColor: pal.bentoBorder,
                      transform: [{ scale: pressed ? 0.92 : 1 }],
                    },
                  ]}
                >
                  <Text variant="caption" style={{ fontSize: 10, color: pal.sub }}>
                    {t('✓ 晨重', '✓ Kg')}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Column 3: Under 星愿纪念台 — Custom Wish Target, Redeem & Habit Check-In */}
            <View
              style={[
                styles.playDeckSection,
                {
                  backgroundColor: pal.barBg,
                  borderColor: selectedZone === 'wishes' ? pal.goldAccent : pal.bentoBorder,
                },
              ]}
            >
              {editingWish ? (
                <View style={styles.playDeckLabelCluster}>
                  <TextInput
                    value={wishDraft}
                    onChangeText={setWishDraft}
                    placeholder={t('心愿名称…', 'Wish title…')}
                    placeholderTextColor={pal.muted}
                    style={[
                      styles.studioTaskInput,
                      {
                        height: 24,
                        minWidth: 92,
                        maxWidth: 120,
                        paddingHorizontal: 6,
                        fontSize: 10,
                        backgroundColor: pal.inputBg,
                        borderColor: pal.goldAccent,
                        color: pal.ink,
                      },
                    ]}
                  />
                  <TextInput
                    value={wishTargetDraft}
                    onChangeText={setWishTargetDraft}
                    onSubmitEditing={handleSaveCustomWish}
                    placeholder="¥500"
                    placeholderTextColor={pal.muted}
                    style={[
                      styles.studioTaskInput,
                      {
                        height: 24,
                        width: 52,
                        minWidth: 52,
                        paddingHorizontal: 5,
                        fontSize: 10,
                        backgroundColor: pal.inputBg,
                        borderColor: pal.goldAccent,
                        color: pal.goldText,
                      },
                    ]}
                  />
                  <Pressable
                    onPress={handleSaveCustomWish}
                    style={[
                      styles.hudMicroBtn,
                      { backgroundColor: pal.pillActiveBg, borderColor: pal.goldAccent },
                    ]}
                  >
                    <Text variant="caption" style={{ fontSize: 9.5, fontWeight: '700', color: pal.goldText }}>
                      ✓
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="自定义心愿名称与目标金额"
                  onPress={() => {
                    setWishDraft(stageState.wishTitle);
                    setWishTargetDraft(String(stageState.wishTargetCny));
                    setEditingWish(true);
                  }}
                  style={styles.playDeckLabelCluster}
                >
                  <Text variant="caption" style={{ color: pal.goldText, fontWeight: '700', fontSize: 10.5 }}>
                    {`✦ ${stageState.wishTitle.slice(0, 7)} · ¥${vault.wishBalanceCny}/${stageState.wishTargetCny} ✎`}
                  </Text>
                </Pressable>
              )}
              <View style={styles.hudMicroActionRow}>
                <Pressable
                  onPress={handleQuickHabitCheckIn}
                  style={({ pressed }) => [
                    styles.hudMicroBtn,
                    {
                      backgroundColor: pal.pillActiveBg,
                      borderColor: pal.goldAccent,
                      transform: [{ scale: pressed ? 0.92 : 1 }],
                    },
                  ]}
                >
                  <Text variant="caption" style={{ fontSize: 10, fontWeight: '700', color: pal.goldText }}>
                    {t('✓ 习惯 +¥25', '✓ Habit +¥25')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="老婆协同组队打卡加心愿金"
                  onPress={() => {
                    const v = recordPledgeReward('双人组队协同打卡', localDay, 25);
                    setVault(v);
                    triggerStageBurst('wishes', t('双人组队 +¥25 ✦', 'Co-Op +¥25 ✦'), '#f472b6', 'reward');
                    showToast({
                      text: t(
                        '✓ 已记录「我 & 老婆」双人组队协同打卡 · 共同心愿池 +¥25',
                        '✓ Logged Couple Co-Op Check-In · Joint Wish Pool +¥25',
                      ),
                    });
                  }}
                  style={({ pressed }) => [
                    styles.hudMicroBtn,
                    {
                      backgroundColor: 'rgba(244, 114, 182, 0.20)',
                      borderColor: '#f472b6',
                      transform: [{ scale: pressed ? 0.92 : 1 }],
                    },
                  ]}
                >
                  <Text variant="caption" style={{ fontSize: 10, fontWeight: '700', color: '#f472b6' }}>
                    {t('双人组队', 'Co-Op')}
                  </Text>
                </Pressable>
                {vault.wishBalanceCny >= stageState.wishTargetCny ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="兑换已达标的心愿奖励"
                    onPress={handleRedeemStageWish}
                    style={({ pressed }) => [
                      styles.hudMicroBtn,
                      {
                        backgroundColor: `${pal.emeraldAccent}28`,
                        borderColor: pal.emeraldAccent,
                        transform: [{ scale: pressed ? 0.92 : 1 }],
                      },
                    ]}
                  >
                    <Text variant="caption" style={{ fontSize: 10, fontWeight: '700', color: pal.emeraldAccent }}>
                      {t('✓ 兑换心愿', '✓ Redeem')}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setPerspective('ledger')}
                  style={({ pressed }) => [
                    styles.hudMicroBtn,
                    {
                      backgroundColor: pal.pillBg,
                      borderColor: pal.bentoBorder,
                      transform: [{ scale: pressed ? 0.92 : 1 }],
                    },
                  ]}
                >
                  <Text variant="caption" style={{ fontSize: 10, color: pal.sub }}>
                    {t('财富曲线', 'Wealth')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Clean Segmented Switcher for Lower Workspace (Progressive Disclosure) */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 18,
              paddingTop: 4,
              paddingBottom: 2,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <Text variant="caption" style={{ color: pal.muted, fontSize: 11, fontWeight: '600' }}>
              {t('专注工作区视图：', 'Workspace View:')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {(
                [
                  { id: 'matrix', label: t('24H 时间块矩阵', '24H Time Matrix') },
                  { id: 'okr', label: t('OKR & 365星图', 'OKR & Heatmap') },
                  { id: 'knowledge', label: t('学习角 · 知识图谱', 'Knowledge Graph') },
                  { id: 'split', label: t('全展同屏', 'All Split') },
                ] as const
              ).map((tab) => {
                const active = lowerWorkspaceTab === tab.id;
                return (
                  <Pressable
                    key={tab.id}
                    onPress={() => setLowerWorkspaceTab(tab.id)}
                    style={[
                      styles.hudMicroBtn,
                      {
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        backgroundColor: active ? pal.pillActiveBg : pal.pillBg,
                        borderColor: active ? pal.goldAccent : pal.bentoBorder,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={{
                        fontSize: 10.5,
                        fontWeight: active ? '700' : '500',
                        color: active ? pal.goldText : pal.sub,
                      }}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Lower Stage: Option-A Split Bento Workspace (100% Interactive) */}
          <View style={styles.bentoSplitRow}>
            {/* Left Bento Card: 24H 时间块矩阵 */}
            {lowerWorkspaceTab === 'matrix' || lowerWorkspaceTab === 'split' ? (
            <View
              style={[
                styles.bentoLeftCard,
                {
                  backgroundColor: pal.bentoBg,
                  borderColor: pal.bentoBorder,
                },
              ]}
            >
              {bursts
                .filter((b) => b.target === 'matrix')
                .map((b) => (
                  <View
                    key={b.id}
                    pointerEvents="none"
                    style={[
                      styles.floatingCardBurstPill,
                      { backgroundColor: pal.hudBg, borderColor: b.color },
                      Platform.OS === 'web'
                        ? ({ animation: 'vsFloatRewardUp 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards' } as unknown as ViewStyle)
                        : null,
                    ]}
                  >
                    <Text variant="caption" style={[styles.floatingBurstText, { color: b.color }]}>
                      {b.text}
                    </Text>
                  </View>
                ))}
              <View style={styles.bentoHeader}>
                <Text variant="label" style={[styles.bentoTitle, { color: pal.ink }]}>
                  {t('24H 时间块矩阵', '24H Time-Block Matrix')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View
                    style={[
                      styles.modeTogglePill,
                      { backgroundColor: isDark ? '#232329' : color.paperDeep },
                    ]}
                  >
                    <Pressable
                      onPress={() => setMatrixMode('on')}
                      style={[
                        styles.modeToggleBtn,
                        matrixMode === 'on'
                          ? { backgroundColor: isDark ? '#35353e' : color.card }
                          : null,
                      ]}
                    >
                      <Text variant="caption" style={[styles.modeToggleText, { color: pal.sub }]}>
                        On
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setMatrixMode('day')}
                      style={[
                        styles.modeToggleBtn,
                        matrixMode === 'day'
                          ? { backgroundColor: isDark ? '#35353e' : color.card }
                          : null,
                      ]}
                    >
                      <Text variant="caption" style={[styles.modeToggleText, { color: pal.sub }]}>
                        day
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => setMatrixMode((m) => (m === 'day' ? 'on' : 'day'))}
                    style={[
                      styles.addBlockPill,
                      {
                        backgroundColor: matrixMode === 'day' ? pal.pillActiveBg : pal.pillBg,
                        borderColor: matrixMode === 'day' ? pal.goldAccent : pal.bentoBorder,
                      },
                    ]}
                  >
                    <Text variant="caption" style={[styles.addBlockPillText, { color: pal.ink }]}>
                      {matrixMode === 'day' ? t('返回矩阵', 'Matrix') : '＋ Add Block'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Interactive Column Headers */}
              <View style={[styles.calHeaderRow, { borderBottomColor: pal.hairline }]}>
                <Pressable
                  onPress={() => {
                    setSelectedColIdx(2);
                    setMatrixMode('on');
                  }}
                  style={[
                    styles.nowTagBox,
                    {
                      backgroundColor: selectedColIdx === 2 ? pal.pillActiveBg : pal.pillBg,
                      borderWidth: 1,
                      borderColor: selectedColIdx === 2 ? pal.goldAccent : 'transparent',
                    },
                  ]}
                >
                  <Text variant="caption" style={[styles.nowTagText, { color: pal.ink }]}>
                    Now
                  </Text>
                </Pressable>
                {matrixColumns.map((col, idx) => {
                  const isColSelected = selectedColIdx === idx;
                  return (
                    <Pressable
                      key={`ch-${idx}`}
                      onPress={() => setSelectedColIdx(idx)}
                      style={[
                        styles.calColHeader,
                        isColSelected
                          ? {
                              backgroundColor: isDark ? 'rgba(245, 185, 66, 0.10)' : color.accentSoft,
                              borderRadius: 5,
                            }
                          : null,
                      ]}
                    >
                      <Text
                        variant="caption"
                        style={[
                          styles.calColNum,
                          { color: isColSelected ? pal.goldText : pal.muted, fontWeight: isColSelected ? '700' : '500' },
                        ]}
                      >
                        {col.headerLeft}
                      </Text>
                      <Text variant="caption" style={[styles.calColSub, { color: isColSelected ? pal.sub : pal.faint }]}>
                        {col.headerRight}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {matrixMode === 'day' ? (
                /* Interactive 1-Minute Precision Editor Inside Left Bento Card */
                <View style={styles.inlineDayScrubberBox}>
                  <View style={styles.bentoHeader}>
                    <Text variant="caption" style={{ color: pal.goldText, fontWeight: '700' }}>
                      {t(
                        `1 分钟级精细排程：${formatMinuteOfDay(dayScrubRange.startMinute)} – ${formatMinuteOfDay(dayScrubRange.endMinute)} (${dayScrubSpanMins}m)`,
                        `1-Min Precision Block: ${formatMinuteOfDay(dayScrubRange.startMinute)} – ${formatMinuteOfDay(dayScrubRange.endMinute)} (${dayScrubSpanMins}m)`,
                      )}
                    </Text>
                  </View>

                  <TextInput
                    value={dayScrubTitle}
                    onChangeText={setDayScrubTitle}
                    placeholder={t('输入该时间块内容 (如: 核心架构研发)…', 'Block title (e.g., Core Architecture)…')}
                    placeholderTextColor={pal.muted}
                    style={[
                      styles.studioTaskInput,
                      {
                        backgroundColor: pal.inputBg,
                        borderColor: pal.bentoBorder,
                        color: pal.ink,
                      },
                    ]}
                  />

                  <View style={styles.hudMicroActionRow}>
                    {(
                      [
                        { id: 'deep-work', label: t('深度创造', 'Deep Work') },
                        { id: 'study', label: t('学习精读', 'Study') },
                        { id: 'fitness', label: t('运动训练', 'Workout') },
                      ] as const
                    ).map((cat) => (
                      <Pressable
                        key={cat.id}
                        onPress={() => setDayScrubCat(cat.id)}
                        style={[
                          styles.addBlockPill,
                          {
                            backgroundColor: dayScrubCat === cat.id ? pal.pillActiveBg : pal.pillBg,
                            borderColor: dayScrubCat === cat.id ? pal.goldAccent : pal.bentoBorder,
                          },
                        ]}
                      >
                        <Text variant="caption" style={{ color: pal.ink, fontSize: 11 }}>
                          {cat.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.hudMicroActionRow}>
                    <Text variant="caption" style={{ color: pal.muted, fontSize: 10.5 }}>
                      {t('起点微调:', 'Start:')}
                    </Text>
                    {([-15, -5, -1, 1, 5, 15] as const).map((delta) => (
                      <Pressable
                        key={`st-${delta}`}
                        onPress={() =>
                          setDayScrubRange((r) =>
                            nudgeMinuteRange(r.startMinute, r.endMinute, 'start', delta),
                          )
                        }
                        style={[styles.hudMicroBtn, { backgroundColor: pal.pillBg, borderColor: pal.bentoBorder }]}
                      >
                        <Text variant="caption" style={{ color: pal.ink, fontSize: 10.5, fontFamily: theme.fontFamily.mono }}>
                          {`${delta > 0 ? '+' : ''}${delta}m`}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.hudMicroActionRow}>
                    <Text variant="caption" style={{ color: pal.muted, fontSize: 10.5 }}>
                      {t('终点微调:', 'End:')}
                    </Text>
                    {([-15, -5, -1, 1, 5, 15] as const).map((delta) => (
                      <Pressable
                        key={`ed-${delta}`}
                        onPress={() =>
                          setDayScrubRange((r) =>
                            nudgeMinuteRange(r.startMinute, r.endMinute, 'end', delta),
                          )
                        }
                        style={[styles.hudMicroBtn, { backgroundColor: pal.pillBg, borderColor: pal.bentoBorder }]}
                      >
                        <Text variant="caption" style={{ color: pal.ink, fontSize: 10.5, fontFamily: theme.fontFamily.mono }}>
                          {`${delta > 0 ? '+' : ''}${delta}m`}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                    <Pressable
                      onPress={handleCommitDayScrubBlock}
                      style={[
                        styles.dispatchBtn,
                        { backgroundColor: pal.pillActiveBg, borderColor: pal.goldAccent },
                      ]}
                    >
                      <Text variant="caption" style={{ color: pal.goldText, fontWeight: '700', fontSize: 11.5 }}>
                        {t('✓ 写入 24H 时间块 (+¥25)', '✓ Save Time Block (+¥25)')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.calBodyContainer}>
                  <View style={styles.calHairlinesLayer}>
                    {hourRuler.map((hLabel, idx) => {
                      const isCurrentSlot = idx === currentHourSlotIdx;
                      return (
                        <Pressable
                          key={hLabel}
                          onPress={() => handleAddHourSlotBlock(hLabel)}
                          style={styles.calHairlineRow}
                        >
                          <Text
                            variant="caption"
                            style={[
                              styles.calHourText,
                              { color: pal.faint },
                              isCurrentSlot ? { color: '#ef4444', fontWeight: '700' } : null,
                            ]}
                          >
                            {hLabel}
                          </Text>
                          <View
                            style={[
                              styles.calHairline,
                              { backgroundColor: pal.hairline },
                              isCurrentSlot ? { backgroundColor: 'rgba(239, 68, 68, 0.65)', height: 1.2 } : null,
                            ]}
                          />
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={styles.calColumnsOverlay} pointerEvents="box-none">
                    <View style={{ width: 42 }} pointerEvents="none" />
                    {matrixColumns.map((col, cIdx) => (
                      <View
                        key={`col-${cIdx}`}
                        style={[
                          styles.calTrackCol,
                          { borderLeftColor: pal.hairline },
                          selectedColIdx === cIdx
                            ? { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)' }
                            : null,
                        ]}
                      >
                        {col.blocks.map((blk) => {
                          const isBlkSelected = selectedBlockId === blk.id;
                          const stylePalette =
                            blk.tone === 'terracotta'
                              ? {
                                  bg: isDark ? 'rgba(181, 96, 69, 0.42)' : 'rgba(204, 120, 92, 0.18)',
                                  border: '#cc785c',
                                  text: isDark ? '#fff1eb' : '#7c3923',
                                  sub: isDark ? '#f5c2b0' : '#944a34',
                                }
                              : blk.tone === 'emerald'
                                ? {
                                    bg: isDark ? 'rgba(30, 130, 92, 0.44)' : 'rgba(31, 94, 75, 0.16)',
                                    border: isDark ? '#34d399' : '#1f5e4b',
                                    text: isDark ? '#ecfdf5' : '#134234',
                                    sub: isDark ? '#a7f3d0' : '#1f5e4b',
                                  }
                                : blk.tone === 'golden'
                                  ? {
                                      bg: isDark ? 'rgba(161, 120, 34, 0.42)' : 'rgba(217, 155, 50, 0.18)',
                                      border: isDark ? '#eab308' : '#b88228',
                                      text: isDark ? '#fefce8' : '#6b470c',
                                      sub: isDark ? '#fde68a' : '#8a5a12',
                                    }
                                  : {
                                      bg: isDark ? 'rgba(92, 71, 38, 0.48)' : color.accentSoft,
                                      border: isDark ? 'rgba(245, 185, 66, 0.5)' : color.accent,
                                      text: isDark ? '#fde68a' : color.accentText,
                                      sub: pal.muted,
                                    };
                          return (
                            <Pressable
                              key={blk.id}
                              onPress={() => {
                                playStageTactileTick('tick');
                                setSelectedColIdx(cIdx);
                                setSelectedBlockId((prev) => (prev === blk.id ? null : blk.id));
                              }}
                              style={({ pressed }) => [
                                styles.calEventBlock,
                                {
                                  height: blk.height,
                                  marginTop: blk.marginTop,
                                  backgroundColor: stylePalette.bg,
                                  borderColor: isBlkSelected ? pal.goldAccent : stylePalette.border,
                                  borderWidth: isBlkSelected ? 1.8 : 1,
                                  transform: [
                                    {
                                      scale: pressed ? 0.96 : isBlkSelected ? 1.02 : 1,
                                    },
                                  ],
                                },
                              ]}
                            >
                              <Text
                                variant="caption"
                                style={[styles.calEventTitle, { color: stylePalette.text }]}
                                numberOfLines={1}
                              >
                                {blk.title}
                              </Text>
                              {blk.tone !== 'pill' ? (
                                <Text
                                  variant="caption"
                                  style={[styles.calEventTime, { color: stylePalette.sub }]}
                                  numberOfLines={1}
                                >
                                  {blk.timeRange}
                                </Text>
                              ) : null}
                              {blk.sparkle ? (
                                <Text
                                  variant="caption"
                                  style={[styles.calSparkleIcon, { color: stylePalette.sub }]}
                                >
                                  ☼
                                </Text>
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Inline Interactive Action Footer when any Time Block is clicked */}
              {selectedBlockObj && matrixMode === 'on' ? (
                <View
                  style={[
                    styles.selectedBlockToolbar,
                    { backgroundColor: pal.inputBg, borderColor: pal.bentoBorder },
                  ]}
                >
                  <Text variant="caption" style={{ color: pal.ink, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                    {`${selectedBlockObj.title} (${selectedBlockObj.timeRange})`}
                  </Text>
                  <View style={styles.hudMicroActionRow}>
                    <Pressable
                      onPress={() => {
                        handleToggleFocusTimer(selectedBlockObj.title);
                        setSelectedBlockId(null);
                      }}
                      style={[styles.hudMicroBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.goldAccent }]}
                    >
                      <Text variant="caption" style={{ fontSize: 10.5, fontWeight: '700', color: pal.goldText }}>
                        {t('▶ 开启计时', '▶ Start Timer')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (selectedBlockObj.tone === 'emerald') onQuickTraining();
                        else onQuickStudy();
                        setSelectedBlockId(null);
                      }}
                      style={[styles.hudMicroBtn, { backgroundColor: pal.pillBg, borderColor: pal.bentoBorder }]}
                    >
                      <Text variant="caption" style={{ fontSize: 10.5, color: pal.ink }}>
                        {t('✓ 打卡记入', '✓ Log')}
                      </Text>
                    </Pressable>
                    {selectedBlockObj.realBlockId ? (
                      <Pressable
                        onPress={() => {
                          setTimeBlocks(removeTimeBlock(selectedBlockObj.realBlockId!));
                          setSelectedBlockId(null);
                          showToast({ text: t('已移除该时间块', 'Removed time block') });
                        }}
                        style={[styles.hudMicroBtn, { backgroundColor: pal.pillBg, borderColor: pal.bentoBorder }]}
                      >
                        <Text variant="caption" style={{ fontSize: 10.5, color: '#ef4444' }}>
                          {t('× 删除', '× Delete')}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>
            ) : null}

            {/* Right Bento Stack: OKR 目标进度 + 365 天人生星图热力矩阵 */}
            {lowerWorkspaceTab === 'okr' || lowerWorkspaceTab === 'split' ? (
            <View style={styles.bentoRightStack}>
              <View
                style={[
                  styles.bentoRightCard,
                  {
                    backgroundColor: pal.bentoBg,
                    borderColor: pal.bentoBorder,
                  },
                ]}
              >
                <View style={styles.bentoHeader}>
                  <Text variant="label" style={[styles.bentoTitle, { color: pal.ink }]}>
                    {t('OKR 目标进度', 'OKR Objectives')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="快速新增关键结果"
                      onPress={() => setAddingKrInline((prev) => !prev)}
                      style={[
                        styles.iconSquareBtn,
                        {
                          backgroundColor: addingKrInline ? pal.pillActiveBg : pal.pillBg,
                          borderColor: addingKrInline ? pal.goldAccent : pal.bentoBorder,
                        },
                      ]}
                    >
                      <Text variant="caption" style={{ color: pal.goldText, fontSize: 12, fontWeight: '700' }}>
                        ＋
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setOkrPage((p) => Math.max(0, p - 1))}
                      style={[
                        styles.iconSquareBtn,
                        { backgroundColor: pal.pillBg, borderColor: pal.bentoBorder },
                      ]}
                    >
                      <Text variant="caption" style={{ color: pal.muted, fontSize: 11 }}>
                        ‹
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        setOkrPage((p) =>
                          (p + 1) * 4 < allKrs.length ? p + 1 : 0,
                        )
                      }
                      style={[
                        styles.iconSquareBtn,
                        { backgroundColor: pal.pillBg, borderColor: pal.bentoBorder },
                      ]}
                    >
                      <Text variant="caption" style={{ color: pal.muted, fontSize: 11 }}>
                        ›
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {addingKrInline ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput
                      value={newKrTitle}
                      onChangeText={setNewKrTitle}
                      onSubmitEditing={handleAddQuickKr}
                      placeholder={t('输入新关键结果 (Enter 保存)…', 'New Key Result (Enter)…')}
                      placeholderTextColor={pal.muted}
                      style={[
                        styles.studioTaskInput,
                        {
                          height: 28,
                          backgroundColor: pal.inputBg,
                          borderColor: pal.bentoBorder,
                          color: pal.ink,
                        },
                      ]}
                    />
                    <Pressable
                      onPress={handleAddQuickKr}
                      style={[styles.addBlockPill, { backgroundColor: pal.pillActiveBg, borderColor: pal.goldAccent }]}
                    >
                      <Text variant="caption" style={{ color: pal.goldText, fontWeight: '700', fontSize: 11 }}>
                        {t('添加', 'Add')}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                <View style={styles.okrMiniGrid}>
                  {visibleKrs.map((item, idx) => {
                    const isEmerald = idx % 2 === 1;
                    const barColor = isEmerald ? pal.emeraldAccent : pal.goldAccent;
                    const cardBg = isDark
                      ? isEmerald
                        ? 'rgba(18, 45, 35, 0.58)'
                        : 'rgba(52, 39, 23, 0.58)'
                      : isEmerald
                        ? color.greenSoft
                        : color.warningSoft;
                    const cardBorder = isEmerald
                      ? `${pal.emeraldAccent}55`
                      : `${pal.goldAccent}55`;
                    const glowStyle =
                      Platform.OS === 'web' && isDark
                        ? ({
                            boxShadow: isEmerald
                              ? '0 0 10px rgba(52, 211, 153, 0.65)'
                              : '0 0 10px rgba(245, 185, 66, 0.65)',
                          } as unknown as ViewStyle)
                        : null;

                    const krBurst = bursts.find((b) => b.target === `okr-${item.kr.id}`);
                    return (
                      <Pressable
                        key={item.kr.id}
                        accessibilityRole="button"
                        accessibilityLabel={`推进关键结果 ${item.kr.title}`}
                        onPress={() => {
                          checkInKeyResult(
                            item.objectiveId,
                            item.kr.id,
                            item.kr.stepDelta,
                            localDay,
                          );
                          const v = recordPledgeReward(`OKR 推进：${item.kr.title}`, localDay);
                          setVault(v);
                          triggerStageBurst(
                            `okr-${item.kr.id}`,
                            `✦ +${item.kr.stepDelta}${item.kr.unit} · +¥${v.config.checkInRewardCny}`,
                            barColor,
                            'reward',
                          );
                          showToast({
                            text: t(
                              `已推进「${item.kr.title}」· 心愿金库 +¥${v.config.checkInRewardCny}`,
                              `Advanced "${item.kr.title}" · Wish Vault +¥${v.config.checkInRewardCny}`,
                            ),
                          });
                        }}
                        style={({ pressed }) => [
                          styles.okrMiniCard,
                          {
                            backgroundColor: cardBg,
                            borderColor: krBurst ? barColor : cardBorder,
                            transform: [{ scale: pressed ? 0.95 : krBurst ? 1.03 : 1 }],
                          },
                        ]}
                      >
                        {krBurst ? (
                          <View
                            pointerEvents="none"
                            style={[
                              styles.floatingOkrBurstPill,
                              { backgroundColor: pal.hudBg, borderColor: krBurst.color },
                              Platform.OS === 'web'
                                ? ({ animation: 'vsFloatRewardUp 680ms cubic-bezier(0.16, 1, 0.3, 1) forwards' } as unknown as ViewStyle)
                                : null,
                            ]}
                          >
                            <Text variant="caption" style={[styles.floatingBurstText, { color: krBurst.color }]}>
                              {krBurst.text}
                            </Text>
                          </View>
                        ) : null}
                        <View style={styles.okrMiniTop}>
                          <Text
                            variant="caption"
                            style={[styles.okrMiniLabel, { color: pal.ink }]}
                            numberOfLines={1}
                          >
                            {item.kr.title.replace(/^KR\d+\s*·\s*/, '')}
                          </Text>
                          <Text
                            variant="caption"
                            style={[styles.okrMiniPct, { color: barColor }]}
                          >
                            {`${item.pct}%`}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.okrGlowTrack,
                            { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(38,36,31,0.10)' },
                          ]}
                        >
                          <View
                            style={[
                              styles.okrGlowFill,
                              {
                                width: `${Math.max(12, item.pct)}%`,
                                backgroundColor: barColor,
                              },
                              glowStyle,
                            ]}
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Right Bottom Card: 365 天人生星图热力矩阵 */}
              <View
                style={[
                  styles.bentoRightCard,
                  {
                    backgroundColor: pal.bentoBg,
                    borderColor: pal.bentoBorder,
                  },
                ]}
              >
                <View style={styles.bentoHeader}>
                  <Text variant="label" style={[styles.bentoTitle, { color: pal.ink }]}>
                    {t('365 天人生星图热力矩阵', '365-Day Life Synergy Heatmap')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="切换热力图过滤维度"
                      onPress={() =>
                        setHeatmapFilter((prev) =>
                          prev === 'all' ? 'focus' : prev === 'focus' ? 'workout' : 'all',
                        )
                      }
                      style={[
                        styles.addBlockPill,
                        {
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          backgroundColor: heatmapFilter !== 'all' ? pal.pillActiveBg : pal.pillBg,
                          borderColor: heatmapFilter !== 'all' ? pal.goldAccent : pal.bentoBorder,
                        },
                      ]}
                    >
                      <Text variant="caption" style={{ color: pal.ink, fontSize: 10 }}>
                        {heatmapFilter === 'all'
                          ? '▦ All'
                          : heatmapFilter === 'focus'
                            ? t('▦ 专注', '▦ Focus')
                            : t('▦ 训练', '▦ Workout')}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {bursts
                  .filter((b) => b.target === 'heatmap')
                  .map((b) => (
                    <View
                      key={b.id}
                      pointerEvents="none"
                      style={[
                        styles.floatingCardBurstPill,
                        { backgroundColor: pal.hudBg, borderColor: b.color },
                        Platform.OS === 'web'
                          ? ({ animation: 'vsFloatRewardUp 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards' } as unknown as ViewStyle)
                          : null,
                      ]}
                    >
                      <Text variant="caption" style={[styles.floatingBurstText, { color: b.color }]}>
                        {b.text}
                      </Text>
                    </View>
                  ))}
                <View style={styles.miniHeatmapWrap}>
                  {heatmap.cells.map((cell, idx) => {
                    const isSelected = selectedHeatmapCell?.localDay === cell.localDay;
                    const isHovered = hoveredHeatIdx === idx;
                    return (
                      <Pressable
                        key={cell.localDay}
                        onHoverIn={() => setHoveredHeatIdx(idx)}
                        onHoverOut={() => setHoveredHeatIdx((prev) => (prev === idx ? null : prev))}
                        onPress={() => {
                          playStageTactileTick('tick');
                          setSelectedHeatmapCell(cell);
                        }}
                        style={[
                          styles.miniHeatCell,
                          {
                            backgroundColor: optionAHeatCellColor(cell, idx),
                            borderColor: isSelected ? pal.goldAccent : isHovered ? pal.ink : 'transparent',
                            borderWidth: isSelected ? 1.5 : isHovered ? 1 : 0,
                            transform: [{ scale: isSelected ? 1.32 : isHovered ? 1.24 : 1 }],
                            zIndex: isSelected || isHovered ? 5 : 1,
                          },
                        ]}
                      />
                    );
                  })}
                </View>

                <View style={styles.miniHeatmapFooter}>
                  <Text variant="caption" style={{ color: pal.muted, fontSize: 10.5 }}>
                    {selectedHeatmapCell
                      ? t(
                          `${selectedHeatmapCell.localDay} · 热力 Lv.${selectedHeatmapCell.level}/4 · 专注 ${selectedHeatmapCell.studyMinutes}m`,
                          `${selectedHeatmapCell.localDay} · Lv.${selectedHeatmapCell.level}/4 · Focus ${selectedHeatmapCell.studyMinutes}m`,
                        )
                      : '365 day heatmap'}
                  </Text>
                  {selectedHeatmapCell ? (
                    <Pressable
                      onPress={() => {
                        setTimeBlocks(
                          addTimeBlock({
                            localDay: selectedHeatmapCell.localDay,
                            startMinute: 9 * 60,
                            endMinute: 9 * 60 + 45,
                            category: 'study',
                            title: t('补记专注 45m', 'Backfill Focus 45m'),
                            goalId: 'goal-ai-infra',
                          }),
                        );
                        triggerStageBurst(
                          'heatmap',
                          `✦ ${selectedHeatmapCell.localDay.slice(5)} +45m`,
                          pal.emeraldAccent,
                          'reward',
                        );
                        showToast({
                          text: t(
                            `✓ 已为 ${selectedHeatmapCell.localDay} 补记 45m 专注`,
                            `✓ Logged 45m focus for ${selectedHeatmapCell.localDay}`,
                          ),
                        });
                      }}
                      style={({ pressed }) => [
                        styles.hudMicroBtn,
                        {
                          backgroundColor: pal.pillActiveBg,
                          borderColor: pal.goldAccent,
                          transform: [{ scale: pressed ? 0.92 : 1 }],
                        },
                      ]}
                    >
                      <Text variant="caption" style={{ fontSize: 10, color: pal.goldText, fontWeight: '700' }}>
                        {t('＋ 补记 45m', '＋ Log 45m')}
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {[pal.emeraldAccent, '#10b981', '#eab308', '#d97706', '#cc785c', pal.emptyHeatCell].map(
                        (c, i) => (
                          <View
                            key={`lg-${i}`}
                            style={[styles.legendDot, { backgroundColor: c }]}
                          />
                        ),
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>
            ) : null}
          </View>
          <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
            <StudioMatrixBentoCard />
          </View>
          {lowerWorkspaceTab === 'knowledge' || lowerWorkspaceTab === 'split' ? (
            <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
              <KnowledgeGraphCornerHub
                localDay={localDay}
                totalStudyMinutesLive={trackedMinsToday}
                onLogStudyMinutes={(title, mins) => {
                  incrementOrAddTimeBlock({
                    localDay,
                    category: 'study',
                    title: `知识图谱：${title}`,
                    deltaMinutes: mins,
                    goalId: null,
                  });
                  setTimeBlocks(readTimeBlocks());
                  triggerStageBurst('focus', `+${mins}m 知识图谱`, pal.goldAccent, 'page');
                }}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Perspective 1B: Dedicated Bookkeeping & Budget Hub */}
      {perspective === 'ledger' ? (
        <View style={{ padding: 12 }}>
          <BookkeepingLedgerHub localDay={localDay} />
        </View>
      ) : null}

      {/* Perspective 1C: Dedicated Time Pricing & Real Hourly Rate Engine */}
      {perspective === 'timeprice' ? (
        <View style={{ padding: 12 }}>
          <TimePricingHub
            localDay={localDay}
            onJumpToLedger={() => setPerspective('ledger')}
            onJumpToDayCycle={() => setPerspective('daycycle')}
          />
        </View>
      ) : null}

      {/* Perspective 2: 24H 昼夜节律环 */}
      {perspective === 'daycycle' ? (
        <View style={[styles.stageGridBg, { backgroundColor: pal.stageBg }]}>
          <View style={styles.dayCycleGrid}>
            {[
              {
                phase: t('06:00 – 09:00 · 晨间唤醒', '06:00 – 09:00 · Morning Awakening'),
                title: t('空腹晨重 & 目标校准', 'Morning Weigh-In & Calibration'),
                status: latestWeightKg
                  ? t(`已记晨重 ${latestWeightKg.toFixed(1)} kg`, `Logged ${latestWeightKg.toFixed(1)} kg`)
                  : t('待记录今日晨重', 'Pending Morning Weigh-In'),
                detail: t(
                  '早起空腹称重最能反映真实体脂趋势，完成后自动点亮今日第一块基石。',
                  'Morning fasting weight best reflects your true body-fat trend and lights up your first daily milestone.',
                ),
                accent: pal.emeraldAccent,
                onAct: () => handleQuickWeightNudge(0),
              },
              {
                phase: t('09:00 – 18:00 · 日间心流', '09:00 – 18:00 · Daytime Deep Flow'),
                title: t('深度专注 & 一万小时积累', 'Deep Focus & 10,000-Hour Mastery'),
                status: t(`今日已投入 ${trackedMinsToday} 分钟`, `${trackedMinsToday} mins invested today`),
                detail: t(
                  '将高难度学习与创造放在精力峰值时段，每一分钟都会沉淀进 10,000 小时定律。',
                  'Schedule demanding creation during peak energy windows—every minute compounds into your 10,000-hour mastery.',
                ),
                accent: pal.terracottaAccent,
                onAct: () => handleToggleFocusTimer(),
              },
              {
                phase: t('18:00 – 21:00 · 晚间活力', '18:00 – 21:00 · Evening Vitality'),
                title: t('力量/有氧训练 & 身体恢复', 'Strength / Cardio & Recovery'),
                status:
                  trainingSetsCount > 0
                    ? t(
                        `已完成 ${trainingSetsCount} 组 (${Math.round(trainingVolumeKg)} kg)`,
                        `${trainingSetsCount} sets (${Math.round(trainingVolumeKg)} kg)`,
                      )
                    : t('待开启今日运动', 'Workout Pending'),
                detail: t(
                  '力量或有氧训练不仅塑造体态，还能为次日带来更高的深度专注时长。',
                  'Strength and cardio training sharpen both physique and next-day cognitive endurance.',
                ),
                accent: '#38bdf8',
                onAct: onQuickTraining,
              },
              {
                phase: t('21:00 – 23:30 · 夜间复盘', '21:00 – 23:30 · Nightly Reflection'),
                title: t('习惯打卡、纪念日与心愿蓄力', 'Habits, Milestones & Wish Vault'),
                status: t(
                  `习惯 ${habitsDoneToday}/${habits.length} · 心愿池 ¥${vault.wishBalanceCny}`,
                  `Habits ${habitsDoneToday}/${habits.length} · Vault ¥${vault.wishBalanceCny}`,
                ),
                detail: nearestMs
                  ? t(
                      `距离「${nearestMs.item.title}」${nearestMs.badgeText}，每一次打卡都在为心愿蓄力。`,
                      `Upcoming "${nearestMs.item.title}" (${nearestMs.badgeText})—every check-in funds your Wish Vault.`,
                    )
                  : t(
                      '睡前花 2 分钟完成习惯打卡与随手记，让一天有始有终。',
                      'Spend 2 minutes before bed checking off daily habits and notes.',
                    ),
                accent: pal.goldAccent,
                onAct: handleQuickHabitCheckIn,
              },
            ].map((slot) => (
              <Pressable
                key={slot.phase}
                onPress={slot.onAct}
                style={[
                  styles.dayCycleCard,
                  {
                    backgroundColor: pal.bentoBg,
                    borderColor: pal.bentoBorder,
                    borderTopColor: slot.accent,
                  },
                ]}
              >
                <Text variant="caption" style={{ color: slot.accent, fontWeight: '600' }}>
                  {slot.phase}
                </Text>
                <Text variant="label" style={{ color: pal.ink, fontSize: 13 }}>
                  {slot.title}
                </Text>
                <View
                  style={[
                    styles.isoHudSubBox,
                    { backgroundColor: pal.inputBg, borderColor: pal.hairline },
                  ]}
                >
                  <Text variant="caption" style={{ color: pal.goldText, fontWeight: '600' }}>
                    {slot.status}
                  </Text>
                </View>
                <Text variant="caption" style={{ color: pal.muted, lineHeight: 16 }}>
                  {slot.detail}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* Perspective 3: 今日五维精要 */}
      {perspective === 'summary' ? (
        <View style={[styles.ledgerGrid, { backgroundColor: pal.stageBg }]}>
          <Pressable onPress={onQuickWeight} style={[styles.ledgerCol, { borderRightColor: pal.hairline }]}>
            <Text variant="caption" style={[styles.ledgerKey, { color: pal.muted }]}>
              {t('今日三件事', 'Daily Core 3')}
            </Text>
            <Text variant="heading" style={{ color: loggedCount === 3 ? pal.emeraldAccent : pal.terracottaAccent }}>
              {t(`${loggedCount} / 3 已记`, `${loggedCount} / 3 Logged`)}
            </Text>
            <Text variant="caption" style={[styles.ledgerSub, { color: pal.muted }]}>
              {t('晨重 · 训练 · 学习', 'Weight · Workout · Study')}
            </Text>
          </Pressable>
          <Pressable onPress={() => handleQuickWeightNudge(0)} style={[styles.ledgerCol, { borderRightColor: pal.hairline }]}>
            <Text variant="caption" style={[styles.ledgerKey, { color: pal.muted }]}>
              {t('近 7 日晨重', '7-Day Weigh-Ins')}
            </Text>
            <Text variant="heading" style={{ color: pal.ink }}>
              {t(`${activeWeightDays} / 7 天`, `${activeWeightDays} / 7 Days`)}
            </Text>
            <Text variant="caption" style={[styles.ledgerSub, { color: pal.muted }]}>
              {t('稳定追踪均重趋势', 'Rolling EMA weight trend')}
            </Text>
          </Pressable>
          <Pressable onPress={onQuickTraining} style={[styles.ledgerCol, { borderRightColor: pal.hairline }]}>
            <Text variant="caption" style={[styles.ledgerKey, { color: pal.muted }]}>
              {t('今日训练负荷', 'Training Load')}
            </Text>
            <Text variant="heading" style={{ color: pal.ink }}>
              {t(`${trainingSetsCount} 组`, `${trainingSetsCount} Sets`)}
            </Text>
            <Text variant="caption" style={[styles.ledgerSub, { color: pal.muted }]}>
              {t(`累计容量 ${Math.round(trainingVolumeKg)} kg`, `Volume ${Math.round(trainingVolumeKg)} kg`)}
            </Text>
          </Pressable>
          <Pressable onPress={onQuickStudy} style={[styles.ledgerCol, { borderRightColor: pal.hairline }]}>
            <Text variant="caption" style={[styles.ledgerKey, { color: pal.muted }]}>
              {t('今日专注时间块', 'Focus Time Blocks')}
            </Text>
            <Text variant="heading" style={{ color: pal.ink }}>
              {t(`${trackedMinsToday} 分钟`, `${trackedMinsToday} mins`)}
            </Text>
            <Text variant="caption" style={[styles.ledgerSub, { color: pal.muted }]}>
              {t(`已完成 ${studyCount} 项学习`, `${studyCount} study sessions`)}
            </Text>
          </Pressable>
          <Pressable onPress={handleQuickHabitCheckIn} style={styles.ledgerCol}>
            <Text variant="caption" style={[styles.ledgerKey, { color: pal.muted }]}>
              {t('心愿池 & OKR', 'Wish Vault & OKR')}
            </Text>
            <Text variant="heading" style={{ color: pal.goldText }}>
              {`¥${vault.wishBalanceCny} · ${avgOkrPct}%`}
            </Text>
            <Text variant="caption" style={[styles.ledgerSub, { color: pal.muted }]}>
              {nearestMs
                ? `${nearestMs.item.title} ${nearestMs.badgeText}`
                : t(`习惯 ${habitsDoneToday}/${habits.length}`, `Habits ${habitsDoneToday}/${habits.length}`)}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stageCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  studioTopbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  topbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  studioTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  perspBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 9,
    borderWidth: 1,
    gap: 3,
  },
  perspPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  perspPillText: {
    fontSize: 11,
  },
  perspPillTextOn: {
    fontWeight: '600',
  },
  studioTaskbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 260,
    maxWidth: 460,
  },
  studioTaskInput: {
    flex: 1,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: 7,
    borderWidth: 1,
    fontSize: 12,
  },
  dispatchBtn: {
    height: 30,
    paddingHorizontal: 11,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  dioramaStageWrap: {
    paddingBottom: 14,
  },
  stageGridBg: {
    position: 'relative',
    minHeight: 248,
    paddingBottom: 10,
  },
  isoCanvas: {
    position: 'relative',
    zIndex: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 10,
  },
  isoIslandSlot: {
    flex: 1,
    minWidth: 265,
    maxWidth: 316,
    alignItems: 'center',
  },
  isoNodeSelected: {
    transform: [{ translateY: -3 }],
  },
  islandArtWrap: {
    position: 'relative',
    width: 280,
    height: 234,
    paddingTop: 30,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  floatingHudCorner: {
    position: 'absolute',
    top: 0,
    right: 2,
    zIndex: 5,
    minWidth: 118,
    maxWidth: 148,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    gap: 1.5,
  },
  hudTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 1,
  },
  hudTitleText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  hudProgressRing: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudProgressDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  hudMetricText: {
    fontSize: 10.5,
    fontFamily: theme.fontFamily.mono,
  },
  hudSubText: {
    fontSize: 10.5,
    fontFamily: theme.fontFamily.mono,
  },
  hudMicroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  hudMicroBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
  },
  bentoSplitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  bentoLeftCard: {
    flex: 1.2,
    minWidth: 320,
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
    gap: 10,
  },
  bentoRightStack: {
    flex: 1,
    minWidth: 295,
    gap: 12,
  },
  bentoRightCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
    gap: 10,
  },
  bentoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  bentoTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  modeTogglePill: {
    flexDirection: 'row',
    borderRadius: 6,
    padding: 2,
    gap: 2,
  },
  modeToggleBtn: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modeToggleText: {
    fontSize: 10.5,
  },
  addBlockPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  addBlockPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  calHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  nowTagBox: {
    width: 38,
    paddingVertical: 2,
    borderRadius: 5,
    alignItems: 'center',
  },
  nowTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  calColHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  calColNum: {
    fontSize: 11,
    fontFamily: theme.fontFamily.mono,
  },
  calColSub: {
    fontSize: 10,
  },
  calBodyContainer: {
    position: 'relative',
    minHeight: 224,
  },
  calHairlinesLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingVertical: 4,
    zIndex: 1,
  },
  calHairlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  calHourText: {
    width: 36,
    textAlign: 'right',
    fontSize: 9.5,
    fontFamily: theme.fontFamily.mono,
  },
  calHairline: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  calColumnsOverlay: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 2,
    zIndex: 2,
  },
  calTrackCol: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 3,
    borderRadius: 6,
  },
  calEventBlock: {
    position: 'relative',
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    justifyContent: 'flex-start',
  },
  calEventTitle: {
    fontSize: 10.5,
    fontWeight: '600',
    lineHeight: 14,
  },
  calEventTime: {
    fontSize: 9.5,
    fontFamily: theme.fontFamily.mono,
    marginTop: 1,
  },
  calSparkleIcon: {
    position: 'absolute',
    right: 6,
    bottom: 3,
    fontSize: 10,
  },
  inlineDayScrubberBox: {
    minHeight: 224,
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 8,
  },
  selectedBlockToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  iconSquareBtn: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okrMiniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  okrMiniCard: {
    flex: 1,
    minWidth: 135,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
    gap: 7,
  },
  okrMiniTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  okrMiniLabel: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  okrMiniPct: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: theme.fontFamily.mono,
  },
  okrGlowTrack: {
    height: 5,
    borderRadius: 999,
  },
  okrGlowFill: {
    height: '100%',
    borderRadius: 999,
  },
  miniHeatmapWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  miniHeatCell: {
    width: 11.5,
    height: 11.5,
    borderRadius: 2.5,
  },
  miniHeatmapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  legendDot: {
    width: 8.5,
    height: 8.5,
    borderRadius: 2,
  },
  floatingBurstPill: {
    position: 'absolute',
    top: 6,
    left: 56,
    zIndex: 30,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 999,
    borderWidth: 1.2,
  },
  floatingCardBurstPill: {
    position: 'absolute',
    top: 8,
    right: 16,
    zIndex: 30,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1.2,
  },
  floatingOkrBurstPill: {
    position: 'absolute',
    top: -8,
    right: 8,
    zIndex: 30,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  floatingBurstText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  interactivePlayDeck: {
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    zIndex: 5,
  },
  playDeckSection: {
    flex: 1,
    minWidth: 250,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  playDeckLabelCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  comboMiniTrack: {
    width: 44,
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  comboMiniFill: {
    height: '100%',
    borderRadius: 999,
  },
  isoHudSubBox: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  dayCycleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 18,
  },
  dayCycleCard: {
    flex: 1,
    minWidth: 210,
    borderRadius: 10,
    borderWidth: 1,
    borderTopWidth: 3,
    padding: 12,
    gap: 7,
  },
  ledgerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  ledgerCol: {
    flex: 1,
    minWidth: 150,
    padding: 14,
    borderRightWidth: 1,
    gap: 4,
  },
  ledgerKey: {
    fontSize: 11,
    fontWeight: '600',
  },
  ledgerSub: {
    fontSize: 11,
  },
});
