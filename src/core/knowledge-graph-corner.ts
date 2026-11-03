/**
 * Study Corner & Personal Knowledge Graph Engine (学习角 · 个人知识图谱与按需离线章节包)
 *
 * Inspired by open-source best practices:
 * - Obsidian / Logseq: Bidirectional `[[WikiLinks]]` & local-first Markdown notes
 * - Roadmap.sh: DAG prerequisite skill-tree topology (`locked` -> `learning` -> `mastered`)
 * - Kiwix / Anki: Zero-bloat app bundle! The app only ships a <10KB Graph Skeleton Index;
 *   heavy chapter contents (mental models, code templates, flashcards) are fetched/installed
 *   on-demand as modular Offline Chapter Packs and can be offloaded anytime without losing
 *   personal mastery progress or study time logs.
 */

export type KnowledgeDomainId = 'ai-infra' | 'cs-systems' | 'wealth-quant' | 'product-arch';

export type NodeMasteryStatus = 'locked' | 'learning' | 'mastered';

export type KnowledgeFlashcard = {
  q: string;
  a: string;
};

export type KnowledgeChapterContent = {
  nodeId: string;
  coreMentalModel: string;
  keyTakeaways: readonly string[];
  codeOrFormulaSnippet: string;
  flashcards: readonly KnowledgeFlashcard[];
};

export type KnowledgeChapterPack = {
  id: string;
  domainId: KnowledgeDomainId;
  icon: string;
  titleZh: string;
  titleEn: string;
  version: string;
  /** Size in KB when cached locally */
  sizeKb: number;
  nodeCount: number;
  descriptionZh: string;
  chapters: Record<string, KnowledgeChapterContent>;
};

export type KnowledgeNode = {
  id: string;
  domainId: KnowledgeDomainId;
  code: string;
  title: string;
  summary: string;
  /** Graph coordinates (0..100 normalized for SVG DAG canvas) */
  x: number;
  y: number;
  /** Upstream prerequisite node IDs */
  prerequisites: string[];
  /** Bidirectional `[[WikiLink]]` related node IDs */
  bidirectionalLinks: string[];
  status: NodeMasteryStatus;
  studyMinutes: number;
  reviewLevel: number;
  userNote: string;
  packId: string;
};

export type KnowledgeGraphState = {
  nodes: KnowledgeNode[];
  /** IDs of chapter packs currently downloaded into local offline storage */
  installedPackIds: string[];
  /** Cached chapter content payloads keyed by nodeId */
  offlineContents: Record<string, KnowledgeChapterContent>;
};

export type StudioUnlockableItem = {
  id: string;
  icon: string;
  titleZh: string;
  titleEn: string;
  requirementZh: string;
  unlocked: boolean;
  progressPct: number;
  color: string;
};

export const KNOWLEDGE_DOMAINS: readonly {
  id: KnowledgeDomainId;
  icon: string;
  zh: string;
  en: string;
  color: string;
}[] = [
  { id: 'ai-infra', icon: '智', zh: 'AI Infra 与大模型系统', en: 'AI Infra & LLM', color: '#f5b942' },
  { id: 'cs-systems', icon: '核', zh: '计算机底层与分布式', en: 'Systems & Distributed', color: '#38bdf8' },
  { id: 'wealth-quant', icon: '财', zh: '资产配置与复利模型', en: 'Asset Allocation & Quant', color: '#34d399' },
  { id: 'product-arch', icon: '架', zh: '跨端架构与工程效能', en: 'Cross-Platform Arch', color: '#f472b6' },
] as const;

/**
 * Lightweight Graph Skeleton (< 4 KB): Only topology & progress metadata live in the initial state.
 */
