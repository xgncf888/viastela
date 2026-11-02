import { createElement, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';

import { type RuntimeHostMode } from '@/core/charioteer-plugin';
import { buildLifeHeatmapGrid, type HeatmapCell, type PledgeVaultState } from '@/core/life-gamification';
import {
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
 * Option-A High-Craft 2.5D Isometric Diorama Islands:
 * 1. 'focus': Warm Walnut Study Loft (Executive walnut desk with drawers, chair, glowing dome lamp, brass lamp, open book, and 10,000h radial badge)
 * 2. 'vitality': Obsidian-Emerald Fitness Island (Rolled terracotta yoga mat, green sphere, copper dumbbells, and digital smart scale with live weight readout)
 * 3. 'wishes': Obsidian-Gold Astrolabe Pavilion (3D Golden Armillary Sphere / Celestial Astrolabe with Polaris arrow + ribboned anniversary gift box)
 */
function IsometricLifeZoneSvg({
  zone,
  active,
  weightText,
  masteryHoursText,
}: {
  zone: LifeZoneKey;
  active: boolean;
  weightText: string;
  masteryHoursText: string;
}) {
  const rimColor =
    zone === 'focus' ? '#e8924a' : zone === 'vitality' ? '#34d399' : '#f5b942';

  if (Platform.OS !== 'web') {
    return (
      <View
        style={{
          width: 230,
          height: 136,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: rimColor,
          backgroundColor: '#1b1815',
        }}
      />
    );
  }

  const gradTopId = `optATop_${zone}`;
  const gradSideLId = `optASideL_${zone}`;
  const gradSideRId = `optASideR_${zone}`;
  const underGlowId = `optAGlow_${zone}`;
  const goldGradId = `optAGold_${zone}`;

  return createElement(
    'svg',
    {
      width: 262,
      height: 168,
      viewBox: '0 0 280 180',
      fill: 'none',
      style: {
        overflow: 'visible',
        filter: active
          ? `drop-shadow(0 18px 28px rgba(0, 0, 0, 0.72)) drop-shadow(0 0 18px ${rimColor}33)`
          : 'drop-shadow(0 14px 22px rgba(0, 0, 0, 0.58))',
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
          stopColor: zone === 'focus' ? '#4a3222' : zone === 'vitality' ? '#1f2d27' : '#2f2920',
        }),
        createElement('stop', {
          offset: '100%',
          stopColor: zone === 'focus' ? '#261a12' : zone === 'vitality' ? '#121a17' : '#181510',
        }),
      ),
      createElement(
        'linearGradient',
        { id: gradSideLId, x1: '0', y1: '0', x2: '1', y2: '1' },
        createElement('stop', {
          offset: '0%',
          stopColor: zone === 'focus' ? '#362317' : zone === 'vitality' ? '#17241e' : '#241e16',
        }),
        createElement('stop', { offset: '100%', stopColor: '#0e0c0a' }),
      ),
      createElement(
        'linearGradient',
        { id: gradSideRId, x1: '0', y1: '0', x2: '1', y2: '1' },
        createElement('stop', { offset: '0%', stopColor: '#1a1612' }),
        createElement('stop', { offset: '100%', stopColor: '#090807' }),
      ),
      createElement(
        'radialGradient',
        { id: underGlowId, cx: '50%', cy: '50%', r: '50%' },
        createElement('stop', { offset: '0%', stopColor: rimColor, stopOpacity: '0.46' }),
        createElement('stop', { offset: '100%', stopColor: rimColor, stopOpacity: '0' }),
      ),
      createElement(
        'linearGradient',
        { id: goldGradId, x1: '0', y1: '0', x2: '1', y2: '1' },
        createElement('stop', { offset: '0%', stopColor: '#fde68a' }),
        createElement('stop', { offset: '50%', stopColor: '#eab308' }),
        createElement('stop', { offset: '100%', stopColor: '#a16207' }),
      ),
    ),

    // 1. Ambient Neon Floor Bloom under Island
    createElement('ellipse', {
      cx: 140,
      cy: 122,
      rx: 102,
      ry: 42,
      fill: `url(#${underGlowId})`,
    }),

    // 2. Thick 2.5D Isometric Platform Slab (Left & Right Extruded Walls + Glowing Under-Rim + Top Deck)
    createElement('polygon', {
      points: '22,110 140,158 140,172 22,124',
      fill: `url(#${gradSideLId})`,
      stroke: 'rgba(255,248,235,0.12)',
      strokeWidth: 1,
    }),
    createElement('polygon', {
      points: '258,110 140,158 140,172 258,124',
      fill: `url(#${gradSideRId})`,
      stroke: 'rgba(255,248,235,0.12)',
      strokeWidth: 1,
    }),
    // Glowing Neon Under-Rim Strip (Option A signature detail)
    createElement('polyline', {
      points: '22,122 140,170 258,122',
      fill: 'none',
      stroke: rimColor,
      strokeWidth: active ? 3.2 : 2.4,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
    // Isometric Platform Top Surface
    createElement('polygon', {
      points: '140,158 258,110 140,62 22,110',
      fill: `url(#${gradTopId})`,
      stroke: rimColor,
      strokeWidth: active ? 1.8 : 1.1,
      strokeOpacity: 0.75,
    }),

    // ================= ISLAND 1: 心流书房 (Walnut Study Desk + Dome Lamp + 10,000h Dial) =================
    zone === 'focus'
      ? createElement(
          'g',
          null,
          // Warm Lamp Pool on Desk
          createElement('ellipse', {
            cx: 132,
            cy: 96,
            rx: 46,
            ry: 22,
            fill: 'rgba(251, 191, 36, 0.22)',
          }),
          // Left & Right Walnut Desk Pedestal Drawers
          createElement('polygon', {
            points: '78,96 106,108 106,130 78,118',
            fill: '#3d2415',
            stroke: '#78472a',
            strokeWidth: 0.9,
          }),
          createElement('polygon', {
            points: '106,108 122,101 122,123 106,130',
            fill: '#29170d',
          }),
          // Drawer pulls
          createElement('line', {
            x1: 88,
            y1: 107,
            x2: 96,
            y2: 111,
            stroke: '#f5b942',
            strokeWidth: 1.5,
          }),
          createElement('line', {
            x1: 88,
            y1: 115,
            x2: 96,
            y2: 119,
            stroke: '#f5b942',
            strokeWidth: 1.5,
          }),
          // Executive Walnut Desk Top
          createElement('polygon', {
            points: '126,112 184,88 140,70 82,94',
            fill: '#5c3722',
            stroke: '#d97706',
            strokeWidth: 1.2,
          }),
          // Open Illuminated Book on Desk
          createElement('polygon', {
            points: '126,98 148,89 134,83 112,92',
            fill: '#fef3c7',
            stroke: '#d97706',
            strokeWidth: 0.9,
          }),
          // Red Hardcover Notebook on Right Corner
          createElement('polygon', {
            points: '154,88 168,82 158,78 144,84',
            fill: '#b45309',
            stroke: '#fde68a',
            strokeWidth: 0.7,
          }),
          // Glowing Warm Dome Lamp (Upper Right of Desk)
          createElement('rect', {
            x: 135,
            y: 56,
            width: 6,
            height: 12,
            rx: 2,
            fill: '#d97706',
          }),
          createElement('path', {
            d: 'M126 58 C126 44, 150 44, 150 58 Z',
            fill: '#fef08a',
            stroke: '#f59e0b',
            strokeWidth: 1.2,
          }),
          // Articulated Brass Reading Lamp (Left of Desk)
          createElement('ellipse', {
            cx: 98,
            cy: 88,
            rx: 7,
            ry: 3.5,
            fill: '#d97706',
          }),
          createElement('polyline', {
            points: '98,88 92,72 106,65',
            fill: 'none',
            stroke: '#f5b942',
            strokeWidth: 2,
          }),
          createElement('polygon', {
            points: '104,62 114,66 108,72 98,67',
            fill: '#f5b942',
          }),
          // Ergonomic Swivel Study Chair
          createElement('polygon', {
            points: '148,108 168,99 168,116 148,125',
            fill: '#292018',
            stroke: '#78472a',
            strokeWidth: 1,
          }),
          // Floating 10,000-Hour Golden Radial Dial Badge (Option A signature element)
          createElement('circle', {
            cx: 214,
            cy: 64,
            r: 25,
            fill: '#181512',
            stroke: 'rgba(245, 185, 66, 0.45)',
            strokeWidth: 1.5,
          }),
          createElement('circle', {
            cx: 214,
            cy: 64,
            r: 20,
            fill: 'none',
            stroke: '#f5b942',
            strokeWidth: 2.5,
            strokeDasharray: '4 2.5',
          }),
          createElement(
            'text',
            {
              x: 214,
              y: 63,
              textAnchor: 'middle',
              fill: '#fde68a',
              fontSize: '8.5',
              fontWeight: '700',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            },
            masteryHoursText,
          ),
          createElement(
            'text',
            {
              x: 214,
              y: 73,
              textAnchor: 'middle',
              fill: '#a8a29e',
              fontSize: '7',
            },
            '10,000h',
          ),
        )
      : null,

    // ================= ISLAND 2: 活力体态 (Rolled Terracotta Yoga Mat + Dumbbells + Digital Scale) =================
    zone === 'vitality'
      ? createElement(
          'g',
          null,
          // Unrolled Terracotta Yoga Mat Base
          createElement('polygon', {
            points: '88,112 162,82 134,70 60,100',
            fill: '#b56345',
            stroke: '#e8924a',
            strokeWidth: 1,
          }),
          // Rolled Yoga Mat Cylinder at Upper Left
          createElement('polygon', {
            points: '56,96 130,66 138,76 64,106',
            fill: '#cc785c',
            stroke: '#f5b942',
            strokeWidth: 0.9,
          }),
          createElement('ellipse', {
            cx: 60,
            cy: 101,
            rx: 6,
            ry: 8,
            fill: '#7c3f29',
            stroke: '#e8924a',
            strokeWidth: 1,
          }),
          // Green Mobility / Kettle Sphere
          createElement('circle', {
            cx: 138,
            cy: 86,
            r: 9,
            fill: '#34d399',
            stroke: '#065f46',
            strokeWidth: 1,
          }),
          // Sleek Glass Digital Smart Scale on Right Side of Island
          createElement('polygon', {
            points: '164,124 212,104 180,90 132,110',
            fill: '#272a30',
            stroke: '#9ca3af',
            strokeWidth: 1.5,
          }),
          // LED Weight Display Screen on Smart Scale
          createElement('polygon', {
            points: '166,105 184,97 176,93 158,101',
            fill: '#0b0f14',
            stroke: '#34d399',
            strokeWidth: 0.9,
          }),
          createElement(
            'text',
            {
              x: 171,
              y: 100,
              textAnchor: 'middle',
              fill: '#4ade80',
              fontSize: '7.5',
              fontWeight: '700',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            },
            weightText,
          ),
          // Pair of Sculpted Copper Dumbbells in Foreground
          createElement('circle', { cx: 116, cy: 122, r: 4.5, fill: '#b45309' }),
          createElement('line', {
            x1: 116,
            y1: 122,
            x2: 130,
            y2: 116,
            stroke: '#fde68a',
            strokeWidth: 2.5,
          }),
          createElement('circle', { cx: 130, cy: 116, r: 4.5, fill: '#b45309' }),
          createElement('circle', { cx: 132, cy: 130, r: 4.5, fill: '#b45309' }),
          createElement('line', {
            x1: 132,
            y1: 130,
            x2: 146,
            y2: 124,
            stroke: '#fde68a',
            strokeWidth: 2.5,
          }),
          createElement('circle', { cx: 146, cy: 124, r: 4.5, fill: '#b45309' }),
        )
      : null,

    // ================= ISLAND 3: 星愿纪念台 (3D Golden Armillary Sphere Astrolabe + Ribboned Gift Box) =================
    zone === 'wishes'
      ? createElement(
          'g',
          null,
          // Sculpted Graduated Golden Astrolabe Pedestal Base
          createElement('ellipse', {
            cx: 130,
            cy: 112,
            rx: 38,
            ry: 16,
            fill: '#292014',
            stroke: `url(#${goldGradId})`,
            strokeWidth: 2,
          }),
          createElement('ellipse', {
            cx: 130,
            cy: 108,
            rx: 28,
            ry: 11,
            fill: '#42321b',
            stroke: '#fde68a',
            strokeWidth: 1.2,
          }),
          // Support Pillar
          createElement('rect', {
            x: 126,
            y: 92,
            width: 8,
            height: 16,
            fill: `url(#${goldGradId})`,
          }),
          // Outer Meridian Golden Ring of Armillary Sphere
          createElement('circle', {
            cx: 130,
            cy: 64,
            r: 32,
            fill: 'none',
            stroke: `url(#${goldGradId})`,
            strokeWidth: 5,
          }),
          createElement('circle', {
            cx: 130,
            cy: 64,
            r: 29,
            fill: 'none',
            stroke: '#fef08a',
            strokeWidth: 0.9,
            strokeDasharray: '2 3',
          }),
          // Tilted Ecliptic Equatorial Ring 1
          createElement('ellipse', {
            cx: 130,
            cy: 64,
            rx: 30,
            ry: 11,
            transform: 'rotate(-28 130 64)',
            fill: 'none',
            stroke: `url(#${goldGradId})`,
            strokeWidth: 3.5,
          }),
          // Tilted Ecliptic Equatorial Ring 2
          createElement('ellipse', {
            cx: 130,
            cy: 64,
            rx: 26,
            ry: 10,
            transform: 'rotate(32 130 64)',
            fill: 'none',
            stroke: '#eab308',
            strokeWidth: 2.4,
          }),
          // Diagonal Celestial Arrow Axis pointing Upper-Left to Polaris
          createElement('line', {
            x1: 158,
            y1: 92,
            x2: 96,
            y2: 30,
            stroke: '#fef08a',
            strokeWidth: 2.4,
          }),
          createElement('polygon', {
            points: '92,26 103,29 96,36',
            fill: '#fef08a',
          }),
          // Central Golden Sun Core
          createElement('circle', {
            cx: 130,
            cy: 64,
            r: 4.5,
            fill: '#fef08a',
          }),
          // Isometric Anniversary Gift Box with Golden Ribbon on Right Corner
          createElement('polygon', {
            points: '190,114 214,104 196,96 172,106',
            fill: '#cc785c',
            stroke: '#fde68a',
            strokeWidth: 1,
          }),
          createElement('polygon', {
            points: '172,106 190,114 190,130 172,122',
            fill: '#9a4e34',
            stroke: '#fde68a',
            strokeWidth: 0.8,
          }),
          createElement('polygon', {
            points: '214,104 190,114 190,130 214,120',
            fill: '#783924',
            stroke: '#fde68a',
            strokeWidth: 0.8,
          }),
          // Golden Ribbon Bow on Gift Box
          createElement('circle', { cx: 191, cy: 102, r: 3.5, fill: '#fde68a' }),
          createElement('circle', { cx: 196, cy: 102, r: 3.5, fill: '#f5b942' }),
        )
      : null,
  );
}

/**
 * Option-A Curved 3D Golden Ribbon Bridges with Circular `(24)` Medallions and Sparkling Particles
 */
function Golden24HourRibbonBridgesSvg({ timerRunning }: { timerRunning: boolean }) {
  if (Platform.OS !== 'web') return null;

  return createElement(
    'svg',
    {
      viewBox: '0 0 1000 250',
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
        { id: 'optARibbonGrad', x1: '0', y1: '0', x2: '1', y2: '0' },
        createElement('stop', { offset: '0%', stopColor: '#d97706', stopOpacity: '0.9' }),
        createElement('stop', { offset: '50%', stopColor: '#fde68a', stopOpacity: '1' }),
        createElement('stop', { offset: '100%', stopColor: '#34d399', stopOpacity: '0.9' }),
      ),
      createElement(
        'linearGradient',
        { id: 'optARibbonGrad2', x1: '0', y1: '0', x2: '1', y2: '0' },
        createElement('stop', { offset: '0%', stopColor: '#34d399', stopOpacity: '0.9' }),
        createElement('stop', { offset: '50%', stopColor: '#fde68a', stopOpacity: '1' }),
        createElement('stop', { offset: '100%', stopColor: '#f5b942', stopOpacity: '0.95' }),
      ),
    ),
    // Bridge 1 (Focus Loft -> Vitality Island)
    createElement('path', {
      d: 'M 250 175 C 315 218, 375 218, 440 175',
      fill: 'none',
      stroke: 'rgba(245, 185, 66, 0.22)',
      strokeWidth: 12,
      strokeLinecap: 'round',
    }),
    createElement('path', {
      d: 'M 250 175 C 315 218, 375 218, 440 175',
      fill: 'none',
      stroke: 'url(#optARibbonGrad)',
      strokeWidth: 4,
      strokeDasharray: timerRunning ? '6 6' : '10 6',
    }),
    // Medallion (24) #1
    createElement('circle', {
      cx: 345,
      cy: 204,
      r: 14,
      fill: '#292014',
      stroke: '#f5b942',
      strokeWidth: 2,
    }),
    createElement(
      'text',
      {
        x: 345,
        y: 208,
        textAnchor: 'middle',
        fill: '#fde68a',
        fontSize: '10.5',
        fontWeight: '700',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      '24',
    ),

    // Bridge 2 (Vitality Island -> Wish Astrolabe Pavilion)
    createElement('path', {
      d: 'M 560 175 C 625 218, 685 218, 750 175',
      fill: 'none',
      stroke: 'rgba(245, 185, 66, 0.22)',
      strokeWidth: 12,
      strokeLinecap: 'round',
    }),
    createElement('path', {
      d: 'M 560 175 C 625 218, 685 218, 750 175',
      fill: 'none',
      stroke: 'url(#optARibbonGrad2)',
      strokeWidth: 4,
      strokeDasharray: '10 6',
    }),
    // Medallion (24) #2
    createElement('circle', {
      cx: 655,
      cy: 204,
      r: 14,
      fill: '#292014',
      stroke: '#f5b942',
      strokeWidth: 2,
    }),
    createElement(
      'text',
      {
        x: 655,
        y: 208,
        textAnchor: 'middle',
        fill: '#fde68a',
        fontSize: '10.5',
        fontWeight: '700',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      '24',
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

  // Flatten top 4 Key Results across objectives for the Option-A 2x2 OKR Progress Bento
  const flattenedKrs = objectives
    .flatMap((obj) =>
      obj.keyResults.map((kr) => ({
        objectiveId: obj.id,
        objectiveTitle: obj.title,
        kr,
        pct: computeKrProgressPct(kr),
      })),
    )
    .slice(0, 4);

  // Build Option-A 365-day style Heatmap Grid (140 cells = 20 columns x 7 rows for compact crispness)
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
    totalDays: 140,
    weightDays: weightDaysSet,
    trainingCountByDay: new Map([[localDay, trainingSetsCount]]),
    studyMinutesByDay,
    habitCountByDay,
  });

  function optionAHeatCellColor(cell: HeatmapCell, idx: number): string {
    if (cell.level === 4) return '#34d399'; // Emerald high
    if (cell.level === 3) return '#10b981'; // Emerald mid
    if (cell.level === 2) return '#eab308'; // Molten gold
    if (cell.level === 1) return '#cc785c'; // Terracotta
    // Subtle deterministic warm pattern for historical visual texture when unlogged, while keeping real score inspectable
    const ring = (idx * 7 + 3) % 11;
    if (ring === 0) return 'rgba(52, 211, 153, 0.28)';
    if (ring === 3) return 'rgba(234, 179, 8, 0.24)';
    if (ring === 6) return 'rgba(204, 120, 92, 0.24)';
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

  // Build Option-A Time-Block Matrix visual blocks (combining real blocks + default structured slots)
  const displayMatrixBlocks =
    todayBlocks.length > 0
      ? todayBlocks.slice(-5).map((b, idx) => ({
          id: b.id,
          title: b.title,
          timeRange: `${formatMinuteOfDay(b.startMinute)} – ${formatMinuteOfDay(b.endMinute)}`,
          durationText: `${b.durationMinutes} min`,
          tone:
            b.category === 'fitness'
              ? ('emerald' as const)
              : idx % 2 === 0
                ? ('terracotta' as const)
                : ('golden' as const),
        }))
      : [
          {
            id: 'slot-morning',
            title: '晨间唤醒 · 空腹晨重与日计划校准',
            timeRange: '08:00 – 09:00',
            durationText: latestWeightKg ? `已记 ${latestWeightKg.toFixed(1)} kg` : '待称重打卡',
            tone: 'terracotta' as const,
          },
          {
            id: 'slot-deepwork',
            title: '核心心流 · 10,000 小时深度架构/学习',
            timeRange: '09:30 – 12:00',
            durationText: studyMinutes > 0 ? `今日已记 ${studyMinutes}m` : '点击右侧 + 切入时间块',
            tone: 'golden' as const,
          },
          {
            id: 'slot-workout',
            title: '晚间活力 · 力量训练与有氧代谢',
            timeRange: '18:30 – 20:00',
            durationText: trainingSetsCount > 0 ? `已完成 ${trainingSetsCount} 组` : 'Keep / BLE 同步就绪',
            tone: 'emerald' as const,
          },
        ];

  const currentClockStr = (() => {
    const dt = new Date(nowMs);
    return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  })();

  return (
    <View style={styles.stageCard}>
      {/* Top Bar: Option-A Walnut & Obsidian Header */}
      <View style={styles.studioTopbar}>
        <View style={styles.topbarLeft}>
          <View style={styles.brandDot} />
          <Text variant="label" style={styles.studioTitle}>
            星途 · 2.5D 个人时间与心愿沙盘
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
          {/* Upper Stage: 3 Floating 2.5D Isometric Islands + Floating Glass HUD Badges + Golden 24H Ribbon Bridges */}
          <View style={styles.stageGridBg}>
            <Golden24HourRibbonBridgesSvg timerRunning={timer.isRunning} />

            <View style={styles.isoCanvas}>
              {/* Island 1: 心流书房 (Walnut Study Desk + 10,000h Badge) */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="心流书房与一万小时精进"
                onPress={() => setSelectedZone('focus')}
                style={[
                  styles.isoNodeColumn,
                  selectedZone === 'focus' ? styles.isoNodeSelected : null,
                ]}
              >
                <View
                  style={[
                    styles.floatingGlassHud,
                    selectedZone === 'focus' ? styles.hudFocusActive : null,
                  ]}
                >
                  <View style={styles.hudTitleRow}>
                    <Text variant="label" style={styles.hudTitleText}>
                      心流书房
                    </Text>
                    <View style={[styles.hudRingDot, { borderColor: '#f5b942' }]} />
                  </View>
                  <Text variant="caption" style={styles.hudMetricText}>
                    {timer.isRunning
                      ? `⏱ 正在专注 ${formatTimerClock(timerElapsedSeconds)}`
                      : `· ${Math.round(totalMasteryHours).toLocaleString('en-US')} / 10,000h`}
                  </Text>
                  <Text variant="caption" style={styles.hudSubText}>
                    {`· 今日已切入 ${trackedMinsToday} 分钟时间块`}
                  </Text>
                </View>

                <IsometricLifeZoneSvg
                  zone="focus"
                  active={selectedZone === 'focus'}
                  weightText={latestWeightKg ? latestWeightKg.toFixed(1) : '72.4'}
                  masteryHoursText={`${Math.round(totalMasteryHours)}h`}
                />
              </Pressable>

              {/* Island 2: 活力体态 (Yoga Mat + Dumbbells + Smart Scale) */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="活力体态与蓝牙体脂秤"
                onPress={() => setSelectedZone('vitality')}
                style={[
                  styles.isoNodeColumn,
                  selectedZone === 'vitality' ? styles.isoNodeSelected : null,
                ]}
              >
                <View
                  style={[
                    styles.floatingGlassHud,
                    selectedZone === 'vitality' ? styles.hudVitalityActive : null,
                  ]}
                >
                  <View style={styles.hudTitleRow}>
                    <Text variant="label" style={styles.hudTitleText}>
                      活力体态
                    </Text>
                    <Text variant="caption" style={{ color: '#34d399', fontSize: 11 }}>
                      ↻
                    </Text>
                  </View>
                  <Text variant="caption" style={styles.hudMetricText}>
                    {`· ${latestWeightKg ? `${latestWeightKg.toFixed(1)} kg` : '待称重'} · 近7日 ${activeWeightDays}/7`}
                  </Text>
                  <Text variant="caption" style={styles.hudSubText}>
                    {trainingSetsCount > 0
                      ? `· 今日已训练 ${trainingSetsCount} 组 (${Math.round(trainingVolumeKg)} kg)`
                      : '· BLE 体脂秤与运动手环就绪'}
                  </Text>
                </View>

                <IsometricLifeZoneSvg
                  zone="vitality"
                  active={selectedZone === 'vitality'}
                  weightText={latestWeightKg ? latestWeightKg.toFixed(1) : '72.4'}
                  masteryHoursText={`${Math.round(totalMasteryHours)}h`}
                />
              </Pressable>

              {/* Island 3: 星愿纪念台 (3D Golden Astrolabe + Anniversary Gift Box) */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="星愿纪念台与心愿金库"
                onPress={() => setSelectedZone('wishes')}
                style={[
                  styles.isoNodeColumn,
                  selectedZone === 'wishes' ? styles.isoNodeSelected : null,
                ]}
              >
                <View
                  style={[
                    styles.floatingGlassHud,
                    selectedZone === 'wishes' ? styles.hudWishesActive : null,
                  ]}
                >
                  <View style={styles.hudTitleRow}>
                    <Text variant="label" style={styles.hudTitleText}>
                      星愿纪念台
                    </Text>
                    <Text variant="caption" style={{ color: '#f5b942', fontSize: 11 }}>
                      ✦
                    </Text>
                  </View>
                  <Text variant="caption" style={styles.hudMetricText}>
                    {nearestMs
                      ? `· ${nearestMs.item.title} (${nearestMs.badgeText})`
                      : `· 季度 OKR 进度 ${avgOkrPct}%`}
                  </Text>
                  <Text variant="caption" style={styles.hudSubText}>
                    {`· 心愿金库 ¥${vault.wishBalanceCny.toLocaleString('en-US')} · 习惯 ${habitsDoneToday}/${habits.length}`}
                  </Text>
                </View>

                <IsometricLifeZoneSvg
                  zone="wishes"
                  active={selectedZone === 'wishes'}
                  weightText={latestWeightKg ? latestWeightKg.toFixed(1) : '72.4'}
                  masteryHoursText={`${Math.round(totalMasteryHours)}h`}
                />
              </Pressable>
            </View>
          </View>

          {/* Lower Stage: Option-A Split Bento Workspace (Left: 24H Time-Block Matrix | Right: OKR Progress + 365-Day Heatmap) */}
          <View style={styles.bentoSplitRow}>
            {/* Left Bento Card: 24H 时间块矩阵 (Time-Block Matrix) */}
            <View style={styles.bentoLeftCard}>
              <View style={styles.bentoHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text variant="label" style={styles.bentoTitle}>
                    24H 时间块矩阵
                  </Text>
                  <View style={styles.nowBadge}>
                    <Text variant="caption" style={styles.nowBadgeText}>
                      {`Now ${currentClockStr}`}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={onQuickJournal} style={styles.addBlockPill}>
                  <Text variant="caption" style={styles.addBlockPillText}>
                    ＋ Add Block
                  </Text>
                </Pressable>
              </View>

              <View style={styles.matrixGridWrap}>
                {/* Subtle red 'Now' timeline indicator */}
                <View style={styles.nowRedLineRow}>
                  <Text variant="caption" style={styles.nowRedClock}>
                    {currentClockStr}
                  </Text>
                  <View style={styles.nowRedDot} />
                  <View style={styles.nowRedLine} />
                </View>

                <View style={styles.matrixColumnsWrap}>
                  {displayMatrixBlocks.map((blk) => {
                    const palette =
                      blk.tone === 'terracotta'
                        ? {
                            bg: 'rgba(204, 120, 92, 0.24)',
                            border: 'rgba(224, 138, 108, 0.68)',
                            titleColor: '#fde8e0',
                            subColor: '#f3bfa9',
                          }
                        : blk.tone === 'emerald'
                          ? {
                              bg: 'rgba(52, 211, 153, 0.20)',
                              border: 'rgba(52, 211, 153, 0.65)',
                              titleColor: '#d1fae5',
                              subColor: '#6ee7b7',
                            }
                          : {
                              bg: 'rgba(234, 179, 8, 0.20)',
                              border: 'rgba(245, 185, 66, 0.65)',
                              titleColor: '#fef3c7',
                              subColor: '#fde68a',
                            };
                    return (
                      <Pressable
                        key={blk.id}
                        onPress={() => {
                          if (blk.tone === 'emerald') onQuickTraining();
                          else onQuickStudy();
                        }}
                        style={[
                          styles.matrixBlockCard,
                          {
                            backgroundColor: palette.bg,
                            borderColor: palette.border,
                          },
                        ]}
                      >
                        <View style={styles.matrixBlockHead}>
                          <Text
                            variant="caption"
                            style={[styles.matrixBlockTitle, { color: palette.titleColor }]}
                            numberOfLines={1}
                          >
                            {blk.title}
                          </Text>
                          <Text
                            variant="caption"
                            style={[styles.matrixBlockMeta, { color: palette.subColor }]}
                          >
                            {blk.durationText}
                          </Text>
                        </View>
                        <Text
                          variant="caption"
                          style={[styles.matrixBlockTime, { color: palette.subColor }]}
                        >
                          {blk.timeRange}
                        </Text>
                      </Pressable>
                    );
                  })}
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
                  <Text variant="caption" style={{ color: '#a8a29e', fontSize: 11 }}>
                    {`总进度 ${avgOkrPct}% · 点击卡片直接打卡推进`}
                  </Text>
                </View>

                <View style={styles.okrMiniGrid}>
                  {flattenedKrs.map((item, idx) => {
                    const isEmerald = idx % 2 === 1;
                    const barColor = isEmerald ? '#34d399' : '#f5b942';
                    const cardBg = isEmerald
                      ? 'rgba(16, 42, 33, 0.55)'
                      : 'rgba(46, 35, 22, 0.55)';
                    const cardBorder = isEmerald
                      ? 'rgba(52, 211, 153, 0.28)'
                      : 'rgba(245, 185, 66, 0.28)';
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
                                width: `${Math.max(8, item.pct)}%`,
                                backgroundColor: barColor,
                              },
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
                  <Text variant="caption" style={{ color: '#a8a29e', fontSize: 10.5 }}>
                    {selectedHeatmapCell
                      ? `${selectedHeatmapCell.localDay} · 热力 Lv.${selectedHeatmapCell.level}/4 · 专注 ${selectedHeatmapCell.studyMinutes}m`
                      : `活跃 ${heatmap.activeDaysCount} 天 · 点击色块检视`}
                  </Text>
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
                  <Text variant="caption" style={{ color: '#78716c', fontSize: 10 }}>
                    365 day habit &amp; focus matrix
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {['#23262e', '#cc785c', '#eab308', '#10b981', '#34d399'].map((c) => (
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
    minHeight: 235,
    backgroundColor: '#121110',
  },
  isoCanvas: {
    position: 'relative',
    zIndex: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 12,
  },
  isoNodeColumn: {
    flex: 1,
    minWidth: 245,
    maxWidth: 315,
    alignItems: 'center',
    gap: 2,
  },
  isoNodeSelected: {
    transform: [{ translateY: -3 }],
  },
  floatingGlassHud: {
    width: '92%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: 'rgba(34, 32, 30, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.14)',
    gap: 2,
  },
  hudFocusActive: {
    borderColor: '#e8924a',
  },
  hudVitalityActive: {
    borderColor: '#34d399',
  },
  hudWishesActive: {
    borderColor: '#f5b942',
  },
  hudTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hudTitleText: {
    color: '#f5f5f4',
    fontSize: 13,
    fontWeight: '700',
  },
  hudRingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  hudMetricText: {
    color: '#e7e5e4',
    fontSize: 11.5,
    fontWeight: '600',
  },
  hudSubText: {
    color: '#a8a29e',
    fontSize: 10.5,
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
    flex: 1.15,
    minWidth: 300,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.10)',
    backgroundColor: '#181716',
    padding: 12,
    gap: 10,
  },
  bentoRightStack: {
    flex: 1,
    minWidth: 290,
    gap: 12,
  },
  bentoRightCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.10)',
    backgroundColor: '#181716',
    padding: 12,
    gap: 9,
  },
  bentoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  bentoTitle: {
    color: '#f5f5f4',
    fontSize: 13,
    fontWeight: '700',
  },
  nowBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 248, 235, 0.08)',
  },
  nowBadgeText: {
    color: '#e7e5e4',
    fontSize: 10,
    fontFamily: theme.fontFamily.mono,
  },
  addBlockPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#272523',
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 235, 0.14)',
  },
  addBlockPillText: {
    color: '#e7e5e4',
    fontSize: 11,
    fontWeight: '600',
  },
  matrixGridWrap: {
    gap: 8,
  },
  nowRedLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nowRedClock: {
    color: '#ef4444',
    fontSize: 10,
    fontFamily: theme.fontFamily.mono,
    fontWeight: '700',
  },
  nowRedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  nowRedLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.55)',
  },
  matrixColumnsWrap: {
    gap: 7,
  },
  matrixBlockCard: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
  },
  matrixBlockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  matrixBlockTitle: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  matrixBlockMeta: {
    fontSize: 10.5,
    fontFamily: theme.fontFamily.mono,
  },
  matrixBlockTime: {
    fontSize: 10.5,
    fontFamily: theme.fontFamily.mono,
  },
  okrMiniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  okrMiniCard: {
    flex: 1,
    minWidth: 135,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    gap: 6,
  },
  okrMiniTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  okrMiniLabel: {
    color: '#e7e5e4',
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
    overflow: 'hidden',
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
    width: 11,
    height: 11,
    borderRadius: 2.5,
  },
  miniHeatmapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  legendDot: {
    width: 8,
    height: 8,
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
