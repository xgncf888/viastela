import { createElement, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';

import {
  type AiAnimationKind,
  CATALOG_CHAPTER_PACKS,
  computeAttentionSimulation,
  computeFlashAttentionSimulation,
  computeKnowledgeGraphStats,
  computePagedAttentionSimulation,
  computeSpeculativeDecodingSimulation,
  computeStudioUnlockables,
  exportChapterPackJson,
  importCustomMarkdownKnowledgeNode,
  installKnowledgeChapterPack,
  KNOWLEDGE_DOMAINS,
  type KnowledgeDomainId,
  type KnowledgeGraphState,
  offloadKnowledgeChapterPack,
  readKnowledgeGraphState,
  updateKnowledgeNodeProgress,
} from '@/core/knowledge-graph-corner';
import { readBookkeepingState } from '@/data/bookkeeping';
import { recordPledgeReward } from '@/data/life-gamification';

import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { showToast } from './toast';
import { useI18n } from './use-i18n';

/**
 * Interactive Animated AI Learning Lab (AI 交互式动画教学沙盘)
 * Supports Play/Pause auto-stepping, interactive token/block clicking, and parameter sliders!
 */
function AiInteractiveAnimationLab({
  kind,
  isDark,
}: {
  kind: AiAnimationKind;
  isDark: boolean;
}) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(true);
  const [tick, setTick] = useState(0);

  // Interactive parameters per lab
  const [focusTokenIdx, setFocusTokenIdx] = useState(5); // 'AI'
  const [attnStepIdx, setAttnStepIdx] = useState(2);
  const [temperature, setTemperature] = useState(0.8);

  const [pagedTokenCount, setPagedTokenCount] = useState(10);
  const [sharedPrefix, setSharedPrefix] = useState(true);

  const [specGamma, setSpecGamma] = useState(4);
  const [specPhase, setSpecPhase] = useState(0);

  const [flashTileIdx, setFlashTileIdx] = useState(1);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
      if (kind === 'self-attention') {
        setAttnStepIdx((prev) => (prev + 1) % 4);
      } else if (kind === 'paged-attention') {
        setPagedTokenCount((prev) => (prev >= 16 ? 5 : prev + 1));
      } else if (kind === 'speculative-decoding') {
        setSpecPhase((prev) => prev + 1);
      } else if (kind === 'flash-attention') {
        setFlashTileIdx((prev) => (prev + 1) % 4);
      }
    }, 1800);
    return () => clearInterval(timer);
  }, [playing, kind]);

  const boxBg = isDark ? '#141210' : '#f8f5ec';
  const borderCol = isDark ? 'rgba(245, 185, 66, 0.35)' : 'rgba(184, 130, 40, 0.35)';
  const ink = isDark ? '#f8fafc' : '#26241f';
  const sub = isDark ? '#cbd5e1' : '#524e46';
  const gold = isDark ? '#fde68a' : '#92560c';
  const emerald = isDark ? '#34d399' : '#1f5e4b';
  const sky = isDark ? '#38bdf8' : '#0284c7';

  if (kind === 'self-attention') {
    const sim = computeAttentionSimulation({
      focusTokenIdx,
      stepIdx: attnStepIdx,
      temperature,
    });
    return (
      <View style={[styles.animContainer, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.animHeader}>
          <Text variant="caption" style={{ color: gold, fontSize: 11, fontWeight: '700' }}>
            {t('✦ AI 交互式动画实验室 · Self-Attention 动态热力连线', '✦ Interactive Animation · Self-Attention Heatmap')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={playing ? '暂停教学动画' : '播放教学动画'}
              onPress={() => setPlaying((p) => !p)}
              style={[styles.microBtn, { backgroundColor: playing ? 'rgba(52,211,153,0.18)' : 'rgba(245,185,66,0.18)', borderColor: playing ? emerald : gold }]}
            >
              <Text variant="caption" style={{ color: playing ? emerald : gold, fontSize: 9.5, fontWeight: '700' }}>
                {playing ? t('⏸ 动画自动演进中', '⏸ Playing') : t('▶ 自动播放动画', '▶ Auto Play')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="单步推进 Self-Attention 教学阶段"
              onPress={() => {
                setPlaying(false);
                setAttnStepIdx((p) => (p + 1) % 4);
              }}
              style={[styles.microBtn, { borderColor: borderCol }]}
            >
              <Text variant="caption" style={{ color: ink, fontSize: 9.5 }}>
                {t('下一步 ▶|', 'Step ▶|')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Interactive Controls: Click any token as Query, or adjust Softmax Temperature */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <Text variant="caption" style={{ color: sub, fontSize: 10 }}>
              {t('点选 Query 发起词:', 'Tap Query Token:')}
            </Text>
            {sim.tokens.map((tok, idx) => {
              const active = idx === sim.focusTokenIdx;
              return (
                <Pressable
                  key={tok}
                  onPress={() => setFocusTokenIdx(idx)}
                  style={[
                    styles.microBtn,
                    {
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      backgroundColor: active ? 'rgba(245, 185, 66, 0.24)' : 'transparent',
                      borderColor: active ? '#f5b942' : borderCol,
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: active ? gold : ink, fontSize: 10.5, fontWeight: '700' }}>
                    {tok}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text variant="caption" style={{ color: sub, fontSize: 10 }}>
              {`温度 τ=${temperature.toFixed(1)}`}
            </Text>
            {[0.4, 0.8, 1.6].map((tVal) => (
              <Pressable
                key={String(tVal)}
                onPress={() => setTemperature(tVal)}
                style={[
                  styles.microBtn,
                  {
                    paddingHorizontal: 6,
                    paddingVertical: 1.5,
                    backgroundColor: Math.abs(temperature - tVal) < 0.05 ? 'rgba(56,189,248,0.22)' : 'transparent',
                    borderColor: Math.abs(temperature - tVal) < 0.05 ? sky : borderCol,
                  },
                ]}
              >
                <Text variant="caption" style={{ color: sky, fontSize: 9.5, fontFamily: theme.fontFamily.mono }}>
                  {tVal === 0.4 ? '0.4尖锐' : tVal === 0.8 ? '0.8均衡' : '1.6平滑'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Animated SVG Attention Arcs & Softmax Bars */}
        {Platform.OS === 'web'
          ? createElement(
              'svg',
              { width: '100%', height: 128, viewBox: '0 0 520 128' },
              // Attention Curved Beams from focusTokenIdx to all Key tokens
              sim.tokens.map((tok, idx) => {
                const xFrom = 48 + sim.focusTokenIdx * 84;
                const xTo = 48 + idx * 84;
                const weight = sim.weightsPct[idx] ?? 10;
                const strokeW = Math.max(1, (weight / 100) * 10);
                const opacity = Math.max(0.18, weight / 100);
                return createElement(
                  'g',
                  { key: `arc-${idx}` },
                  createElement('path', {
                    d: `M ${xFrom} 32 Q ${(xFrom + xTo) / 2} ${72 + Math.abs(idx - sim.focusTokenIdx) * 6} ${xTo} 86`,
                    fill: 'none',
                    stroke: idx === sim.focusTokenIdx ? '#34d399' : '#f5b942',
                    strokeWidth: strokeW,
                    strokeOpacity: opacity,
                    strokeDasharray: sim.stepIdx === 1 ? '4 3' : undefined,
                  }),
                  // Top Query Token Box
                  createElement('rect', {
                    x: xTo - 22,
                    y: 8,
                    width: 44,
                    height: 22,
                    rx: 5,
                    fill: idx === sim.focusTokenIdx ? '#f5b942' : isDark ? '#27272a' : '#e7e2d6',
                  }),
                  createElement(
                    'text',
                    {
                      x: xTo,
                      y: 23,
                      textAnchor: 'middle',
                      fill: idx === sim.focusTokenIdx ? '#18181b' : ink,
                      fontSize: '11',
                      fontWeight: '700',
                    },
                    `${tok}${idx === sim.focusTokenIdx ? '(Q)' : ''}`,
                  ),
                  // Bottom Key/Value Probability Bar
                  createElement('rect', {
                    x: xTo - 22,
                    y: 88,
                    width: 44,
                    height: 18,
                    rx: 4,
                    fill: isDark ? '#1f2937' : '#e2e8f0',
                  }),
                  createElement('rect', {
                    x: xTo - 22,
                    y: 88,
                    width: Math.max(4, (44 * weight) / 100),
                    height: 18,
                    rx: 4,
                    fill: weight >= 25 ? '#34d399' : '#38bdf8',
                  }),
                  createElement(
                    'text',
                    {
                      x: xTo,
                      y: 101,
                      textAnchor: 'middle',
                      fill: '#ffffff',
                      fontSize: '9.5',
                      fontWeight: '700',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    },
                    `${weight}%`,
                  ),
                  createElement(
                    'text',
                    {
                      x: xTo,
                      y: 120,
                      textAnchor: 'middle',
                      fill: sub,
                      fontSize: '9.5',
                    },
                    `K/V:${tok}`,
                  ),
                );
              }),
            )
          : null}

        <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
          <Text variant="caption" style={{ color: gold, fontSize: 10.5, fontWeight: '700' }}>
            {sim.stepTitleZh}
          </Text>
          <Text variant="caption" style={{ color: sub, fontSize: 10 }}>
            {sim.stepDescZh}
          </Text>
        </View>
      </View>
    );
  }

  if (kind === 'paged-attention') {
    const sim = computePagedAttentionSimulation({
      tokenCount: pagedTokenCount,
      sharedPrefixEnabled: sharedPrefix,
    });
    return (
      <View style={[styles.animContainer, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.animHeader}>
          <Text variant="caption" style={{ color: gold, fontSize: 11, fontWeight: '700' }}>
            {t('✦ AI 交互式动画实验室 · vLLM PagedAttention 显存分页映射', '✦ Interactive Animation · PagedAttention')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap' }}>
            <Pressable
              onPress={() => setPlaying((p) => !p)}
              style={[styles.microBtn, { borderColor: playing ? emerald : gold }]}
            >
              <Text variant="caption" style={{ color: playing ? emerald : gold, fontSize: 9.5, fontWeight: '700' }}>
                {playing ? t('⏸ 自动生成中', '⏸ Auto Generating') : t('▶ 自动生成 Token', '▶ Auto')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="手动生成下一个Token观察分页分配"
              onPress={() => {
                setPlaying(false);
                setPagedTokenCount((c) => (c >= 16 ? 4 : c + 1));
              }}
              style={[styles.microBtn, { borderColor: borderCol }]}
            >
              <Text variant="caption" style={{ color: ink, fontSize: 9.5, fontWeight: '700' }}>
                {t('＋ 生成 1 个 Token', '＋ Next Token')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSharedPrefix((p) => !p)}
              style={[styles.microBtn, { borderColor: sharedPrefix ? emerald : borderCol }]}
            >
              <Text variant="caption" style={{ color: sharedPrefix ? emerald : sub, fontSize: 9.5 }}>
                {sharedPrefix ? t('✓ CoW 前缀共享开启', '✓ CoW Shared') : t('○ 开启 CoW 共享', '○ CoW Off')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Visual Block Table Mapping */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {sim.logicalBlocks.map((blk) => (
            <View
              key={blk.logicalIndex}
              style={{
                flex: 1,
                minWidth: 118,
                padding: 7,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: blk.isSharedCoW ? emerald : sky,
                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                gap: 4,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="caption" style={{ color: sky, fontSize: 9.5, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
                  {`逻辑页 L${blk.logicalIndex} → 物理框 P#${blk.physicalBlockId}`}
                </Text>
                {blk.isSharedCoW ? (
                  <Text variant="caption" style={{ color: emerald, fontSize: 9, fontWeight: '700' }}>
                    RefCnt=2
                  </Text>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 3 }}>
                {[0, 1, 2, 3].map((slotIdx) => {
                  const tok = blk.tokens[slotIdx];
                  return (
                    <View
                      key={slotIdx}
                      style={{
                        flex: 1,
                        height: 22,
                        borderRadius: 4,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: tok
                          ? blk.isSharedCoW
                            ? 'rgba(52,211,153,0.22)'
                            : 'rgba(245,185,66,0.22)'
                          : 'rgba(148,163,184,0.12)',
                        borderWidth: 1,
                        borderColor: tok ? '#f5b942' : borderCol,
                      }}
                    >
                      <Text variant="caption" style={{ color: tok ? ink : sub, fontSize: 8.5, fontWeight: '600' }}>
                        {tok ?? '空'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
          <Text variant="caption" style={{ color: emerald, fontSize: 10.5, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
            {`显存节省对比：传统连续预分配浪费 ${sim.traditionalWastePct}% vs PagedAttention 仅 ${sim.pagedWastePct}%（节省 +${sim.savedVramPct}% 显存）`}
          </Text>
          <Text variant="caption" style={{ color: sub, fontSize: 10 }}>
            {sim.summaryZh}
          </Text>
        </View>
      </View>
    );
  }

  if (kind === 'speculative-decoding') {
    const sim = computeSpeculativeDecodingSimulation({
      gamma: specGamma,
      verifyPhase: specPhase + tick,
    });
    return (
      <View style={[styles.animContainer, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.animHeader}>
          <Text variant="caption" style={{ color: gold, fontSize: 11, fontWeight: '700' }}>
            {t('✦ AI 交互式动画实验室 · 投机采样 (Speculative Decoding) 双模型验证', '✦ Speculative Decoding Animation')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {[3, 4, 5].map((gVal) => (
              <Pressable
                key={gVal}
                onPress={() => setSpecGamma(gVal)}
                style={[
                  styles.microBtn,
                  {
                    borderColor: specGamma === gVal ? gold : borderCol,
                    backgroundColor: specGamma === gVal ? 'rgba(245,185,66,0.18)' : 'transparent',
                  },
                ]}
              >
                <Text variant="caption" style={{ color: gold, fontSize: 9.5, fontFamily: theme.fontFamily.mono }}>
                  {`快猜 γ=${gVal}`}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setSpecPhase((p) => p + 1)}
              style={[styles.microBtn, { borderColor: emerald }]}
            >
              <Text variant="caption" style={{ color: emerald, fontSize: 9.5, fontWeight: '700' }}>
                {t('切换全部命中/中途修正 ▶', 'Toggle Hit/Reject ▶')}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {sim.candidates.map((cand, idx) => {
            const cColor =
              cand.status === 'accepted'
                ? emerald
                : cand.status === 'bonus'
                  ? sky
                  : '#f59e0b';
            return (
              <View
                key={idx}
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: cColor,
                  backgroundColor: `${cColor}18`,
                }}
              >
                <Text variant="caption" style={{ color: cColor, fontSize: 10.5, fontWeight: '700' }}>
                  {`${cand.status === 'accepted' ? '✓ 通过' : cand.status === 'bonus' ? '★ 奖励' : '↻ 修正'} · ${cand.token}`}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
          <Text variant="caption" style={{ color: gold, fontSize: 10.5, fontWeight: '700' }}>
            {`大模型 1 次前向并行验证产出 ${sim.acceptedCount} 个 Token · 等效吞吐提速 ${sim.effectiveSpeedup}x`}
          </Text>
          <Text variant="caption" style={{ color: sub, fontSize: 10 }}>
            {sim.stepDescZh}
          </Text>
        </View>
      </View>
    );
  }

  // FlashAttention Tiling Animation
  const flashSim = computeFlashAttentionSimulation({ activeTileIdx: flashTileIdx });
  return (
    <View style={[styles.animContainer, { backgroundColor: boxBg, borderColor: borderCol }]}>
      <View style={styles.animHeader}>
        <Text variant="caption" style={{ color: gold, fontSize: 11, fontWeight: '700' }}>
          {t('✦ AI 交互式动画实验室 · FlashAttention HBM ⇄ SRAM 分块流水线', '✦ FlashAttention Tiling Animation')}
        </Text>
        <Pressable
          onPress={() => setFlashTileIdx((p) => (p + 1) % 4)}
          style={[styles.microBtn, { borderColor: gold }]}
        >
          <Text variant="caption" style={{ color: gold, fontSize: 9.5, fontWeight: '700' }}>
            {t(`推进至下一个 SRAM 分块 (${flashSim.activeTileIdx + 1}/4) ▶`, 'Next Tile ▶')}
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {[0, 1, 2, 3].map((tIdx) => {
          const isCurrent = tIdx === flashSim.activeTileIdx;
          const isDone = tIdx < flashSim.activeTileIdx;
          return (
            <Pressable
              key={tIdx}
              onPress={() => setFlashTileIdx(tIdx)}
              style={{
                flex: 1,
                minWidth: 95,
                padding: 7,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: isCurrent ? gold : isDone ? emerald : borderCol,
                backgroundColor: isCurrent ? 'rgba(245,185,66,0.20)' : isDone ? 'rgba(52,211,153,0.12)' : 'transparent',
              }}
            >
              <Text variant="caption" style={{ color: isCurrent ? gold : isDone ? emerald : sub, fontSize: 10, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
                {`KV Tile #${tIdx + 1} ${isCurrent ? '⚡SRAM计算中' : isDone ? '✓已归约' : '待加载'}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
        <Text variant="caption" style={{ color: emerald, fontSize: 10.5, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
          {`HBM 显存读写对比：标准 Attention ${flashSim.standardHbmReadsMb} MB vs FlashAttention 仅 ${flashSim.flashHbmReadsMb} MB（减少 ${flashSim.ioReductionFactor} 倍访存）`}
        </Text>
        <Text variant="caption" style={{ color: sub, fontSize: 10 }}>
          {flashSim.stepDescZh}
        </Text>
      </View>
    </View>
  );
}

/**
 * Interactive SVG Knowledge Graph DAG + Bidirectional Link Canvas
 */
function KnowledgeGraphSvgCanvas({
  state,
  selectedNodeId,
  onSelectNode,
  isDark,
}: {
  state: KnowledgeGraphState;
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
  isDark: boolean;
}) {
  if (Platform.OS !== 'web') return null;

  const width = 560;
  const height = 188;
  const toX = (pct: number) => 28 + (pct / 100) * (width - 56);
  const toY = (pct: number) => 24 + (pct / 100) * (height - 48);

  const nodeMap = new Map(state.nodes.map((n) => [n.id, n]));

  return createElement(
    'svg',
    {
      width: '100%',
      height,
      viewBox: `0 0 ${width} ${height}`,
      style: { overflow: 'visible' },
    },
    state.nodes.flatMap((node) =>
      node.bidirectionalLinks.map((targetId) => {
        const target = nodeMap.get(targetId);
        if (!target || node.id > target.id) return null;
        return createElement('line', {
          key: `bi-${node.id}-${target.id}`,
          x1: toX(node.x),
          y1: toY(node.y),
          x2: toX(target.x),
          y2: toY(target.y),
          stroke: isDark ? 'rgba(245, 185, 66, 0.24)' : 'rgba(184, 130, 40, 0.26)',
          strokeWidth: 1.2,
          strokeDasharray: '4 4',
        });
      }),
    ),
    state.nodes.flatMap((node) =>
      node.prerequisites.map((preId) => {
        const pre = nodeMap.get(preId);
        if (!pre) return null;
        const isUnlocked = pre.status === 'mastered';
        return createElement('line', {
          key: `pre-${pre.id}-${node.id}`,
          x1: toX(pre.x),
          y1: toY(pre.y),
          x2: toX(node.x),
          y2: toY(node.y),
          stroke: isUnlocked ? '#34d399' : isDark ? '#475569' : '#94a3b8',
          strokeWidth: 2.2,
        });
      }),
    ),
    state.nodes.map((node) => {
      const cx = toX(node.x);
      const cy = toY(node.y);
      const isSelected = node.id === selectedNodeId;
      const isCached = Boolean(state.offlineContents[node.id]);
      const statusColor =
        node.status === 'mastered'
          ? '#34d399'
          : node.status === 'learning'
            ? '#f5b942'
            : '#64748b';
      return createElement(
        'g',
        {
          key: node.id,
          style: { cursor: 'pointer' },
          onClick: () => onSelectNode(node.id),
        },
        isSelected
          ? createElement('circle', {
              cx,
              cy,
              r: 22,
              fill: `${statusColor}22`,
              stroke: statusColor,
              strokeWidth: 1.5,
              strokeDasharray: '3 2',
            })
          : null,
        createElement('circle', {
          cx,
          cy,
          r: 15,
          fill: isDark ? '#18181b' : '#ffffff',
          stroke: statusColor,
          strokeWidth: isSelected ? 2.8 : 2,
        }),
        createElement(
          'text',
          {
            x: cx,
            y: cy + 3.5,
            textAnchor: 'middle',
            fill: statusColor,
            fontSize: '8.5',
            fontWeight: '700',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          },
          node.code,
        ),
        createElement(
          'text',
          {
            x: cx,
            y: cy + 28,
            textAnchor: 'middle',
            fill: isSelected ? (isDark ? '#fde68a' : '#92560c') : isDark ? '#e2e8f0' : '#334155',
            fontSize: '9.5',
            fontWeight: isSelected ? '700' : '500',
          },
          `${node.title.slice(0, 10)}${isCached ? ' ●' : ' ○'}`,
        ),
      );
    }),
  );
}

export function KnowledgeGraphCornerHub({
  localDay,
  totalStudyMinutesLive = 0,
  onLogStudyMinutes,
}: {
  localDay: string;
  totalStudyMinutesLive?: number;
  onLogStudyMinutes?: (title: string, mins: number) => void;
}) {
  const { scheme } = useTheme();
  const { t } = useI18n();
  const isDark = scheme === 'dark';

  const [kgState, setKgState] = useState<KnowledgeGraphState>(readKnowledgeGraphState);
  const [selectedDomain, setSelectedDomain] = useState<KnowledgeDomainId | 'all'>('ai-infra');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node-transformer');
  const [showPackManager, setShowPackManager] = useState(false);
  const [showAddNodeBox, setShowAddNodeBox] = useState(false);
  const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);

  const [customTitle, setCustomTitle] = useState('');
  const [customDomain, setCustomDomain] = useState<KnowledgeDomainId>('ai-infra');
  const [customMd, setCustomMd] = useState('');

  const bkState = readBookkeepingState();
  const stats = useMemo(() => computeKnowledgeGraphStats(kgState), [kgState]);
  const unlockables = useMemo(
    () =>
      computeStudioUnlockables({
        currentSavedCny: bkState.wealthPlan.currentSavedCny,
        totalStudyMinutes: Math.max(stats.totalStudyMinutes, totalStudyMinutesLive),
        teamStreakDays: bkState.coupleProfile.teamStreakDays,
        masteredNodesCount: stats.masteredCount,
      }),
    [bkState.wealthPlan.currentSavedCny, bkState.coupleProfile.teamStreakDays, stats.totalStudyMinutes, stats.masteredCount, totalStudyMinutesLive],
  );

  const selectedNode = useMemo(
    () => kgState.nodes.find((n) => n.id === selectedNodeId) ?? kgState.nodes[0]!,
    [kgState.nodes, selectedNodeId],
  );
  const selectedContent = kgState.offlineContents[selectedNode.id] ?? null;

  const pal = isDark
    ? {
        bg: '#141311',
        cardBg: '#191816',
        elevated: '#201e1b',
        border: 'rgba(255, 255, 255, 0.10)',
        goldBorder: 'rgba(245, 185, 66, 0.32)',
        ink: '#f8fafc',
        sub: '#cbd5e1',
        muted: '#94a3b8',
        gold: '#f5b942',
        goldText: '#fde68a',
        emerald: '#34d399',
        sky: '#38bdf8',
        pillBg: 'rgba(255, 255, 255, 0.06)',
        pillActiveBg: 'rgba(245, 185, 66, 0.16)',
        inputBg: '#0e0d0b',
      }
    : {
        bg: '#f7f4ec',
        cardBg: '#ffffff',
        elevated: '#faf8f2',
        border: 'rgba(38, 36, 31, 0.12)',
        goldBorder: 'rgba(184, 130, 40, 0.32)',
        ink: '#26241f',
        sub: '#524e46',
        muted: '#7a756c',
        gold: '#b88228',
        goldText: '#92560c',
        emerald: '#1f5e4b',
        sky: '#0284c7',
        pillBg: 'rgba(38, 36, 31, 0.05)',
        pillActiveBg: 'rgba(204, 120, 92, 0.14)',
        inputBg: '#f3efe6',
      };

  const visibleNodes = useMemo(
    () =>
      selectedDomain === 'all'
        ? kgState.nodes
        : kgState.nodes.filter((n) => n.domainId === selectedDomain),
    [kgState.nodes, selectedDomain],
  );

  async function handleExportPackFile(packId: string) {
    const json = exportChapterPackJson(packId);
    const filename = `${packId}.pack.json`;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast({ text: t(`✓ 已导出独立离线章节包文件 ${filename}`, `✓ Exported ${filename}`) });
        return;
      } catch {
        // Fallback below
      }
    }
    try {
      await Share.share({ title: filename, message: json });
    } catch {
      showToast({ text: t('导出未完成', 'Export failed'), tone: 'error' });
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: pal.bg, borderColor: pal.goldBorder }]}>
      {/* 1. Studio Level & Gear Unlockables Strip */}
      <View style={[styles.topStrip, { backgroundColor: pal.elevated, borderBottomColor: pal.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontWeight: '700' }}>
            {t('书房藏品与等级解锁（随净资产、双人连击与知识节点自动进化）', 'Studio Gear & Level Unlocks')}
          </Text>
          <Text variant="caption" style={{ color: pal.muted, fontSize: 10, fontFamily: theme.fontFamily.mono }}>
            {t(
              `已解锁 ${unlockables.filter((u) => u.unlocked).length}/${unlockables.length} 件微缩陈列`,
              `Unlocked ${unlockables.filter((u) => u.unlocked).length}/${unlockables.length}`,
            )}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {unlockables.map((item) => (
            <View
              key={item.id}
              style={[
                styles.gearBadge,
                {
                  backgroundColor: item.unlocked ? `${item.color}18` : pal.pillBg,
                  borderColor: item.unlocked ? item.color : pal.border,
                  opacity: item.unlocked ? 1 : 0.65,
                },
              ]}
            >
              <Text variant="caption" style={{ color: item.unlocked ? item.color : pal.muted, fontSize: 10.5, fontWeight: '700' }}>
                {`[${item.icon}] ${t(item.titleZh, item.titleEn)} ${item.unlocked ? '✓' : `${item.progressPct}%`}`}
              </Text>
              <Text variant="caption" style={{ color: pal.muted, fontSize: 9 }}>
                {item.requirementZh}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* 2. Knowledge Graph Header & On-Demand Offline Chapter Pack Controls */}
      <View style={[styles.headerRow, { borderBottomColor: pal.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <Text variant="label" style={{ color: pal.ink, fontSize: 13.5, fontWeight: '700' }}>
            {t('学习角 · AI 交互式动画与知识图谱', 'Study Corner · AI Interactive Lab & Knowledge Graph')}
          </Text>
          <View style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}>
            <Text variant="caption" style={{ color: pal.goldText, fontSize: 10, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
              {t(
                `主包骨架 4KB · 本地已缓存 ${stats.installedPacksCount}/${stats.totalCatalogPacksCount} 章节包 (${stats.cachedSizeKb} KB)`,
                `Index 4KB · Cached ${stats.installedPacksCount}/${stats.totalCatalogPacksCount} packs (${stats.cachedSizeKb} KB)`,
              )}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="查看离线章节包存储路径与管理下载卸载"
            onPress={() => setShowPackManager((prev) => !prev)}
            style={[
              styles.microBtn,
              {
                backgroundColor: showPackManager ? pal.pillActiveBg : pal.pillBg,
                borderColor: showPackManager ? pal.gold : pal.sky,
              },
            ]}
          >
            <Text variant="caption" style={{ color: showPackManager ? pal.goldText : pal.sky, fontSize: 10.5, fontWeight: '700' }}>
              {showPackManager ? t('收起存储与离线包 ▲', 'Close Packs ▲') : t('离线章节包与存储路径管理', 'Offline Packs & Storage')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="新建或导入支持双向链接的自定义知识图谱节点"
            onPress={() => setShowAddNodeBox((prev) => !prev)}
            style={[styles.microBtn, { backgroundColor: pal.pillBg, borderColor: pal.border }]}
          >
            <Text variant="caption" style={{ color: pal.ink, fontSize: 10.5, fontWeight: '600' }}>
              {showAddNodeBox ? t('收起新建', 'Close') : t('＋ 导入/新建 [[双链]] 节点', '＋ Add [[Wiki]] Node')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 3. On-Demand Offline Chapter Pack Manager & Storage Location Inspector */}
      {showPackManager ? (
        <View style={[styles.drawerBox, { backgroundColor: pal.elevated, borderBottomColor: pal.border }]}>
          <View style={[styles.contentBox, { backgroundColor: pal.cardBg, borderColor: pal.goldBorder }]}>
            <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontWeight: '700' }}>
              {t('离线章节包存放在哪里？（双层本地存储机制）', 'Where are downloaded offline packs stored?')}
            </Text>
            <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5, fontFamily: theme.fontFamily.mono }}>
              {`1. 应用内秒开沙箱缓存：本机 localStorage / AsyncStorage 键名 ["${stats.storageKey}"]（当前占用 ${stats.cachedSizeKb} KB，支持一键卸载释放）`}
            </Text>
            <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5, fontFamily: theme.fontFamily.mono }}>
              {`2. 本地独立章节包目录：项目根目录下 knowledge-packs/*.pack.json（可随时导出为独立文件用编辑器查看或备份）`}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CATALOG_CHAPTER_PACKS.map((pack) => {
              const isInstalled = kgState.installedPackIds.includes(pack.id);
              return (
                <View
                  key={pack.id}
                  style={[
                    styles.packCard,
                    {
                      backgroundColor: pal.cardBg,
                      borderColor: isInstalled ? pal.emerald : pal.border,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text variant="caption" style={{ color: pal.ink, fontSize: 11.5, fontWeight: '700' }}>
                      {`[${pack.icon}] ${t(pack.titleZh, pack.titleEn)}`}
                    </Text>
                    <Text variant="caption" style={{ color: pal.muted, fontSize: 9.5, fontFamily: theme.fontFamily.mono }}>
                      {`${pack.version} · ${pack.sizeKb} KB`}
                    </Text>
                  </View>
                  <Text variant="caption" style={{ color: pal.muted, fontSize: 9.5, fontFamily: theme.fontFamily.mono }}>
                    {`文件: ${pack.localFilePath}`}
                  </Text>
                  <Text variant="caption" style={{ color: pal.sub, fontSize: 10 }}>
                    {pack.descriptionZh}
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, gap: 4, flexWrap: 'wrap' }}>
                    <Text
                      variant="caption"
                      style={{
                        color: isInstalled ? pal.emerald : pal.muted,
                        fontSize: 10,
                        fontWeight: '700',
                      }}
                    >
                      {isInstalled ? t('● 已缓存至本地沙箱', '● Cached Offline') : t('○ 未下载（仅骨架）', '○ Skeleton Only')}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <Pressable
                        onPress={() => void handleExportPackFile(pack.id)}
                        style={[styles.microBtn, { backgroundColor: pal.pillBg, borderColor: pal.border }]}
                      >
                        <Text variant="caption" style={{ color: pal.sub, fontSize: 9.5 }}>
                          {t('导出 .pack.json', 'Export File')}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={isInstalled ? `卸载章节包 ${pack.titleZh}` : `离线下载章节包 ${pack.titleZh}`}
                        onPress={() => {
                          if (isInstalled) {
                            setKgState(offloadKnowledgeChapterPack(pack.id));
                            showToast({
                              text: t(
                                `已卸载「${pack.titleZh}」正文缓存（释放 ${pack.sizeKb} KB，节点掌握进度已保留）`,
                                `Offloaded ${pack.titleEn} (${pack.sizeKb} KB freed)`,
                              ),
                            });
                          } else {
                            const { state: next } = installKnowledgeChapterPack(pack.id);
                            setKgState(next);
                            showToast({
                              text: t(
                                `✓ 已离线缓存「${pack.titleZh}」（${pack.sizeKb} KB），断网可随时运行交互动画与闪卡`,
                                `✓ Cached ${pack.titleEn} offline`,
                              ),
                            });
                          }
                        }}
                        style={[
                          styles.microBtn,
                          {
                            backgroundColor: isInstalled ? pal.pillBg : `${pal.emerald}20`,
                            borderColor: isInstalled ? pal.border : pal.emerald,
                          },
                        ]}
                      >
                        <Text
                          variant="caption"
                          style={{
                            color: isInstalled ? pal.sub : pal.emerald,
                            fontSize: 10,
                            fontWeight: '700',
                          }}
                        >
                          {isInstalled ? t('卸载释放空间', 'Offload') : t('⬇ 离线下载章节', '⬇ Download Pack')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* 4. Add Custom Markdown [[WikiLink]] Node Drawer */}
      {showAddNodeBox ? (
        <View style={[styles.drawerBox, { backgroundColor: pal.elevated, borderBottomColor: pal.border }]}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextInput
              value={customTitle}
              onChangeText={setCustomTitle}
              placeholder={t('节点名称（如：MoE 混合专家负载均衡路由）', 'Node title…')}
              placeholderTextColor={pal.muted}
              style={[styles.inputField, { flex: 1, minWidth: 160, backgroundColor: pal.inputBg, borderColor: pal.border, color: pal.ink }]}
            />
            {KNOWLEDGE_DOMAINS.map((d) => {
              const sel = customDomain === d.id;
              return (
                <Pressable
                  key={d.id}
                  onPress={() => setCustomDomain(d.id)}
                  style={[styles.microBtn, { backgroundColor: sel ? `${d.color}22` : pal.pillBg, borderColor: sel ? d.color : pal.border }]}
                >
                  <Text variant="caption" style={{ color: sel ? d.color : pal.sub, fontSize: 10 }}>
                    {`[${d.icon}] ${d.zh}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <TextInput
              value={customMd}
              onChangeText={setCustomMd}
              placeholder={t('支持 [[AI-101]] 或 [[Transformer]] 双向链接语法，自动构建图谱连线…', 'Markdown notes with [[WikiLinks]]…')}
              placeholderTextColor={pal.muted}
              style={[styles.inputField, { flex: 1, backgroundColor: pal.inputBg, borderColor: pal.border, color: pal.ink }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="保存自定义双链知识节点"
              onPress={() => {
                const { state: next, addedNode } = importCustomMarkdownKnowledgeNode({
                  title: customTitle,
                  domainId: customDomain,
                  markdownBody: customMd || `关联 [[AI-101]] 核心推导笔记`,
                  prerequisiteNodeId: selectedNode.id,
                });
                setKgState(next);
                setSelectedNodeId(addedNode.id);
                setCustomTitle('');
                setCustomMd('');
                setShowAddNodeBox(false);
                showToast({ text: t(`✓ 已将节点「${addedNode.title}」加入知识图谱`, `✓ Added node ${addedNode.title}`) });
              }}
              style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
            >
              <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                {t('加入图谱', 'Add Node')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* 5. Main Split View: Left Interactive DAG Graph | Right AI Interactive Animation Lab + Chapter Reader */}
      <View style={styles.mainSplit}>
        {/* Left: Domain Filter + SVG Graph + Node Pills */}
        <View style={[styles.leftCol, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            <Pressable
              onPress={() => setSelectedDomain('all')}
              style={[
                styles.microBtn,
                {
                  backgroundColor: selectedDomain === 'all' ? pal.pillActiveBg : pal.pillBg,
                  borderColor: selectedDomain === 'all' ? pal.gold : pal.border,
                },
              ]}
            >
              <Text variant="caption" style={{ color: selectedDomain === 'all' ? pal.goldText : pal.sub, fontSize: 10, fontWeight: '700' }}>
                {t(`全部领域 (${kgState.nodes.length})`, `All (${kgState.nodes.length})`)}
              </Text>
            </Pressable>
            {KNOWLEDGE_DOMAINS.map((dom) => {
              const active = selectedDomain === dom.id;
              return (
                <Pressable
                  key={dom.id}
                  onPress={() => setSelectedDomain(dom.id)}
                  style={[
                    styles.microBtn,
                    {
                      backgroundColor: active ? `${dom.color}22` : pal.pillBg,
                      borderColor: active ? dom.color : pal.border,
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: active ? dom.color : pal.sub, fontSize: 10, fontWeight: active ? '700' : '500' }}>
                    {`[${dom.icon}] ${t(dom.zh, dom.en)}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <KnowledgeGraphSvgCanvas
            state={{ ...kgState, nodes: visibleNodes }}
            selectedNodeId={selectedNode.id}
            onSelectNode={(id) => {
              setSelectedNodeId(id);
              setShowFlashcardAnswer(false);
            }}
            isDark={isDark}
          />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {visibleNodes.map((node) => {
              const active = node.id === selectedNode.id;
              const isCached = Boolean(kgState.offlineContents[node.id]);
              return (
                <Pressable
                  key={node.id}
                  accessibilityRole="button"
                  accessibilityLabel={`选择知识节点 ${node.title}`}
                  onPress={() => {
                    setSelectedNodeId(node.id);
                    setShowFlashcardAnswer(false);
                  }}
                  style={[
                    styles.microBtn,
                    {
                      backgroundColor: active ? pal.pillActiveBg : pal.pillBg,
                      borderColor: active ? pal.gold : pal.border,
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: active ? pal.goldText : pal.ink, fontSize: 10.5, fontWeight: active ? '700' : '500' }}>
                    {`${node.code} · ${node.title.slice(0, 14)} ${isCached ? '●' : '○'}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Right: Selected Node Inspector + AI Interactive Animation Lab + Spaced Repetition Flashcard */}
        <View style={[styles.rightCol, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}>
                <Text variant="caption" style={{ color: pal.goldText, fontSize: 10, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
                  {selectedNode.code}
                </Text>
              </View>
              <Text variant="label" style={{ color: pal.ink, fontSize: 13, fontWeight: '700' }}>
                {selectedNode.title}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 5 }}>
              {(
                [
                  { id: 'locked', label: t('待解锁', 'Locked'), color: pal.muted },
                  { id: 'learning', label: t('学习中', 'Learning'), color: pal.gold },
                  { id: 'mastered', label: t('✓ 已掌握', '✓ Mastered'), color: pal.emerald },
                ] as const
              ).map((st) => {
                const active = selectedNode.status === st.id;
                return (
                  <Pressable
                    key={st.id}
                    accessibilityRole="button"
                    accessibilityLabel={`标记节点状态为 ${st.label}`}
                    onPress={() => {
                      const next = updateKnowledgeNodeProgress(selectedNode.id, { status: st.id });
                      setKgState(next);
                      if (st.id === 'mastered') {
                        recordPledgeReward(`点亮知识图谱节点：${selectedNode.title}`, localDay, 20);
                        showToast({ text: t(`✓ 已点亮节点「${selectedNode.title}」，心愿金库 +¥20`, '✓ Mastered node +¥20') });
                      }
                    }}
                    style={[
                      styles.microBtn,
                      {
                        backgroundColor: active ? `${st.color}22` : pal.pillBg,
                        borderColor: active ? st.color : pal.border,
                      },
                    ]}
                  >
                    <Text variant="caption" style={{ color: active ? st.color : pal.sub, fontSize: 10, fontWeight: active ? '700' : '500' }}>
                      {st.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text variant="caption" style={{ color: pal.sub, fontSize: 11 }}>
            {selectedNode.summary}
          </Text>

          {selectedContent ? (
            <View style={{ gap: 8 }}>
              {/* Interactive Animation Lab for AI Infra nodes */}
              {selectedContent.animationKind ? (
                <AiInteractiveAnimationLab kind={selectedContent.animationKind} isDark={isDark} />
              ) : null}

              <View style={[styles.contentBox, { backgroundColor: pal.elevated, borderColor: pal.border }]}>
                <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                  {t('核心心智模型 (Mental Model)', 'Core Mental Model')}
                </Text>
                <Text variant="caption" style={{ color: pal.ink, fontSize: 11, lineHeight: 16 }}>
                  {selectedContent.coreMentalModel}
                </Text>
                {selectedContent.keyTakeaways.map((pt, idx) => (
                  <Text key={idx} variant="caption" style={{ color: pal.sub, fontSize: 10.5 }}>
                    {`• ${pt}`}
                  </Text>
                ))}
                <View style={[styles.codeBox, { backgroundColor: pal.inputBg, borderColor: pal.border }]}>
                  <Text variant="caption" style={{ color: pal.emerald, fontSize: 10, fontFamily: theme.fontFamily.mono }}>
                    {selectedContent.codeOrFormulaSnippet}
                  </Text>
                </View>
              </View>

              {selectedContent.flashcards[0] ? (
                <View style={[styles.contentBox, { backgroundColor: pal.elevated, borderColor: pal.goldBorder }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                      {`间隔重复闪卡 (Lv.${selectedNode.reviewLevel}) · Q: ${selectedContent.flashcards[0].q}`}
                    </Text>
                    <Pressable
                      onPress={() => setShowFlashcardAnswer((prev) => !prev)}
                      style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
                    >
                      <Text variant="caption" style={{ color: pal.goldText, fontSize: 9.5, fontWeight: '700' }}>
                        {showFlashcardAnswer ? t('隐藏答案', 'Hide') : t('翻转看答案', 'Flip Answer')}
                      </Text>
                    </Pressable>
                  </View>
                  {showFlashcardAnswer ? (
                    <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5 }}>
                      {`A: ${selectedContent.flashcards[0].a}`}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            <View style={[styles.contentBox, { backgroundColor: pal.elevated, borderColor: pal.goldBorder, alignItems: 'flex-start' }]}>
              <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontWeight: '700' }}>
                {t('该章节交互动画与讲义尚未下载到本地沙箱', 'Chapter pack not cached locally yet')}
              </Text>
              <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5 }}>
                {t(
                  '当前仅展示 <1KB 轻量拓扑节点骨架；点击下方按钮即可按需拉取并缓存该章节离线包。',
                  'Only lightweight node topology is loaded. Click below to cache the chapter pack offline.',
                )}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`立即下载并缓存 ${selectedNode.title} 所属离线章节包`}
                onPress={() => {
                  const { state: next, pack } = installKnowledgeChapterPack(selectedNode.packId);
                  setKgState(next);
                  showToast({
                    text: t(
                      `✓ 已按需下载并缓存「${pack?.titleZh ?? selectedNode.packId}」（${pack?.sizeKb ?? 20} KB）`,
                      '✓ Downloaded chapter pack offline',
                    ),
                  });
                }}
                style={[styles.microBtn, { backgroundColor: `${pal.emerald}22`, borderColor: pal.emerald }]}
              >
                <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, fontWeight: '700' }}>
                  {t('⬇ 一键下载该章节离线包 (约 24 KB)', '⬇ Download Offline Chapter Pack')}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Bottom Bar: Log 25m Pomodoro to this Knowledge Node */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text variant="caption" style={{ color: pal.muted, fontSize: 10, fontFamily: theme.fontFamily.mono }}>
              {`已在该节点投入 ${selectedNode.studyMinutes} 分钟 · 关联节点 ${selectedNode.bidirectionalLinks.length} 个`}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`在节点 ${selectedNode.title} 打卡 25 分钟深度研读`}
              onPress={() => {
                const next = updateKnowledgeNodeProgress(selectedNode.id, {
                  studyMinutes: selectedNode.studyMinutes + 25,
                  reviewLevel: selectedNode.reviewLevel + 1,
                });
                setKgState(next);
                onLogStudyMinutes?.(selectedNode.title, 25);
                recordPledgeReward(`知识图谱研读：${selectedNode.title} +25m`, localDay, 15);
                showToast({
                  text: t(
                    `✓ 已记入「${selectedNode.title}」+25m 研读时长，同步至 24H 时间轴与心愿金库 (+¥15)`,
                    `✓ Logged +25m on ${selectedNode.title}`,
                  ),
                });
              }}
              style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
            >
              <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                {t('＋ 研读打卡 25m（同步时间轴 & +¥15）', '＋ Log 25m Study')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 8,
  },
  topStrip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 6,
  },
  gearBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    gap: 1,
  },
  headerRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  drawerBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  packCard: {
    flex: 1,
    minWidth: 220,
    padding: 9,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  mainSplit: {
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  leftCol: {
    flex: 0.9,
    minWidth: 270,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  rightCol: {
    flex: 1.3,
    minWidth: 310,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  animContainer: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  animHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  stepCaptionBox: {
    padding: 7,
    borderRadius: 6,
    borderWidth: 1,
    gap: 2,
  },
  contentBox: {
    padding: 9,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  codeBox: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 2,
  },
  microBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  inputField: {
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    fontSize: 11,
  },
});