export const DEFAULT_KNOWLEDGE_NODES: readonly KnowledgeNode[] = [
  {
    id: 'node-transformer',
    domainId: 'ai-infra',
    code: 'AI-101',
    title: 'Transformer 与 Attention 复杂度推导',
    summary: 'Self-Attention 矩阵乘积、位置编码 RoPE 与显存瓶颈分析',
    x: 18,
    y: 26,
    prerequisites: [],
    bidirectionalLinks: ['node-kv-cache', 'node-cuda-mem'],
    status: 'mastered',
    studyMinutes: 95,
    reviewLevel: 4,
    userNote: '已完成手推 QK^T/sqrt(d_k) 梯度与显存占用公式。',
    packId: 'pack-ai-infra',
  },
  {
    id: 'node-kv-cache',
    domainId: 'ai-infra',
    code: 'AI-201',
    title: 'KV Cache 与 PagedAttention 调度',
    summary: 'vLLM 分页显存管理、Prefix Caching 与吞吐量优化',
    x: 48,
    y: 22,
    prerequisites: ['node-transformer'],
    bidirectionalLinks: ['node-transformer', 'node-speculative'],
    status: 'learning',
    studyMinutes: 60,
    reviewLevel: 2,
    userNote: '类比操作系统虚拟内存页表，解决碎片化问题。',
    packId: 'pack-ai-infra',
  },
  {
    id: 'node-speculative',
    domainId: 'ai-infra',
    code: 'AI-301',
    title: '投机采样与分布式推理并行 (TP/PP)',
    summary: 'Draft Model 投机解码、张量并行通信开销与 Roofline 模型',
    x: 80,
    y: 26,
    prerequisites: ['node-kv-cache'],
    bidirectionalLinks: ['node-kv-cache', 'node-raft'],
    status: 'locked',
    studyMinutes: 15,
    reviewLevel: 1,
    userNote: '',
    packId: 'pack-ai-infra',
  },
  {
    id: 'node-cuda-mem',
    domainId: 'cs-systems',
    code: 'SYS-101',
    title: 'CPU/GPU 内存层次与 Cache Line 对齐',
    summary: 'SRAM vs HBM 带宽差距、False Sharing 与零拷贝机制',
    x: 22,
    y: 68,
    prerequisites: [],
    bidirectionalLinks: ['node-transformer', 'node-raft'],
    status: 'mastered',
    studyMinutes: 80,
    reviewLevel: 3,
    userNote: '深入理解计算机系统第 6 章存储器山核心笔记。',
    packId: 'pack-cs-systems',
  },
  {
    id: 'node-raft',
    domainId: 'cs-systems',
    code: 'SYS-202',
    title: 'Raft 共识状态机与 Local-First CRDT',
    summary: 'Leader 选举、日志复制安全性与离线多端无冲突合并',
    x: 52,
    y: 72,
    prerequisites: ['node-cuda-mem'],
    bidirectionalLinks: ['node-cuda-mem', 'node-local-first'],
    status: 'learning',
    studyMinutes: 45,
    reviewLevel: 2,
    userNote: '本项目的双人账本合并与离线沙箱即采用幂等集合合并思想。',
    packId: 'pack-cs-systems',
  },
  {
    id: 'node-kelly-dca',
    domainId: 'wealth-quant',
    code: 'FIN-101',
    title: '凯利公式、股债再平衡与家庭现金流池',
    summary: '安全边际、定投微笑曲线、最大回撤控制与双人合池预算模型',
    x: 82,
    y: 68,
    prerequisites: [],
    bidirectionalLinks: ['node-raft'],
    status: 'learning',
    studyMinutes: 50,
    reviewLevel: 3,
    userNote: '月薪 45% 定投 + 8% 复利期望，目标 150w 净值曲线验证。',
    packId: 'pack-wealth-quant',
  },
];

/**
 * Modular Offline Chapter Packs Catalog (On-Demand Downloadable / Offloadable)
 */
