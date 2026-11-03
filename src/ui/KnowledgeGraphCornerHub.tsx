import { createElement, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';

import {
  type AiAnimationKind,
  BROWSER_HOT_QUERIES,
  BROWSER_SEARCH_ENGINES,
  type BrowserSearchEngineId,
  type BrowserSearchResultItem,
  type BrowserViewMode,
  CATALOG_CHAPTER_PACKS,
  clipCustomNewsArticle,
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
  DEFAULT_NEWS_DIGEST_ITEMS,
  DEFAULT_NEWS_FILTER,
  executeInAppBrowserSearch,
  exportChapterPackJson,
  filterNewsDigestItems,
  importCustomMarkdownKnowledgeNode,
  installKnowledgeChapterPack,
  KNOWLEDGE_DOMAINS,
  type KnowledgeDomainId,
  type KnowledgeGraphState,
  LEARNING_STAGES,
  type LearningStageLevel,
  NEWS_CATEGORIES,
  type NewsCategoryId,
  offloadKnowledgeChapterPack,
  readKnowledgeGraphState,
  searchLocalKnowledgeAndNews,
  toggleNewsItemStatus,
  updateKnowledgeNodeProgress,
  updateNewsFilterOptions,
} from '@/core/knowledge-graph-corner';
import { readBookkeepingState } from '@/data/bookkeeping';
import { recordPledgeReward } from '@/data/life-gamification';

import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { showToast } from './toast';
import { useI18n } from './use-i18n';

export type StudyWorkbenchSubView = 'lab' | 'browser' | 'news' | 'graph' | 'packs';

/**
 * 4 Book Pages per Chapter (每章四页纸书阅读体验):
 * Page 1 = 第 1 页 · 开篇引子与深度长文 (Narrative Opening & Multi-Paragraph Deep Essay)
 * Page 2 = 第 2 页 · 书中活动插图 (Interactive Book Figure & Caption)
 * Page 3 = 第 3 页 · 精读划线与书页脚注 (Underlined Key Passages & Footnotes)
 * Page 4 = 第 4 页 · 掩卷思考与手札钤印 (Reflection, Margin Note & Red Seal Stamp)
 */
export type BookPageNumber = 1 | 2 | 3 | 4;

/**
 * Interactive Book Figure (书中活动插图 · 嵌在书页中央)
 */
function AiInteractiveAnimationLab({
  kind,
  figureCode,
  isDark,
  fullScreen = false,
}: {
  kind: AiAnimationKind;
  figureCode: string;
  isDark: boolean;
  fullScreen?: boolean;
}) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);
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
  const [attnHeadIdx] = useState(0);
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
  const [specGamma] = useState(4);
  const [specPhase, setSpecPhase] = useState(0);

  // L4-3: FlashAttention Tiling (AI-401)
  const [flashTileIdx, setFlashTileIdx] = useState(1);

  // L4-4: MoE Top-K Router (AI-501)
  const [moeTokenIdx, setMoeTokenIdx] = useState(0);
  const [moeTopK] = useState(2);
  const [moeLoadBalance] = useState(true);

  // L4-5: 3D Parallelism & ZeRO Sharding (AI-601)
  const [zeroStage, setZeroStage] = useState<0 | 1 | 2 | 3>(2);
  const [microBatches] = useState(8);

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

  const boxBg = isDark ? '#14120f' : '#f5f0e4';
  const borderCol = isDark ? 'rgba(217, 169, 78, 0.34)' : 'rgba(146, 104, 41, 0.28)';
  const ink = isDark ? '#f3efe6' : '#26221b';
  const sub = isDark ? '#c8c0b0' : '#574f42';
  const gold = isDark ? '#fde68a' : '#8a5311';
  const emerald = isDark ? '#34d399' : '#1f5e4b';
  const sky = isDark ? '#38bdf8' : '#0369a1';
  const svgHeight = fullScreen ? 184 : 142;

  if (kind === 'token-next-word') {
    const sim = computeTokenNextWordSimulation({
      generatedStep: tokenStep,
      samplingMode,
    });
    return (
      <View style={[styles.figurePlate, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.figureHeaderRow}>
          <Text variant="caption" style={{ color: gold, fontSize: 11.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
            {`【书中插图 ${figureCode}】词语接龙与下一词概率分布演示`}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Pressable
              onPress={() => {
                setPlaying(false);
                setTokenStep((s) => (s + 1) % 4);
              }}
              style={[styles.primaryPlayBtn, { backgroundColor: '#b88228', borderColor: '#b88228' }]}
            >
              <Text variant="caption" style={{ color: '#fffbeb', fontSize: 11.5, fontWeight: '700' }}>
                {t(`👉 拨动插图：往后接龙第 ${tokenStep + 1}/4 个词`, `👉 Step Next Token (${tokenStep + 1}/4)`)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSamplingMode((m) => (m === 'greedy' ? 'top-p' : 'greedy'))}
              style={[styles.microBtn, { borderColor: borderCol }]}
            >
              <Text variant="caption" style={{ color: sub, fontSize: 10.5 }}>
                {samplingMode === 'greedy' ? '当前：稳健选第1名' : '当前：Top-P 灵动抽签'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.3, minWidth: 260, gap: 8 }}>
            <Text variant="caption" style={{ color: sub, fontSize: 11, fontFamily: theme.fontFamily.serif }}>
              {t('切词积木序列（每猜出一个新词，就拼到句尾继续往下猜）：', 'Token sequence on page:')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {sim.baseTokens.map((tok) => (
                <View
                  key={tok.id}
                  style={{
                    paddingHorizontal: 11,
                    paddingVertical: 6,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: borderCol,
                    backgroundColor: isDark ? '#1e1b17' : '#fcfaf4',
                    alignItems: 'center',
                  }}
                >
                  <Text variant="caption" style={{ color: ink, fontSize: 13, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                    {tok.text}
                  </Text>
                  <Text variant="caption" style={{ color: sub, fontSize: 9, fontFamily: theme.fontFamily.mono }}>
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
                      borderRadius: 6,
                      borderWidth: isLatest ? 1.8 : 1,
                      borderColor: isLatest ? '#b88228' : emerald,
                      backgroundColor: isLatest ? 'rgba(245,185,66,0.20)' : 'rgba(52,211,153,0.12)',
                      alignItems: 'center',
                    }}
                  >
                    <Text variant="caption" style={{ color: isLatest ? gold : emerald, fontSize: 13, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                      {gt.text}
                    </Text>
                    <Text variant="caption" style={{ color: sub, fontSize: 9, fontFamily: theme.fontFamily.mono }}>
                      {`概率 ${gt.probPct}%`}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={{ flex: 1, minWidth: 220, gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: borderCol, backgroundColor: isDark ? '#1c1916' : '#fcfaf4' }}>
            <Text variant="caption" style={{ color: gold, fontSize: 11, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
              {t('候选词概率打分表：', 'Candidate Probabilities:')}
            </Text>
            {sim.candidates.map((cand) => (
              <View key={cand.tokenId} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text variant="caption" style={{ color: cand.chosen ? emerald : ink, fontSize: 11.5, fontFamily: theme.fontFamily.serif, fontWeight: cand.chosen ? '700' : '500', width: 64 }}>
                  {`${cand.chosen ? '● ' : ''}${cand.token}`}
                </Text>
                <View style={{ flex: 1, height: 11, borderRadius: 4, backgroundColor: isDark ? '#292520' : '#e6dfd1', overflow: 'hidden' }}>
                  <View
                    style={{
                      width: `${cand.probPct}%`,
                      height: '100%',
                      backgroundColor: cand.chosen ? '#1f5e4b' : '#b88228',
                    }}
                  />
                </View>
                <Text variant="caption" style={{ color: sub, fontSize: 10, fontFamily: theme.fontFamily.mono, width: 38, textAlign: 'right' }}>
                  {`${cand.probPct}%`}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text variant="caption" style={[styles.figureCaptionText, { color: sub }]}>
          {`【图注】${sim.stepDescZh}`}
        </Text>
      </View>
    );
  }

  if (kind === 'word-embedding') {
    const sim = computeWordEmbeddingSimulation({
      clusterId: embedCluster,
      showRoyaltyAnalogy,
    });
    return (
      <View style={[styles.figurePlate, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.figureHeaderRow}>
          <Text variant="caption" style={{ color: gold, fontSize: 11.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
            {`【书中插图 ${figureCode}】二维语义星空与词向量平行四边形法则`}
          </Text>
          <Pressable
            onPress={() => {
              setPlaying(false);
              setShowRoyaltyAnalogy((v) => !v);
            }}
            style={[styles.primaryPlayBtn, { backgroundColor: '#b88228', borderColor: '#b88228' }]}
          >
            <Text variant="caption" style={{ color: '#fffbeb', fontSize: 11.5, fontWeight: '700' }}>
              {showRoyaltyAnalogy
                ? t('👉 拨动插图：切回「宠物 / 咖啡 / 算力」星团图', '👉 Back to Semantic Clusters')
                : t('👉 拨动插图：演示「国王 - 男人 + 女人 = 女王」', '👉 Demo King - Man + Woman = Queen')}
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
                  rx: 6,
                  fill: isDark ? '#1c1916' : '#fcfaf4',
                  stroke: borderCol,
                }),
                createElement('line', { x1: 24, y1: 116, x2: 320, y2: 116, stroke: borderCol, strokeWidth: 1 }),
                createElement('line', { x1: 24, y1: 14, x2: 24, y2: 116, stroke: borderCol, strokeWidth: 1 }),
                showRoyaltyAnalogy
                  ? createElement(
                      'g',
                      null,
                      createElement('line', {
                        x1: 95,
                        y1: 96,
                        x2: 108,
                        y2: 34,
                        stroke: '#b88228',
                        strokeWidth: 2,
                        strokeDasharray: '4 2',
                      }),
                      createElement('line', {
                        x1: 246,
                        y1: 94,
                        x2: 260,
                        y2: 32,
                        stroke: '#1f5e4b',
                        strokeWidth: 2.4,
                      }),
                      createElement('line', {
                        x1: 108,
                        y1: 34,
                        x2: 260,
                        y2: 32,
                        stroke: '#b45309',
                        strokeWidth: 1.6,
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
                    createElement('circle', { cx, cy, r: 6.5, fill: pt.color }),
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

          <View style={{ flex: 1, minWidth: 230, gap: 6 }}>
            <Text variant="caption" style={{ color: gold, fontSize: 11.5, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
              {sim.pairLabelZh}
            </Text>
            {sim.points.slice(0, 4).map((pt) => (
              <View key={pt.word} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 }}>
                <Text variant="caption" style={{ color: ink, fontSize: 11, fontFamily: theme.fontFamily.serif, fontWeight: '700', width: 98 }}>
                  {pt.word}
                </Text>
                <Text variant="caption" style={{ color: sub, fontSize: 10.5, fontFamily: theme.fontFamily.mono }}>
                  {`[${pt.dims[0]}, ${pt.dims[1]}, ${pt.dims[2]}]`}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text variant="caption" style={[styles.figureCaptionText, { color: sub }]}>
          {`【图注】${sim.summaryZh}`}
        </Text>
      </View>
    );
  }

  if (kind === 'neuron-gradient') {
    const sim = computeNeuronGradientSimulation({
      stepCount: gradStep,
      learningRate,
    });
    return (
      <View style={[styles.figurePlate, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.figureHeaderRow}>
          <Pressable
            onPress={() => {
              setPlaying(false);
              setGradStep((s) => (s >= 7 ? 0 : s + 1));
            }}
            style={[styles.primaryPlayBtn, { backgroundColor: '#b88228', borderColor: '#b88228' }]}
          >
            <Text variant="caption" style={{ color: '#fffbeb', fontSize: 11.5, fontWeight: '700' }}>
              {t(`👉 拨动插图：顺着斜坡往下走第 ${gradStep + 1} 步`, `👉 Step Downhill (${gradStep + 1})`)}
            </Text>
          </Pressable>

          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {[
              { lr: 0.08, label: '小步慢走 (0.08)' },
              { lr: 0.25, label: '稳步入谷 (0.25)' },
              { lr: 0.92, label: '步大震荡 (0.92)' },
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
                stroke: isDark ? '#57534e' : '#a8a29e',
                strokeWidth: 2.2,
              }),
              createElement('circle', { cx: 300, cy: 108, r: 6.5, fill: '#1f5e4b' }),
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
                        stroke: learningRate > 0.7 ? '#dc2626' : '#b88228',
                        strokeWidth: 2,
                        strokeDasharray: '3 2',
                      })
                    : null,
                  createElement('circle', {
                    cx,
                    cy,
                    r: isLast ? 7.5 : 4,
                    fill: isLast ? '#b88228' : '#78716c',
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
                        `当前位置 w=${pt.w} (误差=${pt.loss})`,
                      )
                    : null,
                );
              }),
            )
          : null}

        <Text variant="caption" style={[styles.figureCaptionText, { color: sub }]}>
          {`【图注】${sim.stepDescZh}`}
        </Text>
      </View>
    );
  }

  if (kind === 'rnn-vs-attention') {
    const sim = computeRnnVsAttentionSimulation({ sentenceLength: rnnLen });
    return (
      <View style={[styles.figurePlate, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.figureHeaderRow}>
          <Text variant="caption" style={{ color: gold, fontSize: 11.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
            {`【书中插图 ${figureCode}】串行传声筒衰减 vs 注意力一步直连对比`}
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
                    backgroundColor: rnnLen === len ? '#b88228' : 'transparent',
                    borderColor: rnnLen === len ? '#b88228' : borderCol,
                  },
                ]}
              >
                <Text variant="caption" style={{ color: rnnLen === len ? '#fffbeb' : ink, fontSize: 11, fontWeight: '700' }}>
                  {len === 4 ? '短句 (4词)' : len === 8 ? '中句 (8词)' : '👉 长句 (16词·看传声筒失忆)'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <View style={{ padding: 10, borderRadius: 6, borderWidth: 1, borderColor: borderCol, backgroundColor: isDark ? '#1c1916' : '#fcfaf4', gap: 6 }}>
            <Text variant="caption" style={{ color: '#b45309', fontSize: 11, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
              {`上篇 · 旧模型 RNN 传声筒（挨个传了 ${sim.rnnStepsRequired} 手，句首「小猫」传到末尾只剩 ${sim.rnnRetentionPct}% 印象）：`}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
              {sim.tokens.map((tok, idx) => {
                const fade = Math.max(0.14, 1 - (idx / sim.tokens.length) * (sim.sentenceLength === 16 ? 0.9 : 0.65));
                return (
                  <View
                    key={`rnn-${idx}`}
                    style={{
                      paddingHorizontal: 7,
                      paddingVertical: 3,
                      borderRadius: 4,
                      backgroundColor: `rgba(184, 130, 40, ${fade.toFixed(2)})`,
                    }}
                  >
                    <Text variant="caption" style={{ color: ink, fontSize: 10.5, fontFamily: theme.fontFamily.serif }}>
                      {`${tok}${idx < sim.tokens.length - 1 ? ' →' : ''}`}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={{ padding: 10, borderRadius: 6, borderWidth: 1.2, borderColor: emerald, backgroundColor: isDark ? '#1c1916' : '#fcfaf4', gap: 6 }}>
            <Text variant="caption" style={{ color: emerald, fontSize: 11, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
              {`下篇 · Attention 注意力直连（句尾「它」直接拉一条专线回到句首「小猫」，记忆保留 ${sim.attentionRetentionPct}%）：`}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5, borderWidth: 1, borderColor: emerald }}>
                <Text variant="caption" style={{ color: emerald, fontSize: 11, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                  {`句首：「${sim.tokens[0]}」`}
                </Text>
              </View>
              <Text variant="caption" style={{ color: gold, fontSize: 11, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                {`══════ O(1) 跨句直连引线 (无需中间传话) ══════`}
              </Text>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5, borderWidth: 1, borderColor: gold }}>
                <Text variant="caption" style={{ color: gold, fontSize: 11, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                  {`句尾：「${sim.tokens[sim.tokens.length - 1]}」`}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Text variant="caption" style={[styles.figureCaptionText, { color: sub }]}>
          {`【图注】${sim.summaryZh}`}
        </Text>
      </View>
    );
  }

  if (kind === 'lora-rag') {
    const sim = computeLoraRagSimulation({
      mode: loraRagMode,
      loraRank,
    });
    return (
      <View style={[styles.figurePlate, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.figureHeaderRow}>
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
                    borderColor: loraRagMode === m ? '#b88228' : borderCol,
                    backgroundColor: loraRagMode === m ? '#b88228' : 'transparent',
                  },
                ]}
              >
                <Text variant="caption" style={{ color: loraRagMode === m ? '#fffbeb' : ink, fontSize: 11, fontWeight: '700' }}>
                  {m === 'rag' ? '① 开卷翻书 (RAG)' : m === 'lora' ? '② 书旁贴便利贴 (LoRA)' : '③ 开卷 + 便利贴合璧'}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {([4, 8, 16] as const).map((r) => (
              <Pressable
                key={r}
                onPress={() => setLoraRank(r)}
                style={[styles.microBtn, { borderColor: loraRank === r ? emerald : borderCol }]}
              >
                <Text variant="caption" style={{ color: emerald, fontSize: 10, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                  {`便利贴秩 r=${r}`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <View style={{ flex: 1, minWidth: 200, padding: 12, borderRadius: 6, borderWidth: 1, borderColor: borderCol, backgroundColor: isDark ? '#1c1916' : '#fcfaf4', gap: 4 }}>
            <Text variant="caption" style={{ color: sub, fontSize: 11, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
              {t('原版厚重词典 W_0 (冻结不动)：', 'Frozen Base Weight W_0:')}
            </Text>
            <Text variant="caption" style={{ color: ink, fontSize: 13, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
              {`${sim.fullParamsMillion}M 参数 · 0 训练开销`}
            </Text>
          </View>

          <View style={{ flex: 1, minWidth: 200, padding: 12, borderRadius: 6, borderWidth: 1.5, borderColor: gold, backgroundColor: isDark ? '#1c1916' : '#fcfaf4', gap: 4 }}>
            <Text variant="caption" style={{ color: gold, fontSize: 11, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
              {`页边薄便利贴 A×B (秩 r=${sim.loraRank})：`}
            </Text>
            <Text variant="caption" style={{ color: emerald, fontSize: 13, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
              {`仅 ${sim.loraParamsMillion}M 参数 (省下 ${sim.paramSavingPct}%)`}
            </Text>
          </View>
        </View>

        <Text variant="caption" style={[styles.figureCaptionText, { color: sub }]}>
          {`【图注】${sim.summaryZh}`}
        </Text>
      </View>
    );
  }

  if (kind === 'quantization-smooth') {
    const sim = computeQuantizationSimulation({
      precision: quantPrecision,
      smoothOutliers,
    });
    return (
      <View style={[styles.figurePlate, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.figureHeaderRow}>
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
                    borderColor: quantPrecision === p ? '#b88228' : borderCol,
                    backgroundColor: quantPrecision === p ? '#b88228' : 'transparent',
                  },
                ]}
              >
                <Text variant="caption" style={{ color: quantPrecision === p ? '#fffbeb' : ink, fontSize: 11, fontWeight: '700' }}>
                  {p === 'fp16' ? 'FP16 原装木箱 (14GB)' : p === 'int8' ? 'INT8 半缩盒 (7GB)' : 'INT4 袖珍盒 (3.8GB)'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => setSmoothOutliers((s) => !s)}
            style={[styles.microBtn, { borderColor: smoothOutliers ? emerald : '#dc2626' }]}
          >
            <Text variant="caption" style={{ color: smoothOutliers ? emerald : '#dc2626', fontSize: 10.5, fontWeight: '700' }}>
              {smoothOutliers
                ? t('✓ 已开启 SmoothQuant 削平离群尖峰', '✓ SmoothQuant On')
                : t('👉 点击开启 SmoothQuant 驯服 48.0 尖峰', '⚠ Outliers Unsmoothed')}
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
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: isSpike ? '#dc2626' : borderCol,
                  backgroundColor: isDark ? '#1c1916' : '#fcfaf4',
                  gap: 3,
                }}
              >
                <Text variant="caption" style={{ color: isSpike ? '#dc2626' : sub, fontSize: 10, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                  {ch.name}
                </Text>
                <Text variant="caption" style={{ color: ink, fontSize: 12.5, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
                  {`幅度: ${val.toFixed(1)}`}
                </Text>
              </View>
            );
          })}
        </View>

        <Text variant="caption" style={[styles.figureCaptionText, { color: sub }]}>
          {`【图注】${sim.summaryZh}`}
        </Text>
      </View>
    );
  }

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
      <View style={[styles.figurePlate, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.figureHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text variant="caption" style={{ color: gold, fontSize: 11.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
              {t('👉 点击切换书页中的提问词 (Query)：', '👉 Click Query Token:')}
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
                      backgroundColor: active ? '#b88228' : 'transparent',
                      borderColor: active ? '#b88228' : borderCol,
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: active ? '#fffbeb' : ink, fontSize: 11, fontWeight: '700' }}>
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
                    borderColor: Math.abs(temperature - tVal) < 0.05 ? gold : borderCol,
                  },
                ]}
              >
                <Text variant="caption" style={{ color: Math.abs(temperature - tVal) < 0.05 ? gold : sub, fontSize: 10, fontWeight: '700' }}>
                  {tVal === 0.4 ? 'τ=0.4 聚焦' : tVal === 0.8 ? 'τ=0.8 均衡' : 'τ=1.6 广博'}
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
                    stroke: idx === sim.focusTokenIdx ? '#1f5e4b' : '#b88228',
                    strokeWidth: strokeW,
                    strokeOpacity: opacity,
                  }),
                  createElement('rect', {
                    x: xTo - 24,
                    y: 8,
                    width: 48,
                    height: 24,
                    rx: 5,
                    fill: idx === sim.focusTokenIdx ? '#b88228' : isDark ? '#27241f' : '#e7e0d2',
                  }),
                  createElement(
                    'text',
                    {
                      x: xTo,
                      y: 24,
                      textAnchor: 'middle',
                      fill: idx === sim.focusTokenIdx ? '#fffbeb' : ink,
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
                    fill: isDark ? '#27241f' : '#e5dec9',
                  }),
                  createElement('rect', {
                    x: xTo - 24,
                    y: 96,
                    width: Math.max(5, (48 * weight) / 100),
                    height: 20,
                    rx: 4,
                    fill: weight >= 25 ? '#1f5e4b' : '#b88228',
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
                  rx: 6,
                  fill: isDark ? '#1c1916' : '#fcfaf4',
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
                  `RoPE 位置罗盘 (m=${sim.focusTokenIdx})`,
                ),
                createElement('circle', {
                  cx: 590,
                  cy: 74,
                  r: 34,
                  fill: 'none',
                  stroke: borderCol,
                  strokeWidth: 1.2,
                  strokeDasharray: '3 3',
                }),
                createElement('line', {
                  x1: 590,
                  y1: 74,
                  x2: ropeX,
                  y2: ropeY,
                  stroke: '#b88228',
                  strokeWidth: 3,
                  strokeLinecap: 'round',
                }),
                createElement('circle', { cx: ropeX, cy: ropeY, r: 4.5, fill: '#1f5e4b' }),
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

        <Text variant="caption" style={[styles.figureCaptionText, { color: sub }]}>
          {`【图注】${sim.stepDescZh}`}
        </Text>
      </View>
    );
  }

  if (kind === 'paged-attention') {
    const sim = computePagedAttentionSimulation({
      tokenCount: pagedTokenCount,
      sharedPrefixEnabled: sharedPrefix,
    });
    return (
      <View style={[styles.figurePlate, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.figureHeaderRow}>
          <Pressable
            onPress={() => {
              setPlaying(false);
              setPagedTokenCount((c) => (c >= 16 ? 4 : c + 1));
            }}
            style={[styles.primaryPlayBtn, { backgroundColor: '#b88228', borderColor: '#b88228' }]}
          >
            <Text variant="caption" style={{ color: '#fffbeb', fontSize: 11.5, fontWeight: '700' }}>
              {t(`👉 拨动插图：新添 1 个词入席 (当前 ${pagedTokenCount} 词)`, `👉 +1 Token (${pagedTokenCount})`)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSharedPrefix((p) => !p)}
            style={[styles.microBtn, { borderColor: sharedPrefix ? emerald : borderCol }]}
          >
            <Text variant="caption" style={{ color: sharedPrefix ? emerald : sub, fontSize: 10.5, fontWeight: '700' }}>
              {sharedPrefix ? t('✓ 前缀共桌已开启', '✓ CoW Shared') : t('○ 开启前缀共桌', '○ CoW Off')}
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
                borderRadius: 6,
                borderWidth: 1,
                borderColor: blk.isSharedCoW ? emerald : borderCol,
                backgroundColor: isDark ? '#1c1916' : '#fcfaf4',
                gap: 5,
              }}
            >
              <Text variant="caption" style={{ color: gold, fontSize: 10.5, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
                {`逻辑页 L${blk.logicalIndex} → 物理框 P#${blk.physicalBlockId}`}
              </Text>
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
                        backgroundColor: tok ? 'rgba(184,130,40,0.18)' : 'transparent',
                        borderWidth: 1,
                        borderColor: tok ? '#b88228' : borderCol,
                      }}
                    >
                      <Text variant="caption" style={{ color: tok ? ink : sub, fontSize: 9.5, fontFamily: theme.fontFamily.serif }}>
                        {tok ?? '空'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <Text variant="caption" style={[styles.figureCaptionText, { color: sub }]}>
          {`【图注】${sim.summaryZh}`}
        </Text>
      </View>
    );
  }

  if (kind === 'speculative-decoding') {
    const sim = computeSpeculativeDecodingSimulation({
      gamma: specGamma,
      verifyPhase: specPhase + tick,
    });
    return (
      <View style={[styles.figurePlate, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.figureHeaderRow}>
          <Pressable
            onPress={() => setSpecPhase((p) => p + 1)}
            style={[styles.primaryPlayBtn, { backgroundColor: '#b88228', borderColor: '#b88228' }]}
          >
            <Text variant="caption" style={{ color: '#fffbeb', fontSize: 11.5, fontWeight: '700' }}>
              {t('👉 拨动插图：切换「4词全中奖1词」与「末词由导师批改修正」', '👉 Toggle All-Hit vs Corrected')}
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
                  : '#b45309';
            return (
              <View
                key={idx}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 6,
                  borderWidth: 1.2,
                  borderColor: cColor,
                  backgroundColor: isDark ? '#1c1916' : '#fcfaf4',
                }}
              >
                <Text variant="caption" style={{ color: cColor, fontSize: 11.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                  {`${cand.status === 'accepted' ? '✓ 审阅通过' : cand.status === 'bonus' ? '★ 附赠新词' : '↻ 导师朱批修正'} · ${cand.token}`}
                </Text>
              </View>
            );
          })}
        </View>

        <Text variant="caption" style={[styles.figureCaptionText, { color: sub }]}>
          {`【图注】${sim.stepDescZh}`}
        </Text>
      </View>
    );
  }

  if (kind === 'flash-attention') {
    const flashSim = computeFlashAttentionSimulation({ activeTileIdx: flashTileIdx });
    return (
      <View style={[styles.figurePlate, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.figureHeaderRow}>
          <Pressable
            onPress={() => setFlashTileIdx((p) => (p + 1) % 4)}
            style={[styles.primaryPlayBtn, { backgroundColor: '#b88228', borderColor: '#b88228' }]}
          >
            <Text variant="caption" style={{ color: '#fffbeb', fontSize: 11.5, fontWeight: '700' }}>
              {t(`👉 拨动插图：将下一块书简调入片上案板 (${flashSim.activeTileIdx + 1}/4)`, '👉 Next SRAM Tile ▶')}
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
                  borderRadius: 6,
                  borderWidth: isCurrent ? 1.6 : 1,
                  borderColor: isCurrent ? gold : isDone ? emerald : borderCol,
                  backgroundColor: isDark ? '#1c1916' : '#fcfaf4',
                  gap: 4,
                }}
              >
                <Text variant="caption" style={{ color: isCurrent ? gold : isDone ? emerald : sub, fontSize: 11, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                  {`分块 #${tIdx + 1} ${isCurrent ? '⚡案板演算中' : isDone ? '✓已归档' : '待调取'}`}
                </Text>
                <Text variant="caption" style={{ color: sub, fontSize: 10 }}>
                  {isCurrent ? `极值 m=${flashSim.runningMax} · 缩放 α=${flashSim.rescaleFactor}` : isDone ? '已在线折算并入总表' : '静置在远端显存'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text variant="caption" style={[styles.figureCaptionText, { color: sub }]}>
          {`【图注】${flashSim.stepDescZh}`}
        </Text>
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
      <View style={[styles.figurePlate, { backgroundColor: boxBg, borderColor: borderCol }]}>
        <View style={styles.figureHeaderRow}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Text variant="caption" style={{ color: gold, fontSize: 11.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
              {t('👉 点选不同命题，看门控分诊台唤醒哪位专席学者：', '👉 Select Token to Route:')}
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
                      backgroundColor: active ? '#b88228' : 'transparent',
                      borderColor: active ? '#b88228' : borderCol,
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: active ? '#fffbeb' : ink, fontSize: 11, fontWeight: '700' }}>
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
                borderRadius: 6,
                borderWidth: exp.selected ? 1.5 : 1,
                borderColor: exp.isShared ? emerald : exp.selected ? '#b88228' : borderCol,
                backgroundColor: isDark ? '#1c1916' : '#fcfaf4',
                opacity: exp.selected ? 1 : 0.55,
                gap: 3,
              }}
            >
              <Text variant="caption" style={{ color: exp.isShared ? emerald : exp.selected ? gold : sub, fontSize: 10.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                {exp.nameZh}
              </Text>
              <Text variant="caption" style={{ color: sub, fontSize: 9.5 }}>
                {exp.selected ? `⚡ 奉命作答 (权重 ${exp.scorePct}%)` : '○ 闭门静修 (零算力消耗)'}
              </Text>
            </View>
          ))}
        </View>

        <Text variant="caption" style={[styles.figureCaptionText, { color: sub }]}>
          {`【图注】${moeSim.summaryZh}`}
        </Text>
      </View>
    );
  }

  // Lab 6: 3D Parallelism (TP/PP/DP) & ZeRO Memory Sharding
  const parallelSim = computeDistributedParallelSimulation({
    zeroStage,
    microBatches,
  });
  return (
    <View style={[styles.figurePlate, { backgroundColor: boxBg, borderColor: borderCol }]}>
      <View style={styles.figureHeaderRow}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Text variant="caption" style={{ color: gold, fontSize: 11.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
            {t('👉 点击切换分卷制度 (ZeRO)，看 8 位抄书匠如何分担 112GB 典籍：', '👉 Select ZeRO Stage:')}
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
                  borderColor: zeroStage === st ? '#b88228' : borderCol,
                  backgroundColor: zeroStage === st ? '#b88228' : 'transparent',
                },
              ]}
            >
              <Text variant="caption" style={{ color: zeroStage === st ? '#fffbeb' : ink, fontSize: 11, fontWeight: '700' }}>
                {st === 0 ? '各自备全套 (112GB)' : st === 1 ? 'ZeRO-1 拆参考书 (38GB)' : st === 2 ? 'ZeRO-2 +拆草稿 (26GB)' : 'ZeRO-3 全拆卷 (14.1GB)'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[
          { label: '卷一 · 模型正文参数', gb: parallelSim.paramMemGb, baseGb: 14, color: sky },
          { label: '卷二 · 梯度批改草稿', gb: parallelSim.gradMemGb, baseGb: 14, color: gold },
          { label: '卷三 · Adam 历年底档 (占75%!)', gb: parallelSim.optimMemGb, baseGb: 84, color: emerald },
        ].map((item) => (
          <View
            key={item.label}
            style={{
              flex: 1,
              minWidth: 150,
              padding: 10,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: borderCol,
              backgroundColor: isDark ? '#1c1916' : '#fcfaf4',
              gap: 4,
            }}
          >
            <Text variant="caption" style={{ color: item.color, fontSize: 10.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
              {item.label}
            </Text>
            <Text variant="caption" style={{ color: ink, fontSize: 13, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
              {`${item.gb} GB / 人`}
            </Text>
            <Text variant="caption" style={{ color: sub, fontSize: 9.5 }}>
              {item.gb < item.baseGb ? `✓ 已由 8 人分管 (原 ${item.baseGb}GB)` : '每人各存一整套'}
            </Text>
          </View>
        ))}
      </View>

      <Text variant="caption" style={[styles.figureCaptionText, { color: sub }]}>
        {`【图注】${parallelSim.summaryZh}`}
      </Text>
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
  const [selectedStage, setSelectedStage] = useState<LearningStageLevel>(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node-ai-001-token');
  const [pageNumber, setPageNumber] = useState<BookPageNumber>(1);
  const [tocOpen, setTocOpen] = useState(false);

  const [showAddNodeBox, setShowAddNodeBox] = useState(false);
  const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);
  const [marginNoteDraft, setMarginNoteDraft] = useState<string>(
    () => readKnowledgeGraphState().nodes[0]?.userNote ?? '',
  );

  const [customTitle, setCustomTitle] = useState('');
  const [customDomain, setCustomDomain] = useState<KnowledgeDomainId>('ai-infra');
  const [customMd, setCustomMd] = useState('');

  // Smart News & Tech Digest Reader State
  const [selectedNewsId, setSelectedNewsId] = useState<string>('news-deepseek-r1-grpo');
  const [showClipDrawer, setShowClipDrawer] = useState(false);
  const [clipTitle, setClipTitle] = useState('');
  const [clipCategory, setClipCategory] = useState<NewsCategoryId>('ai-frontier');
  const [clipBody, setClipBody] = useState('');

  // In-App Research Browser & Direct Search Engine State (书院浏览器 · 直接搜)
  const [browserEngine, setBrowserEngine] = useState<BrowserSearchEngineId>('smart-all');
  const [browserQueryInput, setBrowserQueryInput] = useState<string>('Transformer 注意力');
  const [browserViewMode, setBrowserViewMode] = useState<BrowserViewMode>('reader');
  const [browserSearching, setBrowserSearching] = useState<boolean>(false);
  const [browserResults, setBrowserResults] = useState<BrowserSearchResultItem[]>(() =>
    searchLocalKnowledgeAndNews('Transformer 注意力', readKnowledgeGraphState()),
  );
  const [selectedBrowserResultId, setSelectedBrowserResultId] = useState<string>(
    () => searchLocalKnowledgeAndNews('Transformer 注意力', readKnowledgeGraphState())[0]?.id ?? '',
  );
  const [browserHistory, setBrowserHistory] = useState<string[]>(['Transformer 注意力']);
  const [browserHistoryIdx, setBrowserHistoryIdx] = useState<number>(0);
  const [iframeReloadTick, setIframeReloadTick] = useState<number>(0);

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

  const orderedAllNodes = useMemo(
    () => [...kgState.nodes].sort((a, b) => (a.stageLevel ?? 2) - (b.stageLevel ?? 2)),
    [kgState.nodes],
  );
  const globalIndex = useMemo(
    () => Math.max(0, orderedAllNodes.findIndex((n) => n.id === selectedNode.id)),
    [orderedAllNodes, selectedNode.id],
  );
  const prevNodeGlobal = orderedAllNodes[globalIndex - 1] ?? null;
  const nextNodeGlobal = orderedAllNodes[globalIndex + 1] ?? null;

  // Filtered News Digest Items
  const newsFilter = kgState.newsFilter ?? DEFAULT_NEWS_FILTER;
  const allNewsItems = kgState.newsItems ?? DEFAULT_NEWS_DIGEST_ITEMS;
  const filteredNewsResult = useMemo(
    () => filterNewsDigestItems(allNewsItems, newsFilter),
    [allNewsItems, newsFilter],
  );
  const activeNewsItem = useMemo(
    () =>
      filteredNewsResult.visibleItems.find((item) => item.id === selectedNewsId) ??
      filteredNewsResult.visibleItems[0] ??
      allNewsItems[0]!,
    [allNewsItems, filteredNewsResult.visibleItems, selectedNewsId],
  );

  const activeBrowserResult = useMemo(
    () =>
      browserResults.find((item) => item.id === selectedBrowserResultId) ??
      browserResults[0] ??
      null,
    [browserResults, selectedBrowserResultId],
  );

  async function runBrowserDirectSearch(
    rawInput: string,
    engineOverride?: BrowserSearchEngineId,
    pushHistory = true,
  ) {
    const targetEngine = engineOverride ?? browserEngine;
    const trimmed = rawInput.trim() || 'Transformer';
    setBrowserQueryInput(trimmed);
    setBrowserSearching(true);

    if (pushHistory) {
      setBrowserHistory((prev) => {
        const sliced = prev.slice(0, browserHistoryIdx + 1);
        if (sliced[sliced.length - 1] === trimmed) return sliced;
        const next = [...sliced, trimmed];
        setBrowserHistoryIdx(next.length - 1);
        return next;
      });
    }

    try {
      const res = await executeInAppBrowserSearch({
        query: trimmed,
        engine: targetEngine,
        state: kgState,
      });
      setBrowserResults(res.results);
      if (res.results[0]) {
        setSelectedBrowserResultId(res.results[0].id);
      }
      if (res.resolvedOmnibox.kind === 'url') {
        setBrowserViewMode('webview');
      }
    } finally {
      setBrowserSearching(false);
    }
  }

  function selectLesson(nodeId: string, stageLevel?: LearningStageLevel) {
    setSelectedNodeId(nodeId);
    if (stageLevel) setSelectedStage(stageLevel);
    setPageNumber(1);
    setShowFlashcardAnswer(false);
    setSelectedQuizOption(null);
    const target = kgState.nodes.find((n) => n.id === nodeId);
    setMarginNoteDraft(target?.userNote ?? '');
  }

  function handlePrevPage() {
    if (pageNumber > 1) {
      setPageNumber((p) => (p - 1) as BookPageNumber);
    } else if (prevNodeGlobal) {
      selectLesson(prevNodeGlobal.id, prevNodeGlobal.stageLevel);
      setPageNumber(4);
    }
  }

  function handleNextPage() {
    if (pageNumber < 4) {
      setPageNumber((p) => (p + 1) as BookPageNumber);
    } else if (nextNodeGlobal) {
      selectLesson(nextNodeGlobal.id, nextNodeGlobal.stageLevel);
    }
  }

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || activeSubView !== 'lab') {
      return undefined;
    }
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (pageNumber < 4) setPageNumber((p) => (p + 1) as BookPageNumber);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (pageNumber > 1) setPageNumber((p) => (p - 1) as BookPageNumber);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeSubView, pageNumber]);

  const pal = isDark
    ? {
        deskBg: '#11100e',
        paperBg: '#191714',
        paperElevated: '#211e1a',
        spineShadow: '#0a0907',
        border: 'rgba(235, 220, 190, 0.12)',
        goldBorder: 'rgba(217, 169, 78, 0.35)',
        ink: '#f3efe6',
        sub: '#cbc3b3',
        muted: '#948c7d',
        gold: '#d9a94e',
        goldText: '#fde68a',
        emerald: '#34d399',
        sky: '#38bdf8',
        sealRed: '#dc2626',
        highlightBg: 'rgba(217, 169, 78, 0.14)',
        pillBg: 'rgba(255, 255, 255, 0.05)',
        pillActiveBg: 'rgba(217, 169, 78, 0.18)',
        inputBg: '#12100d',
      }
    : {
        deskBg: '#efeadd',
        paperBg: '#fbf8f0',
        paperElevated: '#f4efe2',
        spineShadow: '#dfd7c4',
        border: 'rgba(60, 50, 35, 0.14)',
        goldBorder: 'rgba(146, 104, 41, 0.32)',
        ink: '#26221b',
        sub: '#574f42',
        muted: '#857b6b',
        gold: '#92560c',
        goldText: '#7c4308',
        emerald: '#1f5e4b',
        sky: '#0369a1',
        sealRed: '#b91c1c',
        highlightBg: 'rgba(245, 185, 66, 0.22)',
        pillBg: 'rgba(60, 50, 35, 0.05)',
        pillActiveBg: 'rgba(184, 130, 40, 0.15)',
        inputBg: '#f3ede0',
      };

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
  const chapterIndexInVolume = Math.max(
    1,
    stageNodes.findIndex((n) => n.id === selectedNode.id) + 1,
  );
  const volumeNameZh =
    selectedStage === 1
      ? '第一卷 · 零基础直觉篇'
      : selectedStage === 2
        ? '第二卷 · 核心架构篇'
        : selectedStage === 3
          ? '第三卷 · 定制与智能体篇'
          : '第四卷 · 工业系统篇';

  return (
    <View style={[styles.container, { backgroundColor: pal.deskBg, borderColor: pal.goldBorder }]}>
      {/* 1. Quiet Book Reader Top Bar (书眉工具栏：目录书签 + 四卷切换 + 书院晨报资讯筛选 + 星图/书匣) */}
      <View style={[styles.readerTopBar, { backgroundColor: pal.paperElevated, borderBottomColor: pal.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="展开或收起目录书签"
            onPress={() => {
              setActiveSubView('lab');
              setTocOpen((v) => !v);
            }}
            style={[
              styles.tocToggleBtn,
              {
                backgroundColor: activeSubView === 'lab' && tocOpen ? pal.pillActiveBg : pal.paperBg,
                borderColor: activeSubView === 'lab' ? pal.gold : pal.border,
              },
            ]}
          >
            <Text variant="caption" style={{ color: pal.goldText, fontSize: 12, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
              {activeSubView === 'lab' && tocOpen ? t('📖 收起目录 ▲', '📖 Hide TOC ▲') : t('📖 精装读本 · 目录 ▼', '📖 Book & TOC ▼')}
            </Text>
          </Pressable>

          {LEARNING_STAGES.map((stg) => {
            const active = activeSubView === 'lab' && selectedStage === stg.level;
            const volLabel =
              stg.level === 1
                ? '卷一·入门'
                : stg.level === 2
                  ? '卷二·核心'
                  : stg.level === 3
                    ? '卷三·智能体'
                    : '卷四·系统';
            return (
              <Pressable
                key={stg.level}
                onPress={() => {
                  setActiveSubView('lab');
                  setSelectedStage(stg.level);
                  const firstInStage = kgState.nodes.find((n) => n.stageLevel === stg.level);
                  if (firstInStage) selectLesson(firstInStage.id, stg.level);
                }}
                style={[
                  styles.volumePill,
                  {
                    backgroundColor: active ? pal.pillActiveBg : 'transparent',
                    borderColor: active ? pal.gold : pal.border,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{
                    color: active ? pal.goldText : pal.sub,
                    fontSize: 11.5,
                    fontFamily: theme.fontFamily.serif,
                    fontWeight: active ? '700' : '500',
                  }}
                >
                  {volLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Right Side: In-App Browser (`🌐 书院浏览器 · 直接搜`) + Smart News Digest (`📰 书院晨报`) + Knowledge Graph + Offline Packs */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="切换至书院内置浏览器直接搜索"
            onPress={() => setActiveSubView(activeSubView === 'browser' ? 'lab' : 'browser')}
            style={[
              styles.tocToggleBtn,
              {
                backgroundColor: activeSubView === 'browser' ? pal.pillActiveBg : pal.paperBg,
                borderColor: activeSubView === 'browser' ? pal.gold : pal.border,
              },
            ]}
          >
            <Text variant="caption" style={{ color: activeSubView === 'browser' ? pal.goldText : pal.ink, fontSize: 11.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
              {activeSubView === 'browser'
                ? t('← 返回精装书卷', '← Back to Book')
                : t('🌐 书院浏览器 · 直接搜', '🌐 Research Browser')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="切换至书院晨报与智能资讯筛选"
            onPress={() => setActiveSubView(activeSubView === 'news' ? 'lab' : 'news')}
            style={[
              styles.tocToggleBtn,
              {
                backgroundColor: activeSubView === 'news' ? pal.pillActiveBg : pal.paperBg,
                borderColor: activeSubView === 'news' ? pal.gold : pal.border,
              },
            ]}
          >
            <Text variant="caption" style={{ color: activeSubView === 'news' ? pal.goldText : pal.ink, fontSize: 11.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
              {activeSubView === 'news'
                ? t('← 返回精装书卷', '← Back to Book')
                : t(`📰 书院晨报 · 资讯筛选 (${filteredNewsResult.visibleItems.length})`, `📰 News Digest (${filteredNewsResult.visibleItems.length})`)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveSubView(activeSubView === 'graph' ? 'lab' : 'graph')}
            style={[styles.microBtn, { borderColor: activeSubView === 'graph' ? pal.gold : pal.border }]}
          >
            <Text variant="caption" style={{ color: activeSubView === 'graph' ? pal.goldText : pal.sub, fontSize: 11, fontFamily: theme.fontFamily.serif }}>
              {activeSubView === 'graph' ? t('← 返回书页', '← Book') : t('🗺 知识星图', '🗺 Graph')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveSubView(activeSubView === 'packs' ? 'lab' : 'packs')}
            style={[styles.microBtn, { borderColor: activeSubView === 'packs' ? pal.gold : pal.border }]}
          >
            <Text variant="caption" style={{ color: activeSubView === 'packs' ? pal.goldText : pal.sub, fontSize: 11, fontFamily: theme.fontFamily.serif }}>
              {activeSubView === 'packs' ? t('← 返回书页', '← Book') : t(`📦 藏书匣 (${stats.cachedSizeKb}KB)`, '📦 Packs')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Collapsible Bookmark Table of Contents Drawer */}
      {tocOpen && activeSubView === 'lab' ? (
        <View style={[styles.tocDrawer, { backgroundColor: pal.paperBg, borderBottomColor: pal.border }]}>
          <Text variant="caption" style={{ color: pal.goldText, fontSize: 12, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
            {`${volumeNameZh} · 目录（${activeStageMeta.subtitleZh}）`}
          </Text>
          <View style={{ gap: 6, marginTop: 4 }}>
            {stageNodes.map((n, idx) => {
              const isSel = n.id === selectedNode.id;
              const isRead = n.status === 'mastered';
              return (
                <Pressable
                  key={n.id}
                  onPress={() => {
                    selectLesson(n.id);
                    setTocOpen(false);
                  }}
                  style={[
                    styles.tocRowItem,
                    {
                      backgroundColor: isSel ? pal.pillActiveBg : 'transparent',
                      borderColor: isSel ? pal.gold : pal.border,
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    style={{
                      color: isSel ? pal.goldText : pal.ink,
                      fontSize: 13,
                      fontFamily: theme.fontFamily.serif,
                      fontWeight: isSel ? '700' : '500',
                    }}
                  >
                    {`第 ${idx + 1} 章 (${n.code}) · ${n.title.replace(/^【[^】]+】/, '')}`}
                  </Text>
                  <Text
                    variant="caption"
                    style={{
                      color: isRead ? pal.sealRed : pal.muted,
                      fontSize: 11,
                      fontFamily: theme.fontFamily.serif,
                      fontWeight: isRead ? '700' : '400',
                    }}
                  >
                    {isRead ? '〔已阅钤印〕' : `〔约 5 分钟长文 · 已读 ${n.studyMinutes}m〕`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* ================= SUB-VIEW 5: IN-APP RESEARCH BROWSER & DIRECT SEARCH ENGINE (书院浏览器 · 直接搜) ================= */}
      {activeSubView === 'browser' ? (
        <View style={styles.deskStage}>
          {/* 1. Browser Omnibox & Navigation Bar */}
          <View style={[styles.newsFilterPanel, { backgroundColor: pal.paperElevated, borderColor: pal.goldBorder, gap: 10 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text variant="label" style={{ color: pal.ink, fontSize: 14.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                  {t('🌐 书院内建学术浏览器 · 全网与书院聚合直搜', '🌐 In-App Research Browser & Direct Search')}
                </Text>
                <View style={[styles.redSealBadge, { borderColor: pal.emerald, paddingHorizontal: 8, paddingVertical: 2 }]}>
                  <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                    {t('⚡ 支持维基百科 / HackerNews / 书院17章全书直搜 + 纸书净读模式', '⚡ Live Wiki + HN + Local Book + Reader Mode')}
                  </Text>
                </View>
              </View>

              {/* Reader Mode vs Embedded Web Window Toggle */}
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable
                  onPress={() => setBrowserViewMode('reader')}
                  style={[
                    styles.microBtn,
                    {
                      borderColor: browserViewMode === 'reader' ? pal.gold : pal.border,
                      backgroundColor: browserViewMode === 'reader' ? pal.pillActiveBg : pal.paperBg,
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: browserViewMode === 'reader' ? pal.goldText : pal.sub, fontSize: 11, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                    {t('📖 纸书净读模式 (去广告/高信噪比)', '📖 Book Reader Mode')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setBrowserViewMode('webview')}
                  style={[
                    styles.microBtn,
                    {
                      borderColor: browserViewMode === 'webview' ? pal.gold : pal.border,
                      backgroundColor: browserViewMode === 'webview' ? pal.pillActiveBg : pal.paperBg,
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: browserViewMode === 'webview' ? pal.goldText : pal.sub, fontSize: 11, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                    {t('🖥 网页原貌窗口 (内嵌浏览器)', '🖥 Web Iframe View')}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Browser Chrome Row: Back / Forward / Reload + Omnibox Input + Search CTA */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="浏览器后退"
                  disabled={browserHistoryIdx <= 0}
                  onPress={() => {
                    if (browserHistoryIdx > 0) {
                      const nextIdx = browserHistoryIdx - 1;
                      const prevQuery = browserHistory[nextIdx];
                      if (prevQuery) {
                        setBrowserHistoryIdx(nextIdx);
                        void runBrowserDirectSearch(prevQuery, undefined, false);
                      }
                    }
                  }}
                  style={[styles.microBtn, { borderColor: pal.border, opacity: browserHistoryIdx > 0 ? 1 : 0.4 }]}
                >
                  <Text variant="caption" style={{ color: pal.ink, fontSize: 11, fontWeight: '700' }}>◀</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="浏览器前进"
                  disabled={browserHistoryIdx >= browserHistory.length - 1}
                  onPress={() => {
                    if (browserHistoryIdx < browserHistory.length - 1) {
                      const nextIdx = browserHistoryIdx + 1;
                      const nextQuery = browserHistory[nextIdx];
                      if (nextQuery) {
                        setBrowserHistoryIdx(nextIdx);
                        void runBrowserDirectSearch(nextQuery, undefined, false);
                      }
                    }
                  }}
                  style={[styles.microBtn, { borderColor: pal.border, opacity: browserHistoryIdx < browserHistory.length - 1 ? 1 : 0.4 }]}
                >
                  <Text variant="caption" style={{ color: pal.ink, fontSize: 11, fontWeight: '700' }}>▶</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="刷新当前搜索或网页"
                  onPress={() => {
                    setIframeReloadTick((t0) => t0 + 1);
                    void runBrowserDirectSearch(browserQueryInput, undefined, false);
                  }}
                  style={[styles.microBtn, { borderColor: pal.border }]}
                >
                  <Text variant="caption" style={{ color: pal.ink, fontSize: 11, fontWeight: '700' }}>↻</Text>
                </Pressable>
              </View>

              <TextInput
                value={browserQueryInput}
                onChangeText={setBrowserQueryInput}
                onSubmitEditing={() => void runBrowserDirectSearch(browserQueryInput)}
                placeholder={t('输入任何想搜的词条、AI 概念或直接输入 https:// 网址回车直达...', 'Search any topic, AI concept, or enter https:// URL...')}
                placeholderTextColor={pal.muted}
                style={[
                  styles.input,
                  {
                    flex: 1,
                    minWidth: 240,
                    borderColor: pal.gold,
                    color: pal.ink,
                    backgroundColor: pal.inputBg,
                    fontFamily: theme.fontFamily.serif,
                    fontSize: 13.5,
                    paddingVertical: 9,
                  },
                ]}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="立即搜索"
                onPress={() => void runBrowserDirectSearch(browserQueryInput)}
                style={[styles.primaryPlayBtn, { backgroundColor: '#b88228', borderColor: '#b88228', paddingHorizontal: 16, paddingVertical: 9 }]}
              >
                <Text variant="caption" style={{ color: '#fffbeb', fontSize: 12, fontWeight: '700', fontFamily: theme.fontFamily.serif }}>
                  {browserSearching ? t('⏳ 正在检索...', '⏳ Searching...') : t('🔍 直接搜索', '🔍 Direct Search')}
                </Text>
              </Pressable>
            </View>

            {/* Search Engine Selector Row + Hot Query Chips */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text variant="caption" style={{ color: pal.muted, fontSize: 11, fontFamily: theme.fontFamily.serif }}>
                  {t('检索源：', 'Engine:')}
                </Text>
                {BROWSER_SEARCH_ENGINES.map((eng) => {
                  const isSel = browserEngine === eng.id;
                  return (
                    <Pressable
                      key={eng.id}
                      onPress={() => {
                        setBrowserEngine(eng.id);
                        void runBrowserDirectSearch(browserQueryInput, eng.id, false);
                      }}
                      style={[
                        styles.microBtn,
                        {
                          borderColor: isSel ? pal.gold : pal.border,
                          backgroundColor: isSel ? pal.pillActiveBg : 'transparent',
                        },
                      ]}
                    >
                      <Text variant="caption" style={{ color: isSel ? pal.goldText : pal.sub, fontSize: 11, fontFamily: theme.fontFamily.serif, fontWeight: isSel ? '700' : '400' }}>
                        {`${eng.icon} ${eng.zh}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text variant="caption" style={{ color: pal.muted, fontSize: 10.5, fontFamily: theme.fontFamily.serif }}>
                  {t('热搜直达：', 'Hot:')}
                </Text>
                {BROWSER_HOT_QUERIES.map((hq) => (
                  <Pressable
                    key={hq.query}
                    onPress={() => {
                      void runBrowserDirectSearch(hq.query, browserEngine, true);
                    }}
                    style={[styles.microBtn, { borderColor: pal.border, backgroundColor: pal.paperBg }]}
                  >
                    <Text variant="caption" style={{ color: pal.ink, fontSize: 10.5, fontFamily: theme.fontFamily.serif }}>
                      {hq.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Horizontal Search Result Cards */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
              {browserResults.map((item) => {
                const isSelected = activeBrowserResult?.id === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setSelectedBrowserResultId(item.id)}
                    style={[
                      styles.newsHeadlineCard,
                      {
                        borderColor: isSelected ? pal.gold : pal.border,
                        backgroundColor: isSelected ? pal.pillActiveBg : pal.paperBg,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <Text variant="caption" style={{ color: pal.goldText, fontSize: 10, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                        {item.sourceBadgeZh}
                      </Text>
                      <Text variant="caption" style={{ color: pal.emerald, fontSize: 10, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                        {`信噪比 ${item.signalScore}分`}
                      </Text>
                    </View>
                    <Text
                      variant="caption"
                      numberOfLines={2}
                      style={{
                        color: isSelected ? pal.goldText : pal.ink,
                        fontSize: 12,
                        fontFamily: theme.fontFamily.serif,
                        fontWeight: isSelected ? '700' : '600',
                      }}
                    >
                      {item.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 2. Browser Viewport: Either Book Reader Mode (`reader`) OR Embedded Web Window (`webview`) */}
          {activeBrowserResult ? (
            browserViewMode === 'reader' ? (
              <View style={{ marginTop: 12 }}>
                <View style={[styles.bookPageFolio, { backgroundColor: pal.paperBg, borderColor: pal.goldBorder, borderLeftColor: pal.spineShadow }]}>
                  {/* Running Header */}
                  <View style={[styles.bookRunningHeader, { borderBottomColor: pal.border }]}>
                    <Text variant="caption" style={{ color: pal.muted, fontSize: 11.5, fontFamily: theme.fontFamily.serif }}>
                      {`🌐 书院浏览器 · 纸书净读模式 · ${activeBrowserResult.sourceBadgeZh}`}
                    </Text>
                    <Text variant="caption" style={{ color: pal.emerald, fontSize: 11.5, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                      {`信噪比评分 ${activeBrowserResult.signalScore}/100 · 净读免打扰`}
                    </Text>
                  </View>

                  {/* Title & URL Bar */}
                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <Text variant="caption" style={{ color: pal.gold, fontSize: 11.5, fontFamily: theme.fontFamily.mono }}>
                        {`来源地址：${activeBrowserResult.url}`}
                      </Text>
                      <Pressable
                        onPress={() => setBrowserViewMode('webview')}
                        style={[styles.microBtn, { borderColor: pal.gold }]}
                      >
                        <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                          {t('🖥 切换至网页原貌窗口查看 →', '🖥 Switch to Web Iframe View →')}
                        </Text>
                      </Pressable>
                    </View>
                    <Text
                      variant="title"
                      style={{
                        color: pal.ink,
                        fontSize: fullScreen ? 23 : 20,
                        lineHeight: fullScreen ? 33 : 28,
                        fontFamily: theme.fontFamily.serif,
                        fontWeight: '700',
                      }}
                    >
                      {activeBrowserResult.title}
                    </Text>
                  </View>

                  {/* Summary Highlight Box */}
                  <View style={[styles.epigraphQuoteBox, { backgroundColor: pal.paperElevated, borderLeftColor: pal.gold, gap: 6 }]}>
                    <Text variant="caption" style={{ color: pal.goldText, fontSize: 12, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                      {t('【检索词条核心摘要】', '[Search Entry Digest]')}
                    </Text>
                    <Text
                      variant="body"
                      style={{
                        color: pal.ink,
                        fontSize: fullScreen ? 15.5 : 14.5,
                        lineHeight: fullScreen ? 27 : 25,
                        fontFamily: theme.fontFamily.serif,
                      }}
                    >
                      {activeBrowserResult.snippet}
                    </Text>
                  </View>

                  {/* Full Reader Paragraphs */}
                  <View style={{ gap: 14 }}>
                    {activeBrowserResult.paragraphs.map((para: string, pIdx: number) => (
                      <Text
                        key={pIdx}
                        variant="body"
                        style={{
                          color: pal.ink,
                          fontSize: fullScreen ? 16 : 15,
                          lineHeight: fullScreen ? 29 : 27,
                          fontFamily: theme.fontFamily.serif,
                        }}
                      >
                        {`　　${para}`}
                      </Text>
                    ))}
                  </View>

                  {/* Footer 1-Click Study Actions: Save to Knowledge Graph, Save to News Digest, or Jump to Book Chapter */}
                  <View style={[styles.bookPageFooter, { borderTopColor: pal.border }]}>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <Pressable
                        onPress={() => {
                          const { state: next, addedNode } = importCustomMarkdownKnowledgeNode({
                            title: activeBrowserResult.title.replace(/^【[^】]+】/, ''),
                            domainId: 'ai-infra',
                            markdownBody: `${activeBrowserResult.snippet}\n\n${activeBrowserResult.paragraphs.join('\n\n')}\n\n来源: ${activeBrowserResult.url} 关联 [[AI-101]]`,
                          });
                          setKgState(next);
                          onLogStudyMinutes?.(`浏览器检索收录: ${addedNode.title}`, 10);
                          showToast({ text: t(`📌 已将「${addedNode.title}」收录进你的知识图谱！`, '📌 Saved to Knowledge Graph!') });
                        }}
                        style={[styles.pageTurnBtn, { backgroundColor: '#b88228', borderColor: '#b88228' }]}
                      >
                        <Text variant="caption" style={{ color: '#fffbeb', fontSize: 12, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                          {t('📌 一键收录进我的知识图谱 (+10m)', '📌 Save to Knowledge Graph')}
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          const { state: next } = clipCustomNewsArticle({
                            title: activeBrowserResult.title,
                            sourceName: activeBrowserResult.sourceBadgeZh,
                            categoryId: 'ai-frontier',
                            rawText: activeBrowserResult.paragraphs.join('\n'),
                          });
                          setKgState(next);
                          showToast({ text: t('📰 已存入「书院晨报」净读列表！', '📰 Saved to News Digest!') });
                        }}
                        style={[styles.pageTurnBtn, { borderColor: pal.gold, backgroundColor: pal.pillActiveBg }]}
                      >
                        <Text variant="caption" style={{ color: pal.goldText, fontSize: 12, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                          {t('📰 存入书院晨报净读', '📰 Save to News Digest')}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      {activeBrowserResult.relatedNodeId ? (
                        <Pressable
                          onPress={() => {
                            const targetNode = kgState.nodes.find((n) => n.id === activeBrowserResult.relatedNodeId);
                            selectLesson(activeBrowserResult.relatedNodeId!, targetNode?.stageLevel);
                            setActiveSubView('lab');
                          }}
                          style={[styles.pageTurnBtn, { borderColor: pal.emerald }]}
                        >
                          <Text variant="caption" style={{ color: pal.emerald, fontSize: 12, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                            {t('📖 翻到本书对应章节与活动插图 →', '📖 Open Book Chapter →')}
                          </Text>
                        </Pressable>
                      ) : null}

                      {Platform.OS === 'web' && typeof window !== 'undefined' ? (
                        <Pressable
                          onPress={() => window.open(activeBrowserResult.url, '_blank', 'noopener,noreferrer')}
                          style={[styles.pageTurnBtn, { borderColor: pal.border }]}
                        >
                          <Text variant="caption" style={{ color: pal.sub, fontSize: 11.5, fontFamily: theme.fontFamily.serif }}>
                            {t('↗ 在新标签页打开原网页', '↗ Open External Tab')}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              /* Embedded Web Browser Iframe Window (`webview`) */
              <View style={{ marginTop: 12 }}>
                <View style={[styles.bookPageFolio, { backgroundColor: pal.paperBg, borderColor: pal.goldBorder, borderLeftColor: pal.spineShadow, paddingVertical: 14, paddingHorizontal: 16, minHeight: 540 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: pal.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Text variant="caption" style={{ color: pal.emerald, fontSize: 11, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                        🔒 HTTPS
                      </Text>
                      <Text variant="caption" numberOfLines={1} style={{ color: pal.ink, fontSize: 11.5, fontFamily: theme.fontFamily.mono, flex: 1 }}>
                        {activeBrowserResult.embedUrl}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable
                        onPress={() => setBrowserViewMode('reader')}
                        style={[styles.microBtn, { borderColor: pal.gold, backgroundColor: pal.pillActiveBg }]}
                      >
                        <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                          {t('📖 切回纸书净读模式', '📖 Switch to Reader Mode')}
                        </Text>
                      </Pressable>
                      {Platform.OS === 'web' && typeof window !== 'undefined' ? (
                        <Pressable
                          onPress={() => window.open(activeBrowserResult.url, '_blank', 'noopener,noreferrer')}
                          style={[styles.microBtn, { borderColor: pal.border }]}
                        >
                          <Text variant="caption" style={{ color: pal.ink, fontSize: 11, fontFamily: theme.fontFamily.serif }}>
                            {t('↗ 外部浏览器打开', '↗ Open in New Tab')}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>

                  {Platform.OS === 'web'
                    ? createElement('iframe', {
                        key: `${activeBrowserResult.embedUrl}-${iframeReloadTick}`,
                        src: activeBrowserResult.embedUrl,
                        title: activeBrowserResult.title,
                        sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms',
                        style: {
                          width: '100%',
                          height: fullScreen ? 520 : 440,
                          border: 'none',
                          borderRadius: 8,
                          backgroundColor: '#ffffff',
                        },
                      })
                    : (
                      <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>
                        <Text variant="body" style={{ color: pal.ink, fontFamily: theme.fontFamily.serif }}>
                          {activeBrowserResult.snippet}
                        </Text>
                      </View>
                    )}
                </View>
              </View>
            )
          ) : null}
        </View>
      ) : null}

      {/* ================= SUB-VIEW 4: SMART NEWS & TECH DIGEST FILTER READER (书院晨报 · 资讯筛选与长文净读) ================= */}
      {activeSubView === 'news' ? (
        <View style={styles.deskStage}>
          {/* 1. Multi-Dimensional News Filter Controls */}
          <View style={[styles.newsFilterPanel, { backgroundColor: pal.paperElevated, borderColor: pal.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text variant="label" style={{ color: pal.ink, fontSize: 14, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                  {t('📰 书院晨报 · 智能信噪比资讯筛选台', '📰 Smart High-Signal News & Essay Filter')}
                </Text>
                <View style={[styles.redSealBadge, { borderColor: pal.emerald, paddingHorizontal: 8, paddingVertical: 2 }]}>
                  <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                    {t(
                      `🛡 已自动拦截 ${filteredNewsResult.filteredOutNoiseCount} 篇标题党/低信噪比水文`,
                      `🛡 Intercepted ${filteredNewsResult.filteredOutNoiseCount} noisy items`,
                    )}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => setShowClipDrawer((v) => !v)}
                style={[styles.primaryPlayBtn, { backgroundColor: '#b88228', borderColor: '#b88228' }]}
              >
                <Text variant="caption" style={{ color: '#fffbeb', fontSize: 11, fontWeight: '700' }}>
                  {showClipDrawer ? t('收起剪藏面板 ▲', 'Hide Clipper ▲') : t('＋ 粘贴外部文章 / 资讯净读', '＋ Clip Article to Read')}
                </Text>
              </Pressable>
            </View>

            {/* Category & Signal Threshold Row */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <Pressable
                onPress={() => setKgState(updateNewsFilterOptions({ category: 'all' }))}
                style={[
                  styles.volumePill,
                  {
                    backgroundColor: newsFilter.category === 'all' ? pal.pillActiveBg : pal.paperBg,
                    borderColor: newsFilter.category === 'all' ? pal.gold : pal.border,
                  },
                ]}
              >
                <Text variant="caption" style={{ color: newsFilter.category === 'all' ? pal.goldText : pal.sub, fontSize: 11, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                  {t('全部频道', 'All')}
                </Text>
              </Pressable>
              {NEWS_CATEGORIES.map((cat) => {
                const active = newsFilter.category === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => setKgState(updateNewsFilterOptions({ category: cat.id }))}
                    style={[
                      styles.volumePill,
                      {
                        backgroundColor: active ? pal.pillActiveBg : pal.paperBg,
                        borderColor: active ? pal.gold : pal.border,
                      },
                    ]}
                  >
                    <Text variant="caption" style={{ color: active ? pal.goldText : pal.sub, fontSize: 11, fontFamily: theme.fontFamily.serif, fontWeight: active ? '700' : '500' }}>
                      {`${cat.icon} ${t(cat.zh, cat.en)}`}
                    </Text>
                  </Pressable>
                );
              })}

              {/* Signal Score Toggle */}
              <Pressable
                onPress={() =>
                  setKgState(
                    updateNewsFilterOptions({
                      minSignalScore: newsFilter.minSignalScore >= 80 ? 0 : 80,
                    }),
                  )
                }
                style={[
                  styles.volumePill,
                  {
                    backgroundColor: newsFilter.minSignalScore >= 80 ? 'rgba(52,211,153,0.16)' : pal.paperBg,
                    borderColor: newsFilter.minSignalScore >= 80 ? pal.emerald : pal.border,
                  },
                ]}
              >
                <Text variant="caption" style={{ color: newsFilter.minSignalScore >= 80 ? pal.emerald : pal.sub, fontSize: 11, fontWeight: '700' }}>
                  {newsFilter.minSignalScore >= 80
                    ? t('✓ 仅看高信噪比 (≥80分)', '✓ High-Signal Only (≥80)')
                    : t('○ 显示全部 (含低分水文)', '○ Show All Scores')}
                </Text>
              </Pressable>

              {/* Depth & Bookmark Toggles */}
              <Pressable
                onPress={() =>
                  setKgState(
                    updateNewsFilterOptions({
                      readingDepth:
                        newsFilter.readingDepth === 'all'
                          ? 'deep'
                          : newsFilter.readingDepth === 'deep'
                            ? 'quick'
                            : 'all',
                    }),
                  )
                }
                style={[styles.volumePill, { borderColor: pal.border, backgroundColor: pal.paperBg }]}
              >
                <Text variant="caption" style={{ color: pal.sub, fontSize: 11 }}>
                  {newsFilter.readingDepth === 'all'
                    ? '⏱ 时长：不限'
                    : newsFilter.readingDepth === 'deep'
                      ? '☕ 仅看 ≥6m 深度长文'
                      : '⚡ 仅看 ≤5m 速读简报'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  setKgState(updateNewsFilterOptions({ onlyBookmarked: !newsFilter.onlyBookmarked }))
                }
                style={[
                  styles.volumePill,
                  {
                    borderColor: newsFilter.onlyBookmarked ? pal.gold : pal.border,
                    backgroundColor: newsFilter.onlyBookmarked ? pal.pillActiveBg : pal.paperBg,
                  },
                ]}
              >
                <Text variant="caption" style={{ color: newsFilter.onlyBookmarked ? pal.goldText : pal.sub, fontSize: 11, fontWeight: '700' }}>
                  {newsFilter.onlyBookmarked ? '★ 仅看已收藏' : '☆ 收藏筛选'}
                </Text>
              </Pressable>
            </View>

            {/* Search & Noise Blocklist Inputs */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <TextInput
                value={newsFilter.searchQuery}
                onChangeText={(q) => setKgState(updateNewsFilterOptions({ searchQuery: q }))}
                placeholder={t('🔍 搜索资讯关键词（如 DeepSeek、MCP、vLLM、杠铃策略）...', '🔍 Filter by keyword...')}
                placeholderTextColor={pal.muted}
                style={[styles.input, { flex: 1, minWidth: 220, color: pal.ink, backgroundColor: pal.paperBg, borderColor: pal.border }]}
              />
              <TextInput
                value={newsFilter.mutedKeywordsCsv}
                onChangeText={(m) => setKgState(updateNewsFilterOptions({ mutedKeywordsCsv: m }))}
                placeholder={t('静音词黑名单（逗号分隔，如：震惊, 暴富, 必看）', 'Muted clickbait keywords...')}
                placeholderTextColor={pal.muted}
                style={[styles.input, { flex: 1, minWidth: 220, color: pal.ink, backgroundColor: pal.paperBg, borderColor: pal.border }]}
              />
            </View>

            {/* Optional Custom Article Clipper Drawer */}
            {showClipDrawer ? (
              <View style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: pal.goldBorder, backgroundColor: pal.paperBg, gap: 8 }}>
                <Text variant="caption" style={{ color: pal.goldText, fontSize: 11.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                  {t('✂️ 粘贴外部新闻或长文 → 自动计算信噪比评分并转为纸书排版净读：', '✂️ Paste Article for Clean Book-Style Reading:')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <TextInput
                    value={clipTitle}
                    onChangeText={setClipTitle}
                    placeholder={t('文章标题，如：Anthropic 发布最新 Agent 架构实践', 'Article Title')}
                    placeholderTextColor={pal.muted}
                    style={[styles.input, { flex: 1, minWidth: 200, color: pal.ink, backgroundColor: pal.inputBg, borderColor: pal.border }]}
                  />
                  {NEWS_CATEGORIES.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => setClipCategory(c.id)}
                      style={[
                        styles.microBtn,
                        {
                          backgroundColor: clipCategory === c.id ? pal.pillActiveBg : 'transparent',
                          borderColor: clipCategory === c.id ? pal.gold : pal.border,
                        },
                      ]}
                    >
                      <Text variant="caption" style={{ color: clipCategory === c.id ? pal.goldText : pal.sub, fontSize: 10.5 }}>
                        {c.zh}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={clipBody}
                  onChangeText={setClipBody}
                  placeholder={t('在此粘贴文章正文段落（支持多段文本，系统将自动剔除噪音并按信噪比评分）...', 'Paste article paragraphs here...')}
                  placeholderTextColor={pal.muted}
                  multiline
                  style={[styles.input, { minHeight: 74, color: pal.ink, backgroundColor: pal.inputBg, borderColor: pal.border }]}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                  <Pressable
                    onPress={() => {
                      const res = clipCustomNewsArticle({
                        title: clipTitle,
                        categoryId: clipCategory,
                        rawText: clipBody,
                      });
                      setKgState(res.state);
                      setSelectedNewsId(res.addedItem.id);
                      setClipTitle('');
                      setClipBody('');
                      setShowClipDrawer(false);
                      showToast({
                        text: t(
                          `✓ 已净读收入《${res.addedItem.titleZh}》（信噪比评分 ${res.addedItem.signalScore} 分）`,
                          `✓ Clipped (${res.addedItem.signalScore} pts)`,
                        ),
                      });
                    }}
                    style={[styles.primaryPlayBtn, { backgroundColor: '#b88228', borderColor: '#b88228' }]}
                  >
                    <Text variant="caption" style={{ color: '#fffbeb', fontSize: 11.5, fontWeight: '700' }}>
                      {t('✓ 转为纸书排版并开始阅读', '✓ Format as Book Page')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* Horizontal Filtered Headline Cards */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {filteredNewsResult.visibleItems.map((item) => {
                const isSel = item.id === activeNewsItem.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setSelectedNewsId(item.id)}
                    style={[
                      styles.newsHeadlineCard,
                      {
                        backgroundColor: isSel ? pal.pillActiveBg : pal.paperBg,
                        borderColor: isSel ? pal.gold : pal.border,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <Text variant="caption" style={{ color: item.signalScore >= 90 ? pal.emerald : pal.goldText, fontSize: 10, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                        {`信噪比 ${item.signalScore}分 · ${item.readMinutes}m`}
                      </Text>
                      <Text variant="caption" style={{ color: pal.muted, fontSize: 10 }}>
                        {`${item.bookmarked ? '★ ' : ''}${item.read ? '✓已读' : '未读'}`}
                      </Text>
                    </View>
                    <Text
                      variant="caption"
                      style={{
                        color: isSel ? pal.goldText : pal.ink,
                        fontSize: 12,
                        fontFamily: theme.fontFamily.serif,
                        fontWeight: isSel ? '700' : '600',
                        lineHeight: 18,
                      }}
                    >
                      {item.titleZh.slice(0, 28)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 2. Selected News Article Rendered in the Same Calm Hardcover Book Folio! */}
          {activeNewsItem ? (
            <View
              style={[
                styles.bookPageFolio,
                {
                  backgroundColor: pal.paperBg,
                  borderColor: pal.goldBorder,
                  borderLeftColor: pal.spineShadow,
                  marginTop: 12,
                },
              ]}
            >
              <View style={[styles.bookRunningHeader, { borderBottomColor: pal.border }]}>
                <Text variant="caption" style={{ color: pal.muted, fontSize: 11.5, fontFamily: theme.fontFamily.serif }}>
                  {`${activeNewsItem.sourceName}  ·  ${activeNewsItem.publishedAt}  ·  预计阅读 ${activeNewsItem.readMinutes} 分钟`}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <View style={[styles.redSealBadge, { borderColor: pal.emerald }]}>
                    <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                      {`信噪比 ${activeNewsItem.signalScore}/100`}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setKgState(toggleNewsItemStatus(activeNewsItem.id, 'bookmarked'))}
                    style={[styles.microBtn, { borderColor: activeNewsItem.bookmarked ? pal.gold : pal.border }]}
                  >
                    <Text variant="caption" style={{ color: activeNewsItem.bookmarked ? pal.goldText : pal.sub, fontSize: 11, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                      {activeNewsItem.bookmarked ? '★ 已收藏' : '☆ 收藏本文'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={{ gap: 16, paddingVertical: 8 }}>
                <Text
                  variant="heading"
                  style={{
                    color: pal.ink,
                    fontSize: 21,
                    lineHeight: 31,
                    fontFamily: theme.fontFamily.serif,
                    fontWeight: '700',
                  }}
                >
                  {activeNewsItem.titleZh}
                </Text>

                <View style={[styles.epigraphQuoteBox, { borderLeftColor: pal.gold, backgroundColor: pal.paperElevated }]}>
                  <Text variant="body" style={{ color: pal.sub, fontSize: 13.5, lineHeight: 22, fontFamily: theme.fontFamily.serif }}>
                    {`「晨报提要」${activeNewsItem.summaryZh}`}
                  </Text>
                </View>

                <View style={{ gap: 14 }}>
                  {activeNewsItem.paragraphsZh.map((para, idx) => (
                    <Text
                      key={idx}
                      variant="body"
                      style={{
                        color: pal.ink,
                        fontSize: 16,
                        lineHeight: 30,
                        fontFamily: theme.fontFamily.serif,
                      }}
                    >
                      {`　　${para}`}
                    </Text>
                  ))}
                </View>

                <View style={[styles.highlightedPassageBox, { backgroundColor: pal.highlightBg, borderColor: pal.goldBorder }]}>
                  <Text variant="caption" style={{ color: pal.goldText, fontSize: 11.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                    {t('✒️ 本文核心要点摘录：', '✒️ Key Takeaways:')}
                  </Text>
                  {activeNewsItem.keyTakeawaysZh.map((kt, idx) => (
                    <Text key={idx} variant="body" style={{ color: pal.ink, fontSize: 14, lineHeight: 23, fontFamily: theme.fontFamily.serif }}>
                      {`• ${kt}`}
                    </Text>
                  ))}
                </View>
              </View>

              <View style={[styles.bookPageFooter, { borderTopColor: pal.border }]}>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {activeNewsItem.relatedNodeCode ? (
                    <Pressable
                      onPress={() => {
                        const target = kgState.nodes.find((n) => n.code === activeNewsItem.relatedNodeCode);
                        if (target) {
                          selectLesson(target.id, target.stageLevel);
                          setActiveSubView('lab');
                        }
                      }}
                      style={[styles.pageTurnBtn, { borderColor: pal.gold, backgroundColor: pal.paperElevated }]}
                    >
                      <Text variant="caption" style={{ color: pal.goldText, fontSize: 11.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                        {`📖 翻阅关联书章 (${activeNewsItem.relatedNodeCode})`}
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    onPress={() => {
                      const res = importCustomMarkdownKnowledgeNode({
                        title: activeNewsItem.titleZh.slice(0, 26),
                        domainId:
                          activeNewsItem.categoryId === 'wealth-macro'
                            ? 'wealth-quant'
                            : activeNewsItem.categoryId === 'sys-open'
                              ? 'cs-systems'
                              : 'ai-infra',
                        markdownBody: [
                          ...activeNewsItem.keyTakeawaysZh,
                          activeNewsItem.relatedNodeCode ? `关联章节 [[${activeNewsItem.relatedNodeCode}]]` : '',
                        ]
                          .filter(Boolean)
                          .join('\n'),
                      });
                      setKgState(res.state);
                      showToast({
                        text: t(
                          `📌 已将本文核心要点摘录进你的知识图谱节点「${res.addedNode.code}」！`,
                          `📌 Clipped to Knowledge Graph (${res.addedNode.code})`,
                        ),
                      });
                    }}
                    style={[styles.pageTurnBtn, { borderColor: pal.emerald, backgroundColor: pal.paperElevated }]}
                  >
                    <Text variant="caption" style={{ color: pal.emerald, fontSize: 11.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                      {t('📌 一键摘录进我的知识图谱', '📌 Clip to Knowledge Graph')}
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => {
                    if (!activeNewsItem.read) {
                      setKgState(toggleNewsItemStatus(activeNewsItem.id, 'read'));
                    }
                    onLogStudyMinutes?.(activeNewsItem.titleZh, activeNewsItem.readMinutes);
                    recordPledgeReward(localDay, 'study');
                    showToast({
                      text: t(
                        `💮 已阅《${activeNewsItem.titleZh.slice(0, 14)}...》，记入阅读时长 +${activeNewsItem.readMinutes} 分钟`,
                        `💮 Marked Read (+${activeNewsItem.readMinutes}m)`,
                      ),
                    });
                  }}
                  style={[styles.sealStampCtaBtn, { backgroundColor: pal.sealRed, borderColor: '#fca5a5' }]}
                >
                  <Text variant="caption" style={{ color: '#fffbeb', fontSize: 12.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                    {activeNewsItem.read
                      ? t(`💮 已阅钤印 (+${activeNewsItem.readMinutes}m)`, '💮 Read')
                      : t(`💮 读完本文 · 盖下「已阅」印 (+${activeNewsItem.readMinutes}m)`, `💮 Mark Read (+${activeNewsItem.readMinutes}m)`)}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ================= SUB-VIEW 3: OFFLINE CHAPTER PACK STORE ================= */}
      {activeSubView === 'packs' ? (
        <View style={[styles.drawerBox, { backgroundColor: pal.paperBg }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <Text variant="caption" style={{ color: pal.goldText, fontSize: 12.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
              {t('📦 藏书匣 · 按需离线章节包管理（App 仅内置 4KB 书目索引，插图与正文按需下载缓存）', '📦 Offline Book Packs')}
            </Text>
            <Text variant="caption" style={{ color: pal.sky, fontSize: 10.5, fontFamily: theme.fontFamily.mono }}>
              {`localStorage["${stats.storageKey}"] & ${stats.packFolderRelPath}`}
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
                      backgroundColor: pal.paperElevated,
                      borderColor: installed ? pal.emerald : pal.border,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text variant="caption" style={{ color: pal.ink, fontSize: 12, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                      {`《${t(pack.titleZh, pack.titleEn)}》 (${pack.version})`}
                    </Text>
                    <Text variant="caption" style={{ color: installed ? pal.emerald : pal.muted, fontSize: 10.5, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                      {installed ? `✓ 已收入书匣 · ${pack.sizeKb} KB` : `未下载 · ${pack.sizeKb} KB`}
                    </Text>
                  </View>
                  <Text variant="caption" style={{ color: pal.sub, fontSize: 11, lineHeight: 17 }}>
                    {pack.descriptionZh}
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', gap: 6 }}>
                    <Pressable
                      onPress={() => void handleExportPackFile(pack.id)}
                      style={[styles.microBtn, { borderColor: pal.sky }]}
                    >
                      <Text variant="caption" style={{ color: pal.sky, fontSize: 10.5, fontWeight: '700' }}>
                        {t('📥 导出 .pack.json 书卷', '📥 Export .pack.json')}
                      </Text>
                    </Pressable>
                    {installed ? (
                      <Pressable
                        onPress={() => {
                          setKgState(offloadKnowledgeChapterPack(pack.id));
                          showToast({
                            text: t(
                              `已将《${pack.titleZh}》移出本地缓存释放 ${pack.sizeKb} KB，批注手札与阅读进度完整保留`,
                              `Offloaded ${pack.titleEn}`,
                            ),
                          });
                        }}
                        style={[styles.microBtn, { borderColor: pal.border }]}
                      >
                        <Text variant="caption" style={{ color: pal.muted, fontSize: 10.5 }}>
                          {t('移出缓存释放空间 (保留手札)', 'Offload Pack')}
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => {
                          const res = installKnowledgeChapterPack(pack.id);
                          setKgState(res.state);
                          showToast({ text: t(`✓ 已收入离线书卷《${pack.titleZh}》`, `✓ Installed ${pack.titleEn}`) });
                        }}
                        style={[styles.microBtn, { backgroundColor: 'rgba(52, 211, 153, 0.16)', borderColor: pal.emerald }]}
                      >
                        <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, fontWeight: '700' }}>
                          {t('⬇ 收入本地藏书匣', '⬇ Install Offline Pack')}
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
            <Text variant="caption" style={{ color: pal.goldText, fontSize: 12, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
              {t('🗺 全书知识脉络星图（点击任意章节节点可直接翻至该章书页）', '🗺 Book Knowledge Graph')}
            </Text>
            <Pressable
              onPress={() => setShowAddNodeBox((v) => !v)}
              style={[styles.microBtn, { borderColor: pal.gold, backgroundColor: pal.pillActiveBg }]}
            >
              <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                {t('＋ 撰写新章节手稿 ([[双链]])', '＋ Add Chapter Note')}
              </Text>
            </Pressable>
          </View>

          {showAddNodeBox ? (
            <View style={[styles.drawerBox, { backgroundColor: pal.paperBg, borderColor: pal.goldBorder, borderWidth: 1, borderRadius: 10 }]}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TextInput
                  value={customTitle}
                  onChangeText={setCustomTitle}
                  placeholder={t('新章节标题，如：DeepSeek MLA 矩阵压缩读书笔记', 'Chapter Title')}
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
                  '输入读书心得与双向链接，例如：承接 [[AI-101]] 与 [[AI-201]]，将 KV 联合低秩压缩',
                  'Markdown notes with [[WikiLinks]]...',
                )}
                placeholderTextColor={pal.muted}
                multiline
                style={[styles.input, { minHeight: 60, color: pal.ink, backgroundColor: pal.inputBg, borderColor: pal.border }]}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <Pressable
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
                    showToast({ text: t(`✓ 已编入新章节「${res.addedNode.code}」`, `✓ Added ${res.addedNode.code}`) });
                  }}
                  style={[styles.primaryPlayBtn, { backgroundColor: '#b88228', borderColor: '#b88228' }]}
                >
                  <Text variant="caption" style={{ color: '#fffbeb', fontSize: 11, fontWeight: '700' }}>
                    {t('✓ 编入个人书卷', '✓ Save to Book')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={[styles.canvasCard, { backgroundColor: pal.paperBg, borderColor: pal.border }]}>
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

          <View style={[styles.topStrip, { backgroundColor: pal.paperElevated, borderColor: pal.border, borderWidth: 1, borderRadius: 10 }]}>
            <Text variant="caption" style={{ color: pal.goldText, fontSize: 11.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
              {t(`🏆 书房案头清供解锁 (${unlockables.filter((u) => u.unlocked).length}/${unlockables.length})`, '🏆 Studio Desk Unlocks')}
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

      {/* ================= SUB-VIEW 1: THE OPEN HARDCOVER BOOK FOLIO (沉浸式纸书开本) ================= */}
      {activeSubView === 'lab' ? (
        <View style={styles.deskStage}>
          {/* Quick Chapter Ribbon Strip along top of book */}
          <View style={styles.chapterBookmarkRow}>
            {stageNodes.map((n, idx) => {
              const isSel = n.id === selectedNode.id;
              const isRead = n.status === 'mastered';
              return (
                <Pressable
                  key={n.id}
                  onPress={() => selectLesson(n.id)}
                  style={[
                    styles.chapterRibbonTab,
                    {
                      backgroundColor: isSel ? pal.paperBg : pal.paperElevated,
                      borderColor: isSel ? pal.gold : pal.border,
                      borderBottomWidth: isSel ? 0 : 1,
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    style={{
                      color: isSel ? pal.goldText : isRead ? pal.emerald : pal.muted,
                      fontSize: 11.5,
                      fontFamily: theme.fontFamily.serif,
                      fontWeight: isSel ? '700' : '500',
                    }}
                  >
                    {`${isRead ? '✓ ' : ''}第 ${idx + 1} 章 · ${n.title.replace(/^【[^】]+】/, '').split('？')[0]}${n.title.includes('？') ? '？' : ''}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Physical Book Page Container with Left Spine Crease & Right Stacked Page Edge */}
          <View
            style={[
              styles.bookPageFolio,
              {
                backgroundColor: pal.paperBg,
                borderColor: pal.goldBorder,
                borderLeftColor: pal.spineShadow,
              },
            ]}
          >
            {/* Book Running Header (书眉) */}
            <View style={[styles.bookRunningHeader, { borderBottomColor: pal.border }]}>
              <Text
                variant="caption"
                style={{
                  color: pal.muted,
                  fontSize: 11.5,
                  fontFamily: theme.fontFamily.serif,
                  letterSpacing: 0.6,
                }}
              >
                {`${volumeNameZh}  ·  第 ${chapterIndexInVolume} 章 (${selectedNode.code})`}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {selectedNode.status === 'mastered' ? (
                  <View style={[styles.redSealBadge, { borderColor: pal.sealRed }]}>
                    <Text variant="caption" style={{ color: pal.sealRed, fontSize: 10, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                      〔已阅钤印〕
                    </Text>
                  </View>
                ) : null}
                <Text
                  variant="caption"
                  style={{
                    color: pal.goldText,
                    fontSize: 11.5,
                    fontFamily: theme.fontFamily.serif,
                    fontWeight: '700',
                  }}
                >
                  {`第 ${pageNumber} / 4 页`}
                </Text>
              </View>
            </View>

            {/* 4-Page Navigation Tabs styled as subtle book section markers */}
            <View style={[styles.pageSubtleNavRow, { borderBottomColor: pal.border }]}>
              {(
                [
                  { p: 1 as const, label: '壹 · 开篇深度长文' },
                  { p: 2 as const, label: '贰 · 书中活动插图' },
                  { p: 3 as const, label: '叁 · 划线旁批与底注' },
                  { p: 4 as const, label: '肆 · 掩卷手札与钤印' },
                ] as const
              ).map((item) => {
                const active = pageNumber === item.p;
                return (
                  <Pressable
                    key={item.p}
                    onPress={() => setPageNumber(item.p)}
                    style={[
                      styles.pageSectionTab,
                      {
                        borderBottomColor: active ? pal.gold : 'transparent',
                        borderBottomWidth: active ? 2 : 0,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={{
                        color: active ? pal.goldText : pal.muted,
                        fontSize: 12,
                        fontFamily: theme.fontFamily.serif,
                        fontWeight: active ? '700' : '500',
                      }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedContent ? (
              <View style={styles.bookPageBody}>
                {/* ==================== PAGE 1: 开篇故事与深度长文 (Multi-Paragraph Long-Form Reading) ==================== */}
                {pageNumber === 1 ? (
                  <View style={{ gap: 18 }}>
                    <View style={{ gap: 8, paddingTop: 4 }}>
                      <Text
                        variant="caption"
                        style={{
                          color: pal.gold,
                          fontSize: 12,
                          fontFamily: theme.fontFamily.serif,
                          letterSpacing: 1.2,
                          fontWeight: '700',
                        }}
                      >
                        {`CHAPTER ${selectedNode.code}  ·  精读正文`}
                      </Text>
                      <Text
                        variant="heading"
                        style={{
                          color: pal.ink,
                          fontSize: 22,
                          lineHeight: 32,
                          fontFamily: theme.fontFamily.serif,
                          fontWeight: '700',
                        }}
                      >
                        {selectedNode.title.replace(/^【[^】]+】/, '')}
                      </Text>
                    </View>

                    {/* Epigraph Quote (题记引语) */}
                    <View style={[styles.epigraphQuoteBox, { borderLeftColor: pal.gold, backgroundColor: pal.paperElevated }]}>
                      <Text
                        variant="body"
                        style={{
                          color: pal.sub,
                          fontSize: 14,
                          lineHeight: 23,
                          fontFamily: theme.fontFamily.serif,
                        }}
                      >
                        {`「开篇直觉」${(selectedContent.beginnerAnalogyZh ?? selectedContent.coreMentalModel).replace(/^🌱\s*小白大白话：/, '')}`}
                      </Text>
                    </View>

                    {/* Rich Multi-Paragraph Book Essay so users can read deeply right inside the app! */}
                    <View style={{ gap: 14 }}>
                      {(selectedContent.deepReadingParagraphsZh &&
                      selectedContent.deepReadingParagraphsZh.length > 0
                        ? selectedContent.deepReadingParagraphsZh
                        : [selectedContent.coreMentalModel]
                      ).map((para, pIdx) => (
                        <Text
                          key={pIdx}
                          variant="body"
                          style={{
                            color: pal.ink,
                            fontSize: 16,
                            lineHeight: 30,
                            fontFamily: theme.fontFamily.serif,
                          }}
                        >
                          {`　　${para}`}
                        </Text>
                      ))}
                    </View>

                    {/* Highlighted Key Sentence (荧光笔划线批注) */}
                    <View style={[styles.highlightedPassageBox, { backgroundColor: pal.highlightBg, borderColor: pal.goldBorder }]}>
                      <Text
                        variant="caption"
                        style={{
                          color: pal.goldText,
                          fontSize: 11.5,
                          fontFamily: theme.fontFamily.serif,
                          fontWeight: '700',
                        }}
                      >
                        {t('✒️ 书页荧光划线 · 一句话点透本质：', '✒️ Highlighted Key Passage:')}
                      </Text>
                      <Text
                        variant="body"
                        style={{
                          color: pal.ink,
                          fontSize: 14.5,
                          lineHeight: 25,
                          fontFamily: theme.fontFamily.serif,
                        }}
                      >
                        {selectedContent.coreMentalModel}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* ==================== PAGE 2: 书中活动插图 (Interactive Figure) ==================== */}
                {pageNumber === 2 ? (
                  <View style={{ gap: 16 }}>
                    <Text
                      variant="body"
                      style={{
                        color: pal.ink,
                        fontSize: 15.5,
                        lineHeight: 27,
                        fontFamily: theme.fontFamily.serif,
                      }}
                    >
                      {`　　百闻不如一见。下面这幅【书中活动插图】将「${selectedNode.title.replace(/^【[^】]+】/, '')}」的内部运转过程拆解在了纸面上。${
                        selectedContent.guidedStepsZh?.[0]
                          ? `你可以试着按图上提示亲手拨动按钮——${selectedContent.guidedStepsZh[0]}：`
                          : '不妨亲手点击图中的按钮，观察每一次状态变化：'
                      }`}
                    </Text>

                    {selectedContent.animationKind ? (
                      <AiInteractiveAnimationLab
                        kind={selectedContent.animationKind}
                        figureCode={selectedNode.code}
                        isDark={isDark}
                        fullScreen={fullScreen}
                      />
                    ) : (
                      <View style={[styles.epigraphQuoteBox, { borderLeftColor: pal.gold, backgroundColor: pal.paperElevated }]}>
                        <Text variant="body" style={{ color: pal.ink, fontSize: 15, lineHeight: 26, fontFamily: theme.fontFamily.serif }}>
                          {selectedContent.coreMentalModel}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : null}

                {/* ==================== PAGE 3: 精读划线与书页旁批脚注 ==================== */}
                {pageNumber === 3 ? (
                  <View style={{ gap: 18 }}>
                    <Text
                      variant="body"
                      style={{
                        color: pal.ink,
                        fontSize: 15.5,
                        lineHeight: 27,
                        fontFamily: theme.fontFamily.serif,
                      }}
                    >
                      {t(
                        '　　看过了活动插图的推演，我们不妨在书页边缘记下本章最值得反复咀嚼的三条核心脉络：',
                        'Having explored the interactive figure, let us underline the three essential principles on this page:',
                      )}
                    </Text>

                    <View style={{ gap: 12 }}>
                      {selectedContent.keyTakeaways.map((pt, idx) => {
                        const numLabel = idx === 0 ? '其一' : idx === 1 ? '其二' : idx === 2 ? '其三' : `其四`;
                        return (
                          <View
                            key={idx}
                            style={[
                              styles.underlinedBookNote,
                              {
                                backgroundColor: pal.paperElevated,
                                borderLeftColor: pal.gold,
                              },
                            ]}
                          >
                            <Text
                              variant="body"
                              style={{
                                color: pal.ink,
                                fontSize: 15,
                                lineHeight: 26,
                                fontFamily: theme.fontFamily.serif,
                              }}
                            >
                              <Text style={{ color: pal.goldText, fontWeight: '700', fontFamily: theme.fontFamily.serif }}>
                                {`【${numLabel}】 `}
                              </Text>
                              {pt}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Classic Book Footnote Section (书页底注 · 符号释义) */}
                    <View style={[styles.footnoteSection, { borderTopColor: pal.border }]}>
                      <Text
                        variant="caption"
                        style={{
                          color: pal.goldText,
                          fontSize: 11.5,
                          fontFamily: theme.fontFamily.serif,
                          fontWeight: '700',
                        }}
                      >
                        {t('【书页底注 · 算式与符号释义】', '[Book Footnotes · Formula & Symbols]')}
                      </Text>
                      <Text
                        variant="caption"
                        style={{
                          color: pal.emerald,
                          fontSize: 11.5,
                          fontFamily: theme.fontFamily.mono,
                          fontWeight: '700',
                          marginTop: 2,
                        }}
                      >
                        {selectedContent.codeOrFormulaSnippet}
                      </Text>
                      {selectedContent.formulaBreakdownZh?.map((fb, idx) => (
                        <Text
                          key={idx}
                          variant="caption"
                          style={{
                            color: pal.sub,
                            fontSize: 12,
                            lineHeight: 20,
                            fontFamily: theme.fontFamily.serif,
                          }}
                        >
                          {`[注${idx + 1}]  `}
                          <Text style={{ fontFamily: theme.fontFamily.mono, fontWeight: '700', color: pal.ink }}>
                            {fb.symbol}
                          </Text>
                          {` ：${fb.meaningZh}`}
                        </Text>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* ==================== PAGE 4: 掩卷思考、读书手札与藏书钤印 ==================== */}
                {pageNumber === 4 ? (
                  <View style={{ gap: 18 }}>
                    {selectedContent.quiz ? (
                      <View style={[styles.reflectionBox, { backgroundColor: pal.paperElevated, borderColor: pal.goldBorder }]}>
                        <Text
                          variant="label"
                          style={{
                            color: pal.goldText,
                            fontSize: 14,
                            fontFamily: theme.fontFamily.serif,
                            fontWeight: '700',
                          }}
                        >
                          {`【掩卷一问】${selectedContent.quiz.questionZh.replace(/^【[^】]+】/, '')}`}
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
                                    ? pal.sealRed
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
                                        ? 'rgba(52,211,153,0.15)'
                                        : chosen
                                          ? 'rgba(220,38,38,0.10)'
                                          : pal.paperBg,
                                  },
                                ]}
                              >
                                <Text
                                  variant="body"
                                  style={{
                                    color: pal.ink,
                                    fontSize: 14,
                                    fontFamily: theme.fontFamily.serif,
                                  }}
                                >
                                  {opt}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        {selectedQuizOption !== null ? (
                          <Text
                            variant="caption"
                            style={{
                              color: selectedQuizOption === selectedContent.quiz.correctIndex ? pal.emerald : pal.goldText,
                              fontSize: 12.5,
                              lineHeight: 20,
                              fontFamily: theme.fontFamily.serif,
                              marginTop: 6,
                            }}
                          >
                            {`【书后解析】${selectedContent.quiz.explanationZh}`}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}

                    {selectedContent.flashcards[0] ? (
                      <Pressable
                        onPress={() => setShowFlashcardAnswer((v) => !v)}
                        style={[
                          styles.flashcardBox,
                          { backgroundColor: pal.paperElevated, borderColor: pal.border, padding: 12 },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text variant="caption" style={{ color: pal.sub, fontSize: 12, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                            {`🔖 夹页书签问：${selectedContent.flashcards[0].q}`}
                          </Text>
                          <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontFamily: theme.fontFamily.serif }}>
                            {showFlashcardAnswer ? '合上书签 ▲' : '翻看书签背面 ▼'}
                          </Text>
                        </View>
                        {showFlashcardAnswer ? (
                          <Text variant="caption" style={{ color: pal.emerald, fontSize: 12, marginTop: 6, lineHeight: 19, fontFamily: theme.fontFamily.serif }}>
                            {`书签背面：${selectedContent.flashcards[0].a}`}
                          </Text>
                        ) : null}
                      </Pressable>
                    ) : null}

                    {/* Personal Reading Margin Note (我的读书批注手札) */}
                    <View style={[styles.marginNoteCard, { backgroundColor: pal.paperElevated, borderColor: pal.border }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="caption" style={{ color: pal.goldText, fontSize: 12, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                          {t('✍️ 我的页边批注手札（随笔感悟会自动保存在本章书页上）', '✍️ Personal Margin Notes')}
                        </Text>
                        <Pressable
                          onPress={() => {
                            setKgState(updateKnowledgeNodeProgress(selectedNode.id, { userNote: marginNoteDraft }));
                            showToast({ text: t('✓ 已将批注手札落墨保存至本章书页', '✓ Margin note saved') });
                          }}
                          style={[styles.microBtn, { borderColor: pal.gold }]}
                        >
                          <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                            {t('落墨保存批注', 'Save Note')}
                          </Text>
                        </Pressable>
                      </View>
                      <TextInput
                        value={marginNoteDraft}
                        onChangeText={setMarginNoteDraft}
                        placeholder={t('在此写下你读完本章的领悟或疑问...', 'Write your margin notes here...')}
                        placeholderTextColor={pal.muted}
                        multiline
                        style={[
                          styles.marginNoteInput,
                          {
                            color: pal.ink,
                            backgroundColor: pal.paperBg,
                            borderColor: pal.border,
                            fontFamily: theme.fontFamily.serif,
                          },
                        ]}
                      />
                    </View>

                    {/* Traditional Red Seal Stamp Button */}
                    <View style={{ alignItems: 'flex-end', paddingTop: 4 }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="盖下已阅藏书印并翻至下一章"
                        onPress={() => {
                          const nextMins = selectedNode.studyMinutes + 25;
                          setKgState(
                            updateKnowledgeNodeProgress(selectedNode.id, {
                              studyMinutes: nextMins,
                              reviewLevel: selectedNode.reviewLevel + 1,
                              status: 'mastered',
                              userNote: marginNoteDraft,
                            }),
                          );
                          onLogStudyMinutes?.(selectedNode.title, 25);
                          recordPledgeReward(localDay, 'study');
                          if (nextNodeGlobal) {
                            selectLesson(nextNodeGlobal.id, nextNodeGlobal.stageLevel);
                            showToast({
                              text: t(
                                `💮 已于「${selectedNode.code}」钤印立档 (+25m)，为你翻开下一章《${nextNodeGlobal.title.replace(/^【[^】]+】/, '').slice(0, 12)}》`,
                                `💮 Stamped ${selectedNode.code}! Turning to ${nextNodeGlobal.code}`,
                              ),
                            });
                          } else {
                            showToast({
                              text: t(`💮 恭喜读完本卷终章「${selectedNode.code}」(+25m)！`, `💮 Finished ${selectedNode.code}!`),
                            });
                          }
                        }}
                        style={[styles.sealStampCtaBtn, { backgroundColor: pal.sealRed, borderColor: '#fca5a5' }]}
                      >
                        <Text
                          variant="label"
                          style={{
                            color: '#fffbeb',
                            fontSize: 13.5,
                            fontFamily: theme.fontFamily.serif,
                            fontWeight: '700',
                            letterSpacing: 0.5,
                          }}
                        >
                          {nextNodeGlobal
                            ? t(`💮 盖下「已阅」藏书印 (+25m) · 翻至下一章 (${nextNodeGlobal.code}) ❯`, `💮 Stamp Read & Next Chapter (${nextNodeGlobal.code}) ❯`)
                            : t('💮 盖下「已阅」藏书印 (+25m) · 全书礼成', '💮 Stamp Read & Finish Book')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={[styles.uninstalledBanner, { backgroundColor: pal.paperElevated, borderColor: pal.border }]}>
                <Text variant="caption" style={{ color: pal.muted, fontSize: 12.5, fontFamily: theme.fontFamily.serif }}>
                  {t(
                    `本章所属书卷 (${selectedNode.packId}) 尚未收入本地书匣（仅占 ~20KB 空间）。`,
                    `Chapter pack (${selectedNode.packId}) is not cached locally yet.`,
                  )}
                </Text>
                <Pressable
                  onPress={() => {
                    const res = installKnowledgeChapterPack(selectedNode.packId);
                    setKgState(res.state);
                    if (res.pack) {
                      showToast({ text: t(`✓ 已收入书卷《${res.pack.titleZh}》`, `✓ Installed ${res.pack.titleEn}`) });
                    }
                  }}
                  style={[styles.primaryPlayBtn, { backgroundColor: '#b88228', borderColor: '#b88228' }]}
                >
                  <Text variant="caption" style={{ color: '#fffbeb', fontSize: 11.5, fontWeight: '700' }}>
                    {t('⬇ 立即展卷下载本章', '⬇ Download Chapter Pack')}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Book Page Bottom Footer */}
            <View style={[styles.bookPageFooter, { borderTopColor: pal.border }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="上一页"
                onPress={handlePrevPage}
                disabled={pageNumber === 1 && !prevNodeGlobal}
                style={[
                  styles.pageTurnBtn,
                  {
                    borderColor: pal.border,
                    backgroundColor: pal.paperElevated,
                    opacity: pageNumber === 1 && !prevNodeGlobal ? 0.4 : 1,
                  },
                ]}
              >
                <Text variant="caption" style={{ color: pal.ink, fontSize: 12, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                  {pageNumber > 1
                    ? t(`❮ 往前翻 (第 ${pageNumber - 1} 页)`, `❮ Page ${pageNumber - 1}`)
                    : prevNodeGlobal
                      ? t(`❮ 上一章 (${prevNodeGlobal.code})`, `❮ Prev Ch`)
                      : t('❮ 已是卷首', '❮ First Page')}
                </Text>
              </Pressable>

              <Text
                variant="caption"
                style={{
                  color: pal.muted,
                  fontSize: 11.5,
                  fontFamily: theme.fontFamily.serif,
                }}
              >
                {`—  第 ${pageNumber} / 4 页  ·  ${
                  pageNumber === 1
                    ? '开篇深度长文'
                    : pageNumber === 2
                      ? '活动插图'
                      : pageNumber === 3
                        ? '精读旁批'
                        : '掩卷手札'
                }  —`}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="下一页"
                onPress={handleNextPage}
                disabled={pageNumber === 4 && !nextNodeGlobal}
                style={[
                  styles.pageTurnBtn,
                  {
                    borderColor: pal.gold,
                    backgroundColor: pal.pillActiveBg,
                    opacity: pageNumber === 4 && !nextNodeGlobal ? 0.4 : 1,
                  },
                ]}
              >
                <Text variant="caption" style={{ color: pal.goldText, fontSize: 12.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                  {pageNumber < 4
                    ? t(`往后翻一页 (第 ${pageNumber + 1} 页) ❯`, `Next Page (${pageNumber + 1}/4) ❯`)
                    : nextNodeGlobal
                      ? t(`翻至下一章 (${nextNodeGlobal.code}) ❯`, `Next Ch (${nextNodeGlobal.code}) ❯`)
                      : t('已至卷末 ❯', 'End of Book ❯')}
                </Text>
              </Pressable>
            </View>
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
  readerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tocToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
  },
  volumePill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  tocDrawer: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  tocRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  deskStage: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
  },
  newsFilterPanel: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  newsHeadlineCard: {
    flex: 1,
    minWidth: 210,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  chapterBookmarkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 8,
  },
  chapterRibbonTab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
  },
  bookPageFolio: {
    borderRadius: 10,
    borderWidth: 1.2,
    borderLeftWidth: 7,
    borderRightWidth: 3,
    borderBottomWidth: 4,
    paddingHorizontal: 26,
    paddingVertical: 20,
    gap: 16,
  },
  bookRunningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  redSealBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  pageSubtleNavRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  pageSectionTab: {
    paddingVertical: 4,
  },
  bookPageBody: {
    minHeight: 320,
    paddingVertical: 6,
    justifyContent: 'space-between',
  },
  epigraphQuoteBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 3.5,
    borderRadius: 6,
  },
  highlightedPassageBox: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  figurePlate: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  figureHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  figureCaptionText: {
    fontSize: 12,
    lineHeight: 19,
    fontFamily: theme.fontFamily.serif,
  },
  underlinedBookNote: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 3,
    borderRadius: 6,
  },
  footnoteSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    gap: 6,
  },
  reflectionBox: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  marginNoteCard: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  marginNoteInput: {
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    fontSize: 13.5,
    lineHeight: 22,
  },
  sealStampCtaBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  bookPageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  pageTurnBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  primaryPlayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
  },
  spaciousQuizOptionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 7,
    borderWidth: 1,
  },
  microBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
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
