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
  computeFlashAttentionSimulation,
  computeKnowledgeGraphStats,
  computePagedAttentionSimulation,
  computeSpeculativeDecodingSimulation,
  computeStudioUnlockables,
  exportChapterPackJson,
  importCustomMarkdownKnowledgeNode,
  installKnowledgeChapterPack,
  offloadKnowledgeChapterPack,
  updateKnowledgeNodeProgress,
} from './knowledge-graph-corner';

describe('Study Corner Knowledge Graph, AI Interactive Animations & Offline Chapter Packs', () => {
  it('ships a lightweight skeleton index and supports on-demand chapter pack install & offload without losing mastery progress', () => {
    const initial = buildDefaultKnowledgeState();
    const stats0 = computeKnowledgeGraphStats(initial);
    expect(stats0.totalNodes).toBeGreaterThanOrEqual(7);
    expect(stats0.installedPacksCount).toBe(1);
    expect(stats0.storageKey).toBe('viastela.knowledge_graph.v1');
    expect(initial.offlineContents['node-transformer']?.animationKind).toBe('self-attention');
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

  it('computes interactive AI animation frames for Self-Attention, PagedAttention, Speculative Decoding, and FlashAttention', () => {
    const sharpAttn = computeAttentionSimulation({
      focusTokenIdx: 5,
      stepIdx: 2,
      temperature: 0.4,
    });
    const smoothAttn = computeAttentionSimulation({
      focusTokenIdx: 5,
      stepIdx: 2,
      temperature: 1.6,
    });
    expect(Math.max(...sharpAttn.weightsPct)).toBeGreaterThan(Math.max(...smoothAttn.weightsPct));

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
  });

  it('imports custom Markdown nodes with [[WikiLink]] bidirectional links and computes 2.5D studio unlockables', () => {
    const { state, addedNode } = importCustomMarkdownKnowledgeNode({
      title: 'MoE 混合专家负载均衡路由',
      domainId: 'ai-infra',
      markdownBody: '- 基于 [[AI-101]] Top-K 门控网络与辅助负载均衡损失',
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