export const CATALOG_CHAPTER_PACKS: readonly KnowledgeChapterPack[] = [
  {
    id: 'pack-ai-infra',
    domainId: 'ai-infra',
    icon: '智',
    titleZh: 'AI Infra 与推理加速离线章节包',
    titleEn: 'AI Infra & LLM Inference Offline Pack',
    version: 'v1.2',
    sizeKb: 28,
    nodeCount: 3,
    descriptionZh: '含 Attention 显存公式、vLLM PagedAttention 页表图解、Roofline 算力瓶颈速查卡与 6 张间隔重复闪卡。',
    chapters: {
      'node-transformer': {
        nodeId: 'node-transformer',
        coreMentalModel:
          'Self-Attention 的核心是将序列两两交互转化为矩阵内积，Prefill 阶段受限于算力 (Compute-bound)，Decode 阶段受限于显存带宽 (Memory-bound)。',
        keyTakeaways: [
          'KV Cache 显存公式：2 × 2(FP16) × n_layers × n_heads × d_head × seq_len × batch_size',
          'RoPE 旋转位置编码通过复数平面旋转天然具备相对位置外推性质',
          'FlashAttention 利用 GPU SRAM 分块 (Tiling) + 在线 Softmax 避免读写 N×N 注意力矩阵',
        ],
        codeOrFormulaSnippet:
          'KV_Bytes = 4 * L * H * D * S * B  // FP16 下 7B 模型单并发 4K 上下文约占 ~2.1 GB',
        flashcards: [
          {
            q: '为什么 LLM Decode 阶段通常是 Memory-bound？',
            a: '每次只生成 1 个 token，但需要把全部模型权重和历史 KV Cache 从 HBM 搬运到 SRAM，计算访存比极低。',
          },
        ],
      },
      'node-kv-cache': {
        nodeId: 'node-kv-cache',
        coreMentalModel:
          '借鉴 OS 虚拟内存分页思想，将连续的逻辑 KV Cache 切分为固定大小的物理 KV Block，消除预分配显存碎片。',
        keyTakeaways: [
          '外部碎片完全消除，内部碎片仅限于最后一个未填满的 Block',
          '支持 Copy-on-Write 共享 System Prompt 前缀 (Prefix Caching)',
          '配合 Continuous Batching 实现请求级动态插入与抢占',
        ],
        codeOrFormulaSnippet:
          'LogicalBlock[i] -> BlockTable -> PhysicalBlock[p_idx] (RefCnt >= 1, CoW on write)',
        flashcards: [
          {
            q: 'PagedAttention 如何加速多轮对话共享前缀？',
            a: '通过将相同前缀的逻辑块映射到同一物理块并增加引用计数，避免重复计算 Prefill。',
          },
        ],
      },
      'node-speculative': {
        nodeId: 'node-speculative',
        coreMentalModel:
          '用小参数 Draft 模型快速串行猜出 γ 个 token，再由大参数 Target 模型一次前向并行验证，无损加速 2–3 倍。',
        keyTakeaways: [
          '不改变 Target 模型的输出分布（拒绝采样精确修正概率）',
          'Tensor Parallelism (TP) 需高频 AllReduce，通常限制在单机 NVLink 内',
          'Pipeline Parallelism (PP) 可跨机通信，但需通过 Micro-batching 减小气泡率',
        ],
        codeOrFormulaSnippet:
          'AcceptProb = min(1, P_target(x) / P_draft(x))  // 无损投机采样接受率判据',
        flashcards: [
          {
            q: '投机采样 (Speculative Decoding) 会降低生成质量吗？',
            a: '不会，通过修正拒绝采样分布，数学上保证与大模型直接采样分布严格一致。',
          },
        ],
      },
    },
  },
  {
    id: 'pack-cs-systems',
    domainId: 'cs-systems',
    icon: '核',
    titleZh: '计算机底层与分布式一致性离线包',
    titleEn: 'CS Systems & Distributed Consensus Pack',
    version: 'v1.1',
    sizeKb: 24,
    nodeCount: 2,
    descriptionZh: '含 CSAPP 存储器山、Cache Line 伪共享剖析、Raft 任期状态机及 Local-First 离线同步设计。',
    chapters: {
      'node-cuda-mem': {
        nodeId: 'node-cuda-mem',
        coreMentalModel:
          '程序性能往往取决于局部性原理（时间局部性 + 空间局部性）：L1/L2 Cache 与主存延迟相差近百倍。',
        keyTakeaways: [
          '典型 Cache Line 大小为 64 Bytes，步长为一 (Stride-1) 顺序访问最友好',
          '多核并发写同一 Cache Line 不同字段会触发高频缓存行失效（伪共享 False Sharing）',
          '通过缓存行填充 (Padding) 或线程本地累加可消除伪共享开销',
        ],
        codeOrFormulaSnippet:
          'struct alignas(64) PaddedCounter { std::atomic<int64_t> value; }; // 隔离 64B 缓存行',
        flashcards: [
          {
            q: '什么是多线程下的伪共享 (False Sharing)？',
            a: '两个线程修改不同变量，但变量位于同一个 64B Cache Line 中，导致缓存一致性协议频繁使整行失效。',
          },
        ],
      },
      'node-raft': {
        nodeId: 'node-raft',
        coreMentalModel:
          '将分布式一致性拆解为三个正交子问题：Leader 选举、日志复制与安全性约束；而客户端离线优先应用则优先采用幂等合并 (CRDT)。',
        keyTakeaways: [
          'Leader 只能追加日志，且只提交当前 Term 的日志条目以保证状态机安全',
          'Local-First 架构将本地数据库作为一等公民，网络仅作为后台异步复制通道',
          '按唯一 ID 去重 + 时间戳因果序合并，天然支持断网操作与恢复后无损同步',
        ],
        codeOrFormulaSnippet:
          'merge(A, B) = sortByClock(dedupById(A ∪ B))  // 满足交换律、结合律与幂等律 (CvRDT)',
        flashcards: [
          {
            q: '为什么离线优先 (Local-First) 应用适合采用 CRDT 思想？',
            a: '因为无需中心化锁协调，任意两端离线修改后按交换律/幂等律合并即可收敛到一致状态。',
          },
        ],
      },
    },
  },
  {
    id: 'pack-wealth-quant',
    domainId: 'wealth-quant',
    icon: '财',
    titleZh: '家庭量化配置与复利模型离线包',
    titleEn: 'Household Quant & Compounding Pack',
    version: 'v1.0',
    sizeKb: 19,
    nodeCount: 1,
    descriptionZh: '含凯利公式仓位控制、定投复利微分方程、恩格尔与拿铁因子诊断标准及双人合池预算模型。',
    chapters: {
      'node-kelly-dca': {
        nodeId: 'node-kelly-dca',
        coreMentalModel:
          '长期财富增长 = 稳定的月度净储蓄现金流 × 合理赔率资产配置 × 时间复利，严控回撤比追求短期高收益更关键。',
        keyTakeaways: [
          '波动率税 (Volatility Drag)：资产跌 50% 需要涨 100% 才能回本，几何平均收益率 ≈ 算术平均 - σ²/2',
          '双人合池 + 专账隔离：日常消费走合池安全额度，大额心愿与定投独立建账',
          '把每月固定定投当作第一笔「必须支付给未来自己的账单」',
        ],
        codeOrFormulaSnippet:
          'W(t) = W_0 * (1 + r)^t + PMT * (((1 + r)^t - 1) / r)  // 月度定投复利终值公式',
        flashcards: [
          {
            q: '什么是投资中的波动率损耗 (Volatility Drag)？',
            a: '几何复利收益受方差拖累（g ≈ μ - σ²/2），大幅回撤会严重侵蚀长期复利终值。',
          },
        ],
      },
    },
  },
];

