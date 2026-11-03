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
  LEARNING_STAGES,
  offloadKnowledgeChapterPack,
  updateKnowledgeNodeProgress,
} from './knowledge-graph-corner';

describe('Study Corner Knowledge Graph, 12 Progressive AI Interactive Animation Labs & Beginner-to-Pro Pedagogy', () => {
  it('ships a 4-stage progressive curriculum (L1 Beginner to L4 Systems) and supports on-demand chapter pack install & offload', () => {
    expect(LEARNING_STAGES).toHaveLength(4);
    const initial = buildDefaultKnowledgeState();
    const stats0 = computeKnowledgeGraphStats(initial);
    expect(stats0.totalNodes).toBeGreaterThanOrEqual(15);
    expect(stats0.installedPacksCount).toBe(1);
    expect(stats0.storageKey).toBe('viastela.knowledge_graph.v1');

    // Stage 1 beginner lesson AI-001 has zero-jargon analogy, guided steps, and formula dictionary
    const lesson1 = initial.offlineContents['node-ai-001-token'];
    expect(lesson1?.animationKind).toBe('token-next-word');
    expect(lesson1?.beginnerAnalogyZh).toContain('词语接龙');
    expect(lesson1?.guidedStepsZh?.length).toBeGreaterThanOrEqual(3);
    expect(lesson1?.formulaBreakdownZh?.length).toBeGreaterThanOrEqual(2);

    // Install CS Systems pack on demand
    const { state: afterInstall, pack } = installKnowledgeChapterPack('pack-cs-systems');
    expect(pack?.id).toBe('pack-cs-systems');
    expect(afterInstall.offlineContents['node-raft']).toBeDefined();

    // Mark node-raft as mastered and add study minutes
    updateKnowledgeNodeProgress('node-raft', {
      status: 'mastered',
      studyMinutes: 90,
    });

    // Offload CS Systems pack to free space — mastery & studyMinutes must be preserved!
    const afterOffload = offloadKnowledgeChapterPack('pack-cs-systems');
    expect(afterOffload.offlineContents['node-raft']).toBeUndefined();
    const raftNode = afterOffload.nodes.find((n) => n.id === 'node-raft');
    expect(raftNode?.status).toBe('mastered');
    expect(raftNode?.studyMinutes).toBe(90);

    const exportedJson = exportChapterPackJson('pack-ai-infra');
    expect(exportedJson).toContain('ai-infra-interactive.pack.json');
  });

  it('computes Stage 1 beginner simulations (AI-001 Token Solitaire, AI-002 Word Embedding, AI-003 Gradient Descent, AI-004 RNN vs Attention) and Stage 3 (LoRA/RAG & INT4 Quantization)', () => {
    const tokSim = computeTokenNextWordSimulation({ generatedStep: 2, samplingMode: 'greedy' });
    expect(tokSim.generatedTokens).toHaveLength(3);
    expect(tokSim.fullSentence).toContain('看动画');

    const embedRoyalty = computeWordEmbeddingSimulation({
      clusterId: 'pets',
      showRoyaltyAnalogy: true,
    });
    expect(embedRoyalty.cosineSimilarity).toBeGreaterThan(0.9);
    expect(embedRoyalty.pairLabelZh).toContain('女王');

    const gradGood = computeNeuronGradientSimulation({ stepCount: 6, learningRate: 0.25 });
    const gradOscillate = computeNeuronGradientSimulation({ stepCount: 6, learningRate: 0.92 });
    expect(gradGood.currentLoss).toBeLessThan(gradOscillate.currentLoss);

    const rnnLong = computeRnnVsAttentionSimulation({ sentenceLength: 16 });
    expect(rnnLong.attentionRetentionPct).toBeGreaterThan(rnnLong.rnnRetentionPct);
    expect(rnnLong.attentionStepsRequired).toBe(1);

    const loraSim = computeLoraRagSimulation({ mode: 'lora', loraRank: 8 });
    expect(loraSim.paramSavingPct).toBeGreaterThan(99);
    expect(loraSim.extraInferenceLatencyMs).toBe(0);

    const quantUnsmoothed = computeQuantizationSimulation({
      precision: 'int4',
      smoothOutliers: false,
    });
    const quantSmoothed = computeQuantizationSimulation({
      precision: 'int4',
      smoothOutliers: true,
    });
    expect(quantSmoothed.modelVramGb).toBe(3.8);
    expect(quantSmoothed.quantErrorPct).toBeLessThan(quantUnsmoothed.quantErrorPct);
  });

  it('computes Stage 2 & Stage 4 interactive AI animation frames (Self-Attention+RoPE, PagedAttention, Speculative, FlashAttention, MoE, 3D Parallelism)', () => {
    const sharpAttn = computeAttentionSimulation({
      focusTokenIdx: 5,
      stepIdx: 2,
      temperature: 0.4,
      headIdx: 0,
    });
    const smoothAttn = computeAttentionSimulation({
      focusTokenIdx: 5,
      stepIdx: 2,
      temperature: 1.6,
      headIdx: 1,
    });
    expect(Math.max(...sharpAttn.weightsPct)).toBeGreaterThan(Math.max(...smoothAttn.weightsPct));
    expect(sharpAttn.ropeAngleDeg).toBe(160);

    const paged = computePagedAttentionSimulation({
      tokenCount: 10,
      sharedPrefixEnabled: true,
    });
    expect(paged.logicalBlocks.length).toBe(3);
    expect(paged.logicalBlocks[0]?.isSharedCoW).toBe(true);
    expect(paged.savedVramPct).toBeGreaterThan(40);

    const spec = computeSpeculativeDecodingSimulation({
      gamma: 4,
      verifyPhase: 0,
    });
    expect(spec.acceptedCount).toBe(5);
    expect(spec.effectiveSpeedup).toBeGreaterThan(2);

    const flash = computeFlashAttentionSimulation({ activeTileIdx: 2 });
    expect(flash.ioReductionFactor).toBe(8);
    expect(flash.rescaleFactor).toBeGreaterThan(0);

    const moe = computeMoeRoutingSimulation({
      tokenIdx: 1,
      topK: 2,
      loadBalanceEnabled: true,
    });
    expect(moe.experts.filter((e) => e.selected).length).toBe(3);
    expect(moe.activeParamsBillion).toBeLessThan(moe.totalParamsBillion);

    const zero0 = computeDistributedParallelSimulation({
      zeroStage: 0,
      microBatches: 8,
    });
    const zero3 = computeDistributedParallelSimulation({
      zeroStage: 3,
      microBatches: 8,
    });
    expect(zero0.totalMemPerGpuGb).toBe(112);
    expect(zero3.totalMemPerGpuGb).toBeCloseTo(14.1, 1);
    expect(zero3.bubbleRatioPct).toBeLessThan(35);
  });

  it('imports custom Markdown nodes with [[WikiLink]] bidirectional links and computes 2.5D studio unlockables', () => {
    const { state, addedNode } = importCustomMarkdownKnowledgeNode({
      title: 'MLA 矩阵低秩压缩笔记',
      domainId: 'ai-infra',
      markdownBody: '- 基于 [[AI-101]] 与 [[AI-201]] 低秩联合压缩 KV Cache',
    });
    expect(addedNode.bidirectionalLinks).toContain('node-transformer');
    expect(state.offlineContents[addedNode.id]).toBeDefined();

    const unlockables = computeStudioUnlockables({
      currentSavedCny: 360000,
      totalStudyMinutes: 180,
      teamStreakDays: 12,
      masteredNodesCount: 3,
    });
    expect(unlockables.filter((u) => u.unlocked).length).toBeGreaterThanOrEqual(4);
  });

  it('computes compound regret pill, couple wish gacha, and retro thermal receipt', () => {
    const regret = computeCompoundRegretPill({
      amountCny: 30,
      annualReturnPct: 8,
      isMonthlyHabit: true,
    });
    expect(regret.in10YearsCny).toBeGreaterThan(5000);
    expect(regret.in20YearsCny).toBeGreaterThan(regret.in10YearsCny);

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
    expect(receipt.plainText).toContain('STARWAY');
  });
});
