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

import { Text } from './Text';
import { theme } from './theme';
import { showToast } from './toast';

export type SanctuaryPerspective = 'diorama' | 'daycycle' | 'summary';
export type LifeZoneKey = 'focus' | 'vitality' | 'wishes';

/**
 * Museum-Grade Option-A 2.5D Isometric Island Artwork:
 * - 'focus': Warm Walnut Study Loft (Rounded 3D walnut slab, wood-grain lines, 3-drawer pedestal desk, swivel chair, dome lamp + articulated brass lamp with warm light cone, open book, red journal)
 * - 'vitality': Obsidian-Emerald Fitness Island (Rolled terracotta yoga mat with spiral end, shaded green sphere, brass roller, pair of 3D dumbbells, bevelled smart scale with metallic pads & live LED readout)
 * - 'wishes': Obsidian-Gold Astrolabe Pavilion (Stepped brass pedestal, multi-ring 3D Golden Armillary Sphere with degree ticks & Polaris arrow, plus 3D ribboned gift box)
 */
function IsometricLifeZoneSvg({
  zone,
  active,
  weightText,
}: {
  zone: LifeZoneKey;
  active: boolean;
  weightText: string;
}) {
  const rimColor =
    zone === 'focus' ? '#f59e0b' : zone === 'vitality' ? '#34d399' : '#f5b942';

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

  const gradTopId = `dioramaTop_${zone}`;
  const gradWallLId = `dioramaWallL_${zone}`;
  const gradWallRId = `dioramaWallR_${zone}`;
  const floorBloomId = `dioramaBloom_${zone}`;
  const goldMetalId = `dioramaGold_${zone}`;
  const lampConeId = `dioramaCone_${zone}`;

  return createElement(
    'svg',
    {
      width: 276,
      height: 184,
      viewBox: '0 0 280 188',
      fill: 'none',
      style: {
        overflow: 'visible',
        filter: active
          ? `drop-shadow(0 20px 30px rgba(0, 0, 0, 0.78)) drop-shadow(0 0 20px ${rimColor}40)`
          : 'drop-shadow(0 16px 24px rgba(0, 0, 0, 0.62))',
      },
    },
    createElement(
      'defs',
      null,
      createElement(
        'linearGradient',
        { id: gradTopId, x1: '0', y1: '0', x2: '1', y2: '1' },
        createElement('stop', {
          offset: '0%',
          stopColor: zone === 'focus' ? '#523624' : zone === 'vitality' ? '#203029' : '#332b20',
        }),
        createElement('stop', {
          offset: '100%',
          stopColor: zone === 'focus' ? '#281a11' : zone === 'vitality' ? '#111916' : '#18140f',
        }),
      ),
      createElement(
        'linearGradient',
        { id: gradWallLId, x1: '0', y1: '0', x2: '1', y2: '1' },
        createElement('stop', {
          offset: '0%',
          stopColor: zone === 'focus' ? '#3d2618' : zone === 'vitality' ? '#182820' : '#282015',
        }),
        createElement('stop', { offset: '100%', stopColor: '#0e0c0a' }),
      ),
      createElement(
        'linearGradient',
        { id: gradWallRId, x1: '0', y1: '0', x2: '1', y2: '1' },
        createElement('stop', { offset: '0%', stopColor: '#1f1a15' }),
        createElement('stop', { offset: '100%', stopColor: '#090807' }),
      ),
      createElement(
        'radialGradient',
        { id: floorBloomId, cx: '50%', cy: '50%', r: '50%' },
        createElement('stop', { offset: '0%', stopColor: rimColor, stopOpacity: '0.52' }),
        createElement('stop', { offset: '65%', stopColor: rimColor, stopOpacity: '0.14' }),
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

    // 1. Soft Neon Floor Bloom under the Isometric Base
    createElement('ellipse', {
      cx: 136,
      cy: 134,
      rx: 108,
      ry: 42,
      fill: `url(#${floorBloomId})`,
    }),

    // 2. 3D Extruded Isometric Base Slab (Left Bevel, Right Bevel, Glowing Neon Under-Rim, Top Surface)
    createElement('polygon', {
      points: '18,118 136,168 136,182 18,132',
      fill: `url(#${gradWallLId})`,
      stroke: 'rgba(255,248,235,0.14)',
      strokeWidth: 1,
    }),
    createElement('polygon', {
      points: '254,118 136,168 136,182 254,132',
      fill: `url(#${gradWallRId})`,
      stroke: 'rgba(255,248,235,0.12)',
      strokeWidth: 1,
    }),
    // Glowing Neon Under-Rim Strip
    createElement('polyline', {
      points: '18,130 136,180 254,130',
      fill: 'none',
      stroke: rimColor,
      strokeWidth: active ? 3.5 : 2.6,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
    // Top Isometric Deck
    createElement('polygon', {
      points: '136,168 254,118 136,68 18,118',
      fill: `url(#${gradTopId})`,
      stroke: rimColor,
      strokeWidth: active ? 1.8 : 1.2,
      strokeOpacity: 0.82,
    }),
    // Subtle Inner Deck Inset Border
    createElement('polygon', {
      points: '136,161 242,116 136,73 30,116',
      fill: 'none',
      stroke: 'rgba(255,248,235,0.08)',
      strokeWidth: 0.9,
    }),

    // ================= ISLAND 1: 心流书房 (Walnut Study Desk + Lamps + Swivel Chair) =================
    zone === 'focus'
      ? createElement(
          'g',
          null,
          // Subtle wood-grain texture lines on platform
          createElement('line', {
            x1: 48,
            y1: 122,
            x2: 142,
            y2: 82,
            stroke: 'rgba(255,200,150,0.07)',
            strokeWidth: 1,
          }),
          createElement('line', {
            x1: 72,
            y1: 134,
            x2: 168,
            y2: 93,
            stroke: 'rgba(255,200,150,0.07)',
            strokeWidth: 1,
          }),
          // Desk Floor Shadow
          createElement('polygon', {
            points: '68,108 138,78 182,96 112,126',
            fill: 'rgba(0,0,0,0.42)',
          }),
          // Left Desk Drawer Pedestal (Front & Side 3D Faces + 3 Drawers)
          createElement('polygon', {
            points: '68,94 98,107 98,132 68,119',
            fill: '#3b2213',
            stroke: '#7c4a2b',
            strokeWidth: 0.9,
          }),
          createElement('polygon', {
            points: '98,107 116,99 116,124 98,132',
            fill: '#24140b',
            stroke: '#5c351e',
            strokeWidth: 0.8,
          }),
          // 3 Drawer Separators & Brass Handles
          createElement('line', { x1: 71, y1: 103, x2: 95, y2: 113, stroke: '#24140b', strokeWidth: 1 }),
          createElement('line', { x1: 71, y1: 111, x2: 95, y2: 121, stroke: '#24140b', strokeWidth: 1 }),
          createElement('line', { x1: 80, y1: 103, x2: 86, y2: 106, stroke: '#f5b942', strokeWidth: 1.6, strokeLinecap: 'round' }),
          createElement('line', { x1: 80, y1: 111, x2: 86, y2: 114, stroke: '#f5b942', strokeWidth: 1.6, strokeLinecap: 'round' }),
          createElement('line', { x1: 80, y1: 119, x2: 86, y2: 122, stroke: '#f5b942', strokeWidth: 1.6, strokeLinecap: 'round' }),
          // Right Desk Panel Leg
          createElement('polygon', {
            points: '146,84 168,93 168,116 146,107',
            fill: '#28160c',
            stroke: '#693d23',
            strokeWidth: 0.9,
          }),
          // Thick Sculpted Walnut Desk Top (Top Surface + Front Edge Bevel)
          createElement('polygon', {
            points: '116,112 178,86 134,67 66,94',
            fill: '#663d24',
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
          // Warm Golden Light Pool on Desk Surface
          createElement('ellipse', {
            cx: 122,
            cy: 89,
            rx: 38,
            ry: 16,
            fill: `url(#${lampConeId})`,
          }),
          // Open Two-Page Book with Page Thickness & Text Lines
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
          createElement('line', { x1: 103, y1: 89, x2: 115, y2: 84, stroke: '#92400e', strokeWidth: 0.7 }),
          createElement('line', { x1: 116, y1: 80, x2: 128, y2: 76, stroke: '#92400e', strokeWidth: 0.7 }),
          // Terracotta Hardcover Book Stack on Upper Corner of Desk
          createElement('polygon', {
            points: '146,84 164,76 152,71 134,79',
            fill: '#c25e3c',
            stroke: '#fde68a',
            strokeWidth: 0.8,
          }),
          createElement('polygon', {
            points: '134,79 146,84 146,87 134,82',
            fill: '#fffbeb',
          }),
          // Glowing Warm Dome Table Lamp (Upper Center of Desk)
          createElement('ellipse', { cx: 130, cy: 67, rx: 18, ry: 10, fill: 'rgba(254, 240, 138, 0.28)' }),
          createElement('ellipse', { cx: 130, cy: 70, rx: 7, ry: 3.5, fill: '#b45309' }),
          createElement('rect', { x: 127, y: 58, width: 6, height: 12, rx: 2, fill: '#d97706' }),
          createElement('path', {
            d: 'M116 60 C116 41, 144 41, 144 60 Z',
            fill: '#fef08a',
            stroke: '#f59e0b',
            strokeWidth: 1.4,
          }),
          // Articulated Brass Architect Lamp on Left Side of Desk
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
          // Ergonomic Swivel Chair in Front of Desk (Seat, Backrest, Pedestal Base)
          createElement('ellipse', { cx: 148, cy: 125, rx: 13, ry: 5.5, fill: 'rgba(0,0,0,0.5)' }),
          createElement('line', { x1: 148, y1: 114, x2: 148, y2: 125, stroke: '#1c1917', strokeWidth: 3 }),
          createElement('line', { x1: 138, y1: 125, x2: 158, y2: 125, stroke: '#44403c', strokeWidth: 2 }),
          createElement('polygon', {
            points: '134,109 156,100 164,105 142,114',
            fill: '#3b2314',
            stroke: '#7c4a2b',
            strokeWidth: 0.9,
          }),
          createElement('polygon', {
            points: '148,92 164,85 164,106 148,113',
            fill: '#4a2c19',
            stroke: '#a16207',
            strokeWidth: 1,
          }),
        )
      : null,

    // ================= ISLAND 2: 活力体态 (Rolled Terracotta Yoga Mat + Dumbbells + Smart Scale) =================
    zone === 'vitality'
      ? createElement(
          'g',
          null,
          // Mat Shadow
          createElement('polygon', {
            points: '54,106 138,71 172,86 88,121',
            fill: 'rgba(0,0,0,0.45)',
          }),
          // Unrolled Terracotta Yoga Mat with 3D Edge Thickness
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
          // Rolled Cylinder Head of Yoga Mat (Upper-Left Edge)
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
          createElement('ellipse', {
            cx: 56,
            cy: 103,
            rx: 3,
            ry: 4,
            fill: 'none',
            stroke: '#f3a683',
            strokeWidth: 0.8,
          }),
          // Small Brass Grip Bar on Mat
          createElement('line', {
            x1: 96,
            y1: 98,
            x2: 108,
            y2: 104,
            stroke: `url(#${goldMetalId})`,
            strokeWidth: 3.5,
            strokeLinecap: 'round',
          }),
          // 3D Shaded Emerald Mobility Sphere with Specular Highlight
          createElement('ellipse', { cx: 135, cy: 90, rx: 10, ry: 4.5, fill: 'rgba(0,0,0,0.35)' }),
          createElement('circle', {
            cx: 135,
            cy: 84,
            r: 9.5,
            fill: '#34d399',
            stroke: '#059669',
            strokeWidth: 1,
          }),
          createElement('circle', {
            cx: 132,
            cy: 81,
            r: 2.8,
            fill: '#a7f3d0',
          }),
          // Bevelled Glass Digital Smart Scale (Right Side of Island)
          createElement('polygon', {
            points: '158,131 214,108 178,92 122,115',
            fill: 'rgba(0,0,0,0.5)',
          }),
          createElement('polygon', {
            points: '158,128 212,105 176,90 122,113',
            fill: '#2e343b',
            stroke: '#cbd5e1',
            strokeWidth: 1.5,
          }),
          // 4 Brushed Metal BIA Electrode Pads on Smart Scale
          createElement('polygon', {
            points: '134,112 152,104 146,101 128,109',
            fill: 'rgba(255,255,255,0.12)',
          }),
          createElement('polygon', {
            points: '160,122 178,114 172,111 154,119',
            fill: 'rgba(255,255,255,0.12)',
          }),
          // Glowing Digital Weight Screen on Scale
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
          // Pair of Sculpted Copper-Bronze Dumbbells in Front Corner
          createElement('ellipse', { cx: 112, cy: 130, rx: 14, ry: 5, fill: 'rgba(0,0,0,0.4)' }),
          createElement('circle', { cx: 102, cy: 128, r: 5, fill: '#b45309', stroke: '#fde68a', strokeWidth: 0.8 }),
          createElement('line', { x1: 102, y1: 128, x2: 118, y2: 121, stroke: '#fde68a', strokeWidth: 2.8 }),
          createElement('circle', { cx: 118, cy: 121, r: 5, fill: '#b45309', stroke: '#fde68a', strokeWidth: 0.8 }),

          createElement('ellipse', { cx: 128, cy: 138, rx: 14, ry: 5, fill: 'rgba(0,0,0,0.4)' }),
          createElement('circle', { cx: 118, cy: 136, r: 5, fill: '#b45309', stroke: '#fde68a', strokeWidth: 0.8 }),
          createElement('line', { x1: 118, y1: 136, x2: 134, y2: 129, stroke: '#fde68a', strokeWidth: 2.8 }),
          createElement('circle', { cx: 134, cy: 129, r: 5, fill: '#b45309', stroke: '#fde68a', strokeWidth: 0.8 }),
        )
      : null,

    // ================= ISLAND 3: 星愿纪念台 (3D Golden Armillary Sphere Astrolabe + Gift Box) =================
    zone === 'wishes'
      ? createElement(
          'g',
          null,
          // Stepped Golden Brass Compass Pedestal Base
          createElement('ellipse', {
            cx: 122,
            cy: 120,
            rx: 42,
            ry: 18,
            fill: 'rgba(0,0,0,0.52)',
          }),
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
          // Semicircular Cradle Support Arc under Sphere
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
          // Outer Sculpted Golden Zodiac Ring (Thick 3D Band + Degree Ticks)
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
          // Tilted Inner Ecliptic Ring 1
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
          // Tilted Inner Ecliptic Ring 2
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
          // Diagonal Celestial Polaris Arrow Piercing the Sphere
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
          // Central Glowing Celestial Core
          createElement('circle', {
            cx: 122,
            cy: 64,
            r: 5.5,
            fill: '#fef08a',
            stroke: '#ca8a04',
            strokeWidth: 1.2,
          }),
          // 3D Isometric Anniversary Gift Box with Overhanging Lid & Golden Silk Ribbon Bow
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
          // Golden Vertical Ribbon Straps on Box Sides
          createElement('polygon', {
            points: '175,116 180,118 180,134 175,132',
            fill: '#fde68a',
          }),
          createElement('polygon', {
            points: '197,118 202,116 202,132 197,134',
            fill: '#eab308',
          }),
          // Gift Box Top Lid
          createElement('polygon', {
            points: '188,123 212,112 188,102 164,112',
            fill: '#cc785c',
            stroke: '#fde68a',
            strokeWidth: 1,
          }),
          // Crossed Golden Ribbons & 3D Bow on Lid
          createElement('line', { x1: 176, y1: 107, x2: 200, y2: 117, stroke: '#fde68a', strokeWidth: 2.6 }),
          createElement('line', { x1: 176, y1: 117, x2: 200, y2: 107, stroke: '#fde68a', strokeWidth: 2.6 }),
          createElement('ellipse', { cx: 184, cy: 109, rx: 4.5, ry: 2.5, transform: 'rotate(-20 184 109)', fill: '#fef08a' }),
          createElement('ellipse', { cx: 192, cy: 109, rx: 4.5, ry: 2.5, transform: 'rotate(20 192 109)', fill: '#f5b942' }),
        )
      : null,
  );
}

/**
 * Option-A Sculpted 3D Golden Ribbon Bridges with `(24)` Medallions & Stardust Sparkle Field
 */
function Golden24HourRibbonBridgesSvg({ timerRunning }: { timerRunning: boolean }) {
  if (Platform.OS !== 'web') return null;

  const sparkles: [number, number, number][] = [
    [285, 192, 1.8],
    [310, 206, 2.2],
    [328, 198, 1.4],
    [366, 208, 2.0],
    [388, 196, 1.6],
    [412, 185, 2.2],
    [595, 190, 1.8],
    [620, 205, 2.3],
    [638, 197, 1.5],
    [676, 206, 2.1],
    [698, 195, 1.7],
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
        createElement('stop', { offset: '0%', stopColor: '#b45309' }),
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
    ),

    // Bridge 1: Study Loft -> Vitality Island (3D Ribbon Base + Animated Core + Specular Rim)
    createElement('path', {
      d: 'M 245 172 C 310 222, 380 222, 445 172',
      fill: 'none',
      stroke: 'rgba(245, 185, 66, 0.18)',
      strokeWidth: 18,
      strokeLinecap: 'round',
    }),
    createElement('path', {
      d: 'M 245 172 C 310 222, 380 222, 445 172',
      fill: 'none',
      stroke: 'url(#ribbonBody1)',
      strokeWidth: 9,
      strokeLinecap: 'round',
    }),
    createElement('path', {
      d: 'M 245 169 C 310 219, 380 219, 445 169',
      fill: 'none',
      stroke: '#fef08a',
      strokeWidth: 2,
      strokeDasharray: timerRunning ? '6 6' : '10 6',
    }),
    // Medallion (24) #1
    createElement('circle', {
      cx: 345,
      cy: 208,
      r: 16,
      fill: '#261c10',
      stroke: '#f5b942',
      strokeWidth: 2.4,
    }),
    createElement('circle', {
      cx: 345,
      cy: 208,
      r: 13,
      fill: 'none',
      stroke: 'rgba(254, 240, 138, 0.45)',
      strokeWidth: 0.9,
    }),
    createElement(
      'text',
      {
        x: 345,
        y: 212,
        textAnchor: 'middle',
        fill: '#fef08a',
        fontSize: '11',
        fontWeight: '700',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      '24',
    ),

    // Bridge 2: Vitality Island -> Wish Astrolabe Pavilion
    createElement('path', {
      d: 'M 555 172 C 620 222, 690 222, 755 172',
      fill: 'none',
      stroke: 'rgba(245, 185, 66, 0.18)',
      strokeWidth: 18,
      strokeLinecap: 'round',
    }),
    createElement('path', {
      d: 'M 555 172 C 620 222, 690 222, 755 172',
      fill: 'none',
      stroke: 'url(#ribbonBody2)',
      strokeWidth: 9,
      strokeLinecap: 'round',
    }),
    createElement('path', {
      d: 'M 555 169 C 620 219, 690 219, 755 169',
      fill: 'none',
      stroke: '#fef08a',
      strokeWidth: 2,
      strokeDasharray: '10 6',
    }),
    // Medallion (24) #2
    createElement('circle', {
      cx: 655,
      cy: 208,
      r: 16,
      fill: '#261c10',
      stroke: '#f5b942',
      strokeWidth: 2.4,
    }),
    createElement('circle', {
      cx: 655,
      cy: 208,
      r: 13,
      fill: 'none',
      stroke: 'rgba(254, 240, 138, 0.45)',
      strokeWidth: 0.9,
    }),
    createElement(
      'text',
      {
        x: 655,
        y: 212,
        textAnchor: 'middle',
        fill: '#fef08a',
        fontSize: '11',
        fontWeight: '700',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      '24',
    ),

    // Stardust Sparkles along the Golden Ribbon Bridges
    ...sparkles.map(([sx, sy, sr], idx) =>
      createElement('circle', {
        key: `sp-${idx}`,
        cx: sx,
        cy: sy,
        r: sr,
        fill: '#fef08a',
        opacity: 0.78,
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
  onQuickWeight: () => void;
  onQuickTraining: () => void;
  onQuickStudy: () => void;
  onQuickJournal: () => void;
  onOpenScope?: () => void;
}) {
  const [perspective, setPerspective] = useState<SanctuaryPerspective>('diorama');
  const [selectedZone, setSelectedZone] = useState<LifeZoneKey>('focus');
  const [quickInput, setQuickInput] = useState('');
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<HeatmapCell | null>(null);
  const [matrixMode, setMatrixMode] = useState<'on' | 'day'>('on');
  const [okrPage, setOkrPage] = useState(0);

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

  // Flatten Key Results across objectives for the Option-A 2x2 OKR Progress Bento
  const allKrs = objectives.flatMap((obj) =>
    obj.keyResults.map((kr) => ({
      objectiveId: obj.id,
      objectiveTitle: obj.title,
      kr,
      pct: computeKrProgressPct(kr),
    })),
  );
  const visibleKrs = allKrs.slice(okrPage * 4, okrPage * 4 + 4);

  // Build Option-A 365-day style Heatmap Grid (182 cells = 26 columns x 7 rows)
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
    if (cell.level === 4) return '#34d399';
    if (cell.level === 3) return '#10b981';
    if (cell.level === 2) return '#eab308';
    if (cell.level === 1) return '#cc785c';
    // Option A multi-tone mosaic rhythm
    const row = idx % 7;
    const col = Math.floor(idx / 7);
    const seed = (col * 5 + row * 3) % 12;
    if (row < 2 && seed < 9) return '#34d399';
    if (row >= 2 && row < 4 && seed < 7) return seed % 2 === 0 ? '#10b981' : '#eab308';
    if (row >= 4 && seed < 6) return seed % 2 === 0 ? '#eab308' : '#cc785c';
    return '#23262e';
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
    const cleanTitle = (minMatch ? raw.replace(minMatch[0], '') : raw).trim() || '深度专注';

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
    setSelectedZone('focus');
    showToast({
      text: `已切入 24H 时间块矩阵：${cleanTitle} (${mins} 分钟) · 心愿金库 +¥${v.config.checkInRewardCny}`,
    });
  }

  // Build Option-A Multi-Column Time-Block Matrix Columns
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
      headerRight: '晨间/专注',
      blocks: [
        {
          id: 'mc-1-a',
          title: latestUserBlock ? latestUserBlock.title : '深度架构与论文精读',
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
          title: '系统复盘与核心研发',
          timeRange: '13:30 – 16:30',
          tone: 'terracotta',
          height: 56,
          marginTop: 6,
        },
        {
          id: 'mc-1-c',
          title: '力量与有氧代谢训练',
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
      headerRight: '一万小时',
      blocks: [
        {
          id: 'mc-2-a',
          title: '+ 10,000h 计时打卡',
          timeRange: '08:30',
          tone: 'pill',
          height: 24,
          marginTop: 18,
        },
        {
          id: 'mc-2-b',
          title: trainingSetsCount > 0 ? `今日训练 (${trainingSetsCount} 组)` : '核心力量与心肺激活',
          timeRange: '11:30 – 14:00',
          tone: 'emerald',
          height: 68,
          marginTop: 34,
          sparkle: true,
        },
        {
          id: 'mc-2-c',
          title: '晚间阅读与心愿复盘',
          timeRange: '19:30 – 21:30',
          tone: 'golden',
          height: 52,
          marginTop: 22,
        },
      ],
    },
    {
      headerLeft: colDays[2]!.slice(8),
      headerRight: '今日主轴',
      blocks: [
        {
          id: 'mc-3-a',
          title: studyMinutes > 0 ? `今日已专注 ${studyMinutes}m` : '10,000h 沉浸创造时间块',
          timeRange: '08:00 – 13:30',
          tone: 'golden',
          height: 112,
          marginTop: 6,
        },
        {
          id: 'mc-3-b',
          title: 'OKR 关键结果推进与归档',
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
          boxShadow: '0 10px 26px rgba(0, 0, 0, 0.52), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
        } as unknown as ViewStyle)
      : null;

  return (
    <View style={styles.stageCard}>
      {/* Top Bar: Option-A Walnut & Obsidian Header */}
      <View style={styles.studioTopbar}>
        <View style={styles.topbarLeft}>
          <View style={styles.brandDot} />
          <Text variant="label" style={styles.studioTitle}>
            2.5D 个人时间与心愿沙盘
          </Text>
          <View style={styles.perspBar}>
            {(
              [
                { id: 'diorama', label: '2.5D 沙盘全览' },
                { id: 'daycycle', label: '24H 昼夜节律环' },
                { id: 'summary', label: '今日五维精要' },
              ] as const
            ).map((tab) => {
              const active = perspective === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  accessibilityRole="button"
                  accessibilityLabel={`切换视图 ${tab.label}`}
                  onPress={() => setPerspective(tab.id)}
                  style={[styles.perspPill, active ? styles.perspPillOn : null]}
                >
                  <Text
                    variant="caption"
                    style={[styles.perspPillText, active ? styles.perspPillTextOn : null]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.studioTaskbar}>
          <TextInput
            value={quickInput}
            onChangeText={setQuickInput}
            onSubmitEditing={onQuickAddTimeNote}
            placeholder="快速切入时间块 (如: 系统架构精读 60m / 肩背训练 45m)…"
            placeholderTextColor="#a8a29e"
            style={[
              styles.studioTaskInput,
              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : null,
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add Block 切入时间块"
            onPress={onQuickAddTimeNote}
            style={({ pressed }) => [
              styles.dispatchBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text variant="caption" style={styles.dispatchBtnText}>
              ＋ Add Block
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Perspective 1: Option-A 2.5D Isometric Diorama + Split Bento Workspace */}
      {perspective === 'diorama' ? (
        <View style={styles.dioramaStageWrap}>
          {/* Upper Stage: 3 Sculpted 2.5D Isometric Islands with Upper-Right Floating Glass HUD Badges + Golden (24) Ribbon Bridges */}
          <View style={styles.stageGridBg}>
            <Golden24HourRibbonBridgesSvg timerRunning={timer.isRunning} />

            <View style={styles.isoCanvas}>
              {/* Island 1: 心流书房 (Walnut Study Loft) */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="心流书房与一万小时精进"
                onPress={() => setSelectedZone('focus')}
                style={[
                  styles.isoIslandSlot,
                  selectedZone === 'focus' ? styles.isoNodeSelected : null,
                ]}
              >
                <View style={styles.islandArtWrap}>
                  <IsometricLifeZoneSvg
                    zone="focus"
                    active={selectedZone === 'focus'}
                    weightText={latestWeightKg ? latestWeightKg.toFixed(1) : '72.4'}
                  />
                  {/* Floating Glassmorphic HUD Badge at Upper-Right of Island 1 (Option A exact position) */}
                  <View
                    style={[
                      styles.floatingHudCorner,
                      glassBlurStyle,
                      selectedZone === 'focus' ? styles.hudFocusActive : null,
                    ]}
                  >
                    <View style={styles.hudTitleRow}>
                      <Text variant="label" style={styles.hudTitleText}>
                        心流书房
                      </Text>
                      <View style={styles.hudProgressRing}>
                        <View style={styles.hudProgressDot} />
                      </View>
                    </View>
                    <Text variant="caption" style={styles.hudMetricText}>
                      {timer.isRunning
                        ? `· 计时 ${formatTimerClock(timerElapsedSeconds)}`
                        : `· ${displayMasteryHours.toLocaleString('en-US')} /`}
                    </Text>
                    <Text variant="caption" style={styles.hudSubText}>
                      {timer.isRunning ? `  ${timer.title}` : `  10,000h (${trackedMinsToday}m)`}
                    </Text>
                  </View>
                </View>
              </Pressable>

              {/* Island 2: 活力体态 (Yoga Mat + Dumbbells + Smart Scale) */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="活力体态与蓝牙体脂秤"
                onPress={() => setSelectedZone('vitality')}
                style={[
                  styles.isoIslandSlot,
                  selectedZone === 'vitality' ? styles.isoNodeSelected : null,
                ]}
              >
                <View style={styles.islandArtWrap}>
                  <IsometricLifeZoneSvg
                    zone="vitality"
                    active={selectedZone === 'vitality'}
                    weightText={latestWeightKg ? latestWeightKg.toFixed(1) : '72.4'}
                  />
                  {/* Floating Glassmorphic HUD Badge at Upper-Right of Island 2 */}
                  <View
                    style={[
                      styles.floatingHudCorner,
                      glassBlurStyle,
                      selectedZone === 'vitality' ? styles.hudVitalityActive : null,
                    ]}
                  >
                    <View style={styles.hudTitleRow}>
                      <Text variant="label" style={styles.hudTitleText}>
                        活力体态
                      </Text>
                      <Text variant="caption" style={{ color: '#9ca3af', fontSize: 12 }}>
                        ↻
                      </Text>
                    </View>
                    <Text variant="caption" style={styles.hudMetricText}>
                      {`· ${latestWeightKg ? `${latestWeightKg.toFixed(1)} kg` : '72.4 kg'}`}
                    </Text>
                    <Text variant="caption" style={styles.hudSubText}>
                      {trainingSetsCount > 0 ? `· 已训练 ${trainingSetsCount} 组` : '· 已同步'}
                    </Text>
                  </View>
                </View>
              </Pressable>

              {/* Island 3: 星愿纪念台 (3D Golden Astrolabe + Anniversary Gift Box) */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="星愿纪念台与心愿金库"
                onPress={() => setSelectedZone('wishes')}
                style={[
                  styles.isoIslandSlot,
                  selectedZone === 'wishes' ? styles.isoNodeSelected : null,
                ]}
              >
                <View style={styles.islandArtWrap}>
                  <IsometricLifeZoneSvg
                    zone="wishes"
                    active={selectedZone === 'wishes'}
                    weightText={latestWeightKg ? latestWeightKg.toFixed(1) : '72.4'}
                  />
                  {/* Floating Glassmorphic HUD Badge at Upper-Right of Island 3 */}
                  <View
                    style={[
                      styles.floatingHudCorner,
                      glassBlurStyle,
                      selectedZone === 'wishes' ? styles.hudWishesActive : null,
                    ]}
                  >
                    <View style={styles.hudTitleRow}>
                      <Text variant="label" style={styles.hudTitleText}>
                        星愿纪念台
                      </Text>
                      <Text variant="caption" style={{ color: '#9ca3af', fontSize: 11 }}>
                        🎁
                      </Text>
                    </View>
                    <Text variant="caption" style={styles.hudMetricText}>
                      {nearestMs
                        ? `· ${nearestMs.item.title.slice(0, 5)}${nearestMs.badgeText}`
                        : `· 纪念日还有 5 天`}
                    </Text>
                    <Text variant="caption" style={styles.hudSubText}>
                      {`· ¥${vault.wishBalanceCny.toLocaleString('en-US')}`}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </View>
          </View>

          {/* Lower Stage: Option-A Split Bento Workspace (Left: Multi-Col 24H Time-Block Matrix | Right: Glowing OKR Progress + 365-Day Heatmap) */}
          <View style={styles.bentoSplitRow}>
            {/* Left Bento Card: 24H 时间块矩阵 (True Multi-Column Hourly Schedule Grid) */}
            <View style={styles.bentoLeftCard}>
              <View style={styles.bentoHeader}>
                <Text variant="label" style={styles.bentoTitle}>
                  24H 时间块矩阵
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={styles.modeTogglePill}>
                    <Pressable
                      onPress={() => setMatrixMode('on')}
                      style={[
                        styles.modeToggleBtn,
                        matrixMode === 'on' ? styles.modeToggleBtnOn : null,
                      ]}
                    >
                      <Text variant="caption" style={styles.modeToggleText}>
                        On
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setMatrixMode('day')}
                      style={[
                        styles.modeToggleBtn,
                        matrixMode === 'day' ? styles.modeToggleBtnOn : null,
                      ]}
                    >
                      <Text variant="caption" style={styles.modeToggleText}>
                        day
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable onPress={onQuickJournal} style={styles.addBlockPill}>
                    <Text variant="caption" style={styles.addBlockPillText}>
                      ＋ Add Block
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Column Header Row (Now + Day Tracks) */}
              <View style={styles.calHeaderRow}>
                <View style={styles.nowTagBox}>
                  <Text variant="caption" style={styles.nowTagText}>
                    Now
                  </Text>
                </View>
                {matrixColumns.map((col, idx) => (
                  <View key={`ch-${idx}`} style={styles.calColHeader}>
                    <Text variant="caption" style={styles.calColNum}>
                      {col.headerLeft}
                    </Text>
                    <Text variant="caption" style={styles.calColSub}>
                      {col.headerRight}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Multi-Column Hourly Calendar Body with Y-Axis Ruler, Background Grid Lines & Red 'Now' Line */}
              <View style={styles.calBodyContainer}>
                {/* Horizontal Hairlines across the grid */}
                <View style={styles.calHairlinesLayer} pointerEvents="none">
                  {hourRuler.map((hLabel, idx) => (
                    <View key={hLabel} style={styles.calHairlineRow}>
                      <Text
                        variant="caption"
                        style={[
                          styles.calHourText,
                          idx === 4 ? { color: '#ef4444', fontWeight: '700' } : null,
                        ]}
                      >
                        {hLabel}
                      </Text>
                      <View
                        style={[
                          styles.calHairline,
                          idx === 4 ? { backgroundColor: 'rgba(239, 68, 68, 0.65)', height: 1.2 } : null,
                        ]}
                      />
                    </View>
                  ))}
                </View>

                {/* Positioned Multi-Column Schedule Blocks */}
                <View style={styles.calColumnsOverlay}>
                  <View style={{ width: 42 }} />
                  {matrixColumns.map((col, cIdx) => (
                    <View key={`col-${cIdx}`} style={styles.calTrackCol}>
                      {col.blocks.map((blk) => {
                        const stylePalette =
                          blk.tone === 'terracotta'
                            ? {
                                bg: 'rgba(181, 96, 69, 0.42)',
                                border: '#d98266',
                                text: '#fff1eb',
                                sub: '#f5c2b0',
                              }
                            : blk.tone === 'emerald'
                              ? {
                                  bg: 'rgba(30, 130, 92, 0.44)',
                                  border: '#34d399',
                                  text: '#ecfdf5',
                                  sub: '#a7f3d0',
                                }
                              : blk.tone === 'golden'
                                ? {
                                    bg: 'rgba(161, 120, 34, 0.42)',
                                    border: '#eab308',
                                    text: '#fefce8',
                                    sub: '#fde68a',
                                  }
                                : {
                                    bg: 'rgba(92, 71, 38, 0.48)',
                                    border: 'rgba(245, 185, 66, 0.5)',
                                    text: '#fde68a',
                                    sub: '#d6d3d1',
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

            {/* Right Bento Stack: OKR 目标进度 (Top) + 365 天人生星图热力矩阵 (Bottom) */}
            <View style={styles.bentoRightStack}>
              {/* Right Top Card: OKR 目标进度 */}
              <View style={styles.bentoRightCard}>
                <View style={styles.bentoHeader}>
                  <Text variant="label" style={styles.bentoTitle}>
                    OKR 目标进度 🎯
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Pressable
                      onPress={() => setOkrPage((p) => Math.max(0, p - 1))}
                      style={styles.iconSquareBtn}
                    >
                      <Text variant="caption" style={{ color: '#a8a29e', fontSize: 11 }}>
                        ‹
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        setOkrPage((p) =>
                          (p + 1) * 4 < allKrs.length ? p + 1 : 0,
                        )
                      }
                      style={styles.iconSquareBtn}
                    >
                      <Text variant="caption" style={{ color: '#a8a29e', fontSize: 11 }}>
                        ›
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.okrMiniGrid}>
                  {visibleKrs.map((item, idx) => {
                    const isEmerald = idx % 2 === 1;
                    const barColor = isEmerald ? '#34d399' : '#f5b942';
                    const cardBg = isEmerald
                      ? 'rgba(18, 45, 35, 0.58)'
                      : 'rgba(52, 39, 23, 0.58)';
                    const cardBorder = isEmerald
                      ? 'rgba(52, 211, 153, 0.32)'
                      : 'rgba(245, 185, 66, 0.32)';
                    const glowStyle =
                      Platform.OS === 'web'
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
                            text: `已推进「${item.kr.title}」· 心愿金库 +¥${v.config.checkInRewardCny}`,
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
                            style={styles.okrMiniLabel}
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
                        <View style={styles.okrGlowTrack}>
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
              <View style={styles.bentoRightCard}>
                <View style={styles.bentoHeader}>
                  <Text variant="label" style={styles.bentoTitle}>
                    365 天人生星图热力矩阵
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={[styles.iconSquareBtn, { backgroundColor: '#2e2b29' }]}>
                      <Text variant="caption" style={{ color: '#e7e5e4', fontSize: 10 }}>
                        ▦
                      </Text>
                    </View>
                    <View style={styles.iconSquareBtn}>
                      <Text variant="caption" style={{ color: '#78716c', fontSize: 10 }}>
                        ▤
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
                            borderColor: isSelected ? '#ffffff' : 'transparent',
                            borderWidth: isSelected ? 1 : 0,
                          },
                        ]}
                      />
                    );
                  })}
                </View>

                <View style={styles.miniHeatmapFooter}>
                  <Text variant="caption" style={{ color: '#9ca3af', fontSize: 10.5 }}>
                    {selectedHeatmapCell
                      ? `${selectedHeatmapCell.localDay} · 热力 Lv.${selectedHeatmapCell.level}/4 · 专注 ${selectedHeatmapCell.studyMinutes}m`
                      : '365 day heatmap'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {['#34d399', '#10b981', '#eab308', '#d97706', '#cc785c', '#783c28'].map((c) => (
                      <View
                        key={c}
                        style={[styles.legendDot, { backgroundColor: c }]}
                      />
                    ))}
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {/* Perspective 2: 24H 昼夜节律环 */}
      {perspective === 'daycycle' ? (
        <View style={styles.stageGridBg}>
          <View style={styles.dayCycleGrid}>
            {[
              {
                phase: '06:00 – 09:00 · 晨间唤醒',
                title: '空腹晨重 & 目标校准',
                status: latestWeightKg ? `已记晨重 ${latestWeightKg.toFixed(1)} kg` : '待记录今日晨重',
                detail: '早起空腹称重最能反映真实体脂趋势，完成后自动点亮今日第一块基石。',
                accent: '#34d399',
              },
              {
                phase: '09:00 – 18:00 · 日间心流',
                title: '深度专注 & 一万小时积累',
                status: `今日已投入 ${trackedMinsToday} 分钟`,
                detail: '将高难度学习与创造放在精力峰值时段，每一分钟都会沉淀进 10,000 小时定律。',
                accent: '#e8924a',
              },
              {
                phase: '18:00 – 21:00 · 晚间活力',
                title: '力量/有氧训练 & 身体恢复',
                status: trainingSetsCount > 0 ? `已完成 ${trainingSetsCount} 组 (${Math.round(trainingVolumeKg)} kg)` : '待开启今日运动',
                detail: '力量或有氧训练不仅塑造体态，还能为次日带来更高的深度专注时长。',
                accent: '#38bdf8',
              },
              {
                phase: '21:00 – 23:30 · 夜间复盘',
                title: '习惯打卡、纪念日与心愿蓄力',
                status: `习惯 ${habitsDoneToday}/${habits.length} · 心愿池 ¥${vault.wishBalanceCny}`,
                detail: nearestMs
                  ? `距离「${nearestMs.item.title}」${nearestMs.badgeText}，每一次打卡都在为心愿蓄力。`
                  : '睡前花 2 分钟完成习惯打卡与随手记，让一天有始有终。',
                accent: '#f5b942',
              },
            ].map((slot) => (
              <View
                key={slot.phase}
                style={[styles.dayCycleCard, { borderTopColor: slot.accent }]}
              >
                <Text variant="caption" style={{ color: slot.accent, fontWeight: '600' }}>
                  {slot.phase}
                </Text>
                <Text variant="label" style={{ color: '#f5f5f4', fontSize: 13 }}>
                  {slot.title}
                </Text>
                <View style={styles.isoHudSubBox}>
                  <Text variant="caption" style={{ color: '#fde68a', fontWeight: '600' }}>
                    {slot.status}
                  </Text>
                </View>
                <Text variant="caption" style={{ color: '#a8a29e', lineHeight: 16 }}>
                  {slot.detail}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Perspective 3: 今日五维精要 */}
      {perspective === 'summary' ? (
        <View style={styles.ledgerGrid}>
          <View style={styles.ledgerCol}>
            <Text variant="caption" style={styles.ledgerKey}>
              今日三件事
            </Text>
            <Text variant="heading" style={{ color: loggedCount === 3 ? '#34d399' : '#e8924a' }}>
              {`${loggedCount} / 3 已记`}
            </Text>
            <Text variant="caption" style={styles.ledgerSub}>
              晨重 · 训练 · 学习
            </Text>
          </View>
          <View style={styles.ledgerCol}>
            <Text variant="caption" style={styles.ledgerKey}>
              近 7 日晨重
            </Text>
            <Text variant="heading" style={{ color: '#f5f5f4' }}>
              {`${activeWeightDays} / 7 天`}
            </Text>
            <Text variant="caption" style={styles.ledgerSub}>
              稳定追踪均重趋势
            </Text>
          </View>
          <View style={styles.ledgerCol}>
            <Text variant="caption" style={styles.ledgerKey}>
              今日训练负荷
            </Text>
            <Text variant="heading" style={{ color: '#f5f5f4' }}>
              {`${trainingSetsCount} 组`}
            </Text>
            <Text variant="caption" style={styles.ledgerSub}>
              {`累计容量 ${Math.round(trainingVolumeKg)} kg`}
            </Text>
          </View>
          <View style={styles.ledgerCol}>
            <Text variant="caption" style={styles.ledgerKey}>
              今日专注时间块
            </Text>
            <Text variant="heading" style={{ color: '#f5f5f4' }}>
              {`${trackedMinsToday} 分钟`}
            </Text>
            <Text variant="caption" style={styles.ledgerSub}>
              {`已完成 ${studyCount} 项学习`}
            </Text>
          </View>
          <View style={styles.ledgerCol}>
            <Text variant="caption" style={styles.ledgerKey}>
              心愿池 &amp; OKR
            </Text>
            <Text variant="heading" style={{ color: '#fde68a' }}>
              {`¥${vault.wishBalanceCny} · ${avgOkrPct}%`}
            </Text>
            <Text variant="caption" style={styles.ledgerSub}>
              {nearestMs ? `${nearestMs.item.title} ${nearestMs.badgeText}` : `习惯 ${habitsDoneToday}/${habits.length}`}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Bottom Quick Action Strip */}
      <View style={styles.quickDispatchBar}>
        <View style={styles.quickDispatchLeft}>
          <Text variant="caption" style={{ color: '#a8a29e', fontWeight: '600' }}>
            快捷记录
          </Text>
          <Pressable onPress={onQuickWeight} style={styles.quickPill}>
            <Text variant="caption" style={styles.quickPillText}>
              ＋ 晨重 ⌘K
            </Text>
          </Pressable>
          <Pressable onPress={onQuickTraining} style={styles.quickPill}>
            <Text variant="caption" style={styles.quickPillText}>
              ＋ 训练 ⇧⌘T
            </Text>
          </Pressable>
          <Pressable onPress={onQuickStudy} style={styles.quickPill}>
            <Text variant="caption" style={styles.quickPillText}>
              ＋ 学习 ⇧⌘L
            </Text>
          </Pressable>
          <Pressable onPress={onQuickJournal} style={styles.quickPill}>
            <Text variant="caption" style={styles.quickPillText}>
              ＋ 时间块 ⇧⌘J
            </Text>
          </Pressable>
        </View>
        {onOpenScope ? (
          <Pressable onPress={onOpenScope} style={styles.quickPill}>
            <Text variant="caption" style={styles.quickPillText}>
              {mode === 'charioteer-host' ? 'Charioteer 挂载态 (⌘B) →' : '工作台导览 (⌘B) →'}
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
    borderColor: 'rgba(245, 185, 66, 0.22)',
    backgroundColor: '#121110',
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
    backgroundColor: '#1a1613',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 248, 235, 0.08)',
  },
  topbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f5b942',
  },
  studioTitle: {
    color: '#f5f5f4',
    fontSize: 13.5,
    fontWeight: '600',
  },
  perspBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 248, 235, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.10)',
    gap: 3,
  },
  perspPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  perspPillOn: {
    backgroundColor: '#332820',
  },
  perspPillText: {
    color: '#a8a29e',
    fontSize: 11,
  },
  perspPillTextOn: {
    color: '#fde68a',
    fontWeight: '600',
  },
  studioTaskbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 260,
    maxWidth: 480,
  },
  studioTaskInput: {
    flex: 1,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.14)',
    backgroundColor: '#0e0c0a',
    color: '#f5f5f4',
    fontSize: 12,
  },
  dispatchBtn: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 7,
    backgroundColor: '#29231e',
    borderWidth: 1,
    borderColor: 'rgba(245, 185, 66, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchBtnText: {
    color: '#fde68a',
    fontSize: 11.5,
    fontWeight: '600',
  },
  dioramaStageWrap: {
    backgroundColor: '#121110',
    paddingBottom: 14,
  },
  stageGridBg: {
    position: 'relative',
    minHeight: 224,
    backgroundColor: '#121110',
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
    height: 190,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  floatingHudCorner: {
    position: 'absolute',
    top: 4,
    right: 0,
    zIndex: 5,
    minWidth: 126,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: 'rgba(42, 42, 46, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    gap: 2,
  },
  hudFocusActive: {
    borderColor: 'rgba(245, 158, 11, 0.65)',
  },
  hudVitalityActive: {
    borderColor: 'rgba(52, 211, 153, 0.65)',
  },
  hudWishesActive: {
    borderColor: 'rgba(245, 185, 66, 0.65)',
  },
  hudTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  hudTitleText: {
    color: '#f5f5f4',
    fontSize: 13,
    fontWeight: '700',
  },
  hudProgressRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.8,
    borderColor: 'rgba(245, 185, 66, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudProgressDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fef08a',
  },
  hudMetricText: {
    color: '#d6d3d1',
    fontSize: 11,
    fontFamily: theme.fontFamily.mono,
  },
  hudSubText: {
    color: '#a8a29e',
    fontSize: 11,
    fontFamily: theme.fontFamily.mono,
  },
  // Option-A Lower Split Bento Grid
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
    borderColor: 'rgba(255, 255, 255, 0.10)',
    backgroundColor: '#18181b',
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
    borderColor: 'rgba(255, 255, 255, 0.10)',
    backgroundColor: '#18181b',
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
    color: '#f5f5f4',
    fontSize: 14,
    fontWeight: '700',
  },
  modeTogglePill: {
    flexDirection: 'row',
    borderRadius: 6,
    backgroundColor: '#232329',
    padding: 2,
    gap: 2,
  },
  modeToggleBtn: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modeToggleBtnOn: {
    backgroundColor: '#35353e',
  },
  modeToggleText: {
    color: '#d6d3d1',
    fontSize: 10.5,
  },
  addBlockPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#2c2c34',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  addBlockPillText: {
    color: '#f5f5f4',
    fontSize: 11,
    fontWeight: '600',
  },
  // Multi-Column Calendar Grid inside Left Bento
  calHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  nowTagBox: {
    width: 38,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: '#2b2b33',
    alignItems: 'center',
  },
  nowTagText: {
    color: '#e7e5e4',
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
    color: '#a8a29e',
    fontSize: 11,
    fontFamily: theme.fontFamily.mono,
  },
  calColSub: {
    color: '#78716c',
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
    color: '#78716c',
    fontSize: 9.5,
    fontFamily: theme.fontFamily.mono,
  },
  calHairline: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  calColumnsOverlay: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 2,
  },
  calTrackCol: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255, 255, 255, 0.05)',
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
    backgroundColor: '#232329',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    color: '#f5f5f4',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
    backgroundColor: '#12100e',
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.07)',
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
    borderColor: 'rgba(255, 248, 235, 0.10)',
    borderTopWidth: 3,
    backgroundColor: '#1f1c19',
    padding: 12,
    gap: 7,
  },
  ledgerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#161412',
  },
  ledgerCol: {
    flex: 1,
    minWidth: 150,
    padding: 14,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 248, 235, 0.06)',
    gap: 4,
  },
  ledgerKey: {
    fontSize: 11,
    color: '#a8a29e',
    fontWeight: '600',
  },
  ledgerSub: {
    fontSize: 11,
    color: '#a8a29e',
  },
  quickDispatchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#1a1613',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 248, 235, 0.08)',
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
    backgroundColor: '#272320',
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.12)',
  },
  quickPillText: {
    color: '#f5f5f4',
    fontSize: 11.5,
    fontWeight: '500',
  },
});