const KNOWLEDGE_STORAGE_KEY = 'viastela.knowledge_graph.v1';

export function buildDefaultKnowledgeState(): KnowledgeGraphState {
  const aiPack = CATALOG_CHAPTER_PACKS[0]!;
  return {
    nodes: DEFAULT_KNOWLEDGE_NODES.map((n) => ({ ...n })),
    // Pre-install only the first lightweight pack; others remain on-demand downloadable
    installedPackIds: [aiPack.id],
    offlineContents: { ...aiPack.chapters },
  };
}

let memoryKnowledgeState: KnowledgeGraphState = buildDefaultKnowledgeState();

export function readKnowledgeGraphState(): KnowledgeGraphState {
  try {
    if (typeof localStorage === 'undefined') return memoryKnowledgeState;
    const raw = localStorage.getItem(KNOWLEDGE_STORAGE_KEY);
    if (!raw) return memoryKnowledgeState;
    const parsed = JSON.parse(raw) as Partial<KnowledgeGraphState>;
    if (!parsed || !Array.isArray(parsed.nodes)) return memoryKnowledgeState;
    return {
      nodes: parsed.nodes,
      installedPackIds: Array.isArray(parsed.installedPackIds) ? parsed.installedPackIds : ['pack-ai-infra'],
      offlineContents: parsed.offlineContents && typeof parsed.offlineContents === 'object' ? parsed.offlineContents : {},
    };
  } catch {
    return memoryKnowledgeState;
  }
}

export function writeKnowledgeGraphState(state: KnowledgeGraphState): KnowledgeGraphState {
  memoryKnowledgeState = state;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // Ignore storage quota error
  }
  return state;
}

