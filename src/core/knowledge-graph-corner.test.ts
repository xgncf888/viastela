import { describe, expect, it } from '@jest/globals';

import {
  buildRetroThermalReceipt,
  computeCompoundRegretPill,
  computeCoupleSettlement,
  computeMonthlyBookkeepingSummary,
  computeMonthlyFinancialHealth,
  DEFAULT_BOOKKEEPING_STATE,
  spinCoupleWishGacha,
} from './bookkeeping';
import {
  buildDefaultKnowledgeState,
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
  exportChapterPackJson,
  filterNewsDigestItems,
  importCustomMarkdownKnowledgeNode,
  installKnowledgeChapterPack,
  LEARNING_STAGES,
  offloadKnowledgeChapterPack,
  resolveBrowserOmniboxInput,
  scoreArticleSignalToNoise,
  searchLocalKnowledgeAndNews,
  updateKnowledgeNodeProgress,
  executeInAppBrowserSearch,
} from './knowledge-graph-corner';

describe('Study Corner Hardcover Book Reader, In-App Research Browser, 17 Chapters & Smart News Digest Filter', () => {
  it('supports in-app browser omnibox resolution, local book + news search, and direct search execution', async () => {
    const state = buildDefaultKnowledgeState();

    // Omnibox resolves direct domain or https URL vs search query
    const urlRes = resolveBrowserOmniboxInput('https://zh.wikipedia.org/wiki/Transformer');
    expect(urlRes.kind).toBe('url');
    expect(urlRes.targetUrl).toBe('https://zh.wikipedia.org/wiki/Transformer');

    const domainRes = resolveBrowserOmniboxInput('zh.wikipedia.org/wiki/DeepSeek');
    expect(domainRes.kind).toBe('url');
    expect(domainRes.targetUrl).toBe('https://zh.wikipedia.org/wiki/DeepSeek');

    const queryRes = resolveBrowserOmniboxInput('FlashAttention 显存分块');
    expect(queryRes.kind).toBe('search');
    expect(queryRes.cleanQuery).toBe('FlashAttention 显存分块');

    // Local search across 17 book chapters + news digest
    const localHits = searchLocalKnowledgeAndNews('Transformer', state);
    expect(localHits.length).toBeGreaterThanOrEqual(1);
    expect(localHits[0]?.paragraphs.length).toBeGreaterThanOrEqual(2);

    // Direct search execution in local-book mode returns structured reader items
    const browserExec = await executeInAppBrowserSearch({
      query: 'DeepSeek',
      engine: 'local-book',
      state,
    });
    expect(browserExec.results.length).toBeGreaterThanOrEqual(1);
    expect(browserExec.results.some((r) => r.title.includes('DeepSeek'))).toBe(true);
  });

  it('ships a 4-volume 17-chapter illustrated book with multi-paragraph long-form essays and on-demand pack management', () => {
    expect(LEARNING_STAGES).toHaveLength(4);
    const initial = buildDefaultKnowledgeState();
    const stats0 = computeKnowledgeGraphStats(initial);
    expect(stats0.totalNodes).toBeGreaterThanOrEqual(17);
    expect(stats0.installedPacksCount).toBe(1);
    expect(stats0.storageKey).toBe('viastela.knowledge_graph.v1');

    // Stage 1 beginner lesson AI-001 has multi-paragraph long-form reading text
    const lesson1 = initial.offlineContents['node-ai-001-token'];
    expect(lesson1?.animationKind).toBe('token-next-word');
    expect(lesson1?.beginnerAnalogyZh).toContain('词语接龙');
    expect(lesson1?.deepReadingParagraphsZh?.length).toBeGreaterThanOrEqual(4);

    // Stage 3 includes new Agent/MCP (AI-108) and DeepSeek-R1 GRPO (AI-109) chapters
    expect(initial.offlineContents['node-ai-108-agent']?.deepReadingParagraphsZh?.length).toBeGreaterThanOrEqual(3);
    expect(initial.offlineContents['node-ai-109-rl-r1']?.deepReadingParagraphsZh?.length).toBeGreaterThanOrEqual(3);

    // Install CS Systems pack on demand
    const { state: afterInstall, pack } = installKnowledgeChapterPack('pack-cs-systems');
    expect(pack?.id).toBe('pack-cs-systems');
    expect(afterInstall.offlineContents['node-raft']?.deepReadingParagraphsZh?.length).toBeGreaterThanOrEqual(3);

    updateKnowledgeNodeProgress('node-raft', {
      status: 'mastered',
      studyMinutes: 90,
    });

    const afterOffload = offloadKnowledgeChapterPack('pack-cs-systems');
    expect(afterOffload.offlineContents['node-raft']).toBeUndefined();
    const raftNode = afterOffload.nodes.find((n) => n.id === 'node-raft');
    expect(raftNode?.status).toBe('mastered');
    expect(raftNode?.studyMinutes).toBe(90);

    const exportedJson = exportChapterPackJson('pack-ai-infra');
    expect(exportedJson).toContain('ai-infra-interactive.pack.json');
  });

  it('filters news digest items by signal-to-noise score, category, depth, and muted clickbait keywords', () => {
    // Default filter (minSignalScore: 80, muted: 震惊, 暴富, 必看) automatically blocks the noisy clickbait sample
    const resDefault = filterNewsDigestItems(DEFAULT_NEWS_DIGEST_ITEMS, DEFAULT_NEWS_FILTER);
    expect(resDefault.filteredOutNoiseCount).toBeGreaterThanOrEqual(1);
    expect(resDefault.visibleItems.some((i) => i.id === 'news-noisy-clickbait-sample')).toBe(false);
    expect(resDefault.visibleItems.some((i) => i.id === 'news-deepseek-r1-grpo')).toBe(true);

    // Category filter for wealth-macro
    const resWealth = filterNewsDigestItems(DEFAULT_NEWS_DIGEST_ITEMS, {
      ...DEFAULT_NEWS_FILTER,
      category: 'wealth-macro',
    });
    expect(resWealth.visibleItems.every((i) => i.categoryId === 'wealth-macro')).toBe(true);

    // Signal-to-noise scorer penalizes clickbait and rewards technical substance
    const highSignal = scoreArticleSignalToNoise({
      title: 'FlashAttention 与 vLLM KV Cache 显存量化推导',
      body: '通过 Transformer Attention 分块与 INT4 量化减少 HBM 显存带宽瓶颈。',
    });
    const clickbait = scoreArticleSignalToNoise({
      title: '震惊！学会这招必看秘诀轻松躺赚暴富割韭菜！',
      body: '删前速看！99%的人不知道的暴富密码。',
    });
    expect(highSignal.signalScore).toBeGreaterThan(90);
    expect(clickbait.signalScore).toBeLessThan(50);

    // Clip custom article into the reader
    const clipped = clipCustomNewsArticle({
      title: '自定义 MCP 本地协议架构精读',
      categoryId: 'sys-open',
      rawText: '第一段：MCP 协议通过 stdio 管道实现零内网耦合。\n第二段：支持结合 RAG 与 Agent 工具调用。',
    });
    expect(clipped.addedItem.paragraphsZh).toHaveLength(2);
    expect(clipped.addedItem.signalScore).toBeGreaterThan(80);
  });

  it('computes Stage 1, 2, 3, and 4 interactive AI animation frames', () => {
    const tokSim = computeTokenNextWordSimulation({ generatedStep: 2, samplingMode: 'greedy' });
    expect(tokSim.generatedTokens).toHaveLength(3);

    const embedRoyalty = computeWordEmbeddingSimulation({
      clusterId: 'pets',
      showRoyaltyAnalogy: true,
    });
    expect(embedRoyalty.cosineSimilarity).toBeGreaterThan(0.9);

    const gradGood = computeNeuronGradientSimulation({ stepCount: 6, learningRate: 0.25 });
    const gradOscillate = computeNeuronGradientSimulation({ stepCount: 6, learningRate: 0.92 });
    expect(gradGood.currentLoss).toBeLessThan(gradOscillate.currentLoss);

    const rnnLong = computeRnnVsAttentionSimulation({ sentenceLength: 16 });
    expect(rnnLong.attentionRetentionPct).toBeGreaterThan(rnnLong.rnnRetentionPct);

    const loraSim = computeLoraRagSimulation({ mode: 'lora', loraRank: 8 });
    expect(loraSim.paramSavingPct).toBeGreaterThan(99);

    const quantSmoothed = computeQuantizationSimulation({
      precision: 'int4',
      smoothOutliers: true,
    });
    expect(quantSmoothed.modelVramGb).toBe(3.8);

    const sharpAttn = computeAttentionSimulation({
      focusTokenIdx: 5,
      stepIdx: 2,
      temperature: 0.4,
      headIdx: 0,
    });
    expect(sharpAttn.ropeAngleDeg).toBe(160);

    const paged = computePagedAttentionSimulation({
      tokenCount: 10,
      sharedPrefixEnabled: true,
    });
    expect(paged.savedVramPct).toBeGreaterThan(40);

    const spec = computeSpeculativeDecodingSimulation({ gamma: 4, verifyPhase: 0 });
    expect(spec.acceptedCount).toBe(5);

    const flash = computeFlashAttentionSimulation({ activeTileIdx: 2 });
    expect(flash.ioReductionFactor).toBe(8);

    const moe = computeMoeRoutingSimulation({ tokenIdx: 1, topK: 2, loadBalanceEnabled: true });
    expect(moe.experts.filter((e) => e.selected).length).toBe(3);

    const zero3 = computeDistributedParallelSimulation({ zeroStage: 3, microBatches: 8 });
    expect(zero3.totalMemPerGpuGb).toBeCloseTo(14.1, 1);
  });

  it('imports custom Markdown nodes with [[WikiLink]] bidirectional links and computes studio unlockables & receipt', () => {
    const { addedNode } = importCustomMarkdownKnowledgeNode({
      title: 'MLA 矩阵低秩压缩笔记',
      domainId: 'ai-infra',
      markdownBody: '- 基于 [[AI-101]] 与 [[AI-201]] 低秩联合压缩 KV Cache',
    });
    expect(addedNode.bidirectionalLinks).toContain('node-transformer');

    const unlockables = computeStudioUnlockables({
      currentSavedCny: 360000,
      totalStudyMinutes: 180,
      teamStreakDays: 12,
      masteredNodesCount: 3,
    });
    expect(unlockables.filter((u) => u.unlocked).length).toBeGreaterThanOrEqual(4);

    const regret = computeCompoundRegretPill({
      amountCny: 30,
      annualReturnPct: 8,
      isMonthlyHabit: true,
    });
    expect(regret.in10YearsCny).toBeGreaterThan(5000);

    const prize = spinCoupleWishGacha(0);
    expect(prize.titleZh).toBeTruthy();

    const summary = computeMonthlyBookkeepingSummary(DEFAULT_BOOKKEEPING_STATE, '2026-11-03');
    const settlement = computeCoupleSettlement(DEFAULT_BOOKKEEPING_STATE, '2026-11');
    const health = computeMonthlyFinancialHealth(DEFAULT_BOOKKEEPING_STATE, '2026-11');
    const receipt = buildRetroThermalReceipt({
      summary,
      settlement,
      health,
      topCategories: [],
      coupleNames: '我 & 老婆',
    });
    expect(receipt.receiptNo).toContain('202611');
  });
});
