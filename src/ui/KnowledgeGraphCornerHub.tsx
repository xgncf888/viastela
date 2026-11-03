import { createElement, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';

import {
  type AiAnimationKind,
  CATALOG_CHAPTER_PACKS,
  computeAttentionSimulation,
  computeDistributedParallelSimulation,
  computeFlashAttentionSimulation,
  computeKnowledgeGraphStats,
  computeLoraRagSimulation,
  computeMoeRoutingSimulation,
  computeNeuronGradientSimulation,
  computePagedAttentionSimulation,
  computeQuantizationSimulation,
  computeRnnVsAttentionSimulation,
  computeSpeculativeDecodingSimulation,
  computeStudioUnlockables,
  computeTokenNextWordSimulation,
  computeWordEmbeddingSimulation,
  exportChapterPackJson,
  importCustomMarkdownKnowledgeNode,
  installKnowledgeChapterPack,
  KNOWLEDGE_DOMAINS,
  type KnowledgeDomainId,
  type KnowledgeGraphState,
  LEARNING_STAGES,
  type LearningStageLevel,
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
 * 4-Step Progressive Disclosure Wizard Step inside each lesson:
 * 1 = 🌱 先听大白话比喻 (Zero-Jargon Analogy)
 * 2 = 🎬 动手玩交互动画 (Interactive Animation Sandbox)
 * 3 = 💡 3 句话核心规律 (3 Key Takeaways + Optional Formula Dictionary)
 * 4 = 🎯 1 道题闯关自测 (Single Quiz & Complete Lesson)
 */
export type LessonWizardStep = 1 | 2 | 3 | 4;

/**
 * Interactive Animated AI Learning Lab (AI 交互式动画实验台 · 极简聚焦版)
 * Highlights ONE obvious primary action button ("👉 点这里试试") so the user never feels lost!
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
  const [playing, setPlaying] = useState(false); // Default to manual step-by-step so it doesn't flash chaotically!
  const [tick, setTick] = useState(0);

  // L1-1: Token Next-Word Solitaire (AI-001)
  const [tokenStep, setTokenStep] = useState(0);
  const [samplingMode, setSamplingMode] = useState<'greedy' | 'top-p'>('greedy');

  // L1-2: Word Embedding 2D Galaxy & King-Man+Woman=Queen (AI-002)
  const [embedCluster, setEmbedCluster] = useState<'pets' | 'coffee' | 'tech'>('pets');
  const [showRoyaltyAnalogy, setShowRoyaltyAnalogy] = useState(false);

  // L1-3: Neuron Loss Valley & Gradient Descent (AI-003)
  const [gradStep, setGradStep] = useState(1);
  const [learningRate, setLearningRate] = useState(0.25);

  // L1-4: RNN Sequential Decay vs Attention O(1) Direct Link (AI-004)
  const [rnnLen, setRnnLen] = useState<4 | 8 | 16>(8);

  // L2: Self-Attention + Multi-Head + RoPE 2D Rotation (AI-101)
  const [focusTokenIdx, setFocusTokenIdx] = useState(5);
  const [attnHeadIdx, setAttnHeadIdx] = useState(0);
  const [attnStepIdx, setAttnStepIdx] = useState(2);
  const [temperature, setTemperature] = useState(0.8);

  // L3-1: RAG vs LoRA Low-Rank Adaptation (AI-105)
  const [loraRagMode, setLoraRagMode] = useState<'rag' | 'lora' | 'hybrid'>('hybrid');
  const [loraRank, setLoraRank] = useState<4 | 8 | 16>(8);

  // L3-2: FP16 -> INT4 Quantization & SmoothQuant Outliers (AI-701)
  const [quantPrecision, setQuantPrecision] = useState<'fp16' | 'int8' | 'int4'>('int4');
  const [smoothOutliers, setSmoothOutliers] = useState(true);

  // L4-1: PagedAttention (AI-201)
  const [pagedTokenCount, setPagedTokenCount] = useState(9);
  const [sharedPrefix, setSharedPrefix] = useState(true);

  // L4-2: Speculative Decoding (AI-301)
  const [specGamma, setSpecGamma] = useState(4);
  const [specPhase, setSpecPhase] = useState(0);

  // L4-3: FlashAttention Tiling (AI-401)
  const [flashTileIdx, setFlashTileIdx] = useState(1);

  // L4-4: MoE Top-K Router (AI-501)
  const [moeTokenIdx, setMoeTokenIdx] = useState(0);
  const [moeTopK, setMoeTopK] = useState(2);
  const [moeLoadBalance, setMoeLoadBalance] = useState(true);

  // L4-5: 3D Parallelism & ZeRO Sharding (AI-601)
  const [zeroStage, setZeroStage] = useState<0 | 1 | 2 | 3>(2);
  const [microBatches, setMicroBatches] = useState(8);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
      if (kind === 'token-next-word') {
        setTokenStep((prev) => (prev + 1) % 4);
      } else if (kind === 'word-embedding') {
        setEmbedCluster((prev) => (prev === 'pets' ? 'coffee' : prev === 'coffee' ? 'tech' : 'pets'));
      } else if (kind === 'neuron-gradient') {
        setGradStep((prev) => (prev >= 7 ? 0 : prev + 1));
      } else if (kind === 'rnn-vs-attention') {
        setRnnLen((prev) => (prev === 4 ? 8 : prev === 8 ? 16 : 4));
      } else if (kind === 'self-attention') {
        setAttnStepIdx((prev) => (prev + 1) % 4);
      } else if (kind === 'lora-rag') {
        setLoraRagMode((prev) => (prev === 'rag' ? 'lora' : prev === 'lora' ? 'hybrid' : 'rag'));
      } else if (kind === 'quantization-smooth') {
        setQuantPrecision((prev) => (prev === 'fp16' ? 'int8' : prev === 'int8' ? 'int4' : 'fp16'));
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
    }, 2200);
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
  const svgHeight = fullScreen ? 184 : 142;

  // ==================== LAB AI-001: TOKEN NEXT-WORD SOLITAIRE ====================
  if (kind === 'token-next-word') {
    const sim = computeTokenNextWordSimulation({
      generatedStep: tokenStep,
      samplingMode,
    });
    return (
      <View style={[styles.animContainer, { backgroundColor: boxBg, borderColor: borderCol }]}>
        {/* Single Clear Action Bar */}
        <View style={styles.animHeader}>
          <Pressable
            onPress={() => {
              setPlaying(false);
              setTokenStep((s) => (s + 1) % 4);
            }}
            style={[styles.primaryPlayBtn, { backgroundColor: '#34d399', borderColor: '#34d399' }]}
          >
            <Text variant="caption" style={{ color: '#0f172a', fontSize: 12, fontWeight: '700' }}>
              {t(`👉 点这里：接龙生成下一个词 (${tokenStep + 1}/4)`, `👉 Click: Generate Next Token (${tokenStep + 1}/4)`)}
            </Text>
          </Pressable>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable
              onPress={() => setSamplingMode((m) => (m === 'greedy' ? 'top-p' : 'greedy'))}
              style={[styles.microBtn, { borderColor: sky }]}
            >
              <Text variant="caption" style={{ color: sky, fontSize: 10.5, fontWeight: '700' }}>
                {samplingMode === 'greedy'
                  ? t('切换：当前为稳健选第 1 名', 'Mode: Greedy Top-1')
                  : t('切换：当前为 Top-P 创意抽签', 'Mode: Top-P Creative')}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.3, minWidth: 260, gap: 8 }}>
            <Text variant="caption" style={{ color: sub, fontSize: 11, fontWeight: '700' }}>
              {t('① 积木切词与逐词接龙过程：', '① Token Blocks & Solitaire Chain:')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {sim.baseTokens.map((tok) => (
                <View
                  key={tok.id}
                  style={{
                    paddingHorizontal: 11,
                    paddingVertical: 6,
                    borderRadius: 8,
                    borderWidth: 1.2,
                    borderColor: tok.color,
                    backgroundColor: `${tok.color}18`,
                    alignItems: 'center',
                  }}
                >
                  <Text variant="caption" style={{ color: ink, fontSize: 12.5, fontWeight: '700' }}>
                    {tok.text}
                  </Text>
                  <Text variant="caption" style={{ color: tok.color, fontSize: 9.5, fontFamily: theme.fontFamily.mono }}>
                    {`#${tok.id}`}
                  </Text>
                </View>
              ))}
              {sim.generatedTokens.map((gt, idx) => {
                const isLatest = idx === sim.generatedTokens.length - 1;
                return (
                  <View
                    key={`${gt.id}-${idx}`}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                      borderWidth: isLatest ? 2 : 1.2,
                      borderColor: isLatest ? '#f5b942' : emerald,
                      backgroundColor: isLatest ? 'rgba(245,185,66,0.25)' : 'rgba(52,211,153,0.18)',
                      alignItems: 'center',
                    }}
                  >
                    <Text variant="caption" style={{ color: isLatest ? gold : emerald, fontSize: 12.5, fontWeight: '700' }}>
                      {`${isLatest ? '✨ ' : ''}${gt.text}`}
                    </Text>
                    <Text variant="caption" style={{ color: sub, fontSize: 9.5, fontFamily: theme.fontFamily.mono }}>
                      {`概率 ${gt.probPct}%`}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={{ flex: 1, minWidth: 230, gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: borderCol, backgroundColor: isDark ? '#18181b' : '#ffffff' }}>
            <Text variant="caption" style={{ color: gold, fontSize: 11, fontWeight: '700' }}>
              {t('② 候选词概率榜（为什么选了它？）：', '② Next-Token Probability Ranking:')}
            </Text>
            {sim.candidates.map((cand) => (
              <View key={cand.tokenId} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text variant="caption" style={{ color: cand.chosen ? emerald : ink, fontSize: 11, fontWeight: cand.chosen ? '700' : '500', width: 66 }}>
                  {`${cand.chosen ? '👉 ' : ''}${cand.token}`}
                </Text>
                <View style={{ flex: 1, height: 14, borderRadius: 5, backgroundColor: isDark ? '#27272a' : '#e2e8f0', overflow: 'hidden' }}>
                  <View
                    style={{
                      width: `${cand.probPct}%`,
                      height: '100%',
                      backgroundColor: cand.chosen ? '#34d399' : '#38bdf8',
                    }}
                  />
                </View>
                <Text variant="caption" style={{ color: cand.chosen ? emerald : sub, fontSize: 10.5, fontFamily: theme.fontFamily.mono, width: 42, textAlign: 'right', fontWeight: '700' }}>
                  {`${cand.probPct}%`}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
          <Text variant="caption" style={{ color: sub, fontSize: 11.5, lineHeight: 18 }}>
            {sim.stepDescZh}
          </Text>
        </View>
      </View>
    );
  }

  // ==================== LAB AI-002: WORD EMBEDDING 2D GALAXY ====================
  if (kind === 'word-embedding') {
    const sim = computeWordEmbeddingSimulation({
      clusterId: embedCluster,
      showRoyaltyAnalogy,
    });
    return (
      <View style={[styles.animContainer, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.animHeader}>
          <Pressable
            onPress={() => {
              setPlaying(false);
              setShowRoyaltyAnalogy((v) => !v);
            }}
            style={[styles.primaryPlayBtn, { backgroundColor: '#f5b942', borderColor: '#f5b942' }]}
          >
            <Text variant="caption" style={{ color: '#141311', fontSize: 12, fontWeight: '700' }}>
              {showRoyaltyAnalogy
                ? t('👉 点这里：切回「宠物 / 咖啡 / AI」语义星团图', '👉 Back to Semantic Clusters')
                : t('👉 点这里试试：演示「国王 - 男人 + 女人 = 女王」向量魔法！', '👉 Click: Demo King - Man + Woman = Queen!')}
            </Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          {Platform.OS === 'web'
            ? createElement(
                'svg',
                { width: 360, height: 146, viewBox: '0 0 340 136', style: { flex: 1, minWidth: 260 } },
                createElement('rect', {
                  x: 4,
                  y: 4,
                  width: 332,
                  height: 128,
                  rx: 8,
                  fill: isDark ? '#18181b' : '#ffffff',
                  stroke: borderCol,
                }),
                createElement('line', { x1: 24, y1: 116, x2: 320, y2: 116, stroke: isDark ? '#334155' : '#cbd5e1', strokeWidth: 1 }),
                createElement('line', { x1: 24, y1: 14, x2: 24, y2: 116, stroke: isDark ? '#334155' : '#cbd5e1', strokeWidth: 1 }),
                showRoyaltyAnalogy
                  ? createElement(
                      'g',
                      null,
                      createElement('line', {
                        x1: 95,
                        y1: 96,
                        x2: 108,
                        y2: 34,
                        stroke: '#f5b942',
                        strokeWidth: 2.2,
                        strokeDasharray: '4 2',
                      }),
                      createElement('line', {
                        x1: 246,
                        y1: 94,
                        x2: 260,
                        y2: 32,
                        stroke: '#34d399',
                        strokeWidth: 2.6,
                      }),
                      createElement('line', {
                        x1: 108,
                        y1: 34,
                        x2: 260,
                        y2: 32,
                        stroke: '#f472b6',
                        strokeWidth: 2,
                        strokeDasharray: '3 3',
                      }),
                    )
                  : null,
                sim.points.map((pt) => {
                  const cx = 24 + (pt.x / 100) * 290;
                  const cy = 12 + (pt.y / 100) * 98;
                  return createElement(
                    'g',
                    { key: pt.word },
                    createElement('circle', { cx, cy, r: 7, fill: pt.color }),
                    createElement(
                      'text',
                      {
                        x: cx,
                        y: cy - 10,
                        textAnchor: 'middle',
                        fill: ink,
                        fontSize: '10.5',
                        fontWeight: '700',
                      },
                      pt.word,
                    ),
                  );
                }),
              )
            : null}

          <View style={{ flex: 1, minWidth: 240, gap: 6 }}>
            <Text variant="caption" style={{ color: gold, fontSize: 11.5, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
              {sim.pairLabelZh}
            </Text>
            {sim.points.slice(0, 4).map((pt) => (
              <View key={pt.word} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 }}>
                <Text variant="caption" style={{ color: pt.color, fontSize: 11, fontWeight: '700', width: 98 }}>
                  {pt.word}
                </Text>
                <Text variant="caption" style={{ color: sub, fontSize: 10.5, fontFamily: theme.fontFamily.mono }}>
                  {`[${pt.dims[0]}, ${pt.dims[1]}, ${pt.dims[2]}]`}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
          <Text variant="caption" style={{ color: sub, fontSize: 11.5, lineHeight: 18 }}>
            {sim.summaryZh}
          </Text>
        </View>
      </View>
    );
  }

  // ==================== LAB AI-003: NEURON LOSS VALLEY & GRADIENT DESCENT ====================
  if (kind === 'neuron-gradient') {
    const sim = computeNeuronGradientSimulation({
      stepCount: gradStep,
      learningRate,
    });
    return (
      <View style={[styles.animContainer, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.animHeader}>
          <Pressable
            onPress={() => {
              setPlaying(false);
              setGradStep((s) => (s >= 7 ? 0 : s + 1));
            }}
            style={[styles.primaryPlayBtn, { backgroundColor: '#34d399', borderColor: '#34d399' }]}
          >
            <Text variant="caption" style={{ color: '#0f172a', fontSize: 12, fontWeight: '700' }}>
              {t(`👉 点这里：往山谷底迈出第 ${gradStep + 1} 步`, `👉 Click: Step Downhill (${gradStep + 1})`)}
            </Text>
          </Pressable>

          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {[
              { lr: 0.08, label: '太慢 (0.08)' },
              { lr: 0.25, label: '刚刚好 (0.25)' },
              { lr: 0.92, label: '步太大震荡 (0.92)' },
            ].map((item) => (
              <Pressable
                key={item.lr}
                onPress={() => {
                  setPlaying(false);
                  setLearningRate(item.lr);
                  setGradStep(4);
                }}
                style={[
                  styles.microBtn,
                  {
                    borderColor: Math.abs(learningRate - item.lr) < 0.02 ? gold : borderCol,
                    backgroundColor: Math.abs(learningRate - item.lr) < 0.02 ? 'rgba(245,185,66,0.20)' : 'transparent',
                  },
                ]}
              >
                <Text variant="caption" style={{ color: Math.abs(learningRate - item.lr) < 0.02 ? gold : sub, fontSize: 10.5, fontWeight: '700' }}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {Platform.OS === 'web'
          ? createElement(
              'svg',
              { width: '100%', height: 140, viewBox: '0 0 600 132' },
              createElement('path', {
                d: 'M 80 18 Q 300 198 520 18',
                fill: 'none',
                stroke: isDark ? '#475569' : '#94a3b8',
                strokeWidth: 2.5,
              }),
              createElement('circle', { cx: 300, cy: 108, r: 6.5, fill: '#34d399' }),
              createElement(
                'text',
                { x: 300, y: 126, textAnchor: 'middle', fill: emerald, fontSize: '10.5', fontWeight: '700' },
                '★ 谷底零误差最优解 w=3.0',
              ),
              sim.trajectory.map((pt, idx) => {
                const cx = 80 + (pt.w / 6) * 440;
                const cy = 108 - Math.min(92, (pt.loss / 9) * 90);
                const isLast = idx === sim.trajectory.length - 1;
                const prev = idx > 0 ? sim.trajectory[idx - 1] : null;
                const prevX = prev ? 80 + (prev.w / 6) * 440 : cx;
                const prevY = prev ? 108 - Math.min(92, (prev.loss / 9) * 90) : cy;
                return createElement(
                  'g',
                  { key: idx },
                  prev
                    ? createElement('line', {
                        x1: prevX,
                        y1: prevY,
                        x2: cx,
                        y2: cy,
                        stroke: learningRate > 0.7 ? '#ef4444' : '#f5b942',
                        strokeWidth: 2.2,
                        strokeDasharray: '3 2',
                      })
                    : null,
                  createElement('circle', {
                    cx,
                    cy,
                    r: isLast ? 8 : 4.5,
                    fill: isLast ? '#f5b942' : '#38bdf8',
                    stroke: isLast ? '#ffffff' : 'none',
                    strokeWidth: 1.5,
                  }),
                  isLast
                    ? createElement(
                        'text',
                        {
                          x: cx,
                          y: Math.max(14, cy - 12),
                          textAnchor: 'middle',
                          fill: gold,
                          fontSize: '11',
                          fontWeight: '700',
                        },
                        `当前小球 w=${pt.w} (误差=${pt.loss})`,
                      )
                    : null,
                );
              }),
            )
          : null}

        <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
          <Text variant="caption" style={{ color: sub, fontSize: 11.5, lineHeight: 18 }}>
            {sim.stepDescZh}
          </Text>
        </View>
      </View>
    );
  }

  // ==================== LAB AI-004: RNN DECAY VS ATTENTION DIRECT LINK ====================
  if (kind === 'rnn-vs-attention') {
    const sim = computeRnnVsAttentionSimulation({ sentenceLength: rnnLen });
    return (
      <View style={[styles.animContainer, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.animHeader}>
          <Text variant="caption" style={{ color: gold, fontSize: 11.5, fontWeight: '700' }}>
            {t('👉 点选下方句子长度，对比「传声筒失忆」与「微信 @ 直连」：', '👉 Click sentence length to compare RNN vs Attention:')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([4, 8, 16] as const).map((len) => (
              <Pressable
                key={len}
                onPress={() => {
                  setPlaying(false);
                  setRnnLen(len);
                }}
                style={[
                  styles.primaryPlayBtn,
                  {
                    backgroundColor: rnnLen === len ? '#f5b942' : 'transparent',
                    borderColor: rnnLen === len ? '#f5b942' : borderCol,
                  },
                ]}
              >
                <Text variant="caption" style={{ color: rnnLen === len ? '#141311' : ink, fontSize: 11, fontWeight: '700' }}>
                  {len === 4 ? '短句 (4词)' : len === 8 ? '中句 (8词)' : '长句 (16词·看RNN失忆!)'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <View style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', backgroundColor: isDark ? '#18181b' : '#ffffff', gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption" style={{ color: '#ef4444', fontSize: 11, fontWeight: '700' }}>
                {`❌ 旧模型 RNN 传声筒：挨个传了 ${sim.rnnStepsRequired} 步，句首「小猫」传到句尾时只剩 ${sim.rnnRetentionPct}% 记忆`}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
              {sim.tokens.map((tok, idx) => {
                const fade = Math.max(0.14, 1 - (idx / sim.tokens.length) * (sim.sentenceLength === 16 ? 0.9 : 0.65));
                return (
                  <View
                    key={`rnn-${idx}`}
                    style={{
                      paddingHorizontal: 7,
                      paddingVertical: 4,
                      borderRadius: 5,
                      backgroundColor: `rgba(245, 185, 66, ${fade.toFixed(2)})`,
                    }}
                  >
                    <Text variant="caption" style={{ color: ink, fontSize: 10.5, fontWeight: idx === 0 || idx === sim.tokens.length - 1 ? '700' : '500' }}>
                      {`${tok}${idx < sim.tokens.length - 1 ? ' →' : ''}`}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={{ padding: 10, borderRadius: 8, borderWidth: 1.5, borderColor: emerald, backgroundColor: isDark ? '#18181b' : '#ffffff', gap: 6 }}>
            <Text variant="caption" style={{ color: emerald, fontSize: 11, fontWeight: '700' }}>
              {`✅ Transformer 注意力直连：不管句子多长，句尾「它」永远 1 步专线连回「小猫」（记忆保留 ${sim.attentionRetentionPct}%！）`}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: 'rgba(52,211,153,0.22)', borderWidth: 1, borderColor: emerald }}>
                <Text variant="caption" style={{ color: emerald, fontSize: 11, fontWeight: '700' }}>
                  {`句首：「${sim.tokens[0]}」`}
                </Text>
              </View>
              <Text variant="caption" style={{ color: gold, fontSize: 11.5, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
                {`⚡ ══════ 1 步直连专线 (跨越 ${sim.rnnStepsRequired} 词不衰减) ══════ ⚡`}
              </Text>
              <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: 'rgba(245,185,66,0.22)', borderWidth: 1, borderColor: gold }}>
                <Text variant="caption" style={{ color: gold, fontSize: 11, fontWeight: '700' }}>
                  {`句尾：「${sim.tokens[sim.tokens.length - 1]}」`}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ==================== LAB AI-105: RAG VS LORA ADAPTATION ====================
  if (kind === 'lora-rag') {
    const sim = computeLoraRagSimulation({
      mode: loraRagMode,
      loraRank,
    });
    return (
      <View style={[styles.animContainer, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.animHeader}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {(['rag', 'lora', 'hybrid'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  setPlaying(false);
                  setLoraRagMode(m);
                }}
                style={[
                  styles.primaryPlayBtn,
                  {
                    borderColor: loraRagMode === m ? '#f5b942' : borderCol,
                    backgroundColor: loraRagMode === m ? '#f5b942' : 'transparent',
                  },
                ]}
              >
                <Text variant="caption" style={{ color: loraRagMode === m ? '#141311' : ink, fontSize: 11, fontWeight: '700' }}>
                  {m === 'rag' ? '📚 1. 纯 RAG 开卷检索' : m === 'lora' ? '🩹 2. 纯 LoRA 贴便利贴' : '⚡ 3. RAG+LoRA 组合拳'}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {([4, 8, 16] as const).map((r) => (
              <Pressable
                key={r}
                onPress={() => setLoraRank(r)}
                style={[
                  styles.microBtn,
                  {
                    borderColor: loraRank === r ? emerald : borderCol,
                    backgroundColor: loraRank === r ? 'rgba(52,211,153,0.18)' : 'transparent',
                  },
                ]}
              >
                <Text variant="caption" style={{ color: emerald, fontSize: 10, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                  {`便利贴厚度 r=${r}`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <View style={{ flex: 1, minWidth: 200, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: sky, backgroundColor: isDark ? '#18181b' : '#ffffff', gap: 4 }}>
            <Text variant="caption" style={{ color: sky, fontSize: 11, fontWeight: '700' }}>
              {t('❄️ 冻结原模型主干 W_0 (不动原字典)', '❄️ Frozen Base Weight W_0')}
            </Text>
            <Text variant="caption" style={{ color: ink, fontSize: 13, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
              {`${sim.fullParamsMillion}M 参数 · 0 训练显存`}
            </Text>
          </View>

          <View style={{ flex: 1, minWidth: 200, padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: gold, backgroundColor: isDark ? '#18181b' : '#ffffff', gap: 4 }}>
            <Text variant="caption" style={{ color: gold, fontSize: 11, fontWeight: '700' }}>
              {`🔥 只训练 LoRA 便利贴旁路 (r=${sim.loraRank})`}
            </Text>
            <Text variant="caption" style={{ color: emerald, fontSize: 13, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
              {`仅 ${sim.loraParamsMillion}M 参数 (省下 ${sim.paramSavingPct}%！)`}
            </Text>
          </View>
        </View>

        <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
          <Text variant="caption" style={{ color: sub, fontSize: 11.5, lineHeight: 18 }}>
            {sim.summaryZh}
          </Text>
        </View>
      </View>
    );
  }

  // ==================== LAB AI-701: INT4 QUANTIZATION & SMOOTHQUANT ====================
  if (kind === 'quantization-smooth') {
    const sim = computeQuantizationSimulation({
      precision: quantPrecision,
      smoothOutliers,
    });
    return (
      <View style={[styles.animContainer, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.animHeader}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {(['fp16', 'int8', 'int4'] as const).map((p) => (
              <Pressable
                key={p}
                onPress={() => {
                  setPlaying(false);
                  setQuantPrecision(p);
                }}
                style={[
                  styles.primaryPlayBtn,
                  {
                    borderColor: quantPrecision === p ? '#f5b942' : borderCol,
                    backgroundColor: quantPrecision === p ? '#f5b942' : 'transparent',
                  },
                ]}
              >
                <Text variant="caption" style={{ color: quantPrecision === p ? '#141311' : ink, fontSize: 11, fontWeight: '700' }}>
                  {p === 'fp16' ? 'FP16 原版 (14GB)' : p === 'int8' ? 'INT8 半压缩 (7GB)' : 'INT4 极速版 (3.8GB)'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => setSmoothOutliers((s) => !s)}
            style={[styles.microBtn, { borderColor: smoothOutliers ? emerald : '#ef4444' }]}
          >
            <Text variant="caption" style={{ color: smoothOutliers ? emerald : '#ef4444', fontSize: 10.5, fontWeight: '700' }}>
              {smoothOutliers
                ? t('👉 点这里对比：已开启 SmoothQuant 压平尖峰', '✓ SmoothQuant On')
                : t('👉 点这里修复：未压平 48.0 离群尖峰 (误差飙升!)', '⚠ Outliers Unsmoothed')}
            </Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {sim.activationChannels.map((ch) => {
            const val = sim.smoothOutliers ? ch.smoothedVal : ch.rawVal;
            const isSpike = val > 10;
            return (
              <View
                key={ch.name}
                style={{
                  flex: 1,
                  minWidth: 120,
                  padding: 10,
                  borderRadius: 8,
                  borderWidth: 1.2,
                  borderColor: isSpike ? '#ef4444' : emerald,
                  backgroundColor: isDark ? '#18181b' : '#ffffff',
                  gap: 3,
                }}
              >
                <Text variant="caption" style={{ color: isSpike ? '#ef4444' : sub, fontSize: 10, fontWeight: '700' }}>
                  {ch.name}
                </Text>
                <Text variant="caption" style={{ color: ink, fontSize: 12.5, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
                  {`数值: ${val.toFixed(1)}`}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
          <Text variant="caption" style={{ color: sub, fontSize: 11.5, lineHeight: 18 }}>
            {sim.summaryZh}
          </Text>
        </View>
      </View>
    );
  }

  // ==================== LAB AI-101: SELF-ATTENTION + ROPE ====================
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text variant="caption" style={{ color: gold, fontSize: 11.5, fontWeight: '700' }}>
              {t('👉 点击切换提问词 (Query)：', '👉 Click Query Token:')}
            </Text>
            {sim.tokens.map((tok, idx) => {
              const active = idx === sim.focusTokenIdx;
              return (
                <Pressable
                  key={tok}
                  onPress={() => setFocusTokenIdx(idx)}
                  style={[
                    styles.primaryPlayBtn,
                    {
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      backgroundColor: active ? '#f5b942' : 'transparent',
                      borderColor: active ? '#f5b942' : borderCol,
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: active ? '#141311' : ink, fontSize: 11, fontWeight: '700' }}>
                    {tok}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {[0.4, 0.8, 1.6].map((tVal) => (
              <Pressable
                key={String(tVal)}
                onPress={() => setTemperature(tVal)}
                style={[
                  styles.microBtn,
                  {
                    backgroundColor: Math.abs(temperature - tVal) < 0.05 ? 'rgba(56,189,248,0.22)' : 'transparent',
                    borderColor: Math.abs(temperature - tVal) < 0.05 ? sky : borderCol,
                  },
                ]}
              >
                <Text variant="caption" style={{ color: sky, fontSize: 10, fontWeight: '700' }}>
                  {tVal === 0.4 ? 'τ=0.4 尖锐聚焦' : tVal === 0.8 ? 'τ=0.8 标准' : 'τ=1.6 平均分散'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {Platform.OS === 'web'
          ? createElement(
              'svg',
              { width: '100%', height: svgHeight, viewBox: '0 0 680 148' },
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
                  }),
                  createElement('rect', {
                    x: xTo - 24,
                    y: 8,
                    width: 48,
                    height: 24,
                    rx: 6,
                    fill: idx === sim.focusTokenIdx ? '#f5b942' : isDark ? '#27272a' : '#e7e2d6',
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
                );
              }),
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
                  `RoPE 位置指针 (m=${sim.focusTokenIdx})`,
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
                  x1: 590,
                  y1: 74,
                  x2: ropeX,
                  y2: ropeY,
                  stroke: '#f5b942',
                  strokeWidth: 3,
                  strokeLinecap: 'round',
                }),
                createElement('circle', { cx: ropeX, cy: ropeY, r: 4.5, fill: '#34d399' }),
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
                  `旋转角 ∠${sim.ropeAngleDeg}°`,
                ),
              ),
            )
          : null}

        <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
          <Text variant="caption" style={{ color: sub, fontSize: 11.5, lineHeight: 18 }}>
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
          <Pressable
            onPress={() => {
              setPlaying(false);
              setPagedTokenCount((c) => (c >= 16 ? 4 : c + 1));
            }}
            style={[styles.primaryPlayBtn, { backgroundColor: '#34d399', borderColor: '#34d399' }]}
          >
            <Text variant="caption" style={{ color: '#0f172a', fontSize: 12, fontWeight: '700' }}>
              {t(`👉 点这里：新生成 1 个词，看它坐进哪张 4 人小方桌 (当前 ${pagedTokenCount} 词)`, `👉 Click: +1 Token (${pagedTokenCount})`)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSharedPrefix((p) => !p)}
            style={[styles.microBtn, { borderColor: sharedPrefix ? emerald : borderCol }]}
          >
            <Text variant="caption" style={{ color: sharedPrefix ? emerald : sub, fontSize: 10.5, fontWeight: '700' }}>
              {sharedPrefix ? t('✓ CoW 前缀共享已开启', '✓ CoW Shared') : t('○ 开启 CoW 共享', '○ CoW Off')}
            </Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {sim.logicalBlocks.map((blk) => (
            <View
              key={blk.logicalIndex}
              style={{
                flex: 1,
                minWidth: 140,
                padding: 9,
                borderRadius: 8,
                borderWidth: 1.2,
                borderColor: blk.isSharedCoW ? emerald : sky,
                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                gap: 5,
              }}
            >
              <Text variant="caption" style={{ color: sky, fontSize: 10.5, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
                {`逻辑桌 L${blk.logicalIndex} → 物理框 P#${blk.physicalBlockId}`}
              </Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[0, 1, 2, 3].map((slotIdx) => {
                  const tok = blk.tokens[slotIdx];
                  return (
                    <View
                      key={slotIdx}
                      style={{
                        flex: 1,
                        height: 26,
                        borderRadius: 5,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: tok ? 'rgba(245,185,66,0.22)' : 'rgba(148,163,184,0.12)',
                        borderWidth: 1,
                        borderColor: tok ? '#f5b942' : borderCol,
                      }}
                    >
                      <Text variant="caption" style={{ color: tok ? ink : sub, fontSize: 9.5, fontWeight: '600' }}>
                        {tok ?? '空位'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
          <Text variant="caption" style={{ color: sub, fontSize: 11.5, lineHeight: 18 }}>
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
          <Pressable
            onPress={() => setSpecPhase((p) => p + 1)}
            style={[styles.primaryPlayBtn, { backgroundColor: '#f5b942', borderColor: '#f5b942' }]}
          >
            <Text variant="caption" style={{ color: '#141311', fontSize: 12, fontWeight: '700' }}>
              {t('👉 点这里切换：「4词全猜中白送1词」vs「最后1词猜错由大教授当场修正」', '👉 Toggle All-Hit vs Corrected')}
            </Text>
          </Pressable>
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
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1.5,
                  borderColor: cColor,
                  backgroundColor: `${cColor}18`,
                }}
              >
                <Text variant="caption" style={{ color: cColor, fontSize: 11.5, fontWeight: '700' }}>
                  {`${cand.status === 'accepted' ? '✓ 验证通过' : cand.status === 'bonus' ? '★ 教授白送词' : '↻ 教授当场修正'} · ${cand.token}`}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
          <Text variant="caption" style={{ color: sub, fontSize: 11.5, lineHeight: 18 }}>
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
          <Pressable
            onPress={() => setFlashTileIdx((p) => (p + 1) % 4)}
            style={[styles.primaryPlayBtn, { backgroundColor: '#f5b942', borderColor: '#f5b942' }]}
          >
            <Text variant="caption" style={{ color: '#141311', fontSize: 12, fontWeight: '700' }}>
              {t(`👉 点这里：把下一盘食材端上 SRAM 案板 (${flashSim.activeTileIdx + 1}/4)`, '👉 Next SRAM Tile ▶')}
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
                  minWidth: 130,
                  padding: 10,
                  borderRadius: 8,
                  borderWidth: 1.5,
                  borderColor: isCurrent ? gold : isDone ? emerald : borderCol,
                  backgroundColor: isCurrent ? 'rgba(245,185,66,0.20)' : isDone ? 'rgba(52,211,153,0.12)' : 'transparent',
                  gap: 4,
                }}
              >
                <Text variant="caption" style={{ color: isCurrent ? gold : isDone ? emerald : sub, fontSize: 11, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
                  {`分块 #${tIdx + 1} ${isCurrent ? '⚡案板计算中' : isDone ? '✓已归约' : '待端上'}`}
                </Text>
                <Text variant="caption" style={{ color: sub, fontSize: 10 }}>
                  {isCurrent ? `最高分 m=${flashSim.runningMax} · 修正系数 α=${flashSim.rescaleFactor}` : isDone ? '已合并进总结果' : '在 HBM 冷库等待'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
          <Text variant="caption" style={{ color: sub, fontSize: 11.5, lineHeight: 18 }}>
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
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Text variant="caption" style={{ color: gold, fontSize: 11.5, fontWeight: '700' }}>
              {t('👉 点击挂号不同领域问题，看分诊台点亮哪位专家：', '👉 Select Token to Route:')}
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
                    styles.primaryPlayBtn,
                    {
                      backgroundColor: active ? '#f5b942' : 'transparent',
                      borderColor: active ? '#f5b942' : borderCol,
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: active ? '#141311' : ink, fontSize: 11, fontWeight: '700' }}>
                    {`${tok.text} (${tok.domain})`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {moeSim.experts.map((exp) => (
            <View
              key={exp.id}
              style={{
                flex: 1,
                minWidth: 145,
                padding: 9,
                borderRadius: 8,
                borderWidth: exp.selected ? 1.5 : 1,
                borderColor: exp.isShared ? emerald : exp.selected ? '#f5b942' : borderCol,
                backgroundColor: exp.isShared
                  ? 'rgba(52,211,153,0.16)'
                  : exp.selected
                    ? 'rgba(245,185,66,0.18)'
                    : isDark
                      ? '#18181b'
                      : '#ffffff',
                opacity: exp.selected ? 1 : 0.55,
                gap: 3,
              }}
            >
              <Text variant="caption" style={{ color: exp.isShared ? emerald : exp.selected ? gold : sub, fontSize: 10.5, fontWeight: '700' }}>
                {exp.nameZh}
              </Text>
              <Text variant="caption" style={{ color: sub, fontSize: 9.5 }}>
                {exp.selected ? `⚡ 已出诊 (得分 ${exp.scorePct}%)` : '○ 休息中 (省算力)'}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
          <Text variant="caption" style={{ color: sub, fontSize: 11.5, lineHeight: 18 }}>
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
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Text variant="caption" style={{ color: gold, fontSize: 11.5, fontWeight: '700' }}>
            {t('👉 点击切换 ZeRO 切分等级，看 8 张显卡如何分摊 112GB 显存：', '👉 Select ZeRO Stage:')}
          </Text>
          {([0, 1, 2, 3] as const).map((st) => (
            <Pressable
              key={st}
              onPress={() => {
                setPlaying(false);
                setZeroStage(st);
              }}
              style={[
                styles.primaryPlayBtn,
                {
                  borderColor: zeroStage === st ? '#34d399' : borderCol,
                  backgroundColor: zeroStage === st ? '#34d399' : 'transparent',
                },
              ]}
            >
              <Text variant="caption" style={{ color: zeroStage === st ? '#0f172a' : ink, fontSize: 11, fontWeight: '700' }}>
                {st === 0 ? '不切分 (112GB)' : st === 1 ? 'ZeRO-1 切优化器 (38GB)' : st === 2 ? 'ZeRO-2 +切梯度 (26GB)' : 'ZeRO-3 全切分 (14.1GB)'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[
          { label: '1. 模型参数 (Parameters)', gb: parallelSim.paramMemGb, baseGb: 14, color: '#38bdf8' },
          { label: '2. 梯度草稿 (Gradients)', gb: parallelSim.gradMemGb, baseGb: 14, color: '#f5b942' },
          { label: '3. Adam 优化器状态 (占大头!)', gb: parallelSim.optimMemGb, baseGb: 84, color: '#f472b6' },
        ].map((item) => (
          <View
            key={item.label}
            style={{
              flex: 1,
              minWidth: 150,
              padding: 10,
              borderRadius: 8,
              borderWidth: 1.2,
              borderColor: item.color,
              backgroundColor: isDark ? '#18181b' : '#ffffff',
              gap: 4,
            }}
          >
            <Text variant="caption" style={{ color: item.color, fontSize: 10.5, fontWeight: '700' }}>
              {item.label}
            </Text>
            <Text variant="caption" style={{ color: ink, fontSize: 13, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
              {`${item.gb} GB / 卡`}
            </Text>
            <Text variant="caption" style={{ color: sub, fontSize: 9.5 }}>
              {item.gb < item.baseGb ? `✓ 已由 8 卡平摊 (原 ${item.baseGb}GB)` : '未平摊 (每卡存整份)'}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.stepCaptionBox, { borderColor: borderCol }]}>
        <Text variant="caption" style={{ color: sub, fontSize: 11.5, lineHeight: 18 }}>
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
  const height = fullScreen ? 260 : 196;
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
              r: 24,
              fill: `${statusColor}25`,
              stroke: statusColor,
              strokeWidth: 1.8,
              strokeDasharray: '3 2',
            })
          : null,
        createElement('circle', {
          cx,
          cy,
          r: 16,
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
            fontWeight: isSelected ? '700' : '600',
          },
          `${node.title.slice(0, 9)}${isCached ? ' ●' : ' ○'}`,
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
  // Default to Stage 1 (零基础小白入门) so only 4 clean lessons show up instead of 15!
  const [selectedStage, setSelectedStage] = useState<LearningStageLevel>(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node-ai-001-token');
  // 4-Step Wizard inside each lesson: only 1 card shown at a time!
  const [wizardStep, setWizardStep] = useState<LessonWizardStep>(1);
  const [showFormulaDetail, setShowFormulaDetail] = useState(false);

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

  // Only show nodes belonging to the selected Stage (3–5 lessons max, zero clutter!)
  const stageNodes = useMemo(
    () => kgState.nodes.filter((n) => (n.stageLevel ?? 2) === selectedStage),
    [kgState.nodes, selectedStage],
  );

  const selectedNode = useMemo(
    () =>
      kgState.nodes.find((n) => n.id === selectedNodeId) ??
      stageNodes[0] ??
      kgState.nodes[0]!,
    [kgState.nodes, selectedNodeId, stageNodes],
  );
  const selectedContent = kgState.offlineContents[selectedNode.id] ?? null;

  // Ordered full curriculum for "Next Lesson" progression across stages
  const orderedAllNodes = useMemo(
    () => [...kgState.nodes].sort((a, b) => (a.stageLevel ?? 2) - (b.stageLevel ?? 2)),
    [kgState.nodes],
  );
  const globalIndex = useMemo(
    () => Math.max(0, orderedAllNodes.findIndex((n) => n.id === selectedNode.id)),
    [orderedAllNodes, selectedNode.id],
  );
  const nextNodeGlobal = orderedAllNodes[globalIndex + 1] ?? null;

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

  function selectLesson(nodeId: string, stageLevel?: LearningStageLevel) {
    setSelectedNodeId(nodeId);
    if (stageLevel) setSelectedStage(stageLevel);
    setWizardStep(1);
    setShowFormulaDetail(false);
    setShowFlashcardAnswer(false);
    setSelectedQuizOption(null);
  }

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

  const activeStageMeta =
    LEARNING_STAGES.find((s) => s.level === selectedStage) ?? LEARNING_STAGES[0]!;

  return (
    <View style={[styles.container, { backgroundColor: pal.bg, borderColor: pal.goldBorder }]}>
      {/* 1. Calm Top Bar: Left = 4 Progressive Stages; Right = Secondary Tools (Graph / Offline Packs) */}
      <View style={[styles.headerRow, { backgroundColor: pal.elevated, borderBottomColor: pal.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          {LEARNING_STAGES.map((stg) => {
            const active = activeSubView === 'lab' && selectedStage === stg.level;
            return (
              <Pressable
                key={stg.level}
                accessibilityRole="button"
                accessibilityLabel={t(stg.zh, stg.en)}
                onPress={() => {
                  setActiveSubView('lab');
                  setSelectedStage(stg.level);
                  const firstInStage = kgState.nodes.find((n) => n.stageLevel === stg.level);
                  if (firstInStage) selectLesson(firstInStage.id, stg.level);
                }}
                style={[
                  styles.stageTabBtn,
                  {
                    backgroundColor: active ? `${stg.color}24` : pal.pillBg,
                    borderColor: active ? stg.color : pal.border,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{
                    color: active ? stg.color : pal.sub,
                    fontSize: 12,
                    fontWeight: active ? '700' : '600',
                  }}
                >
                  {t(stg.badge, stg.en)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Secondary Views (Knowledge Graph & Offline Packs) Tucked Neatly on Right */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Pressable
            onPress={() => setActiveSubView(activeSubView === 'graph' ? 'lab' : 'graph')}
            style={[
              styles.microBtn,
              {
                backgroundColor: activeSubView === 'graph' ? pal.pillActiveBg : pal.pillBg,
                borderColor: activeSubView === 'graph' ? pal.gold : pal.border,
              },
            ]}
          >
            <Text variant="caption" style={{ color: activeSubView === 'graph' ? pal.goldText : pal.sub, fontSize: 11, fontWeight: '600' }}>
              {activeSubView === 'graph' ? t('← 返回互动课堂', '← Back to Lesson') : t('🗺 全景知识图谱', '🗺 Graph')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveSubView(activeSubView === 'packs' ? 'lab' : 'packs')}
            style={[
              styles.microBtn,
              {
                backgroundColor: activeSubView === 'packs' ? pal.pillActiveBg : pal.pillBg,
                borderColor: activeSubView === 'packs' ? pal.gold : pal.border,
              },
            ]}
          >
            <Text variant="caption" style={{ color: activeSubView === 'packs' ? pal.goldText : pal.sub, fontSize: 11, fontWeight: '600' }}>
              {activeSubView === 'packs' ? t('← 返回互动课堂', '← Back to Lesson') : t(`📦 离线包 (${stats.cachedSizeKb}KB)`, `📦 Packs`)}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ================= SUB-VIEW 3: OFFLINE CHAPTER PACK STORE ================= */}
      {activeSubView === 'packs' ? (
        <View style={[styles.drawerBox, { backgroundColor: pal.cardBg }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <Text variant="caption" style={{ color: pal.goldText, fontSize: 12.5, fontWeight: '700' }}>
              {t(
                '📦 按需离线章节包管理（App 仅内置 4KB 骨架索引，重型教学动画与题库按需装载/卸载）',
                '📦 On-Demand Offline Chapter Packs (Zero Bundle Bloat)',
              )}
            </Text>
            <Text variant="caption" style={{ color: pal.sky, fontSize: 10.5, fontFamily: theme.fontFamily.mono }}>
              {`存储位置: localStorage["${stats.storageKey}"] & ${stats.packFolderRelPath}`}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
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
                    <Text variant="caption" style={{ color: pal.ink, fontSize: 12, fontWeight: '700' }}>
                      {`[${pack.icon}] ${t(pack.titleZh, pack.titleEn)} (${pack.version})`}
                    </Text>
                    <Text variant="caption" style={{ color: installed ? pal.emerald : pal.muted, fontSize: 10.5, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                      {installed ? `✓ 已缓存 · ${pack.sizeKb} KB` : `未下载 · ${pack.sizeKb} KB`}
                    </Text>
                  </View>
                  <Text variant="caption" style={{ color: pal.sub, fontSize: 11, lineHeight: 17 }}>
                    {pack.descriptionZh}
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', gap: 6 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`导出离线包文件 ${pack.titleZh}`}
                      onPress={() => void handleExportPackFile(pack.id)}
                      style={[styles.microBtn, { borderColor: pal.sky }]}
                    >
                      <Text variant="caption" style={{ color: pal.sky, fontSize: 10.5, fontWeight: '700' }}>
                        {t('📥 导出 .pack.json', '📥 Save .pack.json')}
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
                        <Text variant="caption" style={{ color: pal.muted, fontSize: 10.5 }}>
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
                        <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, fontWeight: '700' }}>
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
        <View style={{ padding: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Text variant="caption" style={{ color: pal.goldText, fontSize: 12, fontWeight: '700' }}>
              {t('🗺 全景知识图谱（点击任意圆点可直接进入该课程；实线为前置依赖，虚线为 [[双向链接]]）', '🗺 Full Knowledge Graph Topology')}
            </Text>
            <Pressable
              onPress={() => setShowAddNodeBox((v) => !v)}
              style={[styles.microBtn, { borderColor: pal.gold, backgroundColor: pal.pillActiveBg }]}
            >
              <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                {t('＋ 新建 [[双链]] 笔记节点', '＋ Add [[WikiLink]] Node')}
              </Text>
            </Pressable>
          </View>

          {showAddNodeBox ? (
            <View style={[styles.drawerBox, { backgroundColor: pal.cardBg, borderColor: pal.goldBorder, borderWidth: 1, borderRadius: 10 }]}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
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
                    <Text variant="caption" style={{ color: customDomain === d.id ? pal.goldText : pal.sub, fontSize: 10.5 }}>
                      {d.zh}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={customMd}
                onChangeText={setCustomMd}
                placeholder={t(
                  '支持多行要点与双向链接，例如：基于 [[AI-101]] 与 [[AI-201]] 将 KV 联合低秩压缩',
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
                    selectLesson(res.addedNode.id, res.addedNode.stageLevel);
                    setCustomTitle('');
                    setCustomMd('');
                    setShowAddNodeBox(false);
                    setActiveSubView('lab');
                    showToast({
                      text: t(`✓ 已加入知识图谱节点「${res.addedNode.code}」`, `✓ Added node ${res.addedNode.code}`),
                    });
                  }}
                  style={[styles.primaryPlayBtn, { backgroundColor: pal.gold, borderColor: pal.gold }]}
                >
                  <Text variant="caption" style={{ color: '#141311', fontSize: 11, fontWeight: '700' }}>
                    {t('✓ 挂载到个人知识图谱', '✓ Mount to Knowledge Graph')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={[styles.canvasCard, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
            <KnowledgeGraphSvgCanvas
              state={kgState}
              selectedNodeId={selectedNode.id}
              onSelectNode={(id) => {
                const target = kgState.nodes.find((n) => n.id === id);
                selectLesson(id, target?.stageLevel);
                setActiveSubView('lab');
              }}
              isDark={isDark}
              fullScreen={fullScreen}
            />
          </View>

          {/* Studio Gear Unlocks in Graph View */}
          <View style={[styles.topStrip, { backgroundColor: pal.elevated, borderColor: pal.border, borderWidth: 1, borderRadius: 10 }]}>
            <Text variant="caption" style={{ color: pal.goldText, fontSize: 11.5, fontWeight: '700' }}>
              {t(`🏆 书房藏品解锁进度 (${unlockables.filter((u) => u.unlocked).length}/${unlockables.length})`, '🏆 Studio Gear Unlocks')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {unlockables.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.gearBadge,
                    {
                      backgroundColor: item.unlocked ? `${item.color}18` : pal.pillBg,
                      borderColor: item.unlocked ? item.color : pal.border,
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: item.unlocked ? item.color : pal.muted, fontSize: 10.5, fontWeight: '700' }}>
                    {`[${item.icon}] ${t(item.titleZh, item.titleEn)} ${item.unlocked ? '✓' : `${item.progressPct}%`}`}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {/* ================= SUB-VIEW 1: CALM, ONE-CARD-AT-A-TIME GUIDED LESSON FLOW ================= */}
      {activeSubView === 'lab' ? (
        <View style={{ padding: 16, gap: 14 }}>
          {/* Stage Subtitle & Clean 3–4 Lesson Selector Pills for Current Stage Only */}
          <View style={{ gap: 8 }}>
            <Text variant="caption" style={{ color: pal.muted, fontSize: 11.5 }}>
              {`${activeStageMeta.zh} — ${activeStageMeta.subtitleZh}`}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {stageNodes.map((n, idx) => {
                const isSel = n.id === selectedNode.id;
                const isMastered = n.status === 'mastered';
                return (
                  <Pressable
                    key={n.id}
                    onPress={() => selectLesson(n.id)}
                    style={[
                      styles.cleanLessonPill,
                      {
                        backgroundColor: isSel ? pal.pillActiveBg : pal.cardBg,
                        borderColor: isSel ? pal.gold : isMastered ? pal.emerald : pal.border,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={{
                        color: isSel ? pal.goldText : isMastered ? pal.emerald : pal.sub,
                        fontSize: 11.5,
                        fontWeight: isSel ? '700' : '600',
                      }}
                    >
                      {`${isMastered ? '✓ ' : ''}第 ${idx + 1} 课 · ${n.title.replace(/^【[^】]+】/, '').split('？')[0]}${n.title.includes('？') ? '？' : ''}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Main Focused Lesson Card */}
          <View style={[styles.focusedLessonCard, { backgroundColor: pal.cardBg, borderColor: pal.goldBorder }]}>
            {/* Lesson Title + 4-Step Progress Bar */}
            <View style={{ gap: 10, borderBottomWidth: 1, borderBottomColor: pal.border, paddingBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <Text variant="heading" style={{ color: pal.ink, fontSize: 17, fontWeight: '700' }}>
                  {`${selectedNode.code} · ${selectedNode.title.replace(/^【[^】]+】/, '')}`}
                </Text>
                <Text variant="caption" style={{ color: pal.emerald, fontSize: 11, fontFamily: theme.fontFamily.mono }}>
                  {selectedNode.status === 'mastered' ? '✦ 本课已通关' : `当前进度：第 ${wizardStep} / 4 步`}
                </Text>
              </View>

              {/* 4-Step Wizard Switcher Pills */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(
                  [
                    { step: 1 as const, label: '① 先听大白话比喻' },
                    { step: 2 as const, label: '② 动手点交互动画' },
                    { step: 3 as const, label: '③ 三句话核心结论' },
                    { step: 4 as const, label: '④ 一道题闯关自测' },
                  ] as const
                ).map((st) => {
                  const isCurrent = wizardStep === st.step;
                  const isPassed = wizardStep > st.step;
                  return (
                    <Pressable
                      key={st.step}
                      onPress={() => setWizardStep(st.step)}
                      style={[
                        styles.wizardStepPill,
                        {
                          backgroundColor: isCurrent
                            ? pal.gold
                            : isPassed
                              ? 'rgba(52, 211, 153, 0.14)'
                              : pal.pillBg,
                          borderColor: isCurrent ? pal.gold : isPassed ? pal.emerald : pal.border,
                        },
                      ]}
                    >
                      <Text
                        variant="caption"
                        style={{
                          color: isCurrent ? '#141311' : isPassed ? pal.emerald : pal.sub,
                          fontSize: 11.5,
                          fontWeight: isCurrent || isPassed ? '700' : '500',
                        }}
                      >
                        {`${isPassed ? '✓ ' : ''}${st.label}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {selectedContent ? (
              <View style={{ gap: 16, paddingTop: 6 }}>
                {/* ==================== WIZARD STEP 1: ZERO-JARGON ANALOGY ONLY ==================== */}
                {wizardStep === 1 ? (
                  <View style={{ gap: 16 }}>
                    <View
                      style={[
                        styles.spaciousAnalogyCard,
                        {
                          backgroundColor: isDark ? 'rgba(52, 211, 153, 0.08)' : 'rgba(31, 94, 75, 0.06)',
                          borderColor: pal.emerald,
                        },
                      ]}
                    >
                      <Text variant="label" style={{ color: pal.emerald, fontSize: 13.5, fontWeight: '700' }}>
                        {t('🌱 第 1 步 · 零基础大白话直觉（不讲任何数学公式，先听个生活比喻）', '🌱 Step 1 · Everyday Analogy')}
                      </Text>
                      <Text
                        variant="body"
                        style={{
                          color: pal.ink,
                          fontSize: 15,
                          lineHeight: 26,
                        }}
                      >
                        {selectedContent.beginnerAnalogyZh ?? selectedContent.coreMentalModel}
                      </Text>
                    </View>

                    <View style={styles.wizardFooterRow}>
                      <Text variant="caption" style={{ color: pal.muted, fontSize: 11.5 }}>
                        {t('读完上面这段比喻就有直觉啦！接下来我们亲手点一点动画验证它。', 'Ready? Let us play with the interactive animation next.')}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="下一步去动手玩动画"
                        onPress={() => setWizardStep(2)}
                        style={[styles.nextBigCtaBtn, { backgroundColor: pal.gold, borderColor: pal.gold }]}
                      >
                        <Text variant="label" style={{ color: '#141311', fontSize: 13.5, fontWeight: '700' }}>
                          {t('看懂比喻了，下一步：去动手玩动画 (2/4) →', 'Next: Play Interactive Animation (2/4) →')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {/* ==================== WIZARD STEP 2: INTERACTIVE ANIMATION ONLY ==================== */}
                {wizardStep === 2 ? (
                  <View style={{ gap: 14 }}>
                    {selectedContent.guidedStepsZh?.[0] ? (
                      <View style={[styles.singleHintBanner, { backgroundColor: pal.elevated, borderColor: pal.goldBorder }]}>
                        <Text variant="caption" style={{ color: pal.goldText, fontSize: 12, fontWeight: '700' }}>
                          {`💡 玩法提示：${selectedContent.guidedStepsZh[0]}`}
                        </Text>
                      </View>
                    ) : null}

                    {selectedContent.animationKind ? (
                      <AiInteractiveAnimationLab
                        kind={selectedContent.animationKind}
                        isDark={isDark}
                        fullScreen={fullScreen}
                      />
                    ) : (
                      <View style={[styles.spaciousAnalogyCard, { backgroundColor: pal.elevated, borderColor: pal.border }]}>
                        <Text variant="body" style={{ color: pal.ink, fontSize: 14, lineHeight: 22 }}>
                          {selectedContent.coreMentalModel}
                        </Text>
                      </View>
                    )}

                    <View style={styles.wizardFooterRow}>
                      <Pressable
                        onPress={() => setWizardStep(1)}
                        style={[styles.microBtn, { borderColor: pal.border, paddingVertical: 8, paddingHorizontal: 12 }]}
                      >
                        <Text variant="caption" style={{ color: pal.sub, fontSize: 12 }}>
                          {t('← 返回第 1 步看比喻', '← Back to Analogy')}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="下一步看三句话核心结论"
                        onPress={() => setWizardStep(3)}
                        style={[styles.nextBigCtaBtn, { backgroundColor: pal.gold, borderColor: pal.gold }]}
                      >
                        <Text variant="label" style={{ color: '#141311', fontSize: 13.5, fontWeight: '700' }}>
                          {t('动画体验完了，下一步：看 3 句话核心结论 (3/4) →', 'Next: 3 Key Takeaways (3/4) →')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {/* ==================== WIZARD STEP 3: 3 KEY TAKEAWAYS & OPTIONAL FORMULA ==================== */}
                {wizardStep === 3 ? (
                  <View style={{ gap: 14 }}>
                    <View style={[styles.spaciousAnalogyCard, { backgroundColor: pal.elevated, borderColor: pal.border }]}>
                      <Text variant="label" style={{ color: pal.goldText, fontSize: 13.5, fontWeight: '700' }}>
                        {t('💡 第 3 步 · 记住这 3 句话就够了（核心规律总结）', '💡 Step 3 · 3 Key Takeaways')}
                      </Text>
                      <Text variant="body" style={{ color: pal.ink, fontSize: 14, lineHeight: 23 }}>
                        {selectedContent.coreMentalModel}
                      </Text>
                      <View style={{ gap: 8, marginTop: 6 }}>
                        {selectedContent.keyTakeaways.map((pt, idx) => (
                          <View
                            key={idx}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 8,
                              backgroundColor: pal.cardBg,
                              borderWidth: 1,
                              borderColor: pal.border,
                            }}
                          >
                            <Text variant="body" style={{ color: pal.ink, fontSize: 13.5, lineHeight: 21 }}>
                              {`${idx + 1}. ${pt}`}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Optional Collapsible Formula Dictionary (Hidden by default so beginners aren't overwhelmed!) */}
                    <View style={{ gap: 8 }}>
                      <Pressable
                        onPress={() => setShowFormulaDetail((v) => !v)}
                        style={[styles.microBtn, { alignSelf: 'flex-start', borderColor: pal.border }]}
                      >
                        <Text variant="caption" style={{ color: pal.sky, fontSize: 11.5, fontWeight: '600' }}>
                          {showFormulaDetail
                            ? t('收起数学公式与符号白话本 ▲', 'Hide Formula Breakdown ▲')
                            : t('📐 想看数学公式怎么写？点此展开「公式符号白话本」（可选）▼', '📐 Optional: Show Formula Dictionary ▼')}
                        </Text>
                      </Pressable>

                      {showFormulaDetail ? (
                        <View style={[styles.codeBox, { backgroundColor: pal.inputBg, borderColor: pal.border, padding: 12 }]}>
                          <Text variant="caption" style={{ color: pal.emerald, fontSize: 12, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                            {selectedContent.codeOrFormulaSnippet}
                          </Text>
                          {selectedContent.formulaBreakdownZh?.map((fb, idx) => (
                            <View key={idx} style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                              <Text variant="caption" style={{ color: pal.sky, fontSize: 11, fontFamily: theme.fontFamily.mono, fontWeight: '700', minWidth: 135 }}>
                                {fb.symbol}
                              </Text>
                              <Text variant="caption" style={{ color: pal.sub, fontSize: 11, flex: 1 }}>
                                {`→ ${fb.meaningZh}`}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.wizardFooterRow}>
                      <Pressable
                        onPress={() => setWizardStep(2)}
                        style={[styles.microBtn, { borderColor: pal.border, paddingVertical: 8, paddingHorizontal: 12 }]}
                      >
                        <Text variant="caption" style={{ color: pal.sub, fontSize: 12 }}>
                          {t('← 返回第 2 步玩动画', '← Back to Animation')}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="下一步去做一道题闯关"
                        onPress={() => setWizardStep(4)}
                        style={[styles.nextBigCtaBtn, { backgroundColor: pal.gold, borderColor: pal.gold }]}
                      >
                        <Text variant="label" style={{ color: '#141311', fontSize: 13.5, fontWeight: '700' }}>
                          {t('总结看懂了，最后一步：做 1 道小测验通关 (4/4) →', 'Next: 1-Question Quiz (4/4) →')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {/* ==================== WIZARD STEP 4: 1-QUESTION QUIZ & COMPLETE LESSON ==================== */}
                {wizardStep === 4 ? (
                  <View style={{ gap: 16 }}>
                    {selectedContent.quiz ? (
                      <View style={[styles.spaciousAnalogyCard, { backgroundColor: pal.elevated, borderColor: pal.goldBorder }]}>
                        <Text variant="label" style={{ color: pal.goldText, fontSize: 14, fontWeight: '700' }}>
                          {`🎯 第 4 步 · 随堂 1 题闯关：${selectedContent.quiz.questionZh}`}
                        </Text>
                        <View style={{ gap: 8, marginTop: 6 }}>
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
                                  styles.spaciousQuizOptionBtn,
                                  {
                                    borderColor: borderC,
                                    backgroundColor:
                                      selectedQuizOption !== null && isCorrect
                                        ? 'rgba(52,211,153,0.18)'
                                        : chosen
                                          ? 'rgba(239,68,68,0.14)'
                                          : pal.cardBg,
                                  },
                                ]}
                              >
                                <Text variant="body" style={{ color: pal.ink, fontSize: 13.5 }}>
                                  {opt}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        {selectedQuizOption !== null ? (
                          <View style={{ marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: pal.cardBg }}>
                            <Text
                              variant="caption"
                              style={{
                                color: selectedQuizOption === selectedContent.quiz.correctIndex ? pal.emerald : '#f59e0b',
                                fontSize: 12,
                                fontWeight: '700',
                                lineHeight: 19,
                              }}
                            >
                              {`${selectedQuizOption === selectedContent.quiz.correctIndex ? '🎉 回答正确！' : '💡 提示解析：'}${selectedContent.quiz.explanationZh}`}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    {/* Optional Flashcard Flipper */}
                    {selectedContent.flashcards[0] ? (
                      <Pressable
                        onPress={() => setShowFlashcardAnswer((v) => !v)}
                        style={[
                          styles.flashcardBox,
                          { backgroundColor: pal.elevated, borderColor: showFlashcardAnswer ? pal.emerald : pal.border, padding: 12 },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text variant="caption" style={{ color: pal.goldText, fontSize: 11.5, fontWeight: '700' }}>
                            {`🃏 思考题闪卡：${selectedContent.flashcards[0].q}`}
                          </Text>
                          <Text variant="caption" style={{ color: pal.sky, fontSize: 10.5 }}>
                            {showFlashcardAnswer ? t('收起答案 ▲', 'Hide ▲') : t('点击查看答案 ▼', 'Show Answer ▼')}
                          </Text>
                        </View>
                        {showFlashcardAnswer ? (
                          <Text variant="caption" style={{ color: pal.emerald, fontSize: 11.5, marginTop: 6, lineHeight: 18 }}>
                            {`答：${selectedContent.flashcards[0].a}`}
                          </Text>
                        ) : null}
                      </Pressable>
                    ) : null}

                    <View style={styles.wizardFooterRow}>
                      <Pressable
                        onPress={() => setWizardStep(3)}
                        style={[styles.microBtn, { borderColor: pal.border, paddingVertical: 8, paddingHorizontal: 12 }]}
                      >
                        <Text variant="caption" style={{ color: pal.sub, fontSize: 12 }}>
                          {t('← 返回第 3 步看总结', '← Back to Summary')}
                        </Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="学会本课并进入下一课"
                        onPress={() => {
                          const nextMins = selectedNode.studyMinutes + 25;
                          setKgState(
                            updateKnowledgeNodeProgress(selectedNode.id, {
                              studyMinutes: nextMins,
                              reviewLevel: selectedNode.reviewLevel + 1,
                              status: 'mastered',
                            }),
                          );
                          onLogStudyMinutes?.(selectedNode.title, 25);
                          recordPledgeReward(localDay, 'study');
                          if (nextNodeGlobal) {
                            selectLesson(nextNodeGlobal.id, nextNodeGlobal.stageLevel);
                            showToast({
                              text: t(
                                `🎉 恭喜通关「${selectedNode.code}」(+25m)！已自动为你开启下一课「${nextNodeGlobal.code}」`,
                                `🎉 Mastered ${selectedNode.code}! Advancing to ${nextNodeGlobal.code}`,
                              ),
                            });
                          } else {
                            showToast({
                              text: t(`🎉 恭喜全部通关「${selectedNode.code}」(+25m)！`, `🎉 Completed ${selectedNode.code}!`),
                            });
                          }
                        }}
                        style={[styles.nextBigCtaBtn, { backgroundColor: '#34d399', borderColor: '#34d399' }]}
                      >
                        <Text variant="label" style={{ color: '#0f172a', fontSize: 13.5, fontWeight: '700' }}>
                          {nextNodeGlobal
                            ? t(`🎉 本课学会了！打卡 +25m 并进入下一课 (${nextNodeGlobal.code}) →`, `🎉 Complete & Next (${nextNodeGlobal.code}) →`)
                            : t('🎉 打卡 +25m 完成全部课程！', '🎉 Complete Curriculum!')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : (
              /* Uninstalled Chapter Pack Prompt */
              <View style={[styles.uninstalledBanner, { backgroundColor: pal.elevated, borderColor: pal.border }]}>
                <Text variant="caption" style={{ color: pal.muted, fontSize: 12 }}>
                  {t(
                    `当前课程所属离线章节包 (${selectedNode.packId}) 尚未缓存到本地（仅占 ~20KB 空间）。`,
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
                  style={[styles.primaryPlayBtn, { backgroundColor: pal.gold, borderColor: pal.gold }]}
                >
                  <Text variant="caption" style={{ color: '#141311', fontSize: 11.5, fontWeight: '700' }}>
                    {t('⬇ 立即按需下载该章节包', '⬇ Download Chapter Pack Now')}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  topStrip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  gearBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  stageTabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1.2,
  },
  cleanLessonPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1.2,
  },
  focusedLessonCard: {
    padding: 18,
    borderRadius: 12,
    borderWidth: 1.2,
    gap: 12,
  },
  wizardStepPill: {
    flex: 1,
    minWidth: 135,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  spaciousAnalogyCard: {
    padding: 18,
    borderRadius: 12,
    borderWidth: 1.2,
    gap: 10,
  },
  singleHintBanner: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  wizardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 6,
  },
  nextBigCtaBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  primaryPlayBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.2,
  },
  spaciousQuizOptionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 9,
    borderWidth: 1.2,
  },
  microBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  drawerBox: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  packCard: {
    flex: 1,
    minWidth: 250,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
  },
  input: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
    fontSize: 12.5,
  },
  canvasCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  animContainer: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.2,
    gap: 12,
  },
  animHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  stepCaptionBox: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  codeBox: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  flashcardBox: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  uninstalledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
});
