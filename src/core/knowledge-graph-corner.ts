/**
 * Study Corner & Personal Knowledge Graph Engine (学习角 · 个人知识图谱与按需离线章节包)
 *
 * Inspired by open-source best practices:
 * - Obsidian / Logseq: Bidirectional `[[WikiLinks]]` & local-first Markdown notes
 * - Roadmap.sh: DAG prerequisite skill-tree topology (`locked` -> `learning` -> `mastered`)
 * - Kiwix / Anki: Zero-bloat app bundle! The app only ships a <4KB Graph Skeleton Index;
 *   heavy chapter contents (mental models, code templates, interactive animation scripts, flashcards)
 *   are fetched/installed on-demand as modular Offline Chapter Packs and can be offloaded anytime
 *   without losing personal mastery progress or study time logs.
 * - 3Blue1Brown / Distill.pub: Step-by-step interactive animated simulations for AI Infra concepts.
 */

export type KnowledgeDomainId = 'ai-infra' | 'cs-systems' | 'wealth-quant' | 'product-arch';

export type NodeMasteryStatus = 'locked' | 'learning' | 'mastered';

export type KnowledgeFlashcard = {
  q: string;
  a: string;
};

export type AiAnimationKind =
  | 'self-attention'
  | 'paged-attention'
  | 'speculative-decoding'
  | 'flash-attention';