/**
 * Installs an Offline Chapter Pack on demand into local storage.
 */
export function installKnowledgeChapterPack(packId: string): {
  state: KnowledgeGraphState;
  pack: KnowledgeChapterPack | null;
} {
  const cur = readKnowledgeGraphState();
  const pack = CATALOG_CHAPTER_PACKS.find((p) => p.id === packId) ?? null;
  if (!pack) return { state: cur, pack: null };

  const nextInstalled = cur.installedPackIds.includes(packId)
    ? cur.installedPackIds
    : [...cur.installedPackIds, packId];

  const nextContents: Record<string, KnowledgeChapterContent> = {
    ...cur.offlineContents,
    ...pack.chapters,
  };

  const next = writeKnowledgeGraphState({
    ...cur,
    installedPackIds: nextInstalled,
    offlineContents: nextContents,
  });
  return { state: next, pack };
}

/**
 * Offloads/uninstalls a Chapter Pack's heavy content body to free storage space,
 * while strictly preserving the user's node mastery status, study minutes, and personal notes!
 */
export function offloadKnowledgeChapterPack(packId: string): KnowledgeGraphState {
  const cur = readKnowledgeGraphState();
  const pack = CATALOG_CHAPTER_PACKS.find((p) => p.id === packId);
  const nextContents = { ...cur.offlineContents };
  if (pack) {
    for (const nodeId of Object.keys(pack.chapters)) {
      delete nextContents[nodeId];
    }
  }
  return writeKnowledgeGraphState({
    ...cur,
    installedPackIds: cur.installedPackIds.filter((id) => id !== packId),
    offlineContents: nextContents,
  });
}

export function updateKnowledgeNodeProgress(
  nodeId: string,
  patch: Partial<Pick<KnowledgeNode, 'status' | 'studyMinutes' | 'reviewLevel' | 'userNote'>>,
): KnowledgeGraphState {
  const cur = readKnowledgeGraphState();
  const nextNodes = cur.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n));
  return writeKnowledgeGraphState({
    ...cur,
    nodes: nextNodes,
  });
}

/**
 * Parses a Markdown snippet containing `# Title`, `[[WikiLink]]` references, and bullet points
 * into a new custom node + offline chapter content in the user's Knowledge Graph.
 */
export function importCustomMarkdownKnowledgeNode(input: {
  title: string;
  domainId: KnowledgeDomainId;
  markdownBody: string;
  prerequisiteNodeId?: string;
}): { state: KnowledgeGraphState; addedNode: KnowledgeNode } {
  const cur = readKnowledgeGraphState();
  const cleanTitle = input.title.trim() || '自定义知识节点';
  const body = input.markdownBody.trim() || '核心概念与推导笔记';

  // Extract [[WikiLinks]] from markdown body and match against existing nodes
  const wikiMatches = [...body.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]!.trim().toLowerCase());
  const linkedIds: string[] = [];
  for (const n of cur.nodes) {
    if (
      wikiMatches.some((w) => n.title.toLowerCase().includes(w) || n.code.toLowerCase() === w)
    ) {
      linkedIds.push(n.id);
    }
  }
  if (input.prerequisiteNodeId && !linkedIds.includes(input.prerequisiteNodeId)) {
    linkedIds.push(input.prerequisiteNodeId);
  }

  const lines = body
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);

  const nodeId = `node-custom-${Date.now()}`;
  const domainNodes = cur.nodes.filter((n) => n.domainId === input.domainId);
  const newNode: KnowledgeNode = {
    id: nodeId,
    domainId: input.domainId,
    code: `USR-${cur.nodes.length + 1}`,
    title: cleanTitle,
    summary: (lines[0] ?? cleanTitle).slice(0, 60),
    x: Math.min(88, 24 + ((domainNodes.length * 26) % 68)),
    y: input.domainId === 'ai-infra' || input.domainId === 'product-arch' ? 44 : 84,
    prerequisites: input.prerequisiteNodeId ? [input.prerequisiteNodeId] : [],
    bidirectionalLinks: linkedIds,
    status: 'learning',
    studyMinutes: 15,
    reviewLevel: 1,
    userNote: body,
    packId: 'pack-user-custom',
  };

  const customContent: KnowledgeChapterContent = {
    nodeId,
    coreMentalModel: lines[0] ?? cleanTitle,
    keyTakeaways: lines.slice(0, 4),
    codeOrFormulaSnippet: lines.find((l) => /[=(){};]/.test(l)) ?? `// ${cleanTitle} 核心锚点`,
    flashcards: [
      {
        q: `${cleanTitle} 的核心要点是什么？`,
        a: lines.join('；').slice(0, 120),
      },
    ],
  };

  const next = writeKnowledgeGraphState({
    ...cur,
    nodes: [...cur.nodes, newNode],
    offlineContents: {
      ...cur.offlineContents,
      [nodeId]: customContent,
    },
  });

  return { state: next, addedNode: newNode };
}

