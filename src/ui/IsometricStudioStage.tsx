import { createElement, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';

import { type RuntimeHostMode } from '@/core/charioteer-plugin';
import { buildLifeHeatmapGrid, type HeatmapCell, type PledgeVaultState } from '@/core/life-gamification';
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
  type TimeBlockItem,
} from '@/core/time-block-tracker';
import {
  readPledgeVault,
  recordPledgeReward,
  subscribeLifeGamificationStore,
} from '@/data/life-gamification';
import {
  checkInKeyResult,
  readDailyHabits,
  readLifeMilestones,
  readOkrObjectives,
  subscribeLifeOkrStore,
} from '@/data/life-milestones-okr';
import {
  addTimeBlock,
  readActiveTimer,
  readMasteryGoals,
  readTimeBlocks,
} from '@/data/time-block-tracker';

import { useI18n } from './use-i18n';

import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { showToast } from './toast';

export type SanctuaryPerspective = 'diorama' | 'daycycle' | 'summary';
export type LifeZoneKey = 'focus' | 'vitality' | 'wishes';
export type SpatialModuleFilter = 'all' | 'focus' | 'vitality' | 'wishes';

/**
 * Dual-Theme (黑金风 Dark Obsidian-Gold ⇄ 暖色调 Warm Sunlit Parchment) 2.5D Isometric Island Artwork
 */