export type KnowledgeChapterContent = {
  nodeId: string;
  coreMentalModel: string;
  keyTakeaways: readonly string[];
  codeOrFormulaSnippet: string;
  flashcards: readonly KnowledgeFlashcard[];
  animationKind?: AiAnimationKind;
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
  localFilePath: string;
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
  { id: 'ai-infra', icon: '智', zh: 'AI Infra 交互动画实验室', en: 'AI Infra Interactive Lab', color: '#f5b942' },
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
    title: 'Transformer 与 Self-Attention 矩阵动画',
    summary: 'Q/K/V 向量投影、缩放点积注意力热力图与温度 τ 分布动态演示',
    x: 14,
    y: 24,
    prerequisites: [],
    bidirectionalLinks: ['node-kv-cache', 'node-flash-attn', 'node-cuda-mem'],
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
    title: 'KV Cache 与 vLLM PagedAttention 分页动画',
    summary: '虚拟页表映射、非连续物理显存块分配与 Copy-on-Write 前缀共享动画',
    x: 42,
    y: 18,
    prerequisites: ['node-transformer'],
    bidirectionalLinks: ['node-transformer', 'node-speculative', 'node-flash-attn'],
    status: 'learning',
    studyMinutes: 60,
    reviewLevel: 2,
    userNote: '类比操作系统虚拟内存页表，将显存浪费从 60%+ 降至 <4%。',
    packId: 'pack-ai-infra',
  },
  {
    id: 'node-speculative',
    domainId: 'ai-infra',
    code: 'AI-301',
    title: '投机采样 (Speculative Decoding) 双模型动画',
    summary: '小模型串行快猜 γ 步 + 大模型单次前向并行验证的无损加速动画',
    x: 68,
    y: 22,
    prerequisites: ['node-kv-cache'],
    bidirectionalLinks: ['node-kv-cache', 'node-flash-attn'],
    status: 'learning',
    studyMinutes: 35,
    reviewLevel: 2,
    userNote: '利用 Decode 阶段算力富余，1 次前向同时验证 γ 个候选词。',
    packId: 'pack-ai-infra',
  },
  {
    id: 'node-flash-attn',
    domainId: 'ai-infra',
    code: 'AI-401',
    title: 'FlashAttention SRAM 分块与 Online Softmax 动画',
    summary: 'GPU HBM ⇄ 片上 SRAM Tiling 流水线与在线重缩放递推公式动画',
    x: 88,
    y: 34,
    prerequisites: ['node-transformer', 'node-kv-cache'],
    bidirectionalLinks: ['node-transformer', 'node-cuda-mem'],
    status: 'locked',
    studyMinutes: 20,
    reviewLevel: 1,
    userNote: '不把 N×N 注意力矩阵写回 HBM，直接片上流式归约。',
    packId: 'pack-ai-infra',
  },
  {
    id: 'node-cuda-mem',
    domainId: 'cs-systems',
    code: 'SYS-101',
    title: 'CPU/GPU 内存层次与 Cache Line 对齐',
    summary: 'SRAM vs HBM 带宽差距、False Sharing 与零拷贝机制',
    x: 22,
    y: 72,
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
    y: 76,
    prerequisites: ['node-cuda-mem'],
    bidirectionalLinks: ['node-cuda-mem', 'node-kelly-dca'],
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
    y: 72,
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
    titleZh: 'AI Infra 交互式动画教学离线包',
    titleEn: 'AI Infra Interactive Animation Pack',
    version: 'v2.0',
    sizeKb: 36,
    nodeCount: 4,
    localFilePath: 'knowledge-packs/ai-infra-interactive.pack.json',
    descriptionZh:
      '含 4 套可交互 SVG 教学动画（Self-Attention 热力连线、PagedAttention 显存分页、Speculative 投机采样、FlashAttention SRAM 分块）及闪卡。',
    chapters: {
      'node-transformer': {
        nodeId: 'node-transformer',
        animationKind: 'self-attention',
        coreMentalModel:
          'Self-Attention 的本质是「动态软寻址字典」：每个词发出 Query 向量去和所有词的 Key 做内积匹配，经过 Softmax(·/τ) 归一化成注意力权重后，对 Value 向量加权求和。',
        keyTakeaways: [
          '除以 √d_k 是为了防止高维内积方差过大导致 Softmax 进入梯度饱和区',
          '温度参数 τ 越小，注意力分布越尖锐（聚焦头部词）；τ 越大，分布越平缓均匀',
          'Prefill 阶段并行算整句属算力受限 (Compute-bound)，Decode 阶段逐词生成属显存带宽受限 (Memory-bound)',
        ],
        codeOrFormulaSnippet:
          'Attention(Q, K, V) = softmax((Q @ K.T) / (sqrt(d_k) * tau)) @ V',
        flashcards: [
          {
            q: '为什么 Scaled Dot-Product Attention 必须除以 √d_k？',
            a: '假设 Q、K 元素均值为 0、方差为 1，则内积方差为 d_k；除以 √d_k 将方差拉回 1，避免 Softmax 极化导致梯度消失。',
          },
        ],
      },
      'node-kv-cache': {
        nodeId: 'node-kv-cache',
        animationKind: 'paged-attention',
        coreMentalModel:
          '借鉴操作系统虚拟内存分页思想，将连续的逻辑 KV Cache 切分为固定大小（如每块 4 个 Token）的物理 KV Block，通过 Block Table 动态映射，彻底消灭预分配碎片。',
        keyTakeaways: [
          '传统连续显存预分配需按 Max_Seq_Len 预留，高达 60%–80% 显存被内部碎片浪费',
          'PagedAttention 仅在最后一个未填满的 Block 产生极小内部碎片，显存利用率提升至 96%+',
          '多并发请求共享相同 System Prompt 时，通过引用计数 (RefCnt) + Copy-on-Write 实现零拷贝复用',
        ],
        codeOrFormulaSnippet:
          'PhysicalBlock = BlockTable[req_id][logical_token_idx // BLOCK_SIZE]',
        flashcards: [
          {
            q: 'PagedAttention 如何在多个对话间共享长 System Prompt 的 KV Cache？',
            a: '多个请求的逻辑块指向同一个物理 KV 块并将引用计数 +1；当某请求需修改该块时才触发写时复制 (Copy-on-Write)。',
          },
        ],
      },
      'node-speculative': {
        nodeId: 'node-speculative',
        animationKind: 'speculative-decoding',
        coreMentalModel:
          '利用 GPU 在单 Token Decode 时算力大量闲置的特性：先用极快的小模型（Draft）连续猜 γ 个词，再让大模型（Target）用 1 次前向传播同时验证这 γ 个词，实现 2–3 倍无损加速。',
        keyTakeaways: [
          '验证阶段把 γ 个候选词拼成序列一次送入大模型，耗时与算 1 个词几乎相同',
          '若第 k 个候选词被拒绝，直接从修正分布中重采样第 k 个词，前面 k-1 个词全部保留，且额外白送第 k 个正确词',
          '每次大模型验证保底产出 1 个词、最高产出 γ+1 个词，数学上严格保持大模型原始分布',
        ],
        codeOrFormulaSnippet:
          'ExpectedTokensPerStep = (1 - alpha^(gamma + 1)) / (1 - alpha)  // alpha 为单步接受率',
        flashcards: [
          {
            q: '如果 Draft 小模型猜的 γ=4 个词全错了，投机采样这一步产出了几个有效 Token？',
            a: '依然至少产出 1 个有效 Token（由大模型在第一个被拒位置直接输出的概率分布采样得到）。',
          },
        ],
      },
      'node-flash-attn': {
        nodeId: 'node-flash-attn',
        animationKind: 'flash-attention',
        coreMentalModel:
          'GPU 的片上 SRAM 带宽（~19 TB/s）比 HBM 显存带宽（~1.5 TB/s）快 10 倍以上。FlashAttention 通过分块 (Tiling) + 在线 Softmax 递推，在 SRAM 内一次性完成 QKV 归约，避免把巨大的 N×N 注意力矩阵写回 HBM。',
        keyTakeaways: [
          '标准 Attention 需将 N×N 中间矩阵 S 和 P 反复读写 HBM，访存复杂度为 O(N²)',
          'Online Softmax 维护局部最大值 m(x) 与指数和 l(x)，每加载一个新 KV 分块就用 exp(m_old - m_new) 动态修正历史累加值',
          '显存占用从 O(N²) 降为 O(N)，HBM 读写量减少 5–9 倍',
        ],
        codeOrFormulaSnippet:
          'm_new = max(m_old, rowmax(S_ij));  O_new = diag(exp(m_old - m_new)) * O_old + exp(S_ij - m_new) @ V_j',
        flashcards: [
          {
            q: 'FlashAttention 为什么不需要先遍历完整行就能算出精确的 Softmax？',
            a: '利用指数函数可分解性质 exp(x - m_new) = exp(x - m_old) * exp(m_old - m_new)，在遍历每个分块时在线重缩放历史分子与分母。',
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
    localFilePath: 'knowledge-packs/cs-systems-consensus.pack.json',
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
    localFilePath: 'knowledge-packs/wealth-quant-compounding.pack.json',
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

export const KNOWLEDGE_STORAGE_KEY = 'viastela.knowledge_graph.v1';

/**
 * Interactive Simulation 1: Self-Attention Q/K/V & Temperature Softmax Frame
 */
export function computeAttentionSimulation(input: {
  focusTokenIdx: number;
  stepIdx: number;
  temperature: number;
}): {
  tokens: readonly string[];
  focusTokenIdx: number;
  stepIdx: number;
  stepTitleZh: string;
  stepDescZh: string;
  weightsPct: number[];
  entropyInfoZh: string;
} {
  const tokens = ['我', '在', '深', '度', '学', 'AI'] as const;
  const idx = Math.max(0, Math.min(tokens.length - 1, input.focusTokenIdx));
  const tau = Math.max(0.2, Math.min(2.5, input.temperature));

  const rawLogitsMatrix: readonly (readonly number[])[] = [
    [2.6, 1.4, 0.9, 0.8, 1.9, 1.7],
    [1.3, 2.4, 1.8, 1.6, 2.1, 1.2],
    [0.8, 1.2, 2.7, 2.5, 2.2, 1.9],
    [0.7, 1.1, 2.5, 2.6, 2.3, 1.8],
    [1.8, 1.5, 2.0, 2.1, 2.8, 2.9],
    [1.6, 1.1, 1.9, 1.8, 2.7, 3.1],
  ];
  const row = rawLogitsMatrix[idx] ?? rawLogitsMatrix[5]!;
  const scaled = row.map((v) => v / tau);
  const maxVal = Math.max(...scaled);
  const exps = scaled.map((v) => Math.exp(v - maxVal));
  const sumExp = exps.reduce((a, b) => a + b, 0) || 1;
  const weightsPct = exps.map((e) => Math.round((e / sumExp) * 100));

  const steps: { title: string; desc: string }[] = [
    {
      title: '步骤 1/4 · Token 向量投影 (Q, K, V) 与 RoPE 旋转编码',
      desc: `当前选中词「${tokens[idx]}」通过线性层映射出 Query 检索向量，并乘以复数旋转矩阵注入相对位置信息。`,
    },
    {
      title: '步骤 2/4 · 缩放点积打分 S = (Q · K^T) / √d_k',
      desc: `「${tokens[idx]}」的 Query 与句中全部 6 个词的 Key 并行计算内积，并除以 √d_k 稳定梯度方差。`,
    },
    {
      title: `步骤 3/4 · 温度缩放 Softmax 归一化 (当前 τ = ${tau.toFixed(1)})`,
      desc:
        tau < 0.7
          ? '低温模式：概率分布高度尖锐，注意力几乎全部聚焦在语义最相关的核心词上。'
          : tau > 1.4
            ? '高温模式：概率分布趋于平缓均匀，广泛融合整句上下文信息。'
            : '标准温度 (τ=1.0)：兼顾核心语义对齐与上下文平滑聚合。',
    },
    {
      title: '步骤 4/4 · Value 向量加权求和输出 Context Representation',
      desc: `按注意力权重 [${weightsPct.map((w) => `${w}%`).join(', ')}] 对各词 Value 加权求和，得到融合上下文后的新表征。`,
    },
  ];

  const stepObj = steps[Math.max(0, Math.min(3, input.stepIdx))] ?? steps[0]!;
  const maxWeight = Math.max(...weightsPct);
  const entropyInfoZh = `最高注意力权重 ${maxWeight}% · 温度 τ=${tau.toFixed(1)}`;

  return {
    tokens,
    focusTokenIdx: idx,
    stepIdx: Math.max(0, Math.min(3, input.stepIdx)),
    stepTitleZh: stepObj.title,
    stepDescZh: stepObj.desc,
    weightsPct,
    entropyInfoZh,
  };
}

/**
 * Interactive Simulation 2: PagedAttention Logical -> Physical VRAM Blocks
 */
export function computePagedAttentionSimulation(input: {
  tokenCount: number;
  sharedPrefixEnabled: boolean;
}): {
  tokenCount: number;
  blockSize: number;
  logicalBlocks: {
    logicalIndex: number;
    physicalBlockId: number;
    filledSlots: number;
    isSharedCoW: boolean;
    tokens: string[];
  }[];
  traditionalWastePct: number;
  pagedWastePct: number;
  savedVramPct: number;
  summaryZh: string;
} {
  const sampleTokens = [
    '[Sys:你',
    '是AI',
    '架构',
    '导师]',
    '请推',
    '导KV',
    '显存',
    '分页',
    '如何',
    '消除',
    '外部',
    '碎片',
    '并提',
    '升吞',
    '吐量',
    '3倍',
  ];
  const blockSize = 4;
  const count = Math.max(4, Math.min(16, input.tokenCount));
  const physicalMapping = [7, 2, 11, 4];
  const numBlocks = Math.ceil(count / blockSize);

  const logicalBlocks = Array.from({ length: numBlocks }, (_, bIdx) => {
    const start = bIdx * blockSize;
    const slice = sampleTokens.slice(start, Math.min(count, start + blockSize));
    return {
      logicalIndex: bIdx,
      physicalBlockId: physicalMapping[bIdx] ?? bIdx + 1,
      filledSlots: slice.length,
      isSharedCoW: bIdx === 0 && input.sharedPrefixEnabled,
      tokens: slice,
    };
  });

  const maxReserved = 32;
  const traditionalWastePct = Math.round(((maxReserved - count) / maxReserved) * 100);
  const pagedAllocatedSlots = numBlocks * blockSize;
  const pagedWastePct = Math.round(((pagedAllocatedSlots - count) / pagedAllocatedSlots) * 100);
  const savedVramPct = Math.max(0, traditionalWastePct - pagedWastePct);

  return {
    tokenCount: count,
    blockSize,
    logicalBlocks,
    traditionalWastePct,
    pagedWastePct,
    savedVramPct,
    summaryZh: `已生成 ${count} 个 Token：分配 ${numBlocks} 个非连续物理页框（${logicalBlocks.map((b) => `P#${b.physicalBlockId}`).join(' → ')}），显存浪费从传统预分配的 ${traditionalWastePct}% 降至 ${pagedWastePct}%！`,
  };
}

/**
 * Interactive Simulation 3: Speculative Decoding Draft + Target Parallel Verify
 */
export function computeSpeculativeDecodingSimulation(input: {
  gamma: number;
  verifyPhase: number;
}): {
  gamma: number;
  candidates: { token: string; status: 'accepted' | 'corrected' | 'bonus' }[];
  acceptedCount: number;
  effectiveSpeedup: number;
  stepDescZh: string;
} {
  const pool = ['通过', '分页', '映射', '消除', '显存', '碎片', '瓶颈'];
  const g = Math.max(2, Math.min(5, input.gamma));
  const allPass = input.verifyPhase % 2 === 0;
  const candidates: { token: string; status: 'accepted' | 'corrected' | 'bonus' }[] = [];

  for (let i = 0; i < g; i += 1) {
    if (!allPass && i === g - 1) {
      candidates.push({ token: `${pool[i]}→[零拷贝]`, status: 'corrected' });
    } else {
      candidates.push({ token: pool[i] ?? 'Token', status: 'accepted' });
    }
  }
  if (allPass) {
    candidates.push({ token: `+${pool[g] ?? '加速'}`, status: 'bonus' });
  }

  const acceptedCount = candidates.length;
  const effectiveSpeedup = Number((acceptedCount / 1.35).toFixed(1));
  const stepDescZh = allPass
    ? `Draft 小模型快猜 ${g} 个词全部通过大模型单次并行验证，并额外白送 1 个新词，单步吐出 ${acceptedCount} 个 Token（等效提速 ${effectiveSpeedup}x）！`
    : `Draft 小模型快猜 ${g} 个词，前 ${g - 1} 个验证通过，第 ${g} 个词由大模型直接修正分布重采样为「零拷贝」，单步依然产出 ${acceptedCount} 个有效 Token！`;

  return {
    gamma: g,
    candidates,
    acceptedCount,
    effectiveSpeedup,
    stepDescZh,
  };
}

/**
 * Interactive Simulation 4: FlashAttention HBM <-> SRAM Tiling Loop
 */
export function computeFlashAttentionSimulation(input: {
  activeTileIdx: number;
}): {
  activeTileIdx: number;
  totalTiles: number;
  runningMax: number;
  runningSumExp: number;
  standardHbmReadsMb: number;
  flashHbmReadsMb: number;
  ioReductionFactor: number;
  stepDescZh: string;
} {
  const totalTiles = 4;
  const idx = Math.max(0, Math.min(totalTiles - 1, input.activeTileIdx));
  const maxProgression = [1.8, 2.4, 2.4, 3.1];
  const sumProgression = [3.2, 7.8, 12.4, 18.6];
  const standardHbmReadsMb = 128;
  const flashHbmReadsMb = 16;

  return {
    activeTileIdx: idx,
    totalTiles,
    runningMax: maxProgression[idx]!,
    runningSumExp: sumProgression[idx]!,
    standardHbmReadsMb,
    flashHbmReadsMb,
    ioReductionFactor: Number((standardHbmReadsMb / flashHbmReadsMb).toFixed(1)),
    stepDescZh: `正在 GPU 片上 SRAM 处理第 ${idx + 1}/${totalTiles} 个 KV 分块 (Tile #${idx + 1})：在线更新局部最大值 m=${maxProgression[idx]}，用 exp(m_old - m_new) 动态缩放累加器 O，全程 0 次中间矩阵写回 HBM！`,
  };
}

export function buildDefaultKnowledgeState(): KnowledgeGraphState {
  const aiPack = CATALOG_CHAPTER_PACKS[0]!;
  return {
    nodes: DEFAULT_KNOWLEDGE_NODES.map((n) => ({ ...n })),
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
    const existingIds = new Set(parsed.nodes.map((n) => n.id));
    const mergedNodes = [
      ...parsed.nodes,
      ...DEFAULT_KNOWLEDGE_NODES.filter((dn) => !existingIds.has(dn.id)),
    ];
    const installed = Array.isArray(parsed.installedPackIds)
      ? parsed.installedPackIds
      : ['pack-ai-infra'];
    const mergedContents: Record<string, KnowledgeChapterContent> = {
      ...(parsed.offlineContents ?? {}),
    };
    if (installed.includes('pack-ai-infra')) {
      Object.assign(mergedContents, CATALOG_CHAPTER_PACKS[0]!.chapters);
    }
    return {
      nodes: mergedNodes,
      installedPackIds: installed,
      offlineContents: mergedContents,
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

export function importCustomMarkdownKnowledgeNode(input: {
  title: string;
  domainId: KnowledgeDomainId;
  markdownBody: string;
  prerequisiteNodeId?: string;
}): { state: KnowledgeGraphState; addedNode: KnowledgeNode } {
  const cur = readKnowledgeGraphState();
  const cleanTitle = input.title.trim() || '自定义知识节点';
  const body = input.markdownBody.trim() || '核心概念与推导笔记';

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

export function exportChapterPackJson(packId: string): string {
  const pack = CATALOG_CHAPTER_PACKS.find((p) => p.id === packId) ?? CATALOG_CHAPTER_PACKS[0]!;
  return JSON.stringify(pack, null, 2);
}

export function computeKnowledgeGraphStats(state: KnowledgeGraphState): {
  totalNodes: number;
  masteredCount: number;
  learningCount: number;
  totalStudyMinutes: number;
  installedPacksCount: number;
  totalCatalogPacksCount: number;
  cachedSizeKb: number;
  storageKey: string;
  packFolderRelPath: string;
} {
  const masteredCount = state.nodes.filter((n) => n.status === 'mastered').length;
  const learningCount = state.nodes.filter((n) => n.status === 'learning').length;
  const totalStudyMinutes = state.nodes.reduce((s, n) => s + n.studyMinutes, 0);
  const cachedSizeKb = CATALOG_CHAPTER_PACKS.filter((p) =>
    state.installedPackIds.includes(p.id),
  ).reduce((s, p) => s + p.sizeKb, 4);

  return {
    totalNodes: state.nodes.length,
    masteredCount,
    learningCount,
    totalStudyMinutes,
    installedPacksCount: state.installedPackIds.length,
    totalCatalogPacksCount: CATALOG_CHAPTER_PACKS.length,
    cachedSizeKb,
    storageKey: KNOWLEDGE_STORAGE_KEY,
    packFolderRelPath: 'knowledge-packs/*.pack.json',
  };
}

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
