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
  computeMoeRoutingSimulation,
  computePagedAttentionSimulation,
  computeSpeculativeDecodingSimulation,
  computeStudioUnlockables,
  exportChapterPackJson,
  importCustomMarkdownKnowledgeNode,
  installKnowledgeChapterPack,
  offloadKnowledgeChapterPack,
  updateKnowledgeNodeProgress,
} from './knowledge-graph-corner';

describe('Study Corner Knowledge Graph, 6 AI Interactive Animation Labs & Offline Chapter Packs', () => {
  it('ships a lightweight skeleton index and supports on-demand chapter pack install & offload without losing mastery progress', () => {
    const initial = buildDefaultKnowledgeState();
    const stats0 = computeKnowledgeGraphStats(initial);
    expect(stats0.totalNodes).toBeGreaterThanOrEqual(9);
    expect(stats0.installedPacksCount).toBe(1);
    expect(stats0.storageKey).toBe('viastela.knowledge_graph.v1');
    expect(initial.offlineContents['node-transformer']?.animationKind).toBe('self-attention');
    expect(initial.offlineContents['node-transformer']?.quiz?.correctIndex).toBe(1);
    expect(initial.offlineContents['node-raft']).toBeUndefined();

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

  it('computes all 6 interactive AI animation frames (Self-Attention+RoPE, PagedAttention, Speculative, FlashAttention, MoE, 3D Parallelism)', () => {
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
    expect(moe.experts.filter((e) => e.selected).length).toBe(3); // 1 shared + Top-2 routed
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