function IsometricLifeZoneSvg({
  zone,
  active,
  isDark,
  weightText,
}: {
  zone: LifeZoneKey;
  active: boolean;
  isDark: boolean;
  weightText: string;
}) {
  const rimColor =
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

  if (Platform.OS !== 'web') {
    return (
      <View
        style={{
          width: 240,
          height: 150,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: rimColor,
          backgroundColor: isDark ? '#1b1815' : '#f1efe8',
        }}
      />
    );
  }

  const suffix = `${zone}_${isDark ? 'd' : 'l'}`;
  const gradTopId = `dioramaTop_${suffix}`;
  const gradWallLId = `dioramaWallL_${suffix}`;
  const gradWallRId = `dioramaWallR_${suffix}`;
  const floorBloomId = `dioramaBloom_${suffix}`;
  const goldMetalId = `dioramaGold_${suffix}`;
  const lampConeId = `dioramaCone_${suffix}`;

  const topStart = isDark
    ? zone === 'focus'
      ? '#523624'
      : zone === 'vitality'
        ? '#203029'
        : '#332b20'
    : zone === 'focus'
      ? '#ede2d0'
      : zone === 'vitality'
        ? '#dfece5'
        : '#f2ead8';
  const topEnd = isDark
    ? zone === 'focus'
      ? '#281a11'
      : zone === 'vitality'
        ? '#111916'
        : '#18140f'
    : zone === 'focus'
      ? '#d8c5ab'
      : zone === 'vitality'
        ? '#c6ddd1'
        : '#dfd1b4';

  const wallLStart = isDark ? '#3d2618' : '#c9b69c';
  const wallLEnd = isDark ? '#0e0c0a' : '#a8947a';
  const wallRStart = isDark ? '#1f1a15' : '#b5a188';
  const wallREnd = isDark ? '#090807' : '#948067';

  return createElement(
    'svg',
    {
      width: 276,
      height: 184,
      viewBox: '0 0 280 188',
      fill: 'none',
      style: {
        overflow: 'visible',
        filter: isDark
          ? active
            ? `drop-shadow(0 20px 30px rgba(0, 0, 0, 0.78)) drop-shadow(0 0 20px ${rimColor}40)`
            : 'drop-shadow(0 16px 24px rgba(0, 0, 0, 0.62))'
          : active
            ? `drop-shadow(0 14px 24px rgba(38, 36, 31, 0.18)) drop-shadow(0 0 14px ${rimColor}33)`
            : 'drop-shadow(0 10px 18px rgba(38, 36, 31, 0.12))',
      },
    },
    createElement(
      'defs',
      null,
      createElement(
        'linearGradient',
        { id: gradTopId, x1: '0', y1: '0', x2: '1', y2: '1' },
        createElement('stop', { offset: '0%', stopColor: topStart }),
        createElement('stop', { offset: '100%', stopColor: topEnd }),
      ),
      createElement(
        'linearGradient',
        { id: gradWallLId, x1: '0', y1: '0', x2: '1', y2: '1' },
        createElement('stop', { offset: '0%', stopColor: wallLStart }),
        createElement('stop', { offset: '100%', stopColor: wallLEnd }),
      ),
      createElement(
        'linearGradient',
        { id: gradWallRId, x1: '0', y1: '0', x2: '1', y2: '1' },
        createElement('stop', { offset: '0%', stopColor: wallRStart }),
        createElement('stop', { offset: '100%', stopColor: wallREnd }),
      ),
      createElement(
        'radialGradient',
        { id: floorBloomId, cx: '50%', cy: '50%', r: '50%' },
        createElement('stop', {
          offset: '0%',
          stopColor: rimColor,
          stopOpacity: isDark ? '0.52' : '0.26',
        }),
        createElement('stop', {
          offset: '65%',
          stopColor: rimColor,
          stopOpacity: isDark ? '0.14' : '0.08',
        }),
        createElement('stop', { offset: '100%', stopColor: rimColor, stopOpacity: '0' }),
      ),
      createElement(
        'linearGradient',
        { id: goldMetalId, x1: '0', y1: '0', x2: '1', y2: '1' },
        createElement('stop', { offset: '0%', stopColor: '#fef08a' }),
        createElement('stop', { offset: '45%', stopColor: '#f5b942' }),
        createElement('stop', { offset: '100%', stopColor: '#92560c' }),
      ),
      createElement(
        'radialGradient',
        { id: lampConeId, cx: '50%', cy: '25%', r: '65%' },
        createElement('stop', { offset: '0%', stopColor: '#fef08a', stopOpacity: '0.55' }),
        createElement('stop', { offset: '100%', stopColor: '#f59e0b', stopOpacity: '0' }),
      ),
    ),

    // 1. Soft Floor Bloom under the Isometric Base
    createElement('ellipse', {
      cx: 136,
      cy: 134,
      rx: 108,
      ry: 42,
      fill: `url(#${floorBloomId})`,
    }),

    // 2. 3D Extruded Isometric Base Slab
    createElement('polygon', {
      points: '18,118 136,168 136,182 18,132',
      fill: `url(#${gradWallLId})`,
      stroke: isDark ? 'rgba(255,248,235,0.14)' : 'rgba(38,36,31,0.14)',
      strokeWidth: 1,
    }),
    createElement('polygon', {
      points: '254,118 136,168 136,182 254,132',
      fill: `url(#${gradWallRId})`,
      stroke: isDark ? 'rgba(255,248,235,0.12)' : 'rgba(38,36,31,0.12)',
      strokeWidth: 1,
    }),
    createElement('polyline', {
      points: '18,130 136,180 254,130',
      fill: 'none',
      stroke: rimColor,
      strokeWidth: active ? 3.5 : 2.6,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
    createElement('polygon', {
      points: '136,168 254,118 136,68 18,118',
      fill: `url(#${gradTopId})`,
      stroke: rimColor,
      strokeWidth: active ? 1.8 : 1.2,
      strokeOpacity: 0.85,
    }),
    createElement('polygon', {
      points: '136,161 242,116 136,73 30,116',
      fill: 'none',
      stroke: isDark ? 'rgba(255,248,235,0.08)' : 'rgba(38,36,31,0.08)',
      strokeWidth: 0.9,
    }),

    // ================= ISLAND 1: 心流书房 =================
    zone === 'focus'
      ? createElement(
          'g',
          null,
          createElement('polygon', {
            points: '68,108 138,78 182,96 112,126',
            fill: isDark ? 'rgba(0,0,0,0.42)' : 'rgba(38,36,31,0.15)',
          }),
          createElement('polygon', {
            points: '68,94 98,107 98,132 68,119',
            fill: isDark ? '#3b2213' : '#8c583a',
            stroke: '#7c4a2b',
            strokeWidth: 0.9,
          }),
          createElement('polygon', {
            points: '98,107 116,99 116,124 98,132',
            fill: isDark ? '#24140b' : '#6e4228',
            stroke: '#5c351e',
            strokeWidth: 0.8,
          }),
          createElement('line', { x1: 71, y1: 103, x2: 95, y2: 113, stroke: '#24140b', strokeWidth: 1 }),
          createElement('line', { x1: 71, y1: 111, x2: 95, y2: 121, stroke: '#24140b', strokeWidth: 1 }),
          createElement('line', { x1: 80, y1: 103, x2: 86, y2: 106, stroke: '#f5b942', strokeWidth: 1.6, strokeLinecap: 'round' }),
          createElement('line', { x1: 80, y1: 111, x2: 86, y2: 114, stroke: '#f5b942', strokeWidth: 1.6, strokeLinecap: 'round' }),
          createElement('line', { x1: 80, y1: 119, x2: 86, y2: 122, stroke: '#f5b942', strokeWidth: 1.6, strokeLinecap: 'round' }),
          createElement('polygon', {
            points: '146,84 168,93 168,116 146,107',
            fill: isDark ? '#28160c' : '#73452a',
            stroke: '#693d23',
            strokeWidth: 0.9,
          }),
          createElement('polygon', {
            points: '116,112 178,86 134,67 66,94',
            fill: isDark ? '#663d24' : '#a66c49',
            stroke: '#e8924a',
            strokeWidth: 1.2,
          }),
          createElement('polygon', {
            points: '66,94 116,112 116,116 66,98',
            fill: '#472917',
          }),
          createElement('polygon', {
            points: '116,112 178,86 178,90 116,116',
            fill: '#361f11',
          }),
          createElement('ellipse', {
            cx: 122,
            cy: 89,
            rx: 38,
            ry: 16,
            fill: `url(#${lampConeId})`,
          }),
          createElement('polygon', {
            points: '104,92 120,85 110,80 94,87',
            fill: '#fffbeb',
            stroke: '#d97706',
            strokeWidth: 0.8,
          }),
          createElement('polygon', {
            points: '120,85 136,79 126,74 110,80',
            fill: '#fef3c7',
            stroke: '#d97706',
            strokeWidth: 0.8,
          }),
          createElement('line', { x1: 100, y1: 87, x2: 112, y2: 82, stroke: '#92400e', strokeWidth: 0.7 }),
          createElement('line', { x1: 116, y1: 80, x2: 128, y2: 76, stroke: '#92400e', strokeWidth: 0.7 }),
          createElement('polygon', {
            points: '146,84 164,76 152,71 134,79',
            fill: '#c25e3c',
            stroke: '#fde68a',
            strokeWidth: 0.8,
          }),
          createElement('ellipse', { cx: 130, cy: 67, rx: 18, ry: 10, fill: 'rgba(254, 240, 138, 0.28)' }),
          createElement('ellipse', { cx: 130, cy: 70, rx: 7, ry: 3.5, fill: '#b45309' }),
          createElement('rect', { x: 127, y: 58, width: 6, height: 12, rx: 2, fill: '#d97706' }),
          createElement('path', {
            d: 'M116 60 C116 41, 144 41, 144 60 Z',
            fill: '#fef08a',
            stroke: '#f59e0b',
            strokeWidth: 1.4,
          }),
          createElement('ellipse', { cx: 84, cy: 89, rx: 6.5, ry: 3.2, fill: `url(#${goldMetalId})` }),
          createElement('polyline', {
            points: '84,89 76,72 94,63',
            fill: 'none',
            stroke: `url(#${goldMetalId})`,
            strokeWidth: 2.2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }),
          createElement('polygon', {
            points: '92,59 104,64 98,71 88,65',
            fill: `url(#${goldMetalId})`,
          }),
          createElement('line', { x1: 148, y1: 114, x2: 148, y2: 125, stroke: '#1c1917', strokeWidth: 3 }),
          createElement('line', { x1: 138, y1: 125, x2: 158, y2: 125, stroke: '#44403c', strokeWidth: 2 }),
          createElement('polygon', {
            points: '134,109 156,100 164,105 142,114',
            fill: isDark ? '#3b2314' : '#7c4a2b',
            stroke: '#7c4a2b',
            strokeWidth: 0.9,
          }),
          createElement('polygon', {
            points: '148,92 164,85 164,106 148,113',
            fill: isDark ? '#4a2c19' : '#8c583a',
            stroke: '#a16207',
            strokeWidth: 1,
          }),
        )
      : null,

    // ================= ISLAND 2: 活力体态 =================
    zone === 'vitality'
      ? createElement(
          'g',
          null,
          createElement('polygon', {
            points: '54,106 138,71 172,86 88,121',
            fill: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(38,36,31,0.14)',
          }),
          createElement('polygon', {
            points: '86,118 168,84 138,71 56,105',
            fill: '#c26d4f',
            stroke: '#f3a683',
            strokeWidth: 1,
          }),
          createElement('polygon', {
            points: '56,105 86,118 86,121 56,108',
            fill: '#8c4932',
          }),
          createElement('polygon', {
            points: '86,118 168,84 168,87 86,121',
            fill: '#733a26',
          }),
          createElement('polygon', {
            points: '52,98 134,64 142,74 60,108',
            fill: '#d97f5f',
            stroke: '#f7b799',
            strokeWidth: 1,
          }),
          createElement('ellipse', {
            cx: 56,
            cy: 103,
            rx: 6.5,
            ry: 8.5,
            fill: '#783c28',
            stroke: '#f3a683',
            strokeWidth: 1.2,
          }),
          createElement('line', {
            x1: 96,
            y1: 98,
            x2: 108,
            y2: 104,
            stroke: `url(#${goldMetalId})`,
            strokeWidth: 3.5,
            strokeLinecap: 'round',
          }),
          createElement('circle', {
            cx: 135,
            cy: 84,
            r: 9.5,
            fill: '#34d399',
            stroke: '#059669',
            strokeWidth: 1,
          }),
          createElement('circle', { cx: 132, cy: 81, r: 2.8, fill: '#a7f3d0' }),
          createElement('polygon', {
            points: '158,128 212,105 176,90 122,113',
            fill: isDark ? '#2e343b' : '#475569',
            stroke: '#cbd5e1',
            strokeWidth: 1.5,
          }),
          createElement('polygon', {
            points: '160,106 180,98 171,94 151,102',
            fill: '#090d11',
            stroke: '#34d399',
            strokeWidth: 1,
          }),
          createElement(
            'text',
            {
              x: 165,
              y: 101,
              textAnchor: 'middle',
              fill: '#6ee7b7',
              fontSize: '7.5',
              fontWeight: '700',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            },
            weightText,
          ),
          createElement('circle', { cx: 102, cy: 128, r: 5, fill: '#b45309', stroke: '#fde68a', strokeWidth: 0.8 }),
          createElement('line', { x1: 102, y1: 128, x2: 118, y2: 121, stroke: '#fde68a', strokeWidth: 2.8 }),
          createElement('circle', { cx: 118, cy: 121, r: 5, fill: '#b45309', stroke: '#fde68a', strokeWidth: 0.8 }),
          createElement('circle', { cx: 118, cy: 136, r: 5, fill: '#b45309', stroke: '#fde68a', strokeWidth: 0.8 }),
          createElement('line', { x1: 118, y1: 136, x2: 134, y2: 129, stroke: '#fde68a', strokeWidth: 2.8 }),
          createElement('circle', { cx: 134, cy: 129, r: 5, fill: '#b45309', stroke: '#fde68a', strokeWidth: 0.8 }),
        )
      : null,

    // ================= ISLAND 3: 星愿纪念台 =================
    zone === 'wishes'
      ? createElement(
          'g',
          null,
          createElement('ellipse', {
            cx: 122,
            cy: 116,
            rx: 38,
            ry: 15,
            fill: '#2b2113',
            stroke: `url(#${goldMetalId})`,
            strokeWidth: 2.2,
          }),
          createElement('ellipse', {
            cx: 122,
            cy: 112,
            rx: 28,
            ry: 11,
            fill: '#47361d',
            stroke: '#fef08a',
            strokeWidth: 1.2,
          }),
          createElement('path', {
            d: 'M 86 72 A 36 36 0 0 0 158 72',
            fill: 'none',
            stroke: `url(#${goldMetalId})`,
            strokeWidth: 3.5,
          }),
          createElement('rect', {
            x: 118,
            y: 98,
            width: 8,
            height: 14,
            rx: 2,
            fill: `url(#${goldMetalId})`,
          }),
          createElement('circle', {
            cx: 122,
            cy: 64,
            r: 34,
            fill: 'none',
            stroke: `url(#${goldMetalId})`,
            strokeWidth: 6,
          }),
          createElement('circle', {
            cx: 122,
            cy: 64,
            r: 34,
            fill: 'none',
            stroke: '#422006',
            strokeWidth: 1.2,
            strokeDasharray: '1.5 4.5',
          }),
          createElement('ellipse', {
            cx: 122,
            cy: 64,
            rx: 31,
            ry: 12,
            transform: 'rotate(-28 122 64)',
            fill: 'none',
            stroke: `url(#${goldMetalId})`,
            strokeWidth: 4,
          }),
          createElement('ellipse', {
            cx: 122,
            cy: 64,
            rx: 28,
            ry: 11,
            transform: 'rotate(34 122 64)',
            fill: 'none',
            stroke: '#eab308',
            strokeWidth: 2.8,
          }),
          createElement('line', {
            x1: 152,
            y1: 94,
            x2: 86,
            y2: 28,
            stroke: '#fef08a',
            strokeWidth: 2.6,
          }),
          createElement('polygon', {
            points: '81,23 93,26 86,33',
            fill: '#fef08a',
          }),
          createElement('circle', {
            cx: 122,
            cy: 64,
            r: 5.5,
            fill: '#fef08a',
            stroke: '#ca8a04',
            strokeWidth: 1.2,
          }),
          createElement('polygon', {
            points: '166,112 188,122 188,138 166,128',
            fill: '#a8573b',
            stroke: '#f5b942',
            strokeWidth: 0.8,
          }),
          createElement('polygon', {
            points: '210,112 188,122 188,138 210,128',
            fill: '#7c3d26',
            stroke: '#f5b942',
            strokeWidth: 0.8,
          }),
          createElement('polygon', {
            points: '188,123 212,112 188,102 164,112',
            fill: '#cc785c',
            stroke: '#fde68a',
            strokeWidth: 1,
          }),
          createElement('line', { x1: 176, y1: 107, x2: 200, y2: 117, stroke: '#fde68a', strokeWidth: 2.6 }),
          createElement('line', { x1: 176, y1: 117, x2: 200, y2: 107, stroke: '#fde68a', strokeWidth: 2.6 }),
        )
      : null,
  );
}

/**
 * Golden 24H Ribbon Bridges (Adapts cleanly to both Dark Obsidian-Gold and Warm Sunlit Parchment)
 */
function Golden24HourRibbonBridgesSvg({
  timerRunning,
  isDark,
}: {
  timerRunning: boolean;
  isDark: boolean;
}) {
  if (Platform.OS !== 'web') return null;

  const sparkles: [number, number, number][] = [
    [285, 192, 1.8],
    [310, 206, 2.2],
    [366, 208, 2.0],
    [412, 185, 2.2],
    [595, 190, 1.8],
    [620, 205, 2.3],
    [676, 206, 2.1],
    [722, 184, 2.0],
  ];

  return createElement(
    'svg',
    {
      viewBox: '0 0 1000 245',
      preserveAspectRatio: 'none',
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
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
        createElement('stop', { offset: '50%', stopColor: '#eab308' }),
        createElement('stop', { offset: '100%', stopColor: '#10b981' }),
      ),
      createElement(
        'linearGradient',
        { id: 'ribbonBody2', x1: '0', y1: '0', x2: '1', y2: '0' },
        createElement('stop', { offset: '0%', stopColor: '#10b981' }),
        createElement('stop', { offset: '50%', stopColor: '#eab308' }),
        createElement('stop', { offset: '100%', stopColor: '#d97706' }),
      ),
    ),
    createElement('path', {
      d: 'M 245 172 C 310 222, 380 222, 445 172',
      fill: 'none',
      stroke: isDark ? 'rgba(245, 185, 66, 0.18)' : 'rgba(204, 120, 92, 0.16)',
      strokeWidth: 16,
      strokeLinecap: 'round',
    }),
    createElement('path', {
      d: 'M 245 172 C 310 222, 380 222, 445 172',
      fill: 'none',
      stroke: 'url(#ribbonBody1)',
      strokeWidth: 7,
      strokeLinecap: 'round',
    }),
    createElement('path', {
      d: 'M 245 169 C 310 219, 380 219, 445 169',
      fill: 'none',
      stroke: isDark ? '#fef08a' : '#fffbeb',
      strokeWidth: 2,
      strokeDasharray: timerRunning ? '6 6' : '10 6',
    }),
    createElement('circle', {
      cx: 345,
      cy: 208,
      r: 15,
      fill: isDark ? '#261c10' : '#fffbeb',
      stroke: '#d97706',
      strokeWidth: 2.2,
    }),
    createElement(
      'text',
      {
        x: 345,
        y: 212,
        textAnchor: 'middle',
        fill: isDark ? '#fef08a' : '#92400e',
        fontSize: '10.5',
        fontWeight: '700',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      '24',
    ),
    createElement('path', {
      d: 'M 555 172 C 620 222, 690 222, 755 172',
      fill: 'none',
      stroke: isDark ? 'rgba(245, 185, 66, 0.18)' : 'rgba(204, 120, 92, 0.16)',
      strokeWidth: 16,
      strokeLinecap: 'round',
    }),
    createElement('path', {
      d: 'M 555 172 C 620 222, 690 222, 755 172',
      fill: 'none',
      stroke: 'url(#ribbonBody2)',
      strokeWidth: 7,
      strokeLinecap: 'round',
    }),
    createElement('path', {
      d: 'M 555 169 C 620 219, 690 219, 755 169',
      fill: 'none',
      stroke: isDark ? '#fef08a' : '#fffbeb',
      strokeWidth: 2,
      strokeDasharray: '10 6',
    }),
    createElement('circle', {
      cx: 655,
      cy: 208,
      r: 15,
      fill: isDark ? '#261c10' : '#fffbeb',
      stroke: '#d97706',
      strokeWidth: 2.2,
    }),
    createElement(
      'text',
      {
        x: 655,
        y: 212,
        textAnchor: 'middle',
        fill: isDark ? '#fef08a' : '#92400e',
        fontSize: '10.5',
        fontWeight: '700',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      '24',
    ),
    ...sparkles.map(([sx, sy, sr], idx) =>
      createElement('circle', {
        key: `sp-${idx}`,
        cx: sx,
        cy: sy,
        r: sr,
        fill: isDark ? '#fef08a' : '#d97706',
        opacity: 0.72,
      }),
    ),
  );
}

export function IsometricStudioStage({
  mode,
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
  onOpenScope,
}: {
  mode: RuntimeHostMode;
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
}) {
  const { color, scheme, toggleTheme } = useTheme();
  const { locale, toggleLocale, t } = useI18n();
  const isDark = scheme === 'dark';

  const [perspective, setPerspective] = useState<SanctuaryPerspective>('diorama');
  const [internalZone, setInternalZone] = useState<LifeZoneKey>('focus');
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(false);
  const [quickInput, setQuickInput] = useState('');
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<HeatmapCell | null>(null);
  const [matrixMode, setMatrixMode] = useState<'on' | 'day'>('on');
  const [okrPage, setOkrPage] = useState(0);

  const selectedZone: LifeZoneKey =
    activeModuleFilter && activeModuleFilter !== 'all' ? activeModuleFilter : internalZone;

  function selectIslandAndSync(zone: LifeZoneKey) {
    setInternalZone(zone);
    onSelectModuleFilter?.(zone);
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

  useEffect(() => {
    const u1 = subscribeLifeGamificationStore(() => setVault(readPledgeVault()));
    const u2 = subscribeLifeOkrStore(() => {
      setMilestones(readLifeMilestones());
      setObjectives(readOkrObjectives());
      setHabits(readDailyHabits());
    });
    const poll = setInterval(() => {
      setTimeBlocks(readTimeBlocks());
      setMasteryGoals(readMasteryGoals());
      setTimer(readActiveTimer());
      setNowMs(Date.now());
    }, 1500);
    return () => {
      u1();
      u2();
      clearInterval(poll);
    };
  }, []);

  // Theme-adaptive surface tokens so Light (暖色调) and Dark (黑金风) are 100% unified across the entire window
  const pal = isDark
    ? {
        stageBg: '#121110',
        stageBorder: 'rgba(245, 185, 66, 0.22)',
        barBg: '#1a1613',
        bentoBg: '#18181b',
        bentoBorder: 'rgba(255, 255, 255, 0.10)',
        hudBg: 'rgba(42, 42, 46, 0.80)',
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
        hudBg: 'rgba(255, 253, 248, 0.90)',
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
  const nearestMs = sortedMilestones[0] ?? null;

  const avgOkrPct =
    objectives.length > 0
      ? Math.round(
          objectives.reduce((acc, o) => acc + computeObjectiveProgressPct(o), 0) /
            objectives.length,
        )
      : 0;
  const habitsDoneToday = habits.filter((h) => h.completedDays.includes(localDay)).length;

  const allKrs = objectives.flatMap((obj) =>
    obj.keyResults.map((kr) => ({
      objectiveId: obj.id,
      objectiveTitle: obj.title,
      kr,
      pct: computeKrProgressPct(kr),
    })),
  );
  const visibleKrs = allKrs.slice(okrPage * 4, okrPage * 4 + 4);

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

  const heatmap = buildLifeHeatmapGrid({
    endDay: localDay,
    totalDays: 182,
    weightDays: weightDaysSet,
    trainingCountByDay: new Map([[localDay, trainingSetsCount]]),
    studyMinutesByDay,
    habitCountByDay,
  });

  function optionAHeatCellColor(cell: HeatmapCell, idx: number): string {
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

  function onQuickAddTimeNote() {
    const raw = quickInput.trim();
    if (!raw) {
      onQuickJournal();
      return;
    }
    const minMatch = raw.match(/(\d+)\s*(m|min|分钟)/i);
    const mins = minMatch ? Math.max(5, Math.min(360, Number.parseInt(minMatch[1]!, 10))) : 45;
    const now = new Date();
    const endMin = now.getHours() * 60 + now.getMinutes();
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
    const v = recordPledgeReward(`记录时间块：${cleanTitle} (${mins}分钟)`, localDay);
    setVault(v);
    setQuickInput('');
    selectIslandAndSync('focus');
    showToast({
      text: t(
        `已切入 24H 时间块矩阵：${cleanTitle} (${mins} 分钟) · 心愿金库 +¥${v.config.checkInRewardCny}`,
        `Added to 24H Time Block Matrix: ${cleanTitle} (${mins}m) · Wish Vault +¥${v.config.checkInRewardCny}`,
      ),
    });
  }

  const colDays = [
    addDaysToLocalDay(localDay, -3),
    addDaysToLocalDay(localDay, -2),
    addDaysToLocalDay(localDay, -1),
    localDay,
  ];

  const latestUserBlock = todayBlocks[todayBlocks.length - 1] ?? null;

  const matrixColumns: {
    headerLeft: string;
    headerRight: string;
    blocks: {
      id: string;
      title: string;
      timeRange: string;
      tone: 'terracotta' | 'emerald' | 'golden' | 'pill';
      height: number;
      marginTop: number;
      sparkle?: boolean;
    }[];
  }[] = [
    {
      headerLeft: colDays[0]!.slice(8),
      headerRight: t('晨间/专注', 'AM Focus'),
      blocks: [
        {
          id: 'mc-1-a',
          title: latestUserBlock
            ? latestUserBlock.title
            : t('深度架构与论文精读', 'Deep Architecture & Paper Reading'),
          timeRange: latestUserBlock
            ? `${formatMinuteOfDay(latestUserBlock.startMinute)} – ${formatMinuteOfDay(latestUserBlock.endMinute)}`
            : '09:00 – 13:00',
          tone: 'terracotta',
          height: 62,
          marginTop: 18,
          sparkle: true,
        },
        {
          id: 'mc-1-b',
          title: t('系统复盘与核心研发', 'System Review & Core R&D'),
          timeRange: '13:30 – 16:30',
          tone: 'terracotta',
          height: 56,
          marginTop: 6,
        },
        {
          id: 'mc-1-c',
          title: t('力量与有氧代谢训练', 'Strength & Metabolic Conditioning'),
          timeRange: '17:00 – 18:30',
          tone: 'emerald',
          height: 44,
          marginTop: 10,
          sparkle: true,
        },
      ],
    },
    {
      headerLeft: colDays[1]!.slice(8),
      headerRight: t('一万小时', '10,000h'),
      blocks: [
        {
          id: 'mc-2-a',
          title: t('+ 10,000h 计时打卡', '+ 10,000h Focus Check-In'),
          timeRange: '08:30',
          tone: 'pill',
          height: 24,
          marginTop: 18,
        },
        {
          id: 'mc-2-b',
          title:
            trainingSetsCount > 0
              ? t(`今日训练 (${trainingSetsCount} 组)`, `Today's Workout (${trainingSetsCount} sets)`)
              : t('核心力量与心肺激活', 'Core Strength & Cardio'),
          timeRange: '11:30 – 14:00',
          tone: 'emerald',
          height: 68,
          marginTop: 34,
          sparkle: true,
        },
        {
          id: 'mc-2-c',
          title: t('晚间阅读与心愿复盘', 'Evening Reading & Wish Review'),
          timeRange: '19:30 – 21:30',
          tone: 'golden',
          height: 52,
          marginTop: 22,
        },
      ],
    },
    {
      headerLeft: colDays[2]!.slice(8),
      headerRight: t('今日主轴', 'Today'),
      blocks: [
        {
          id: 'mc-3-a',
          title:
            studyMinutes > 0
              ? t(`今日已专注 ${studyMinutes}m`, `Focused ${studyMinutes}m Today`)
              : t('10,000h 沉浸创造时间块', '10,000h Deep Creation Block'),
          timeRange: '08:00 – 13:30',
          tone: 'golden',
          height: 112,
          marginTop: 6,
        },
        {
          id: 'mc-3-b',
          title: t('OKR 关键结果推进与归档', 'OKR Key Results & Review'),
          timeRange: '14:30 – 18:30',
          tone: 'golden',
          height: 84,
          marginTop: 6,
        },
      ],
    },
  ];

  const hourRuler = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];

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

  const dailyWorkflowSteps = [
    {
      id: 'step-weight',
      num: '①',
      zone: 'vitality' as LifeZoneKey,
      done: Boolean(latestWeightKg),
      title: t('晨起记体重', 'Morning Weigh-In'),
      status: latestWeightKg
        ? t(`✓ 已记 ${latestWeightKg.toFixed(1)} kg`, `✓ ${latestWeightKg.toFixed(1)} kg`)
        : t('点击记录 ⌘K', 'Log Weight ⌘K'),
      accent: pal.emeraldAccent,
      onPress: () => {
        selectIslandAndSync('vitality');
        onQuickWeight();
      },
    },
    {
      id: 'step-focus',
      num: '②',
      zone: 'focus' as LifeZoneKey,
      done: trackedMinsToday > 0 || timer.isRunning,
      title: t('专注与1m时间块', 'Focus & 1m Time Block'),
      status:
        trackedMinsToday > 0
          ? t(`✓ 已专注 ${trackedMinsToday}m`, `✓ ${trackedMinsToday}m Tracked`)
          : t('切入时间块 ⇧⌘J', 'Add 1m Block ⇧⌘J'),
      accent: pal.terracottaAccent,
      onPress: () => {
        selectIslandAndSync('focus');
        onQuickJournal();
      },
    },
    {
      id: 'step-workout',
      num: '③',
      zone: 'vitality' as LifeZoneKey,
      done: trainingSetsCount > 0,
      title: t('运动与穿戴同步', 'Workout & Wearable'),
      status:
        trainingSetsCount > 0
          ? t(`✓ 已练 ${trainingSetsCount} 组`, `✓ ${trainingSetsCount} Sets Done`)
          : t('记录训练 ⇧⌘T', 'Log Workout ⇧⌘T'),
      accent: '#38bdf8',
      onPress: () => {
        selectIslandAndSync('vitality');
        onQuickTraining();
      },
    },
    {
      id: 'step-wishes',
      num: '④',
      zone: 'wishes' as LifeZoneKey,
      done: habitsDoneToday > 0,
      title: t('OKR推进与心愿金', 'OKR & Wish Vault'),
      status: t(
        `OKR ${avgOkrPct}% · ¥${vault.wishBalanceCny}`,
        `OKR ${avgOkrPct}% · ¥${vault.wishBalanceCny}`,
      ),
      accent: pal.goldAccent,
      onPress: () => {
        selectIslandAndSync('wishes');
      },
    },
  ];

  const activeIslandInfo =
    selectedZone === 'focus'
      ? {
          badge: t('① 心流书房 · 已联动', '① Flow Study · Linked'),
          title: t(
            '管理 24H 时间块矩阵（支持 1 分钟拖拽框选）与 10,000 小时精进计时',
            'Controls 24H Time-Block Matrix (1-min drag selection) & 10,000-Hour Mastery Timer',
          ),
          ctaLabel: t('＋ 切入 1m 时间块 (⇧⌘J)', '＋ Add 1m Time Block (⇧⌘J)'),
          secondaryLabel: t('📚 记学习 (⇧⌘L)', '📚 Log Study (⇧⌘L)'),
          accent: pal.terracottaAccent,
          onPrimary: onQuickJournal,
          onSecondary: onQuickStudy,
        }
      : selectedZone === 'vitality'
        ? {
            badge: t('② 活力体态站 · 已联动', '② Vitality Station · Linked'),
            title: t(
              '管理每日空腹晨重、7 日 EMA 均重趋势、力量训练组数与智能手环/体脂秤同步',
              'Controls Morning Weigh-In, 7-Day EMA Weight Trend, Strength Sets & Wearable Sync',
            ),
            ctaLabel: t('⚖ 记录今日晨重 (⌘K)', '⚖ Log Morning Weight (⌘K)'),
            secondaryLabel: t('🏋️ 记录训练组 (⇧⌘T)', '🏋️ Log Workout Set (⇧⌘T)'),
            accent: pal.emeraldAccent,
            onPrimary: onQuickWeight,
            onSecondary: onQuickTraining,
          }
        : {
            badge: t('③ 星愿纪念台 · 已联动', '③ Astral Wish Altar · Linked'),
            title: t(
              '管理重要纪念日倒数、季度 OKR 关键结果打卡，每次自律打卡自动注入 +¥25 心愿金',
              'Controls Milestone Countdowns, Quarterly OKR Key Results & +¥25 Wish Vault Rewards',
            ),
            ctaLabel: t('🎯 聚焦下方 OKR 与心愿金库', '🎯 Focus OKR & Wish Vault Below'),
            secondaryLabel: t('✦ 打卡习惯 +¥25', '✦ Check-In +¥25'),
            accent: pal.goldAccent,
            onPrimary: () => onSelectModuleFilter?.('wishes'),
            onSecondary: () => {
              const firstKr = allKrs[0];
              if (firstKr) {
                checkInKeyResult(
                  firstKr.objectiveId,
                  firstKr.kr.id,
                  firstKr.kr.stepDelta,
                  localDay,
                );
                const v = recordPledgeReward(`OKR 推进：${firstKr.kr.title}`, localDay);
                setVault(v);
                showToast({
                  text: t(
                    `已推进「${firstKr.kr.title}」· 心愿金库 +¥${v.config.checkInRewardCny}`,
                    `Advanced "${firstKr.kr.title}" · Wish Vault +¥${v.config.checkInRewardCny}`,
                  ),
                });
              }
            },
          };

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
      {/* Top Bar: Theme-Unified Header + 1-Click Warm/Black-Gold Toggle + Bilingual Toggle */}
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
            {t('2.5D 个人时间与心愿沙盘', '2.5D Personal Time & Wish Sanctuary')}
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
                { id: 'diorama', label: t('2.5D 沙盘全览', '2.5D Studio') },
                { id: 'daycycle', label: t('24H 昼夜节律环', '24H Day Cycle') },
                { id: 'summary', label: t('今日五维精要', '5-Dim Summary') },
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

          {/* Charioteer-style 1-Click Global Theme Toggle (暖色调 ⇄ 黑金风) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="切换全局暖色调与黑金风主题"
            onPress={() => {
              toggleTheme();
              showToast({
                text: isDark
                  ? t('已切换至「晨曦暖纸风」全局主题 (⌘T)', 'Switched to Warm Parchment Theme (⌘T)')
                  : t('已切换至「黑金星盘风」全局主题 (⌘T)', 'Switched to Black-Gold Obsidian Theme (⌘T)'),
              });
            }}
            style={[
              styles.dispatchBtn,
              {
                height: 28,
                backgroundColor: pal.pillBg,
                borderColor: pal.goldAccent,
              },
            ]}
          >
            <Text
              variant="caption"
              style={{
                color: pal.goldText,
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              {isDark
                ? t('✦ 黑金风 ⇄ 暖色调 (⌘T)', '✦ Black-Gold ⇄ Warm (⌘T)')
                : t('☀ 暖色调 ⇄ 黑金风 (⌘T)', '☀ Warm ⇄ Black-Gold (⌘T)')}
            </Text>
          </Pressable>

          {/* Instant Bilingual Switcher (中 / EN) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="切换中英文语言 Switch Language"
            onPress={() => {
              const next = toggleLocale();
              showToast({
                text:
                  next === 'en'
                    ? 'Switched to English (⌥L)'
                    : '已切换为中文界面 (⌥L)',
              });
            }}
            style={[
              styles.dispatchBtn,
              {
                height: 28,
                backgroundColor: pal.pillBg,
                borderColor: pal.bentoBorder,
              },
            ]}
          >
            <Text
              variant="caption"
              style={{
                color: pal.ink,
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              {locale === 'zh' ? '🌐 中 / EN' : '🌐 EN / 中文'}
            </Text>
          </Pressable>

          {/* Expandable How-To-Use Guide Toggle */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="查看沙盘使用指南 How It Works"
            onPress={() => setShowOnboardingGuide((prev) => !prev)}
            style={[
              styles.dispatchBtn,
              {
                height: 28,
                backgroundColor: showOnboardingGuide ? pal.pillActiveBg : pal.pillBg,
                borderColor: showOnboardingGuide ? pal.goldAccent : pal.bentoBorder,
              },
            ]}
          >
            <Text
              variant="caption"
              style={{
                color: showOnboardingGuide ? pal.goldText : pal.sub,
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              {showOnboardingGuide
                ? t('▲ 收起用法指南', '▲ Hide Guide')
                : t('❓ 30秒看懂沙盘用法', '❓ How It Works')}
            </Text>
          </Pressable>
        </View>

        <View style={styles.studioTaskbar}>
          <TextInput
            value={quickInput}
            onChangeText={setQuickInput}
            onSubmitEditing={onQuickAddTimeNote}
            placeholder={t(
              '快速切入时间块 (如: 系统架构精读 60m / 肩背训练 45m)…',
              'Quick add time block (e.g., System Design 60m / Back Workout 45m)…',
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
              {t('＋ 切入时间块', '＋ Add Block')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Interactive 4-Step Daily Workflow Loop Ribbon (Always Visible Onboarding & Quick Loop) */}
      <View
        style={[
          styles.workflowLoopRibbon,
          {
            backgroundColor: isDark ? 'rgba(26, 22, 19, 0.92)' : color.paperDeep,
            borderBottomColor: pal.hairline,
          },
        ]}
      >
        <View style={styles.workflowHeaderCol}>
          <Text variant="caption" style={{ color: pal.goldText, fontWeight: '700', fontSize: 11 }}>
            {t('🧭 今日 4 步闭环', '🧭 4-Step Daily Loop')}
          </Text>
          <Text variant="caption" style={{ color: pal.muted, fontSize: 10 }}>
            {t('点击任意步骤直接打卡或联动下方模块 →', 'Click any step to log or filter modules →')}
          </Text>
        </View>

        <View style={styles.workflowStepsRow}>
          {dailyWorkflowSteps.map((step) => {
            const isSelectedZone = selectedZone === step.zone;
            return (
              <Pressable
                key={step.id}
                accessibilityRole="button"
                accessibilityLabel={`${step.num} ${step.title}`}
                onPress={step.onPress}
                style={({ pressed }) => [
                  styles.workflowStepCard,
                  {
                    backgroundColor: isSelectedZone ? pal.pillActiveBg : pal.bentoBg,
                    borderColor: step.done
                      ? step.accent
                      : isSelectedZone
                        ? pal.goldAccent
                        : pal.bentoBorder,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View style={styles.workflowStepTop}>
                  <Text
                    variant="caption"
                    style={{
                      color: step.done ? step.accent : pal.ink,
                      fontWeight: '700',
                      fontSize: 11.5,
                    }}
                  >
                    {`${step.num} ${step.title}`}
                  </Text>
                  <View
                    style={[
                      styles.workflowStatusBadge,
                      {
                        backgroundColor: step.done
                          ? `${step.accent}22`
                          : isDark
                            ? 'rgba(255,255,255,0.06)'
                            : color.pill,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={{
                        color: step.done ? step.accent : pal.muted,
                        fontSize: 10,
                        fontWeight: '600',
                        fontFamily: theme.fontFamily.mono,
                      }}
                    >
                      {step.status}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Expandable 30-Second Visual Guide: How the 3 2.5D Islands Connect to the Homepage */}
      {showOnboardingGuide ? (
        <View
          style={[
            styles.onboardingDrawer,
            {
              backgroundColor: isDark ? '#171411' : color.surface,
              borderBottomColor: pal.stageBorder,
            },
          ]}
        >
          <View style={styles.onboardingDrawerHeader}>
            <Text variant="label" style={{ color: pal.goldText, fontWeight: '700', fontSize: 12.5 }}>
              {t(
                '💡 为什么首页有这三座 2.5D 岛屿？它们如何与下方工作台联动？',
                '💡 How the 3 Isometric Islands Connect to Your Daily Workspace',
              )}
            </Text>
            <Text variant="caption" style={{ color: pal.muted, fontSize: 11 }}>
              {t(
                '三座岛屿不是静态插画，而是「空间化总控开关」——点击任意岛屿，即可直接操作或聚焦下方对应功能区：',
                'Each island is an interactive spatial switch—click any island to act immediately or filter the workspace below:',
              )}
            </Text>
          </View>

          <View style={styles.onboardingCols}>
            {[
              {
                num: t('岛屿 ① · 心流书房', 'Island ① · Flow Study'),
                accent: pal.terracottaAccent,
                mapTo: t('联动下方：24H 时间块 & 10,000h 精进工作台', 'Links to: 24H Time-Block & 10,000h Hub'),
                desc: t(
                  '上方可直接输入「架构精读 60m」切入时间块；下方工作台支持 1 分钟粒度拖拽框选、60 格放大镜微调与番茄钟倒计时。',
                  'Type "System Design 60m" above or use the 1-minute drag-to-select timeline & 60-cell magnifier below.',
                ),
                zone: 'focus' as LifeZoneKey,
              },
              {
                num: t('岛屿 ② · 活力体态站', 'Island ② · Vitality Station'),
                accent: pal.emeraldAccent,
                mapTo: t('联动下方：7日均重趋势、今日训练组 & 智能穿戴同步', 'Links to: 7-Day EMA Weight, Workouts & Wearables'),
                desc: t(
                  '微缩体脂秤实时映射你的最新体重；点击可快速记录晨重 (⌘K)、力量训练组 (⇧⌘T) 或一键同步 Apple Watch / 体脂秤。',
                  'The miniature scale displays your live weight. Click to log morning weight (⌘K), training sets (⇧⌘T), or sync wearables.',
                ),
                zone: 'vitality' as LifeZoneKey,
              },
              {
                num: t('岛屿 ③ · 星愿纪念台', 'Island ③ · Astral Wish Altar'),
                accent: pal.goldAccent,
                mapTo: t('联动下方：人生纪念日、OKR 目标 & 心愿金库', 'Links to: Milestones, Quarterly OKRs & Wish Vault'),
                desc: t(
                  '浑天仪追踪最近的重要纪念日倒数；每次完成晨重、时间块或 OKR 关键结果，系统自动向你的心愿金库注入 +¥25 奖励金。',
                  'Tracks upcoming milestones & quarterly OKRs. Every completed check-in automatically deposits +¥25 into your Wish Vault.',
                ),
                zone: 'wishes' as LifeZoneKey,
              },
            ].map((guide) => (
              <Pressable
                key={guide.num}
                onPress={() => selectIslandAndSync(guide.zone)}
                style={[
                  styles.onboardingColCard,
                  {
                    backgroundColor: pal.bentoBg,
                    borderColor: selectedZone === guide.zone ? guide.accent : pal.bentoBorder,
                  },
                ]}
              >
                <Text variant="label" style={{ color: guide.accent, fontWeight: '700', fontSize: 12 }}>
                  {guide.num}
                </Text>
                <Text variant="caption" style={{ color: pal.ink, fontWeight: '600', fontSize: 11 }}>
                  {guide.mapTo}
                </Text>
                <Text variant="caption" style={{ color: pal.muted, fontSize: 11, lineHeight: 15 }}>
                  {guide.desc}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* Perspective 1: Option-A 2.5D Isometric Diorama + Split Bento Workspace */}
      {perspective === 'diorama' ? (
        <View style={[styles.dioramaStageWrap, { backgroundColor: pal.stageBg }]}>
          {/* Upper Stage: 3 Sculpted 2.5D Isometric Islands */}
          <View style={[styles.stageGridBg, { backgroundColor: pal.stageBg }]}>
            <Golden24HourRibbonBridgesSvg timerRunning={timer.isRunning} isDark={isDark} />

            <View style={styles.isoCanvas}>
              {/* Island 1: 心流书房 */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="心流书房与一万小时精进"
                onPress={() => selectIslandAndSync('focus')}
                style={[
                  styles.isoIslandSlot,
                  selectedZone === 'focus' ? styles.isoNodeSelected : null,
                ]}
              >
                <View style={styles.islandArtWrap}>
                  {/* Interactive Callout Pin */}
                  <View
                    style={[
                      styles.islandCalloutPin,
                      {
                        backgroundColor:
                          selectedZone === 'focus' ? pal.terracottaAccent : pal.pillBg,
                        borderColor: pal.terracottaAccent,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={{
                        color: selectedZone === 'focus' ? '#fffbeb' : pal.goldText,
                        fontSize: 10,
                        fontWeight: '700',
                      }}
                    >
                      {t('① 点击联动：专注 & 24H时间轴', '① Click: Focus & 24H Timeline')}
                    </Text>
                  </View>
                  <IsometricLifeZoneSvg
                    zone="focus"
                    active={selectedZone === 'focus'}
                    isDark={isDark}
                    weightText={latestWeightKg ? latestWeightKg.toFixed(1) : '72.4'}
                  />
                  <View
                    style={[
                      styles.floatingHudCorner,
                      {
                        backgroundColor: pal.hudBg,
                        borderColor:
                          selectedZone === 'focus' ? pal.terracottaAccent : pal.hudBorder,
                      },
                      glassBlurStyle,
                    ]}
                  >
                    <View style={styles.hudTitleRow}>
                      <Text variant="label" style={[styles.hudTitleText, { color: pal.ink }]}>
                        {t('心流书房', 'Flow Study')}
                      </Text>
                      <View style={[styles.hudProgressRing, { borderColor: pal.goldAccent }]}>
                        <View style={[styles.hudProgressDot, { backgroundColor: pal.goldAccent }]} />
                      </View>
                    </View>
                    <Text variant="caption" style={[styles.hudMetricText, { color: pal.sub }]}>
                      {timer.isRunning
                        ? `· ${t('计时', 'Timer')} ${formatTimerClock(timerElapsedSeconds)}`
                        : `· ${displayMasteryHours.toLocaleString('en-US')} /`}
                    </Text>
                    <Text variant="caption" style={[styles.hudSubText, { color: pal.muted }]}>
                      {timer.isRunning ? `  ${timer.title}` : `  10,000h (${trackedMinsToday}m)`}
                    </Text>
                  </View>
                </View>
              </Pressable>

              {/* Island 2: 活力体态 */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="活力体态与蓝牙体脂秤"
                onPress={() => selectIslandAndSync('vitality')}
                style={[
                  styles.isoIslandSlot,
                  selectedZone === 'vitality' ? styles.isoNodeSelected : null,
                ]}
              >
                <View style={styles.islandArtWrap}>
                  {/* Interactive Callout Pin */}
                  <View
                    style={[
                      styles.islandCalloutPin,
                      {
                        backgroundColor:
                          selectedZone === 'vitality' ? pal.emeraldAccent : pal.pillBg,
                        borderColor: pal.emeraldAccent,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={{
                        color: selectedZone === 'vitality' ? '#052e16' : pal.emeraldAccent,
                        fontSize: 10,
                        fontWeight: '700',
                      }}
                    >
                      {t('② 点击联动：晨重 & 训练/手环', '② Click: Weight & Workout')}
                    </Text>
                  </View>
                  <IsometricLifeZoneSvg
                    zone="vitality"
                    active={selectedZone === 'vitality'}
                    isDark={isDark}
                    weightText={latestWeightKg ? latestWeightKg.toFixed(1) : '72.4'}
                  />
                  <View
                    style={[
                      styles.floatingHudCorner,
                      {
                        backgroundColor: pal.hudBg,
                        borderColor:
                          selectedZone === 'vitality' ? pal.emeraldAccent : pal.hudBorder,
                      },
                      glassBlurStyle,
                    ]}
                  >
                    <View style={styles.hudTitleRow}>
                      <Text variant="label" style={[styles.hudTitleText, { color: pal.ink }]}>
                        {t('活力体态', 'Vitality')}
                      </Text>
                      <Text variant="caption" style={{ color: pal.emeraldAccent, fontSize: 12 }}>
                        ↻
                      </Text>
                    </View>
                    <Text variant="caption" style={[styles.hudMetricText, { color: pal.sub }]}>
                      {`· ${latestWeightKg ? `${latestWeightKg.toFixed(1)} kg` : '72.4 kg'}`}
                    </Text>
                    <Text variant="caption" style={[styles.hudSubText, { color: pal.muted }]}>
                      {trainingSetsCount > 0
                        ? t(`· 已训练 ${trainingSetsCount} 组`, `· ${trainingSetsCount} Sets Logged`)
                        : t('· 已同步', '· Synced')}
                    </Text>
                  </View>
                </View>
              </Pressable>

              {/* Island 3: 星愿纪念台 */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="星愿纪念台与心愿金库"
                onPress={() => selectIslandAndSync('wishes')}
                style={[
                  styles.isoIslandSlot,
                  selectedZone === 'wishes' ? styles.isoNodeSelected : null,
                ]}
              >
                <View style={styles.islandArtWrap}>
                  {/* Interactive Callout Pin */}
                  <View
                    style={[
                      styles.islandCalloutPin,
                      {
                        backgroundColor:
                          selectedZone === 'wishes' ? pal.goldAccent : pal.pillBg,
                        borderColor: pal.goldAccent,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={{
                        color: selectedZone === 'wishes' ? '#1c1917' : pal.goldText,
                        fontSize: 10,
                        fontWeight: '700',
                      }}
                    >
                      {t('③ 点击联动：纪念日 & OKR/心愿', '③ Click: Milestones & OKR')}
                    </Text>
                  </View>
                  <IsometricLifeZoneSvg
                    zone="wishes"
                    active={selectedZone === 'wishes'}
                    isDark={isDark}
                    weightText={latestWeightKg ? latestWeightKg.toFixed(1) : '72.4'}
                  />
                  <View
                    style={[
                      styles.floatingHudCorner,
                      {
                        backgroundColor: pal.hudBg,
                        borderColor:
                          selectedZone === 'wishes' ? pal.goldAccent : pal.hudBorder,
                      },
                      glassBlurStyle,
                    ]}
                  >
                    <View style={styles.hudTitleRow}>
                      <Text variant="label" style={[styles.hudTitleText, { color: pal.ink }]}>
                        {t('星愿纪念台', 'Wish Altar')}
                      </Text>
                      <Text variant="caption" style={{ color: pal.goldAccent, fontSize: 11 }}>
                        🎁
                      </Text>
                    </View>
                    <Text variant="caption" style={[styles.hudMetricText, { color: pal.sub }]}>
                      {nearestMs
                        ? `· ${nearestMs.item.title.slice(0, 5)}${nearestMs.badgeText}`
                        : t('· 纪念日还有 5 天', '· Milestone in 5d')}
                    </Text>
                    <Text variant="caption" style={[styles.hudSubText, { color: pal.muted }]}>
                      {`· ¥${vault.wishBalanceCny.toLocaleString('en-US')}`}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </View>

            {/* Active Island Command Dock: Bridges the 3 2.5D Islands with the Homepage Modules Below */}
            <View
              style={[
                styles.islandCommandDock,
                {
                  backgroundColor: pal.barBg,
                  borderColor: activeIslandInfo.accent,
                },
              ]}
            >
              <View style={styles.islandDockLeft}>
                <View
                  style={[
                    styles.islandDockBadge,
                    { backgroundColor: `${activeIslandInfo.accent}22`, borderColor: activeIslandInfo.accent },
                  ]}
                >
                  <Text
                    variant="caption"
                    style={{ color: activeIslandInfo.accent, fontWeight: '700', fontSize: 11 }}
                  >
                    {activeIslandInfo.badge}
                  </Text>
                </View>
                <Text
                  variant="caption"
                  style={{ color: pal.sub, fontSize: 11.5, flex: 1 }}
                  numberOfLines={1}
                >
                  {activeIslandInfo.title}
                </Text>
              </View>

              <View style={styles.islandDockActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={activeIslandInfo.onPrimary}
                  style={[
                    styles.dockActionBtn,
                    {
                      backgroundColor: pal.pillActiveBg,
                      borderColor: activeIslandInfo.accent,
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    style={{ color: pal.goldText, fontWeight: '700', fontSize: 11 }}
                  >
                    {activeIslandInfo.ctaLabel}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={activeIslandInfo.onSecondary}
                  style={[
                    styles.dockActionBtn,
                    {
                      backgroundColor: pal.pillBg,
                      borderColor: pal.bentoBorder,
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    style={{ color: pal.ink, fontWeight: '600', fontSize: 11 }}
                  >
                    {activeIslandInfo.secondaryLabel}
                  </Text>
                </Pressable>
                {onSelectModuleFilter ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      onSelectModuleFilter(
                        activeModuleFilter === selectedZone ? 'all' : selectedZone,
                      )
                    }
                    style={[
                      styles.dockActionBtn,
                      {
                        backgroundColor:
                          activeModuleFilter === selectedZone ? pal.pillActiveBg : pal.pillBg,
                        borderColor:
                          activeModuleFilter === selectedZone ? pal.goldAccent : pal.bentoBorder,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={{
                        color: activeModuleFilter === selectedZone ? pal.goldText : pal.muted,
                        fontWeight: '600',
                        fontSize: 11,
                      }}
                    >
                      {activeModuleFilter === selectedZone
                        ? t('✦ 正在聚焦该模块 (点此看全部)', '✦ Filtering Module (Show All)')
                        : t('🔍 仅看下方对应模块', '🔍 Filter Below to This Zone')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>

          {/* Lower Stage: Option-A Split Bento Workspace */}
          <View style={styles.bentoSplitRow}>
            {/* Left Bento Card: 24H 时间块矩阵 */}
            <View
              style={[
                styles.bentoLeftCard,
                {
                  backgroundColor: pal.bentoBg,
                  borderColor: pal.bentoBorder,
                },
              ]}
            >
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
                    onPress={onQuickJournal}
                    style={[
                      styles.addBlockPill,
                      {
                        backgroundColor: pal.pillBg,
                        borderColor: pal.bentoBorder,
                      },
                    ]}
                  >
                    <Text variant="caption" style={[styles.addBlockPillText, { color: pal.ink }]}>
                      ＋ Add Block
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={[styles.calHeaderRow, { borderBottomColor: pal.hairline }]}>
                <View style={[styles.nowTagBox, { backgroundColor: pal.pillBg }]}>
                  <Text variant="caption" style={[styles.nowTagText, { color: pal.ink }]}>
                    Now
                  </Text>
                </View>
                {matrixColumns.map((col, idx) => (
                  <View key={`ch-${idx}`} style={styles.calColHeader}>
                    <Text variant="caption" style={[styles.calColNum, { color: pal.muted }]}>
                      {col.headerLeft}
                    </Text>
                    <Text variant="caption" style={[styles.calColSub, { color: pal.faint }]}>
                      {col.headerRight}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.calBodyContainer}>
                <View style={styles.calHairlinesLayer} pointerEvents="none">
                  {hourRuler.map((hLabel, idx) => (
                    <View key={hLabel} style={styles.calHairlineRow}>
                      <Text
                        variant="caption"
                        style={[
                          styles.calHourText,
                          { color: pal.faint },
                          idx === 4 ? { color: '#ef4444', fontWeight: '700' } : null,
                        ]}
                      >
                        {hLabel}
                      </Text>
                      <View
                        style={[
                          styles.calHairline,
                          { backgroundColor: pal.hairline },
                          idx === 4 ? { backgroundColor: 'rgba(239, 68, 68, 0.65)', height: 1.2 } : null,
                        ]}
                      />
                    </View>
                  ))}
                </View>

                <View style={styles.calColumnsOverlay}>
                  <View style={{ width: 42 }} />
                  {matrixColumns.map((col, cIdx) => (
                    <View
                      key={`col-${cIdx}`}
                      style={[styles.calTrackCol, { borderLeftColor: pal.hairline }]}
                    >
                      {col.blocks.map((blk) => {
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
                              if (blk.tone === 'emerald') onQuickTraining();
                              else onQuickStudy();
                            }}
                            style={[
                              styles.calEventBlock,
                              {
                                height: blk.height,
                                marginTop: blk.marginTop,
                                backgroundColor: stylePalette.bg,
                                borderColor: stylePalette.border,
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
            </View>

            {/* Right Bento Stack: OKR 目标进度 + 365 天人生星图热力矩阵 */}
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
                    {t('OKR 目标进度 🎯', 'OKR Objectives 🎯')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
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
                          showToast({
                            text: t(
                              `已推进「${item.kr.title}」· 心愿金库 +¥${v.config.checkInRewardCny}`,
                              `Advanced "${item.kr.title}" · Wish Vault +¥${v.config.checkInRewardCny}`,
                            ),
                          });
                        }}
                        style={[
                          styles.okrMiniCard,
                          { backgroundColor: cardBg, borderColor: cardBorder },
                        ]}
                      >
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
                    <View
                      style={[
                        styles.iconSquareBtn,
                        { backgroundColor: pal.pillBg, borderColor: pal.bentoBorder },
                      ]}
                    >
                      <Text variant="caption" style={{ color: pal.ink, fontSize: 10 }}>
                        ▦
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.miniHeatmapWrap}>
                  {heatmap.cells.map((cell, idx) => {
                    const isSelected = selectedHeatmapCell?.localDay === cell.localDay;
                    return (
                      <Pressable
                        key={cell.localDay}
                        onPress={() => setSelectedHeatmapCell(cell)}
                        style={[
                          styles.miniHeatCell,
                          {
                            backgroundColor: optionAHeatCellColor(cell, idx),
                            borderColor: isSelected ? pal.ink : 'transparent',
                            borderWidth: isSelected ? 1.2 : 0,
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
                </View>
              </View>
            </View>
          </View>
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
              },
            ].map((slot) => (
              <View
                key={slot.phase}
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
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Perspective 3: 今日五维精要 */}
      {perspective === 'summary' ? (
        <View style={[styles.ledgerGrid, { backgroundColor: pal.stageBg }]}>
          <View style={[styles.ledgerCol, { borderRightColor: pal.hairline }]}>
            <Text variant="caption" style={[styles.ledgerKey, { color: pal.muted }]}>
              {t('今日三件事', 'Daily Core 3')}
            </Text>
            <Text variant="heading" style={{ color: loggedCount === 3 ? pal.emeraldAccent : pal.terracottaAccent }}>
              {t(`${loggedCount} / 3 已记`, `${loggedCount} / 3 Logged`)}
            </Text>
            <Text variant="caption" style={[styles.ledgerSub, { color: pal.muted }]}>
              {t('晨重 · 训练 · 学习', 'Weight · Workout · Study')}
            </Text>
          </View>
          <View style={[styles.ledgerCol, { borderRightColor: pal.hairline }]}>
            <Text variant="caption" style={[styles.ledgerKey, { color: pal.muted }]}>
              {t('近 7 日晨重', '7-Day Weigh-Ins')}
            </Text>
            <Text variant="heading" style={{ color: pal.ink }}>
              {t(`${activeWeightDays} / 7 天`, `${activeWeightDays} / 7 Days`)}
            </Text>
            <Text variant="caption" style={[styles.ledgerSub, { color: pal.muted }]}>
              {t('稳定追踪均重趋势', 'Rolling EMA weight trend')}
            </Text>
          </View>
          <View style={[styles.ledgerCol, { borderRightColor: pal.hairline }]}>
            <Text variant="caption" style={[styles.ledgerKey, { color: pal.muted }]}>
              {t('今日训练负荷', 'Training Load')}
            </Text>
            <Text variant="heading" style={{ color: pal.ink }}>
              {t(`${trainingSetsCount} 组`, `${trainingSetsCount} Sets`)}
            </Text>
            <Text variant="caption" style={[styles.ledgerSub, { color: pal.muted }]}>
              {t(`累计容量 ${Math.round(trainingVolumeKg)} kg`, `Volume ${Math.round(trainingVolumeKg)} kg`)}
            </Text>
          </View>
          <View style={[styles.ledgerCol, { borderRightColor: pal.hairline }]}>
            <Text variant="caption" style={[styles.ledgerKey, { color: pal.muted }]}>
              {t('今日专注时间块', 'Focus Time Blocks')}
            </Text>
            <Text variant="heading" style={{ color: pal.ink }}>
              {t(`${trackedMinsToday} 分钟`, `${trackedMinsToday} mins`)}
            </Text>
            <Text variant="caption" style={[styles.ledgerSub, { color: pal.muted }]}>
              {t(`已完成 ${studyCount} 项学习`, `${studyCount} study sessions`)}
            </Text>
          </View>
          <View style={styles.ledgerCol}>
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
          </View>
        </View>
      ) : null}

      {/* Bottom Quick Action Strip */}
      <View
        style={[
          styles.quickDispatchBar,
          {
            backgroundColor: pal.barBg,
            borderTopColor: pal.hairline,
          },
        ]}
      >
        <View style={styles.quickDispatchLeft}>
          <Text variant="caption" style={{ color: pal.muted, fontWeight: '600' }}>
            {t('快捷记录', 'Quick Log')}
          </Text>
          <Pressable
            onPress={onQuickWeight}
            style={[styles.quickPill, { backgroundColor: pal.pillBg, borderColor: pal.bentoBorder }]}
          >
            <Text variant="caption" style={[styles.quickPillText, { color: pal.ink }]}>
              {t('＋ 晨重 ⌘K', '＋ Weight ⌘K')}
            </Text>
          </Pressable>
          <Pressable
            onPress={onQuickTraining}
            style={[styles.quickPill, { backgroundColor: pal.pillBg, borderColor: pal.bentoBorder }]}
          >
            <Text variant="caption" style={[styles.quickPillText, { color: pal.ink }]}>
              {t('＋ 训练 ⇧⌘T', '＋ Workout ⇧⌘T')}
            </Text>
          </Pressable>
          <Pressable
            onPress={onQuickStudy}
            style={[styles.quickPill, { backgroundColor: pal.pillBg, borderColor: pal.bentoBorder }]}
          >
            <Text variant="caption" style={[styles.quickPillText, { color: pal.ink }]}>
              {t('＋ 学习 ⇧⌘L', '＋ Study ⇧⌘L')}
            </Text>
          </Pressable>
          <Pressable
            onPress={onQuickJournal}
            style={[styles.quickPill, { backgroundColor: pal.pillBg, borderColor: pal.bentoBorder }]}
          >
            <Text variant="caption" style={[styles.quickPillText, { color: pal.ink }]}>
              {t('＋ 时间块 ⇧⌘J', '＋ Time Block ⇧⌘J')}
            </Text>
          </Pressable>
        </View>
        {onOpenScope ? (
          <Pressable
            onPress={onOpenScope}
            style={[styles.quickPill, { backgroundColor: pal.pillBg, borderColor: pal.bentoBorder }]}
          >
            <Text variant="caption" style={[styles.quickPillText, { color: pal.ink }]}>
              {mode === 'charioteer-host'
                ? t('Charioteer 挂载态 (⌘B) →', 'Charioteer Host (⌘B) →')
                : t('工作台导览 (⌘B) →', 'Workbench Guide (⌘B) →')}
            </Text>
          </Pressable>
        ) : null}
      </View>
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
  workflowLoopRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  workflowHeaderCol: {
    gap: 2,
    minWidth: 150,
  },
  workflowStepsRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  workflowStepCard: {
    flex: 1,
    minWidth: 165,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  workflowStepTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  workflowStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  onboardingDrawer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  onboardingDrawerHeader: {
    gap: 3,
  },
  onboardingCols: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  onboardingColCard: {
    flex: 1,
    minWidth: 230,
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  dioramaStageWrap: {
    paddingBottom: 14,
  },
  stageGridBg: {
    position: 'relative',
    minHeight: 224,
  },
  isoCanvas: {
    position: 'relative',
    zIndex: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 10,
  },
  isoIslandSlot: {
    flex: 1,
    minWidth: 255,
    maxWidth: 325,
    alignItems: 'center',
  },
  isoNodeSelected: {
    transform: [{ translateY: -3 }],
  },
  islandArtWrap: {
    position: 'relative',
    width: 280,
    height: 196,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  islandCalloutPin: {
    position: 'absolute',
    top: 4,
    left: 6,
    zIndex: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  islandCommandDock: {
    marginHorizontal: 14,
    marginTop: 4,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    zIndex: 3,
  },
  islandDockLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
    minWidth: 240,
  },
  islandDockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  islandDockActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  dockActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  floatingHudCorner: {
    position: 'absolute',
    top: 28,
    right: 0,
    zIndex: 5,
    minWidth: 126,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
    gap: 2,
  },
  hudTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  hudTitleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  hudProgressRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudProgressDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  hudMetricText: {
    fontSize: 11,
    fontFamily: theme.fontFamily.mono,
  },
  hudSubText: {
    fontSize: 11,
    fontFamily: theme.fontFamily.mono,
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
    paddingHorizontal: 4,
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
  },
  calHairlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  },
  calTrackCol: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 3,
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
  quickDispatchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  quickDispatchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  quickPillText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
});