export function computeKnowledgeGraphStats(state: KnowledgeGraphState): {
  totalNodes: number;
  masteredCount: number;
  learningCount: number;
  totalStudyMinutes: number;
  installedPacksCount: number;
  totalCatalogPacksCount: number;
  cachedSizeKb: number;
} {
  const masteredCount = state.nodes.filter((n) => n.status === 'mastered').length;
  const learningCount = state.nodes.filter((n) => n.status === 'learning').length;
  const totalStudyMinutes = state.nodes.reduce((s, n) => s + n.studyMinutes, 0);
  const cachedSizeKb = CATALOG_CHAPTER_PACKS.filter((p) =>
    state.installedPackIds.includes(p.id),
  ).reduce((s, p) => s + p.sizeKb, 4); // 4KB base skeleton index

  return {
    totalNodes: state.nodes.length,
    masteredCount,
    learningCount,
    totalStudyMinutes,
    installedPacksCount: state.installedPackIds.length,
    totalCatalogPacksCount: CATALOG_CHAPTER_PACKS.length,
    cachedSizeKb,
  };
}

/**
 * Computes 2.5D Studio Unlockable Decor & Gear based on real wealth, study hours, and bookkeeping streak.
 */
export function computeStudioUnlockables(input: {
  currentSavedCny: number;
  totalStudyMinutes: number;
  teamStreakDays: number;
  masteredNodesCount: number;
}): StudioUnlockableItem[] {
  return [
    {
      id: 'gear-mech-kb',
      icon: '键',
      titleZh: '黑金客制化机械键盘',
      titleEn: 'Obsidian Mech Keyboard',
      requirementZh: '专注累计 ≥ 60 分钟',
      unlocked: input.totalStudyMinutes >= 60,
      progressPct: Math.min(100, Math.round((input.totalStudyMinutes / 60) * 100)),
      color: '#f5b942',
    },
    {
      id: 'gear-espresso',
      icon: '咖',
      titleZh: '意式双锅炉手冲咖啡站',
      titleEn: 'Dual-Boiler Espresso Bar',
      requirementZh: '双人记账协同 ≥ 7 天',
      unlocked: input.teamStreakDays >= 7,
      progressPct: Math.min(100, Math.round((input.teamStreakDays / 7) * 100)),
      color: '#f59e0b',
    },
    {
      id: 'gear-lucky-cat',
      icon: '猫',
      titleZh: '镇宅金箔招财猫摆件',
      titleEn: 'Gold Leaf Lucky Cat',
      requirementZh: '家庭净资产底仓 ≥ ¥20w',
      unlocked: input.currentSavedCny >= 200000,
      progressPct: Math.min(100, Math.round((input.currentSavedCny / 200000) * 100)),
      color: '#34d399',
    },
    {
      id: 'gear-holo-globe',
      icon: '图',
      titleZh: '全息知识星图仪',
      titleEn: 'Holographic Knowledge Orrery',
      requirementZh: '知识图谱已掌握 ≥ 2 个节点',
      unlocked: input.masteredNodesCount >= 2,
      progressPct: Math.min(100, Math.round((input.masteredNodesCount / 2) * 100)),
      color: '#38bdf8',
    },
    {
      id: 'gear-camping-dome',
      icon: '营',
      titleZh: '双人星空露营微缩景观',
      titleEn: 'Couple Stargazing Glamp',
      requirementZh: '家庭净资产 ≥ ¥100w',
      unlocked: input.currentSavedCny >= 1000000,
      progressPct: Math.min(100, Math.round((input.currentSavedCny / 1000000) * 100)),
      color: '#f472b6',
    },
  ];
}
