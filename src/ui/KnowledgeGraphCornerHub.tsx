import { createElement, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';

import {
  type AiAnimationKind,
  CATALOG_CHAPTER_PACKS,
  computeAttentionSimulation,
  computeDistributedParallelSimulation,
  computeFlashAttentionSimulation,
  computeKnowledgeGraphStats,
  computeMoeRoutingSimulation,
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

export type StudyWorkbenchSubView = 'lab' | 'graph' | 'packs';

/**
 * Interactive Animated AI Learning Lab (AI 交互式动画教学大讲堂)
 * Supports 6 interactive SVG laboratories with Play/Pause auto-stepping,
 * multi-head/parameter controls, and real-time mathematical readouts.
 */
function AiInteractiveAnimationLab({
  kind,
  isDark,
  fullScreen = false,
}: {
  kind: AiAnimationKind;
  isDark: boolean;
  fullScreen?: boolean;
}) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(true);
  const [tick, setTick] = useState(0);

  // Lab 1: Self-Attention + Multi-Head + RoPE 2D Rotation
  const [focusTokenIdx, setFocusTokenIdx] = useState(5); // 'AI'
  const [attnHeadIdx, setAttnHeadIdx] = useState(0);
  const [attnStepIdx, setAttnStepIdx] = useState(2);
  const [temperature, setTemperature] = useState(0.8);

  // Lab 2: PagedAttention
  const [pagedTokenCount, setPagedTokenCount] = useState(11);
  const [sharedPrefix, setSharedPrefix] = useState(true);

  // Lab 3: Speculative Decoding
  const [specGamma, setSpecGamma] = useState(4);
  const [specPhase, setSpecPhase] = useState(0);

  // Lab 4: FlashAttention Tiling
  const [flashTileIdx, setFlashTileIdx] = useState(1);

  // Lab 5: MoE Top-K Router
  const [moeTokenIdx, setMoeTokenIdx] = useState(0);
  const [moeTopK, setMoeTopK] = useState(2);
  const [moeLoadBalance, setMoeLoadBalance] = useState(true);

  // Lab 6: 3D Parallelism & ZeRO Sharding
  const [zeroStage, setZeroStage] = useState<0 | 1 | 2 | 3>(2);
  const [microBatches, setMicroBatches] = useState(8);

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
      } else if (kind === 'moe-routing') {
        setMoeTokenIdx((prev) => (prev + 1) % 4);
      } else if (kind === 'distributed-parallel') {
        setZeroStage((prev) => ((prev + 1) % 4) as 0 | 1 | 2 | 3);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [playing, kind]);

  const boxBg = isDark ? '#12110f' : '#f8f5ec';
  const borderCol = isDark ? 'rgba(245, 185, 66, 0.38)' : 'rgba(184, 130, 40, 0.36)';
  const ink = isDark ? '#f8fafc' : '#26241f';
  const sub = isDark ? '#cbd5e1' : '#524e46';
  const gold = isDark ? '#fde68a' : '#92560c';
  const emerald = isDark ? '#34d399' : '#1f5e4b';
  const sky = isDark ? '#38bdf8' : '#0284c7';
  const pink = isDark ? '#f472b6' : '#db2777';
  const svgHeight = fullScreen ? 176 : 138;

  if (kind === 'self-attention') {
    const sim = computeAttentionSimulation({
      focusTokenIdx,
      stepIdx: attnStepIdx,
      temperature,
      headIdx: attnHeadIdx,
    });
    const rad = (sim.ropeAngleDeg * Math.PI) / 180;
    const ropeX = 590 + Math.cos(rad) * 34;
    const ropeY = 74 - Math.sin(rad) * 34;

    return (
      <View style={[styles.animContainer, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.animHeader}>
          <View style={{ gap: 2 }}>
            <Text variant="caption" style={{ color: gold, fontSize: 12, fontWeight: '700' }}>
              {t(
                '✦ AI 交互式动画实验室 · Multi-Head Self-Attention + 2D RoPE 复平面旋转',
                '✦ Interactive Lab · Multi-Head Self-Attention & 2D RoPE Rotation',
              )}
            </Text>
            <Text variant="caption" style={{ color: sub, fontSize: 10, fontFamily: theme.fontFamily.mono }}>
              {sim.entropyInfoZh}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={playing ? '暂停教学动画' : '播放教学动画'}
              onPress={() => setPlaying((p) => !p)}
              style={[
                styles.microBtn,
                {
                  backgroundColor: playing ? 'rgba(52,211,153,0.18)' : 'rgba(245,185,66,0.18)',
                  borderColor: playing ? emerald : gold,
                },
              ]}
            >
              <Text variant="caption" style={{ color: playing ? emerald : gold, fontSize: 10, fontWeight: '700' }}>
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
              <Text variant="caption" style={{ color: ink, fontSize: 10, fontWeight: '700' }}>
                {t('下一步 ▶|', 'Step ▶|')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Interactive Parameter Toolbar: Query Token, Attention Head, Softmax Temperature */}
        <View style={styles.controlToolbar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <Text variant="caption" style={{ color: sub, fontSize: 10 }}>
              {t('Query 发起词:', 'Query Token:')}
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
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      backgroundColor: active ? 'rgba(245, 185, 66, 0.24)' : 'transparent',
                      borderColor: active ? '#f5b942' : borderCol,
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: active ? gold : ink, fontSize: 10.5, fontWeight: '700' }}>
                    {`${tok} (m=${idx})`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <Text variant="caption" style={{ color: sub, fontSize: 10 }}>
              {t('切换注意力头:', 'Head:')}
            </Text>
            {[
              { idx: 0, label: 'H1·语义指代' },
              { idx: 1, label: 'H2·邻近局部' },
              { idx: 2, label: 'H3·全局句首' },
            ].map((h) => (
              <Pressable
                key={h.idx}
                onPress={() => setAttnHeadIdx(h.idx)}
                style={[
                  styles.microBtn,
                  {
                    backgroundColor: attnHeadIdx === h.idx ? 'rgba(52,211,153,0.20)' : 'transparent',
                    borderColor: attnHeadIdx === h.idx ? emerald : borderCol,
                  },
                ]}
              >
                <Text variant="caption" style={{ color: attnHeadIdx === h.idx ? emerald : sub, fontSize: 9.5, fontWeight: '700' }}>
                  {h.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text variant="caption" style={{ color: sub, fontSize: 10 }}>
              {`温度 τ=${temperature.toFixed(1)}:`}
            </Text>
            {[0.4, 0.8, 1.6].map((tVal) => (
              <Pressable
                key={String(tVal)}
                onPress={() => setTemperature(tVal)}
                style={[
                  styles.microBtn,
                  {
                    paddingHorizontal: 7,
                    paddingVertical: 2,
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

        {/* Animated SVG: Left = Multi-Head Q/K/V Attention Arcs & Softmax Bars; Right = 2D RoPE Complex Plane */}
        {Platform.OS === 'web'
          ? createElement(
              'svg',
              { width: '100%', height: svgHeight, viewBox: '0 0 680 148' },
              // Left Panel: Attention Curved Beams from focusTokenIdx to all Key tokens
              sim.tokens.map((tok, idx) => {
                const xFrom = 44 + sim.focusTokenIdx * 78;
                const xTo = 44 + idx * 78;
                const weight = sim.weightsPct[idx] ?? 10;
                const strokeW = Math.max(1.2, (weight / 100) * 11);
                const opacity = Math.max(0.2, weight / 100);
                return createElement(
                  'g',
                  {
                    key: `arc-${idx}`,
                    style: { cursor: 'pointer' },
                    onClick: () => setFocusTokenIdx(idx),
                  },
                  createElement('path', {
                    d: `M ${xFrom} 34 Q ${(xFrom + xTo) / 2} ${78 + Math.abs(idx - sim.focusTokenIdx) * 6} ${xTo} 94`,
                    fill: 'none',
                    stroke: idx === sim.focusTokenIdx ? '#34d399' : '#f5b942',
                    strokeWidth: strokeW,
                    strokeOpacity: opacity,
                    strokeDasharray: sim.stepIdx === 1 ? '5 3' : undefined,
                  }),
                  // Top Query Token Box
                  createElement('rect', {
                    x: xTo - 24,
                    y: 8,
                    width: 48,
                    height: 24,
                    rx: 6,
                    fill: idx === sim.focusTokenIdx ? '#f5b942' : isDark ? '#27272a' : '#e7e2d6',
                    stroke: idx === sim.focusTokenIdx ? '#fef08a' : 'none',
                    strokeWidth: 1.2,
                  }),
                  createElement(
                    'text',
                    {
                      x: xTo,
                      y: 24,
                      textAnchor: 'middle',
                      fill: idx === sim.focusTokenIdx ? '#18181b' : ink,
                      fontSize: '11',
                      fontWeight: '700',
                    },
                    `${tok}${idx === sim.focusTokenIdx ? '(Q)' : ''}`,
                  ),
                  // Bottom Key/Value Probability Bar
                  createElement('rect', {
                    x: xTo - 24,
                    y: 96,
                    width: 48,
                    height: 20,
                    rx: 4,
                    fill: isDark ? '#1f2937' : '#e2e8f0',
                  }),
                  createElement('rect', {
                    x: xTo - 24,
                    y: 96,
                    width: Math.max(5, (48 * weight) / 100),
                    height: 20,
                    rx: 4,
                    fill: weight >= 25 ? '#34d399' : '#38bdf8',
                  }),
                  createElement(
                    'text',
                    {
                      x: xTo,
                      y: 110,
                      textAnchor: 'middle',
                      fill: '#ffffff',
                      fontSize: '10',
                      fontWeight: '700',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    },
                    `${weight}%`,
                  ),
                  createElement(
                    'text',
                    {
                      x: xTo,
                      y: 132,
                      textAnchor: 'middle',
                      fill: sub,
                      fontSize: '9.5',
                    },
                    `K/V:${tok}`,
                  ),
                );
              }),
              // Right Panel: 2D Complex Plane RoPE Rotation Visualizer
              createElement(
                'g',
                null,
                createElement('rect', {
                  x: 506,
                  y: 8,
                  width: 164,
                  height: 130,
                  rx: 8,
                  fill: isDark ? '#18181b' : '#ffffff',
                  stroke: borderCol,
                  strokeWidth: 1,
                }),
                createElement(
                  'text',
                  {
                    x: 588,
                    y: 24,
                    textAnchor: 'middle',
                    fill: gold,
                    fontSize: '10',
                    fontWeight: '700',
                  },
                  `RoPE 复平面旋转 (m=${sim.focusTokenIdx})`,
                ),
                createElement('circle', {
                  cx: 590,
                  cy: 74,
                  r: 34,
                  fill: 'none',
                  stroke: isDark ? '#334155' : '#cbd5e1',
                  strokeWidth: 1.2,
                  strokeDasharray: '3 3',
                }),
                createElement('line', {
                  x1: 550,
                  y1: 74,
                  x2: 630,
                  y2: 74,
                  stroke: isDark ? '#334155' : '#cbd5e1',
                  strokeWidth: 1,
                }),
                createElement('line', {
                  x1: 590,
                  y1: 36,
                  x2: 590,
                  y2: 112,
                  stroke: isDark ? '#334155' : '#cbd5e1',
                  strokeWidth: 1,
                }),
                // Base vector at 0 deg
                createElement('line', {
                  x1: 590,
                  y1: 74,
                  x2: 624,
                  y2: 74,
                  stroke: '#38bdf8',
                  strokeWidth: 2,
                  strokeOpacity: 0.5,
                }),
                // Rotated Query vector at m * theta
                createElement('line', {
                  x1: 590,
                  y1: 74,
                  x2: ropeX,
                  y2: ropeY,
                  stroke: '#f5b942',
                  strokeWidth: 3,
                  strokeLinecap: 'round',
                }),
                createElement('circle', {
                  cx: ropeX,
                  cy: ropeY,
                  r: 4.5,
                  fill: '#34d399',
                }),
                createElement(
                  'text',
                  {
                    x: 588,
                    y: 128,
                    textAnchor: 'middle',
                    fill: emerald,
                    fontSize: '9.5',
                    fontWeight: '700',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  },
                  `e^(i·mθ) = ∠${sim.ropeAngleDeg}°`,
                ),
              ),
            )
          : null}

        {/* Stepper Progress Pills */}
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {[0, 1, 2, 3].map((sIdx) => (
            <Pressable
              key={sIdx}
              onPress={() => {
                setPlaying(false);
                setAttnStepIdx(sIdx);
              }}
              style={[
                styles.microBtn,
                {
                  flex: 1,
                  minWidth: 110,
                  backgroundColor: sim.stepIdx === sIdx ? 'rgba(245,185,66,0.20)' : 'transparent',
                  borderColor: sim.stepIdx === sIdx ? gold : borderCol,
                },
              ]}
            >
              <Text variant="caption" style={{ color: sim.stepIdx === sIdx ? gold : sub, fontSize: 9.5, fontWeight: '700' }}>
                {sIdx === 0
                  ? '① QKV + RoPE旋转'
                  : sIdx === 1
                    ? '② Q·K^T / √d_k'
                    : sIdx === 2
                      ? '③ Softmax(·/τ)'
                      : '④ 加权求和 @V'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
          <Text variant="caption" style={{ color: gold, fontSize: 11, fontWeight: '700' }}>
            {sim.stepTitleZh}
          </Text>
          <Text variant="caption" style={{ color: sub, fontSize: 10.5 }}>
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
          <Text variant="caption" style={{ color: gold, fontSize: 12, fontWeight: '700' }}>
            {t('✦ AI 交互式动画实验室 · vLLM PagedAttention 虚拟页表 ⇄ 非连续物理显存映射', '✦ Interactive Animation · PagedAttention')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Pressable
              onPress={() => setPlaying((p) => !p)}
              style={[styles.microBtn, { borderColor: playing ? emerald : gold }]}
            >
              <Text variant="caption" style={{ color: playing ? emerald : gold, fontSize: 10, fontWeight: '700' }}>
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
              <Text variant="caption" style={{ color: ink, fontSize: 10, fontWeight: '700' }}>
                {t('＋ 生成 1 个 Token', '＋ Next Token')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSharedPrefix((p) => !p)}
              style={[styles.microBtn, { borderColor: sharedPrefix ? emerald : borderCol }]}
            >
              <Text variant="caption" style={{ color: sharedPrefix ? emerald : sub, fontSize: 10, fontWeight: '700' }}>
                {sharedPrefix ? t('✓ CoW 前缀共享开启 (RefCnt=2)', '✓ CoW Shared') : t('○ 开启 CoW 共享', '○ CoW Off')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Visual Block Table Mapping */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {sim.logicalBlocks.map((blk) => (
            <View
              key={blk.logicalIndex}
              style={{
                flex: 1,
                minWidth: 135,
                padding: 8,
                borderRadius: 8,
                borderWidth: 1.2,
                borderColor: blk.isSharedCoW ? emerald : sky,
                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                gap: 5,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="caption" style={{ color: sky, fontSize: 10, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
                  {`逻辑页 L${blk.logicalIndex} → 物理框 P#${blk.physicalBlockId}`}
                </Text>
                {blk.isSharedCoW ? (
                  <Text variant="caption" style={{ color: emerald, fontSize: 9.5, fontWeight: '700' }}>
                    CoW·RefCnt=2
                  </Text>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[0, 1, 2, 3].map((slotIdx) => {
                  const tok = blk.tokens[slotIdx];
                  return (
                    <View
                      key={slotIdx}
                      style={{
                        flex: 1,
                        height: 24,
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
                      <Text variant="caption" style={{ color: tok ? ink : sub, fontSize: 9, fontWeight: '600' }}>
                        {tok ?? '空闲'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        {/* Contiguous vs Paged VRAM Waste Visual Comparison Bars */}
        <View style={{ gap: 4, paddingVertical: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text variant="caption" style={{ color: sub, fontSize: 9.5, width: 118 }}>
              {t('传统连续预分配:', 'Contiguous VRAM:')}
            </Text>
            <View style={{ flex: 1, height: 12, borderRadius: 6, backgroundColor: 'rgba(239,68,68,0.22)', overflow: 'hidden', flexDirection: 'row' }}>
              <View style={{ width: `${100 - sim.traditionalWastePct}%`, backgroundColor: '#f59e0b' }} />
            </View>
            <Text variant="caption" style={{ color: '#ef4444', fontSize: 9.5, fontFamily: theme.fontFamily.mono, width: 92 }}>
              {`浪费 ${sim.traditionalWastePct}%`}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text variant="caption" style={{ color: emerald, fontSize: 9.5, width: 118, fontWeight: '700' }}>
              {t('vLLM 分页显存:', 'PagedAttention:')}
            </Text>
            <View style={{ flex: 1, height: 12, borderRadius: 6, backgroundColor: 'rgba(52,211,153,0.16)', overflow: 'hidden', flexDirection: 'row' }}>
              <View style={{ width: `${100 - sim.pagedWastePct}%`, backgroundColor: '#34d399' }} />
            </View>
            <Text variant="caption" style={{ color: emerald, fontSize: 9.5, fontFamily: theme.fontFamily.mono, width: 92, fontWeight: '700' }}>
              {`仅 ${sim.pagedWastePct}% 碎片`}
            </Text>
          </View>
        </View>

        <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
          <Text variant="caption" style={{ color: emerald, fontSize: 11, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
            {`显存节省对比：传统连续预分配浪费 ${sim.traditionalWastePct}% vs PagedAttention 仅 ${sim.pagedWastePct}%（节省 +${sim.savedVramPct}% 显存）`}
          </Text>
          <Text variant="caption" style={{ color: sub, fontSize: 10.5 }}>
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
          <Text variant="caption" style={{ color: gold, fontSize: 12, fontWeight: '700' }}>
            {t('✦ AI 交互式动画实验室 · 投机采样 (Speculative Decoding) 双轨竞速验证', '✦ Speculative Decoding Animation')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
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
                <Text variant="caption" style={{ color: gold, fontSize: 10, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                  {`快猜步数 γ=${gVal}`}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setSpecPhase((p) => p + 1)}
              style={[styles.microBtn, { borderColor: emerald }]}
            >
              <Text variant="caption" style={{ color: emerald, fontSize: 10, fontWeight: '700' }}>
                {t('切换全部命中 / 中途修正重采样 ▶', 'Toggle Hit/Reject ▶')}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
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
                  paddingHorizontal: 11,
                  paddingVertical: 7,
                  borderRadius: 7,
                  borderWidth: 1.2,
                  borderColor: cColor,
                  backgroundColor: `${cColor}18`,
                }}
              >
                <Text variant="caption" style={{ color: cColor, fontSize: 11, fontWeight: '700' }}>
                  {`${cand.status === 'accepted' ? '✓ 验证通过' : cand.status === 'bonus' ? '★ 免费奖励词' : '↻ 拒绝并重采样'} · ${cand.token}`}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
          <Text variant="caption" style={{ color: gold, fontSize: 11, fontWeight: '700' }}>
            {`Target 大模型 1 次前向并行验证产出 ${sim.acceptedCount} 个 Token · 等效吞吐提速 ${sim.effectiveSpeedup}x`}
          </Text>
          <Text variant="caption" style={{ color: sub, fontSize: 10.5 }}>
            {sim.stepDescZh}
          </Text>
        </View>
      </View>
    );
  }

  if (kind === 'flash-attention') {
    const flashSim = computeFlashAttentionSimulation({ activeTileIdx: flashTileIdx });
    return (
      <View style={[styles.animContainer, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.animHeader}>
          <Text variant="caption" style={{ color: gold, fontSize: 12, fontWeight: '700' }}>
            {t('✦ AI 交互式动画实验室 · FlashAttention HBM ⇄ 片上 SRAM 分块与 Online Softmax', '✦ FlashAttention Tiling Animation')}
          </Text>
          <Pressable
            onPress={() => setFlashTileIdx((p) => (p + 1) % 4)}
            style={[styles.microBtn, { borderColor: gold }]}
          >
            <Text variant="caption" style={{ color: gold, fontSize: 10, fontWeight: '700' }}>
              {t(`推进至下一个 SRAM 分块 (${flashSim.activeTileIdx + 1}/4) ▶`, 'Next Tile ▶')}
            </Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[0, 1, 2, 3].map((tIdx) => {
            const isCurrent = tIdx === flashSim.activeTileIdx;
            const isDone = tIdx < flashSim.activeTileIdx;
            return (
              <Pressable
                key={tIdx}
                onPress={() => setFlashTileIdx(tIdx)}
                style={{
                  flex: 1,
                  minWidth: 120,
                  padding: 9,
                  borderRadius: 7,
                  borderWidth: 1.2,
                  borderColor: isCurrent ? gold : isDone ? emerald : borderCol,
                  backgroundColor: isCurrent ? 'rgba(245,185,66,0.20)' : isDone ? 'rgba(52,211,153,0.12)' : 'transparent',
                  gap: 3,
                }}
              >
                <Text variant="caption" style={{ color: isCurrent ? gold : isDone ? emerald : sub, fontSize: 10.5, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
                  {`KV Tile #${tIdx + 1} ${isCurrent ? '⚡SRAM计算中' : isDone ? '✓已归约' : '待加载'}`}
                </Text>
                <Text variant="caption" style={{ color: sub, fontSize: 9.5, fontFamily: theme.fontFamily.mono }}>
                  {isCurrent
                    ? `m=${flashSim.runningMax} · l=${flashSim.runningSumExp} · α=${flashSim.rescaleFactor}`
                    : isDone
                      ? '已在线重缩放合并至 O'
                      : '驻留 HBM 等待 DMA'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
          <Text variant="caption" style={{ color: emerald, fontSize: 11, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
            {`HBM 显存读写对比：标准 Attention ${flashSim.standardHbmReadsMb} MB vs FlashAttention 仅 ${flashSim.flashHbmReadsMb} MB（减少 ${flashSim.ioReductionFactor} 倍访存）`}
          </Text>
          <Text variant="caption" style={{ color: sub, fontSize: 10.5 }}>
            {flashSim.stepDescZh}
          </Text>
        </View>
      </View>
    );
  }

  if (kind === 'moe-routing') {
    const moeSim = computeMoeRoutingSimulation({
      tokenIdx: moeTokenIdx,
      topK: moeTopK,
      loadBalanceEnabled: moeLoadBalance,
    });
    return (
      <View style={[styles.animContainer, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.animHeader}>
          <Text variant="caption" style={{ color: gold, fontSize: 12, fontWeight: '700' }}>
            {t(
              '✦ AI 交互式动画实验室 · DeepSeek/Mixtral MoE Top-K 门控路由与负载均衡',
              '✦ Interactive Lab · Sparse MoE Top-K Router & Load Balancing',
            )}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Pressable
              onPress={() => setPlaying((p) => !p)}
              style={[styles.microBtn, { borderColor: playing ? emerald : gold }]}
            >
              <Text variant="caption" style={{ color: playing ? emerald : gold, fontSize: 10, fontWeight: '700' }}>
                {playing ? t('⏸ 自动轮询 Token', '⏸ Auto') : t('▶ 自动轮询', '▶ Play')}
              </Text>
            </Pressable>
            {[1, 2, 3].map((kVal) => (
              <Pressable
                key={kVal}
                onPress={() => setMoeTopK(kVal)}
                style={[
                  styles.microBtn,
                  {
                    borderColor: moeTopK === kVal ? sky : borderCol,
                    backgroundColor: moeTopK === kVal ? 'rgba(56,189,248,0.18)' : 'transparent',
                  },
                ]}
              >
                <Text variant="caption" style={{ color: sky, fontSize: 9.5, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                  {`Top-${kVal}`}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setMoeLoadBalance((b) => !b)}
              style={[styles.microBtn, { borderColor: moeLoadBalance ? emerald : pink }]}
            >
              <Text variant="caption" style={{ color: moeLoadBalance ? emerald : pink, fontSize: 9.5, fontWeight: '700' }}>
                {moeLoadBalance ? t('✓ 动态偏置负载均衡已开启', '✓ Load Balanced') : t('⚠ 负载均衡关闭 (热门专家拥塞)', '⚠ Unbalanced')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Token Picker */}
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Text variant="caption" style={{ color: sub, fontSize: 10 }}>
            {t('点击测试不同领域输入 Token:', 'Select Input Token:')}
          </Text>
          {moeSim.tokens.map((tok, idx) => {
            const active = idx === moeSim.tokenIdx;
            return (
              <Pressable
                key={tok.text}
                onPress={() => {
                  setPlaying(false);
                  setMoeTokenIdx(idx);
                }}
                style={[
                  styles.microBtn,
                  {
                    backgroundColor: active ? 'rgba(245,185,66,0.22)' : 'transparent',
                    borderColor: active ? '#f5b942' : borderCol,
                  },
                ]}
              >
                <Text variant="caption" style={{ color: active ? gold : ink, fontSize: 10, fontWeight: '700' }}>
                  {`${tok.text} (${tok.domain})`}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Expert Cards Grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {moeSim.experts.map((exp) => (
            <View
              key={exp.id}
              style={{
                flex: 1,
                minWidth: 135,
                padding: 8,
                borderRadius: 7,
                borderWidth: exp.selected ? 1.5 : 1,
                borderColor: exp.isShared ? emerald : exp.selected ? '#f5b942' : borderCol,
                backgroundColor: exp.isShared
                  ? 'rgba(52,211,153,0.16)'
                  : exp.selected
                    ? 'rgba(245,185,66,0.18)'
                    : isDark
                      ? '#18181b'
                      : '#ffffff',
                opacity: exp.selected ? 1 : 0.62,
                gap: 3,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="caption" style={{ color: exp.isShared ? emerald : exp.selected ? gold : sub, fontSize: 10, fontWeight: '700' }}>
                  {exp.nameZh}
                </Text>
                <Text variant="caption" style={{ color: exp.selected ? emerald : sub, fontSize: 9.5, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                  {exp.isShared ? '常驻 100%' : `门控 ${exp.scorePct}%`}
                </Text>
              </View>
              <Text variant="caption" style={{ color: sub, fontSize: 9, fontFamily: theme.fontFamily.mono }}>
                {exp.selected ? '⚡ 当前 Token 已激活该专家' : '○ 本步休眠 (0 FLOPs)'}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
          <Text variant="caption" style={{ color: gold, fontSize: 11, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
            {`激活参数量：${moeSim.activeParamsBillion}B / 总参数量 ${moeSim.totalParamsBillion}B（单步推理节省 ${Math.round((1 - moeSim.activeParamsBillion / moeSim.totalParamsBillion) * 100)}% 算力）`}
          </Text>
          <Text variant="caption" style={{ color: sub, fontSize: 10.5 }}>
            {moeSim.summaryZh}
          </Text>
        </View>
      </View>
    );
  }

  // Lab 6: 3D Parallelism (TP/PP/DP) & ZeRO Memory Sharding
  const parallelSim = computeDistributedParallelSimulation({
    zeroStage,
    microBatches,
  });
  return (
    <View style={[styles.animContainer, { backgroundColor: boxBg, borderColor: borderCol }]}>
      <View style={styles.animHeader}>
        <Text variant="caption" style={{ color: gold, fontSize: 12, fontWeight: '700' }}>
          {t(
            '✦ AI 交互式动画实验室 · 分布式 3D 并行 (TP/PP/DP) 与 ZeRO-1/2/3 显存切分',
            '✦ Interactive Lab · 3D Parallelism & ZeRO Memory Sharding',
          )}
        </Text>
        <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap' }}>
          {([0, 1, 2, 3] as const).map((st) => (
            <Pressable
              key={st}
              onPress={() => {
                setPlaying(false);
                setZeroStage(st);
              }}
              style={[
                styles.microBtn,
                {
                  borderColor: zeroStage === st ? emerald : borderCol,
                  backgroundColor: zeroStage === st ? 'rgba(52,211,153,0.18)' : 'transparent',
                },
              ]}
            >
              <Text variant="caption" style={{ color: zeroStage === st ? emerald : sub, fontSize: 9.5, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                {st === 0 ? 'Baseline (无ZeRO)' : `ZeRO-${st}`}
              </Text>
            </Pressable>
          ))}
          {[4, 8, 16].map((mb) => (
            <Pressable
              key={mb}
              onPress={() => setMicroBatches(mb)}
              style={[
                styles.microBtn,
                {
                  borderColor: microBatches === mb ? sky : borderCol,
                  backgroundColor: microBatches === mb ? 'rgba(56,189,248,0.18)' : 'transparent',
                },
              ]}
            >
              <Text variant="caption" style={{ color: sky, fontSize: 9.5, fontFamily: theme.fontFamily.mono }}>
                {`1F1B 微批次 M=${mb}`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Single-GPU Memory Breakdown Comparison */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[
          { label: 'FP16 参数 (Parameters)', gb: parallelSim.paramMemGb, baseGb: 14, color: '#38bdf8' },
          { label: 'FP16 梯度 (Gradients)', gb: parallelSim.gradMemGb, baseGb: 14, color: '#f5b942' },
          { label: 'FP32 Adam 优化器状态', gb: parallelSim.optimMemGb, baseGb: 84, color: '#f472b6' },
        ].map((item) => (
          <View
            key={item.label}
            style={{
              flex: 1,
              minWidth: 145,
              padding: 8,
              borderRadius: 7,
              borderWidth: 1,
              borderColor: item.color,
              backgroundColor: isDark ? '#18181b' : '#ffffff',
              gap: 3,
            }}
          >
            <Text variant="caption" style={{ color: item.color, fontSize: 10, fontWeight: '700' }}>
              {item.label}
            </Text>
            <Text variant="caption" style={{ color: ink, fontSize: 12, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
              {`${item.gb} GB / 卡`}
            </Text>
            <Text variant="caption" style={{ color: sub, fontSize: 9 }}>
              {item.gb < item.baseGb ? `✓ 已按 8 卡 DP 分片 (原 ${item.baseGb}GB)` : '未分片 (每卡完整副本)'}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
        <Text variant="caption" style={{ color: emerald, fontSize: 11, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
          {`单卡模型状态总显存：${parallelSim.totalMemPerGpuGb} GB (相比无 ZeRO 的 112 GB 节省 ${Math.round((1 - parallelSim.totalMemPerGpuGb / 112) * 100)}%) · 1F1B 流水线气泡率 ${parallelSim.bubbleRatioPct}%`}
        </Text>
        <Text variant="caption" style={{ color: sub, fontSize: 10.5 }}>
          {parallelSim.summaryZh}
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
  fullScreen = false,
}: {
  state: KnowledgeGraphState;
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
  isDark: boolean;
  fullScreen?: boolean;
}) {
  if (Platform.OS !== 'web') return null;

  const width = 680;
  const height = fullScreen ? 250 : 196;
  const toX = (pct: number) => 34 + (pct / 100) * (width - 68);
  const toY = (pct: number) => 26 + (pct / 100) * (height - 52);

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
          stroke: isDark ? 'rgba(245, 185, 66, 0.28)' : 'rgba(184, 130, 40, 0.28)',
          strokeWidth: 1.4,
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
          strokeWidth: 2.4,
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
              r: 25,
              fill: `${statusColor}25`,
              stroke: statusColor,
              strokeWidth: 1.8,
              strokeDasharray: '3 2',
            })
          : null,
        createElement('circle', {
          cx,
          cy,
          r: 17,
          fill: isDark ? '#18181b' : '#ffffff',
          stroke: statusColor,
          strokeWidth: isSelected ? 3 : 2,
        }),
        createElement(
          'text',
          {
            x: cx,
            y: cy + 3.5,
            textAnchor: 'middle',
            fill: statusColor,
            fontSize: '9',
            fontWeight: '700',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          },
          node.code,
        ),
        createElement(
          'text',
          {
            x: cx,
            y: cy + 30,
            textAnchor: 'middle',
            fill: isSelected ? (isDark ? '#fde68a' : '#92560c') : isDark ? '#e2e8f0' : '#334155',
            fontSize: '10',
            fontWeight: isSelected ? '700' : '600',
          },
          `${node.title.slice(0, 11)}${isCached ? ' ●' : ' ○'}`,
        ),
      );
    }),
  );
}

export function KnowledgeGraphCornerHub({
  localDay,
  totalStudyMinutesLive = 0,
  onLogStudyMinutes,
  fullScreen = false,
}: {
  localDay: string;
  totalStudyMinutesLive?: number;
  onLogStudyMinutes?: (title: string, mins: number) => void;
  fullScreen?: boolean;
}) {
  const { scheme } = useTheme();
  const { t } = useI18n();
  const isDark = scheme === 'dark';

  const [kgState, setKgState] = useState<KnowledgeGraphState>(readKnowledgeGraphState);
  const [activeSubView, setActiveSubView] = useState<StudyWorkbenchSubView>('lab');
  const [selectedDomain, setSelectedDomain] = useState<KnowledgeDomainId | 'all'>('ai-infra');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node-transformer');
  const [showAddNodeBox, setShowAddNodeBox] = useState(false);
  const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);

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
        goldBorder: 'rgba(245, 185, 66, 0.34)',
        ink: '#f8fafc',
        sub: '#cbd5e1',
        muted: '#94a3b8',
        gold: '#f5b942',
        goldText: '#fde68a',
        emerald: '#34d399',
        sky: '#38bdf8',
        pillBg: 'rgba(255, 255, 255, 0.06)',
        pillActiveBg: 'rgba(245, 185, 66, 0.18)',
        inputBg: '#0e0d0b',
      }
    : {
        bg: '#f7f4ec',
        cardBg: '#ffffff',
        elevated: '#faf8f2',
        border: 'rgba(38, 36, 31, 0.12)',
        goldBorder: 'rgba(184, 130, 40, 0.34)',
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
      {/* 1. Primary 3-Mode Workbench Switcher Bar */}
      <View style={[styles.headerRow, { backgroundColor: pal.elevated, borderBottomColor: pal.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          {[
            {
              id: 'lab' as const,
              zh: '✦ AI 交互动画大讲堂 (6 大实验)',
              en: '✦ AI Interactive Animation Labs (6)',
            },
            {
              id: 'graph' as const,
              zh: `◎ 全景知识图谱 & 双链笔记 (${stats.masteredCount}/${stats.totalNodes})`,
              en: `◎ DAG Knowledge Graph & WikiLinks (${stats.masteredCount}/${stats.totalNodes})`,
            },
            {
              id: 'packs' as const,
              zh: `⬇ 离线章节包仓库 (${stats.installedPacksCount}/${stats.totalCatalogPacksCount} · ${stats.cachedSizeKb}KB)`,
              en: `⬇ Offline Chapter Packs (${stats.cachedSizeKb}KB)`,
            },
          ].map((tab) => {
            const active = activeSubView === tab.id;
            return (
              <Pressable
                key={tab.id}
                accessibilityRole="button"
                accessibilityLabel={t(tab.zh, tab.en)}
                onPress={() => setActiveSubView(tab.id)}
                style={[
                  styles.modeTabBtn,
                  {
                    backgroundColor: active ? pal.pillActiveBg : pal.pillBg,
                    borderColor: active ? pal.gold : pal.border,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{
                    color: active ? pal.goldText : pal.sub,
                    fontSize: 11.5,
                    fontWeight: active ? '700' : '600',
                  }}
                >
                  {t(tab.zh, tab.en)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="自建双链知识节点"
            onPress={() => {
              setActiveSubView('graph');
              setShowAddNodeBox((v) => !v);
            }}
            style={[
              styles.microBtn,
              {
                backgroundColor: showAddNodeBox ? pal.pillActiveBg : pal.pillBg,
                borderColor: showAddNodeBox ? pal.gold : pal.border,
              },
            ]}
          >
            <Text variant="caption" style={{ color: pal.ink, fontSize: 10.5, fontWeight: '700' }}>
              {t('＋ 新建 [[双链]] 笔记节点', '＋ Add [[WikiLink]] Node')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 2. Domain Filter & Course Chapter Selector Strip */}
      <View style={[styles.domainStrip, { borderBottomColor: pal.border }]}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
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
            <Text variant="caption" style={{ color: selectedDomain === 'all' ? pal.goldText : pal.sub, fontSize: 10.5, fontWeight: '700' }}>
              {t(`全部课题 (${kgState.nodes.length})`, `All (${kgState.nodes.length})`)}
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
                    backgroundColor: active ? `${dom.color}20` : pal.pillBg,
                    borderColor: active ? dom.color : pal.border,
                  },
                ]}
              >
                <Text variant="caption" style={{ color: active ? dom.color : pal.sub, fontSize: 10.5, fontWeight: '700' }}>
                  {`[${dom.icon}] ${t(dom.zh, dom.en)}`}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Horizontal Node Selector Cards */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {visibleNodes.map((n) => {
            const isSel = n.id === selectedNode.id;
            const isCached = Boolean(kgState.offlineContents[n.id]);
            const hasAnim = Boolean(kgState.offlineContents[n.id]?.animationKind);
            const dotColor =
              n.status === 'mastered' ? pal.emerald : n.status === 'learning' ? pal.gold : pal.muted;
            return (
              <Pressable
                key={n.id}
                onPress={() => {
                  setSelectedNodeId(n.id);
                  setShowFlashcardAnswer(false);
                  setSelectedQuizOption(null);
                }}
                style={[
                  styles.nodeChipBtn,
                  {
                    backgroundColor: isSel ? pal.pillActiveBg : pal.cardBg,
                    borderColor: isSel ? pal.gold : pal.border,
                  },
                ]}
              >
                <Text variant="caption" style={{ color: dotColor, fontSize: 10.5, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
                  {`${n.code}${hasAnim ? '🎬' : ''}`}
                </Text>
                <Text variant="caption" style={{ color: isSel ? pal.goldText : pal.ink, fontSize: 10.5, fontWeight: isSel ? '700' : '500' }}>
                  {n.title.slice(0, 14)}
                </Text>
                <Text variant="caption" style={{ color: isCached ? pal.emerald : pal.muted, fontSize: 9.5 }}>
                  {isCached ? '●已缓存' : '○未装'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ================= SUB-VIEW 3: OFFLINE CHAPTER PACK STORE ================= */}
      {activeSubView === 'packs' ? (
        <View style={[styles.drawerBox, { backgroundColor: pal.cardBg, borderBottomColor: pal.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <Text variant="caption" style={{ color: pal.goldText, fontSize: 12, fontWeight: '700' }}>
              {t(
                '📦 按需离线章节包管理（零体积膨胀架构：App 仅内置 4KB 骨架索引，重型教学动画与题库按需装载/卸载）',
                '📦 On-Demand Offline Chapter Packs (Zero Bundle Bloat Architecture)',
              )}
            </Text>
            <Text variant="caption" style={{ color: pal.sky, fontSize: 10, fontFamily: theme.fontFamily.mono }}>
              {`存储位置: localStorage["${stats.storageKey}"] & ${stats.packFolderRelPath}`}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {CATALOG_CHAPTER_PACKS.map((pack) => {
              const installed = kgState.installedPackIds.includes(pack.id);
              return (
                <View
                  key={pack.id}
                  style={[
                    styles.packCard,
                    {
                      backgroundColor: pal.elevated,
                      borderColor: installed ? pal.emerald : pal.border,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text variant="caption" style={{ color: pal.ink, fontSize: 11.5, fontWeight: '700' }}>
                      {`[${pack.icon}] ${t(pack.titleZh, pack.titleEn)} (${pack.version})`}
                    </Text>
                    <Text variant="caption" style={{ color: installed ? pal.emerald : pal.muted, fontSize: 10, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                      {installed ? `✓ 已缓存 · ${pack.sizeKb} KB` : `未下载 · ${pack.sizeKb} KB`}
                    </Text>
                  </View>
                  <Text variant="caption" style={{ color: pal.sub, fontSize: 10 }}>
                    {pack.descriptionZh}
                  </Text>
                  <Text variant="caption" style={{ color: pal.muted, fontSize: 9.5, fontFamily: theme.fontFamily.mono }}>
                    {`本地包路径: ${pack.localFilePath} · 含 ${pack.nodeCount} 个章节`}
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 6 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`导出离线包文件 ${pack.titleZh}`}
                      onPress={() => void handleExportPackFile(pack.id)}
                      style={[styles.microBtn, { borderColor: pal.sky }]}
                    >
                      <Text variant="caption" style={{ color: pal.sky, fontSize: 10, fontWeight: '700' }}>
                        {t('📥 导出 .pack.json 到本地文件夹', '📥 Save .pack.json')}
                      </Text>
                    </Pressable>
                    {installed ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`卸载离线章节包 ${pack.titleZh}`}
                        onPress={() => {
                          setKgState(offloadKnowledgeChapterPack(pack.id));
                          showToast({
                            text: t(
                              `已卸载「${pack.titleZh}」释放 ${pack.sizeKb} KB，学习进度与笔记完整保留`,
                              `Offloaded ${pack.titleEn} (${pack.sizeKb} KB freed)`,
                            ),
                          });
                        }}
                        style={[styles.microBtn, { borderColor: pal.border }]}
                      >
                        <Text variant="caption" style={{ color: pal.muted, fontSize: 10 }}>
                          {t('卸载释放空间 (保留进度)', 'Offload Pack')}
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`下载离线章节包 ${pack.titleZh}`}
                        onPress={() => {
                          const res = installKnowledgeChapterPack(pack.id);
                          setKgState(res.state);
                          showToast({
                            text: t(
                              `✓ 已离线装载「${pack.titleZh}」(${pack.sizeKb} KB)`,
                              `✓ Installed ${pack.titleEn}`,
                            ),
                          });
                        }}
                        style={[
                          styles.microBtn,
                          { backgroundColor: 'rgba(52, 211, 153, 0.16)', borderColor: pal.emerald },
                        ]}
                      >
                        <Text variant="caption" style={{ color: pal.emerald, fontSize: 10, fontWeight: '700' }}>
                          {t('⬇ 一键离线装载章节包', '⬇ Install Offline Pack')}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* ================= SUB-VIEW 2: DAG KNOWLEDGE GRAPH & WIKILINK EDITOR ================= */}
      {activeSubView === 'graph' ? (
        <View style={{ padding: 12, gap: 10 }}>
          {showAddNodeBox ? (
            <View style={[styles.drawerBox, { backgroundColor: pal.cardBg, borderColor: pal.goldBorder, borderWidth: 1, borderRadius: 8 }]}>
              <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontWeight: '700' }}>
                {t(
                  '✍️ 导入自定义 Markdown 知识节点（在正文中输入 [[AI-101]] 或 [[Transformer]] 自动生成双向图谱连线）',
                  '✍️ Import Custom Markdown Node (Use [[Code]] or [[Title]] for automatic bidirectional links)',
                )}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <TextInput
                  value={customTitle}
                  onChangeText={setCustomTitle}
                  placeholder={t('节点标题，如：DeepSeek MLA 矩阵压缩推导', 'Node Title')}
                  placeholderTextColor={pal.muted}
                  style={[styles.input, { flex: 1, minWidth: 200, color: pal.ink, backgroundColor: pal.inputBg, borderColor: pal.border }]}
                />
                {KNOWLEDGE_DOMAINS.map((d) => (
                  <Pressable
                    key={d.id}
                    onPress={() => setCustomDomain(d.id)}
                    style={[
                      styles.microBtn,
                      {
                        backgroundColor: customDomain === d.id ? pal.pillActiveBg : pal.pillBg,
                        borderColor: customDomain === d.id ? pal.gold : pal.border,
                      },
                    ]}
                  >
                    <Text variant="caption" style={{ color: customDomain === d.id ? pal.goldText : pal.sub, fontSize: 10 }}>
                      {d.zh}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={customMd}
                onChangeText={setCustomMd}
                placeholder={t(
                  '支持多行要点与双向链接，例如：基于 [[AI-101]] 与 [[AI-201]] 将 KV 联合低秩压缩，显存再降 75%',
                  'Markdown notes with [[WikiLinks]]...',
                )}
                placeholderTextColor={pal.muted}
                multiline
                style={[styles.input, { minHeight: 60, color: pal.ink, backgroundColor: pal.inputBg, borderColor: pal.border }]}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="保存自定义知识节点"
                  onPress={() => {
                    const res = importCustomMarkdownKnowledgeNode({
                      title: customTitle,
                      domainId: customDomain,
                      markdownBody: customMd,
                      prerequisiteNodeId: selectedNode.id,
                    });
                    setKgState(res.state);
                    setSelectedNodeId(res.addedNode.id);
                    setCustomTitle('');
                    setCustomMd('');
                    setShowAddNodeBox(false);
                    showToast({
                      text: t(
                        `✓ 已加入知识图谱节点「${res.addedNode.code} ${res.addedNode.title}」`,
                        `✓ Added node ${res.addedNode.code}`,
                      ),
                    });
                  }}
                  style={[styles.microBtn, { backgroundColor: pal.gold, borderColor: pal.gold }]}
                >
                  <Text variant="caption" style={{ color: '#141311', fontSize: 10.5, fontWeight: '700' }}>
                    {t('✓ 挂载到个人知识图谱', '✓ Mount to Knowledge Graph')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={[styles.canvasCard, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontWeight: '700' }}>
                {t('2D 技能树前置依赖 (实线) + Obsidian [[双向链接]] (虚线) 拓扑画布', '2D Skill-Tree & Bidirectional WikiLink Topology')}
              </Text>
              <Text variant="caption" style={{ color: pal.muted, fontSize: 10 }}>
                {t('点击画布任意圆点即可切换至对应章节与交互动画', 'Click any node to inspect')}
              </Text>
            </View>
            <KnowledgeGraphSvgCanvas
              state={kgState}
              selectedNodeId={selectedNode.id}
              onSelectNode={(id) => {
                setSelectedNodeId(id);
                setShowFlashcardAnswer(false);
                setSelectedQuizOption(null);
              }}
              isDark={isDark}
              fullScreen={fullScreen}
            />
          </View>
        </View>
      ) : null}

      {/* ================= SELECTED CHAPTER INTERACTIVE ANIMATION & INSPECTOR ================= */}
      <View style={{ padding: 12, gap: 10 }}>
        <View style={[styles.inspectorCard, { backgroundColor: pal.cardBg, borderColor: pal.goldBorder }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <View style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}>
                <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
                  {selectedNode.code}
                </Text>
              </View>
              <Text variant="label" style={{ color: pal.ink, fontSize: 15, fontWeight: '700' }}>
                {selectedNode.title}
              </Text>
              <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, fontFamily: theme.fontFamily.mono }}>
                {`累计研习 ${selectedNode.studyMinutes} min · 掌握度 Lv.${selectedNode.reviewLevel}`}
              </Text>
            </View>

            {/* Status & Pomodoro Action Buttons */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {(['locked', 'learning', 'mastered'] as const).map((st) => {
                const active = selectedNode.status === st;
                return (
                  <Pressable
                    key={st}
                    onPress={() => {
                      setKgState(updateKnowledgeNodeProgress(selectedNode.id, { status: st }));
                    }}
                    style={[
                      styles.microBtn,
                      {
                        backgroundColor: active ? pal.pillActiveBg : pal.pillBg,
                        borderColor: active ? pal.gold : pal.border,
                      },
                    ]}
                  >
                    <Text variant="caption" style={{ color: active ? pal.goldText : pal.muted, fontSize: 10, fontWeight: '700' }}>
                      {st === 'mastered' ? '✦ 已掌握' : st === 'learning' ? '🔥 学习中' : '🔒 待解锁'}
                    </Text>
                  </Pressable>
                );
              })}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="专注研习该知识节点25分钟"
                onPress={() => {
                  const nextMins = selectedNode.studyMinutes + 25;
                  const nextStatus = nextMins >= 60 ? 'mastered' : 'learning';
                  setKgState(
                    updateKnowledgeNodeProgress(selectedNode.id, {
                      studyMinutes: nextMins,
                      reviewLevel: selectedNode.reviewLevel + 1,
                      status: nextStatus,
                    }),
                  );
                  onLogStudyMinutes?.(selectedNode.title, 25);
                  recordPledgeReward(localDay, 'study');
                  showToast({
                    text: t(
                      `✓ 已完成「${selectedNode.code}」25m 深度研习，同步计入一万小时定律 (+15 心流币)`,
                      `✓ Logged +25m on ${selectedNode.code}`,
                    ),
                  });
                }}
                style={[styles.microBtn, { backgroundColor: pal.gold, borderColor: pal.gold }]}
              >
                <Text variant="caption" style={{ color: '#141311', fontSize: 10.5, fontWeight: '700' }}>
                  {t('⏱ 打卡 +25m 专注研习', '⏱ Log +25m Study')}
                </Text>
              </Pressable>
            </View>
          </View>

          <Text variant="caption" style={{ color: pal.sub, fontSize: 11.5 }}>
            {selectedNode.summary}
          </Text>

          {selectedContent ? (
            <View style={{ gap: 10, marginTop: 4 }}>
              {/* ★ AI Interactive Animation Lab Stage ★ */}
              {selectedContent.animationKind ? (
                <AiInteractiveAnimationLab
                  kind={selectedContent.animationKind}
                  isDark={isDark}
                  fullScreen={fullScreen}
                />
              ) : null}

              {/* Core Mental Model & Key Takeaways Grid */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <View style={[styles.contentBox, { flex: 1, minWidth: 280, backgroundColor: pal.elevated, borderColor: pal.border }]}>
                  <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontWeight: '700' }}>
                    {t('💡 核心心智模型 (Core Mental Model)', '💡 Core Mental Model')}
                  </Text>
                  <Text variant="caption" style={{ color: pal.ink, fontSize: 11.5, lineHeight: 18 }}>
                    {selectedContent.coreMentalModel}
                  </Text>
                  <View style={{ gap: 4, marginTop: 4 }}>
                    {selectedContent.keyTakeaways.map((pt, idx) => (
                      <Text key={idx} variant="caption" style={{ color: pal.sub, fontSize: 10.5 }}>
                        {`• ${pt}`}
                      </Text>
                    ))}
                  </View>
                </View>

                <View style={{ flex: 1, minWidth: 280, gap: 8 }}>
                  {/* Code / Formula Box */}
                  <View style={[styles.codeBox, { backgroundColor: pal.inputBg, borderColor: pal.border }]}>
                    <Text variant="caption" style={{ color: pal.muted, fontSize: 9.5 }}>
                      {t('核心数学公式 / 算子伪代码:', 'Core Formula / Snippet:')}
                    </Text>
                    <Text variant="caption" style={{ color: pal.emerald, fontSize: 11, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                      {selectedContent.codeOrFormulaSnippet}
                    </Text>
                  </View>

                  {/* Spaced Repetition Flashcard */}
                  {selectedContent.flashcards[0] ? (
                    <Pressable
                      onPress={() => setShowFlashcardAnswer((v) => !v)}
                      style={[
                        styles.flashcardBox,
                        { backgroundColor: pal.elevated, borderColor: showFlashcardAnswer ? pal.emerald : pal.goldBorder },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                          {`🎯 记忆闪卡 Q: ${selectedContent.flashcards[0].q}`}
                        </Text>
                        <Text variant="caption" style={{ color: pal.sky, fontSize: 9.5 }}>
                          {showFlashcardAnswer ? t('收起答案 ▲', 'Hide ▲') : t('点击翻转答案 ▼', 'Flip Answer ▼')}
                        </Text>
                      </View>
                      {showFlashcardAnswer ? (
                        <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, marginTop: 4 }}>
                          {`A: ${selectedContent.flashcards[0].a}`}
                        </Text>
                      ) : null}
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {/* ★ Interactive Self-Test Quiz Card ★ */}
              {selectedContent.quiz ? (
                <View style={[styles.quizBox, { backgroundColor: pal.elevated, borderColor: pal.goldBorder }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                    <Text variant="caption" style={{ color: pal.goldText, fontSize: 11.5, fontWeight: '700' }}>
                      {`🧪 随堂交互自测 · ${selectedContent.quiz.questionZh}`}
                    </Text>
                    {selectedQuizOption !== null ? (
                      <Text
                        variant="caption"
                        style={{
                          color: selectedQuizOption === selectedContent.quiz.correctIndex ? pal.emerald : '#ef4444',
                          fontSize: 10.5,
                          fontWeight: '700',
                        }}
                      >
                        {selectedQuizOption === selectedContent.quiz.correctIndex
                          ? t('✓ 回答正确！掌握度 +1', '✓ Correct!')
                          : t('✗ 再想一想，查看下方解析', '✗ Try again')}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {selectedContent.quiz.optionsZh.map((opt, oIdx) => {
                      const chosen = selectedQuizOption === oIdx;
                      const isCorrect = oIdx === selectedContent.quiz?.correctIndex;
                      const borderC =
                        selectedQuizOption === null
                          ? pal.border
                          : isCorrect
                            ? pal.emerald
                            : chosen
                              ? '#ef4444'
                              : pal.border;
                      return (
                        <Pressable
                          key={oIdx}
                          onPress={() => {
                            setSelectedQuizOption(oIdx);
                            if (oIdx === selectedContent.quiz?.correctIndex) {
                              recordPledgeReward(localDay, 'study');
                            }
                          }}
                          style={[
                            styles.quizOptionBtn,
                            {
                              borderColor: borderC,
                              backgroundColor:
                                selectedQuizOption !== null && isCorrect
                                  ? 'rgba(52,211,153,0.16)'
                                  : chosen
                                    ? 'rgba(239,68,68,0.14)'
                                    : pal.cardBg,
                            },
                          ]}
                        >
                          <Text variant="caption" style={{ color: pal.ink, fontSize: 10.5 }}>
                            {opt}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {selectedQuizOption !== null ? (
                    <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, marginTop: 4 }}>
                      {`解析：${selectedContent.quiz.explanationZh}`}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            /* Uninstalled Chapter Pack Prompt */
            <View style={[styles.uninstalledBanner, { backgroundColor: pal.elevated, borderColor: pal.border }]}>
              <Text variant="caption" style={{ color: pal.muted, fontSize: 11 }}>
                {t(
                  `当前节点所属离线章节包 (${selectedNode.packId}) 尚未缓存到本地（仅占 ~20KB 空间）。`,
                  `Chapter pack (${selectedNode.packId}) is not cached locally yet.`,
                )}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`立即下载章节包 ${selectedNode.packId}`}
                onPress={() => {
                  const res = installKnowledgeChapterPack(selectedNode.packId);
                  setKgState(res.state);
                  if (res.pack) {
                    showToast({ text: t(`✓ 已离线装载「${res.pack.titleZh}」`, `✓ Installed ${res.pack.titleEn}`) });
                  }
                }}
                style={[styles.microBtn, { backgroundColor: pal.gold, borderColor: pal.gold }]}
              >
                <Text variant="caption" style={{ color: '#141311', fontSize: 10.5, fontWeight: '700' }}>
                  {t('⬇ 立即按需下载该章节包', '⬇ Download Chapter Pack Now')}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Studio Gear Unlocks Strip at Bottom */}
        <View style={[styles.topStrip, { backgroundColor: pal.elevated, borderColor: pal.border, borderWidth: 1, borderRadius: 8 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontWeight: '700' }}>
              {t('🏆 书房微缩藏品与等级解锁（随专注时长、知识节点掌握度与家庭净资产自动点亮）', '🏆 Studio Gear & Level Unlocks')}
            </Text>
            <Text variant="caption" style={{ color: pal.muted, fontSize: 10, fontFamily: theme.fontFamily.mono }}>
              {t(
                `已解锁 ${unlockables.filter((u) => u.unlocked).length}/${unlockables.length} 件书房陈列`,
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  topStrip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 6,
  },
  gearBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    gap: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  domainStrip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  modeTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  nodeChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  microBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  drawerBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  packCard: {
    flex: 1,
    minWidth: 240,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  input: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    fontSize: 12,
  },
  canvasCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  inspectorCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  animContainer: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.2,
    gap: 10,
  },
  animHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  controlToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  stepCaptionBox: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
    gap: 3,
  },
  contentBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  codeBox: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 7,
    borderWidth: 1,
    gap: 3,
  },
  flashcardBox: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 7,
    borderWidth: 1,
  },
  quizBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  quizOptionBtn: {
    flex: 1,
    minWidth: 210,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
  },
  uninstalledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
});
