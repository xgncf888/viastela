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
  computeKnowledgeGraphStats,
  computeStudioUnlockables,
  importCustomMarkdownKnowledgeNode,
  installKnowledgeChapterPack,
  offloadKnowledgeChapterPack,
  updateKnowledgeNodeProgress,
} from './knowledge-graph-corner';

describe('Study Corner Knowledge Graph & On-Demand Offline Chapter Packs', () => {
  it('ships a lightweight skeleton index and supports on-demand chapter pack install & offload without losing mastery progress', () => {
    const initial = buildDefaultKnowledgeState();
    const stats0 = computeKnowledgeGraphStats(initial);
    expect(stats0.totalNodes).toBeGreaterThanOrEqual(6);
    expect(stats0.installedPacksCount).toBe(1);
    expect(initial.offlineContents['node-transformer']).toBeDefined();
    expect(initial.offlineContents['node-raft']).toBeUndefined();

    // Install CS Systems pack on demand
    const { state: afterInstall, pack } = installKnowledgeChapterPack('pack-cs-systems');
    expect(pack?.id).toBe('pack-cs-systems');
    expect(afterInstall.offlineContents['node-raft']).toBeDefined();

    // Mark node-raft as mastered and add study minutes
    const afterMastery = updateKnowledgeNodeProgress('node-raft', {
      status: 'mastered',
      studyMinutes: 90,
    });

    // Offload CS Systems pack to free space — mastery & studyMinutes must be preserved!
    const afterOffload = offloadKnowledgeChapterPack('pack-cs-systems');
    expect(afterOffload.offlineContents['node-raft']).toBeUndefined();
    const raftNode = afterOffload.nodes.find((n) => n.id === 'node-raft');
    expect(raftNode?.status).toBe('mastered');
    expect(raftNode?.studyMinutes).toBe(90);
  });

  it('imports custom Markdown nodes with [[WikiLink]] bidirectional links and computes 2.5D studio unlockables', () => {
    const { state, addedNode } = importCustomMarkdownKnowledgeNode({
      title: 'FlashAttention-3 异步流水线',
      domainId: 'ai-infra',
      markdownBody: '- 基于 [[AI-101]] 与 Hopper 架构 WGMMA 指令重叠计算与数据传输',
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
