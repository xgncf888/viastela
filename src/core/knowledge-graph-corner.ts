/**
 * Study Corner & Personal Knowledge Graph Engine (学习角 · 从小白到架构师渐进式 AI 精装读本、知识图谱与智能资讯筛选)
 *
 * Inspired by open-source best practices:
 * - 3Blue1Brown / Distill.pub / Karpathy Zero-to-Hero: Progressive visual intuition from absolute beginner
 *   (Tokens, Embeddings, Gradient Descent, RNN vs Attention) to industrial LLM systems (PagedAttention,
 *   Speculative Decoding, FlashAttention, MoE, 3D Parallelism, LoRA/RAG, INT4 Quantization, Agent/MCP, RL/GRPO).
 * - Apple Books / WeRead (微信读书) /《数学之美》: Multi-paragraph long-form narrative prose, serif typography,
 *   margin notes, footnotes, and red seal stamps so users can read deeply right inside the app.
 * - Readwise Reader / NetNewsWire / Hacker News: Local-first Smart News & Tech Digest Filter with
 *   Signal-to-Noise scoring, clickbait keyword muting, category/depth filtering, and 1-click clipping
 *   into the Personal Knowledge Graph (100% privacy-safe, zero intranet coupling).
 */

export type KnowledgeDomainId = 'ai-infra' | 'cs-systems' | 'wealth-quant' | 'product-arch';

export type NodeMasteryStatus = 'locked' | 'learning' | 'mastered';

/**
 * 4 Progressive Learning Stages from Zero-Basis Beginner to Systems Architect
 */
export type LearningStageLevel = 1 | 2 | 3 | 4;

export type KnowledgeFlashcard = {
  q: string;
  a: string;
};

export type KnowledgeQuizItem = {
  questionZh: string;
  optionsZh: readonly string[];
  correctIndex: number;
  explanationZh: string;
};

export type FormulaSymbolItem = {
  symbol: string;
  meaningZh: string;
};

export type AiAnimationKind =
  | 'token-next-word'
  | 'word-embedding'
  | 'neuron-gradient'
  | 'rnn-vs-attention'
  | 'self-attention'
  | 'lora-rag'
  | 'quantization-smooth'
  | 'paged-attention'
  | 'speculative-decoding'
  | 'flash-attention'
  | 'moe-routing'
  | 'distributed-parallel';

export type KnowledgeChapterContent = {
  nodeId: string;
  stageLevel?: LearningStageLevel;
  /** Zero-jargon everyday analogy for complete beginners */
  beginnerAnalogyZh?: string;
  /** Rich multi-paragraph long-form book prose so users can read deeply right inside the app */
  deepReadingParagraphsZh?: readonly string[];
  /** Step-by-step hands-on prompts guiding the user through the interactive animation */
  guidedStepsZh?: readonly string[];
  /** Plain-Chinese dictionary breaking down every symbol in the formula */
  formulaBreakdownZh?: readonly FormulaSymbolItem[];
  coreMentalModel: string;
  keyTakeaways: readonly string[];
  codeOrFormulaSnippet: string;
  flashcards: readonly KnowledgeFlashcard[];
  quiz?: KnowledgeQuizItem;
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
  stageLevel: LearningStageLevel;
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

// ============================================================================
// ★ SMART NEWS & TECH DIGEST FILTER TYPES (书院晨报 · 智能资讯筛选与长文净读)
// ============================================================================

export type NewsCategoryId = 'ai-frontier' | 'sys-open' | 'wealth-macro' | 'deep-essay';

export type NewsDigestItem = {
  id: string;
  categoryId: NewsCategoryId;
  sourceName: string;
  publishedAt: string;
  readMinutes: number;
  /** Signal-to-noise ratio score (0..100); >=90 means hardcore high-signal, <65 means hype/noise */
  signalScore: number;
  titleZh: string;
  summaryZh: string;
  /** Full multi-paragraph article body for distraction-free reading inside the app */
  paragraphsZh: readonly string[];
  keyTakeawaysZh: readonly string[];
  tags: readonly string[];
  relatedNodeCode?: string;
  bookmarked: boolean;
  read: boolean;
};

export type NewsFilterOptions = {
  category: NewsCategoryId | 'all';
  minSignalScore: number;
  readingDepth: 'all' | 'quick' | 'deep';
  searchQuery: string;
  mutedKeywordsCsv: string;
  onlyBookmarked: boolean;
  hideRead: boolean;
};

export type KnowledgeGraphState = {
  nodes: KnowledgeNode[];
  /** IDs of chapter packs currently downloaded into local offline storage */
  installedPackIds: string[];
  /** Cached chapter content payloads keyed by nodeId */
  offlineContents: Record<string, KnowledgeChapterContent>;
  /** Local-first curated & user-clipped news digest items */
  newsItems?: NewsDigestItem[];
  /** Saved user preferences for news filtering & noise muting */
  newsFilter?: NewsFilterOptions;
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

export const NEWS_CATEGORIES: readonly {
  id: NewsCategoryId;
  icon: string;
  zh: string;
  en: string;
  color: string;
}[] = [
  { id: 'ai-frontier', icon: '🤖', zh: 'AI 与大模型前沿', en: 'AI & LLM Frontier', color: '#f5b942' },
  { id: 'sys-open', icon: '⚙️', zh: '开源工程与架构', en: 'Open Source & Systems', color: '#38bdf8' },
  { id: 'wealth-macro', icon: '📈', zh: '宏观与量化理财', en: 'Macro & Quant Wealth', color: '#34d399' },
  { id: 'deep-essay', icon: '📚', zh: '深度长文与书摘', en: 'Deep Essays & Book Digest', color: '#f472b6' },
] as const;

export const LEARNING_STAGES: readonly {
  level: LearningStageLevel;
  badge: string;
  zh: string;
  en: string;
  subtitleZh: string;
  color: string;
}[] = [
  {
    level: 1,
    badge: 'L1 · 零基础入门',
    zh: '第一卷：零基础直觉篇',
    en: 'Vol 1: Zero-to-One Intuition',
    subtitleZh: '无需任何数学与编程背景，用「词语接龙、性格打分卡、下山调水温、微信群@人」4 个生活故事彻底读懂 AI 底层逻辑',
    color: '#34d399',
  },
  {
    level: 2,
    badge: 'L2 · 核心架构',
    zh: '第二卷：核心架构与原理篇',
    en: 'Vol 2: Transformer & Systems Core',
    subtitleZh: '深入图书馆检索软寻址 (Q/K/V)、RoPE 复平面旋转罗盘、计算机存储器山与长期复利数学原理',
    color: '#f5b942',
  },
  {
    level: 3,
    badge: 'L3 · 微调与智能体',
    zh: '第三卷：定制微调、量化与智能体篇',
    en: 'Vol 3: Fine-Tuning, Quant & Agents',
    subtitleZh: '掌握 RAG 开卷检索、LoRA 便利贴微调、INT4 端侧量化、AI Agent 工具调用以及 DeepSeek-R1 强化学习慢思考',
    color: '#38bdf8',
  },
  {
    level: 4,
    badge: 'L4 · 工业级系统',
    zh: '第四卷：工业级推理与集群训练篇',
    en: 'Vol 4: Industrial LLM Infra',
    subtitleZh: '剖析 vLLM 显存分页、投机采样双轨竞速、FlashAttention 片上分块、MoE 专家路由与 3D 分布式并行',
    color: '#f472b6',
  },
] as const;

export const KNOWLEDGE_DOMAINS: readonly {
  id: KnowledgeDomainId;
  icon: string;
  zh: string;
  en: string;
  color: string;
}[] = [
  { id: 'ai-infra', icon: '智', zh: 'AI 从零到架构师读本 (14章)', en: 'AI Illustrated Book (14 Ch)', color: '#f5b942' },
  { id: 'cs-systems', icon: '核', zh: '计算机底层与分布式', en: 'Systems & Distributed', color: '#38bdf8' },
  { id: 'wealth-quant', icon: '财', zh: '资产配置与复利模型', en: 'Asset Allocation & Quant', color: '#34d399' },
  { id: 'product-arch', icon: '架', zh: '跨端架构与工程效能', en: 'Cross-Platform Arch', color: '#f472b6' },
] as const;

/**
 * Lightweight Graph Skeleton: Progressive 17-Node Book Curriculum from AI-001 to AI-701
 */
export const DEFAULT_KNOWLEDGE_NODES: readonly KnowledgeNode[] = [
  // ==================== STAGE 1: 零基础小白入门 (AI-001 ~ AI-004) ====================
  {
    id: 'node-ai-001-token',
    domainId: 'ai-infra',
    stageLevel: 1,
    code: 'AI-001',
    title: '大模型是怎么说话的？Token 切词与下一词接龙',
    summary: '【零基础第1章】把句子切成积木块 (Token)，看大模型如何像玩文字接龙一样算出下一个词的概率',
    x: 8,
    y: 14,
    prerequisites: [],
    bidirectionalLinks: ['node-ai-002-embed', 'node-transformer'],
    status: 'mastered',
    studyMinutes: 35,
    reviewLevel: 3,
    userNote: '原来 ChatGPT 每次只吐一个词，把吐出来的词拼回去再算下一个词！',
    packId: 'pack-ai-infra',
  },
  {
    id: 'node-ai-002-embed',
    domainId: 'ai-infra',
    stageLevel: 1,
    code: 'AI-002',
    title: '文字怎么变成数字？词向量 Embedding 与语义星空',
    summary: '【零基础第2章】给每个词发一张多维特征打分卡，亲手体验「国王 - 男人 + 女人 = 女王」的向量魔法',
    x: 24,
    y: 14,
    prerequisites: ['node-ai-001-token'],
    bidirectionalLinks: ['node-ai-001-token', 'node-ai-003-grad', 'node-transformer'],
    status: 'mastered',
    studyMinutes: 40,
    reviewLevel: 3,
    userNote: '意思越像的词，在向量空间里的夹角余弦 cos(θ) 越接近 1。',
    packId: 'pack-ai-infra',
  },
  {
    id: 'node-ai-003-grad',
    domainId: 'ai-infra',
    stageLevel: 1,
    code: 'AI-003',
    title: '机器是怎么学会知识的？Loss 误差山谷与梯度下降',
    summary: '【零基础第3章】像蒙眼下山和调冷热水龙头一样，顺着斜率（梯度）一步步修正参数直到误差最小',
    x: 40,
    y: 14,
    prerequisites: ['node-ai-002-embed'],
    bidirectionalLinks: ['node-ai-002-embed', 'node-ai-004-rnn-attn'],
    status: 'learning',
    studyMinutes: 35,
    reviewLevel: 2,
    userNote: '学习率太小下山太慢，学习率太大直接在山谷两边震荡飞出去了。',
    packId: 'pack-ai-infra',
  },
  {
    id: 'node-ai-004-rnn-attn',
    domainId: 'ai-infra',
    stageLevel: 1,
    code: 'AI-004',
    title: '为什么旧模型会忘事？RNN 传声筒衰减 vs 注意力直连',
    summary: '【零基础第4章】对比串行传话筒的记忆衰减与微信群直接 @ 某人的全局注意力直连通道',
    x: 56,
    y: 14,
    prerequisites: ['node-ai-003-grad'],
    bidirectionalLinks: ['node-ai-003-grad', 'node-transformer'],
    status: 'learning',
    studyMinutes: 30,
    reviewLevel: 2,
    userNote: '彻底看懂为什么 Transformer 能替代 RNN：不用挨个传话，任意两词一步直达！',
    packId: 'pack-ai-infra',
  },

  // ==================== STAGE 2: 核心原理进阶 (AI-101, SYS-101, FIN-101) ====================
  {
    id: 'node-transformer',
    domainId: 'ai-infra',
    stageLevel: 2,
    code: 'AI-101',
    title: 'Transformer 核心：Q/K/V 自注意力与 RoPE 旋转罗盘',
    summary: '【核心第5章】拆解 Query/Key/Value 三兄弟怎么配合打分，以及 2D 复平面旋转如何记住词序',
    x: 16,
    y: 44,
    prerequisites: ['node-ai-004-rnn-attn'],
    bidirectionalLinks: ['node-ai-004-rnn-attn', 'node-kv-cache', 'node-flash-attn', 'node-ai-105-lora-rag'],
    status: 'mastered',
    studyMinutes: 95,
    reviewLevel: 4,
    userNote: '已完成手推 QK^T/sqrt(d_k) 梯度与 RoPE 相对位置内积不变性推导。',
    packId: 'pack-ai-infra',
  },

  // ==================== STAGE 3: 私有定制、端侧量化、智能体与慢思考 (AI-105, AI-701, AI-108, AI-109) ====================
  {
    id: 'node-ai-105-lora-rag',
    domainId: 'ai-infra',
    stageLevel: 3,
    code: 'AI-105',
    title: '怎么定制专属模型？RAG 开卷考试 vs LoRA 低秩微调',
    summary: '【进阶第6章】对比外挂知识库检索 (RAG) 与冻结主干只训 1% 旁路小矩阵 (LoRA) 的双剑合璧架构',
    x: 34,
    y: 44,
    prerequisites: ['node-transformer'],
    bidirectionalLinks: ['node-transformer', 'node-ai-701-quant', 'node-ai-108-agent'],
    status: 'learning',
    studyMinutes: 40,
    reviewLevel: 2,
    userNote: 'RAG 解决最新事实与防幻觉，LoRA 解决特定语气格式与垂直领域思维习惯。',
    packId: 'pack-ai-infra',
  },
  {
    id: 'node-ai-701-quant',
    domainId: 'ai-infra',
    stageLevel: 3,
    code: 'AI-701',
    title: '笔记本怎么跑大模型？FP16→INT4 量化与离群值平滑',
    summary: '【进阶第7章】把 16 位高精度浮点数装进 4 位小格子显存立省 75%，用 SmoothQuant 驯服离群尖峰',
    x: 50,
    y: 44,
    prerequisites: ['node-ai-105-lora-rag'],
    bidirectionalLinks: ['node-ai-105-lora-rag', 'node-kv-cache'],
    status: 'learning',
    studyMinutes: 30,
    reviewLevel: 2,
    userNote: '7B 模型 FP16 要 14GB 显存，INT4 量化后仅需 3.8GB，MacBook 也能流畅跑！',
    packId: 'pack-ai-infra',
  },
  {
    id: 'node-ai-108-agent',
    domainId: 'ai-infra',
    stageLevel: 3,
    code: 'AI-108',
    title: 'AI Agent 智能体怎么自己干活？ReAct 循环与 MCP 协议',
    summary: '【进阶第8章】给大模型装上「手和脚」：思考 (Thought) → 调工具 (Action) → 看结果 (Observation) 闭环',
    x: 62,
    y: 44,
    prerequisites: ['node-ai-105-lora-rag'],
    bidirectionalLinks: ['node-ai-105-lora-rag', 'node-ai-109-rl-r1'],
    status: 'learning',
    studyMinutes: 35,
    reviewLevel: 2,
    userNote: 'MCP (Model Context Protocol) 就像 AI 世界的 USB-C 统一接口，让模型安全连接本地文件与工具。',
    packId: 'pack-ai-infra',
  },
  {
    id: 'node-ai-109-rl-r1',
    domainId: 'ai-infra',
    stageLevel: 3,
    code: 'AI-109',
    title: 'DeepSeek-R1 怎么学会「慢思考」？强化学习与 GRPO',
    summary: '【进阶第9章】从死记硬背标准答案 (SFT) 到自己在草稿纸上推演试错、顿悟反思 (Aha Moment)',
    x: 62,
    y: 64,
    prerequisites: ['node-ai-108-agent'],
    bidirectionalLinks: ['node-ai-108-agent', 'node-moe-router'],
    status: 'learning',
    studyMinutes: 45,
    reviewLevel: 2,
    userNote: 'GRPO 省去了庞大昂贵的 Critic 价值网络，用组内相对平均分做基线，直接激发长思维链涌现！',
    packId: 'pack-ai-infra',
  },

  // ==================== STAGE 4: 工业级推理与集群训练 (AI-201 ~ AI-601) ====================
  {
    id: 'node-kv-cache',
    domainId: 'ai-infra',
    stageLevel: 4,
    code: 'AI-201',
    title: 'KV Cache 与 vLLM PagedAttention 显存分页',
    summary: '【高阶第10章】虚拟页表映射、非连续物理显存块分配与 Copy-on-Write 前缀共享动画',
    x: 78,
    y: 20,
    prerequisites: ['node-transformer'],
    bidirectionalLinks: ['node-transformer', 'node-speculative', 'node-flash-attn'],
    status: 'learning',
    studyMinutes: 60,
    reviewLevel: 2,
    userNote: '类比操作系统虚拟内存页表，将显存浪费从 62%+ 降至 <4%。',
    packId: 'pack-ai-infra',
  },
  {
    id: 'node-speculative',
    domainId: 'ai-infra',
    stageLevel: 4,
    code: 'AI-301',
    title: '投机采样 (Speculative Decoding) 双轨竞速验证',
    summary: '【高阶第11章】小模型串行快猜 γ 步 + 大模型单次前向并行验证的无损加速动画',
    x: 92,
    y: 20,
    prerequisites: ['node-kv-cache'],
    bidirectionalLinks: ['node-kv-cache', 'node-flash-attn', 'node-moe-router'],
    status: 'learning',
    studyMinutes: 45,
    reviewLevel: 2,
    userNote: '利用 Decode 阶段算力富余，1 次前向同时验证 γ 个候选词。',
    packId: 'pack-ai-infra',
  },
  {
    id: 'node-flash-attn',
    domainId: 'ai-infra',
    stageLevel: 4,
    code: 'AI-401',
    title: 'FlashAttention SRAM 分块与 Online Softmax',
    summary: '【高阶第12章】GPU HBM ⇄ 片上 SRAM Tiling 流水线与在线重缩放递推公式动画',
    x: 78,
    y: 48,
    prerequisites: ['node-transformer', 'node-kv-cache'],
    bidirectionalLinks: ['node-transformer', 'node-cuda-mem', 'node-3d-parallel'],
    status: 'learning',
    studyMinutes: 40,
    reviewLevel: 2,
    userNote: '不把 N×N 注意力矩阵写回 HBM，直接片上流式归约。',
    packId: 'pack-ai-infra',
  },
  {
    id: 'node-moe-router',
    domainId: 'ai-infra',
    stageLevel: 4,
    code: 'AI-501',
    title: 'MoE 混合专家 Top-K 门控路由与负载均衡',
    summary: '【高阶第13章】DeepSeek/Mixtral 共享专家 + 路由专家激活与负载均衡辅助损失动画',
    x: 78,
    y: 76,
    prerequisites: ['node-transformer'],
    bidirectionalLinks: ['node-speculative', 'node-3d-parallel'],
    status: 'learning',
    studyMinutes: 30,
    reviewLevel: 1,
    userNote: '参数量扩展至 671B 而单 Token 仅激活 37B，兼顾容量与推理成本。',
    packId: 'pack-ai-infra',
  },
  {
    id: 'node-3d-parallel',
    domainId: 'ai-infra',
    stageLevel: 4,
    code: 'AI-601',
    title: '分布式 3D 并行 (TP/PP/DP) 与 ZeRO 显存切分',
    summary: '【高阶第14章】1F1B 流水线气泡消除、NVLink 张量切分与 ZeRO-1/2/3 优化器状态分片动画',
    x: 92,
    y: 62,
    prerequisites: ['node-flash-attn', 'node-moe-router'],
    bidirectionalLinks: ['node-flash-attn', 'node-moe-router', 'node-raft'],
    status: 'locked',
    studyMinutes: 25,
    reviewLevel: 1,
    userNote: '节点内走 NVLink 做 TP，跨机走 RoCE/IB 做 PP 与 ZeRO-DP。',
    packId: 'pack-ai-infra',
  },

  // ==================== CS SYSTEMS & WEALTH QUANT ====================
  {
    id: 'node-cuda-mem',
    domainId: 'cs-systems',
    stageLevel: 2,
    code: 'SYS-101',
    title: 'CPU/GPU 内存层次与 Cache Line 伪共享剖析',
    summary: 'SRAM vs HBM 带宽差距、False Sharing 与零拷贝机制',
    x: 16,
    y: 80,
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
    stageLevel: 3,
    code: 'SYS-202',
    title: 'Raft 共识状态机与 Local-First CRDT',
    summary: 'Leader 选举、日志复制安全性与离线多端无冲突合并',
    x: 38,
    y: 82,
    prerequisites: ['node-cuda-mem'],
    bidirectionalLinks: ['node-cuda-mem', 'node-kelly-dca', 'node-3d-parallel'],
    status: 'learning',
    studyMinutes: 45,
    reviewLevel: 2,
    userNote: '本项目的双人账本合并与离线沙箱即采用幂等集合合并思想。',
    packId: 'pack-cs-systems',
  },
  {
    id: 'node-kelly-dca',
    domainId: 'wealth-quant',
    stageLevel: 2,
    code: 'FIN-101',
    title: '凯利公式、股债再平衡与家庭现金流池',
    summary: '安全边际、定投微笑曲线、最大回撤控制与双人合池预算模型',
    x: 58,
    y: 82,
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
 * Modular Offline Chapter Packs Catalog (With Multi-Paragraph Book Prose!)
 */
export const CATALOG_CHAPTER_PACKS: readonly KnowledgeChapterPack[] = [
  {
    id: 'pack-ai-infra',
    domainId: 'ai-infra',
    icon: '智',
    titleZh: '《AI 从零到架构师 · 交互式插图精装读本》全集',
    titleEn: 'The Illustrated Interactive Book of AI (14 Chapters)',
    version: 'v5.0',
    sizeKb: 118,
    nodeCount: 14,
    localFilePath: 'knowledge-packs/ai-infra-interactive.pack.json',
    descriptionZh:
      '含 14 章完整长文书稿与可拨动书中插图：从零基础（Token 接龙、词向量星空、梯度下山、RNN vs 注意力）到核心架构（Transformer、RAG/LoRA、INT4 量化、Agent/MCP、DeepSeek-R1 强化学习）再到工业级系统（PagedAttention、投机采样、FlashAttention、MoE、3D 并行）。',
    chapters: {
      // ==================== AI-001 ====================
      'node-ai-001-token': {
        nodeId: 'node-ai-001-token',
        stageLevel: 1,
        animationKind: 'token-next-word',
        beginnerAnalogyZh:
          '🌱 小白大白话：别把大模型想得太玄乎！它本质上就是一个超级「词语接龙游戏机」。你输入半句话，它先把话切成一小块一小块的乐高积木（叫做 Token），然后翻遍字典给所有可能接在后面的词打分算概率，选出一个词吐给你；接着把这个新词拼到句子末尾，再猜下一个词，循环往复直到说完一整段话！',
        deepReadingParagraphsZh: [
          '许多人第一次见到 ChatGPT 或 DeepSeek 在屏幕上流畅地写诗、写代码时，都会直觉地以为：屏幕背后一定坐着一个像人类一样先把整段腹稿打好、然后再敲字出来的“数字大脑”。但如果你掀开大语言模型（LLM）的引擎盖，会发现一个令人惊讶却极其优雅的事实——它根本不会一次性思考整段话，它自始至终只做一件事：玩一场超大规模的「下一词接龙游戏」。',
          '这场接龙游戏的第一步，叫做「切词（Tokenization）」。因为电子计算机的芯片里只有门电路和数字，根本不认识汉字的笔画或英文字母的拼写。于是工程师们先编纂了一本包含约 10 万个常用词块的大字典（词表 Vocabulary），给每个词块发一个唯一的身份证号（Token ID）。比如当你输入“学习 AI 最棒的方式是”，切词器会在一瞬间把这句话拆成 5 块带编号的积木：[学习(#1024), AI(#2048), 最棒的(#4096), 方式(#5120), 是(#618)]。',
          '积木切好后，真正神奇的第二步开始了：模型把这 5 块积木吃进肚子里，经过几十层神经网络的矩阵计算，给词表里的全部 10 万个候选词逐一打分，算出此时此刻谁最适合接在“是”字后面。比如它算出：「动手」的概率是 54%，「边玩」是 26%，「阅读」是 14%，而「苹果」只有 0.0001%。',
          '如果模型每次都死板地挑概率第 1 名的词（这叫 Greedy 贪婪解码），它说出来的话就会非常稳健，但有时也会显得千篇一律；如果我们允许它在排名前 80% 的高分候选池里像掷骰子一样微调抽签（这叫 Top-P 核采样），它就能在保持逻辑通顺的同时，写出灵动多变、充满创意的句子。最关键的是：一旦它选出了「动手」这个词，就会立刻把「动手」拼回原句末尾，变成 6 块积木，再去猜第 7 个词——如此周而复始，直到吐出代表结束的句号积木 `<EOS>`。这就是为什么大模型回答你时，文字总是一个接一个往外蹦的真正原因！',
        ],
        guidedStepsZh: [
          '拨动插图中的「👉 往后接龙」按钮，观察新吐出的词如何自动追加到句子末尾，并触发下一轮概率打分',
        ],
        formulaBreakdownZh: [
          { symbol: 'w_1, w_2, ..., w_{t-1}', meaningZh: '已经说出口的前面那串词（上下文积木）' },
          { symbol: 'P(w_t | w_{<t})', meaningZh: '在看到前面所有词的条件下，第 t 个位置出现某个新词的概率' },
          { symbol: 'Tokenizer', meaningZh: '切词器：把人类文字切成模型词表里的数字编号（如「学习」→ #1024）' },
        ],
        coreMentalModel:
          '自回归语言模型 (Autoregressive LLM) 的核心机制是「条件概率链式法则」：将生成整段长文的复杂任务，拆解为每一步仅预测「下一个 Token 的概率分布」，并通过采样将新 Token 追加回输入序列循环生成。',
        keyTakeaways: [
          '模型眼里没有汉字或英文字母，只有切词器 (Tokenizer) 转换出的整数编号 Token ID',
          '常见词通常 1 个词就是 1 个 Token，生僻词或长单词会被拆成多个子词 (Sub-word) 积木',
          'Greedy（贪婪解码）每次死板只选第 1 名，容易车轱辘话重复；Top-P 核采样保留前 P% 概率池随机抽样，说话更自然鲜活',
        ],
        codeOrFormulaSnippet:
          'P(w_1, ..., w_T) = prod_{t=1..T} P(w_t | w_1, ..., w_{t-1})  // 自回归逐词接龙公式',
        flashcards: [
          {
            q: '为什么 ChatGPT 回复我们时字是一个个往外蹦的，而不是整篇瞬间弹出来？',
            a: '因为大模型采用自回归 (Autoregressive) 接龙机制：必须先算出第 N 个词，把它拼回输入里，才能继续算第 N+1 个词。',
          },
        ],
        quiz: {
          questionZh: '【小白闯关】如果大模型已经生成了「今天天气真」，它下一步在做什么？',
          optionsZh: [
            'A. 去互联网上搜索今天的天气预报网页',
            'B. 给词表里所有候选词计算接在「今天天气真」后面的概率（如「好」62%、「棒」21%），并按采样策略选出下一个 Token',
            'C. 一次性把后面 500 个字同时算出来',
            'D. 把「今天天气真」删掉重写',
          ],
          correctIndex: 1,
          explanationZh:
            '太棒了！大模型每一步只做一件事：根据当前已有的 Token 序列，预测下一个 Token 的概率分布并抽样出一个词拼上去。',
        },
      },

      // ==================== AI-002 ====================
      'node-ai-002-embed': {
        nodeId: 'node-ai-002-embed',
        stageLevel: 1,
        animationKind: 'word-embedding',
        beginnerAnalogyZh:
          '🌱 小白大白话：电脑只会算加减乘除，根本不懂「小猫」和「小狗」是什么意思。怎么办？我们给每个词发一张「多维属性打分卡」——比如按 [毛茸茸程度, 体型大小, 科技含量] 三个维度打分：「小猫 = [0.9, 0.2, 0.0]」，「小狗 = [0.85, 0.35, 0.0]」，「显卡 = [0.0, 0.1, 0.98]」。这一串数字就叫 **词向量 (Embedding)**！分数越接近的词，在星空图里靠得越近！',
        deepReadingParagraphsZh: [
          '上一章我们知道，切词器给每个词发了一个整数编号（比如「小猫」是 #105，「小狗」是 #8920，「拖拉机」是 #106）。但这里隐藏着一个大麻烦：编号 #105 和 #106 虽然数字挨着，但「小猫」和「拖拉机」风马牛不相及；反倒是编号相差甚远的「小猫」和「小狗」在现实中亲如一家。如果直接拿字典页码去算加减法，计算机怎么可能懂人类语言的微妙含义呢？',
          '为了解决这个问题，科学家们发明了深度学习大厦最核心的基石之一——**词向量（Word Embedding）**。它的思想非常浪漫：既然一个词的含义是由它周围常出现的语境决定的（“观其伴而知其意”），那我们不如给每个词建立一张包含几千个维度的「性格特征打分表」。',
          '打个比方，假设我们的打分表只有 3 个维度：[生物活力感, 社交/皇室感, 科技算力感]。经过海量文本阅读后，模型会自动给「小猫」打出 [0.95, 0.45, 0.05]，给「小狗」打出 [0.92, 0.52, 0.06]，而给「GPU显卡」打出 [0.04, 0.15, 0.98]。当我们把这串坐标画在几何空间里时，奇迹发生了：所有关于宠物的词自动聚成了一团星云，所有关于咖啡饮品的词聚成了另一团星云！',
          '更令人拍案叫绝的是，在这个几何星空里，人类抽象的逻辑关系竟然直接变成了可以计算的「向量箭头平移」！最著名的例子莫过于：如果你用「国王」的坐标减去「男人」的坐标，就把“男性”特征剥离了，只留下纯粹的“皇室元首”方向；此时你再加上「女人」的坐标，箭头落下的位置，分毫不差正好指向「女王」！从此以后，“理解一段话的语义”，在计算机眼里就彻底等价于“计算高维星空里两个箭头的夹角余弦值（Cosine Similarity）”。',
        ],
        guidedStepsZh: [
          '点击插图右上角的「👉 演示国王 - 男人 + 女人 = 女王」，观察二维坐标系里的平行四边形向量加减法则',
        ],
        formulaBreakdownZh: [
          { symbol: 'E(w) ∈ R^d', meaningZh: '把词 w 变成由 d 个小数组成的特征向量（真实大模型里 d 通常是 4096 维）' },
          { symbol: 'cos(θ) = (A · B) / (|A||B|)', meaningZh: '余弦相似度：两个词向量箭头的夹角越小，cos(θ) 越接近 1，代表意思越相近' },
          { symbol: 'v(国王) - v(男人) + v(女人)', meaningZh: '剥离「男性」特征、保留「皇室统治者」特征、再加上「女性」特征，正好落到「女王」坐标点！' },
        ],
        coreMentalModel:
          'Embedding 将离散的符号编号映射到连续的高维几何空间（语义空间）。在这个空间里，「语义相似性」直接等价于「几何距离/方向接近度」，而「概念关系」则表现为「向量平移方向」。',
        keyTakeaways: [
          'One-Hot 编码里所有词都互相垂直、毫无关联；而 Embedding 用稠密低维实数向量捕获了词汇间的天然亲疏关系',
          '向量点积 A·B 或余弦相似度 cos(θ) 是大模型衡量「两个概念有多匹配」最核心的尺子',
          '不仅是单个词，整句话、一张图片、一段音频都可以编码成同一个空间里的 Embedding 向量（多模态底座）',
        ],
        codeOrFormulaSnippet:
          'Similarity(u, v) = dot(u, v) / (norm(u) * norm(v));  v_queen ≈ v_king - v_man + v_woman',
        flashcards: [
          {
            q: '为什么把文字变成 Embedding 词向量后，计算机就能理解「苹果」和「香蕉」比「苹果」和「卡车」更相近？',
            a: '因为训练后的 Embedding 空间把具有相似上下文属性的词（如水果属性高、交通工具属性低）映射到了几何距离很近的坐标点，它们的向量夹角余弦值接近 1。',
          },
        ],
        quiz: {
          questionZh: '【小白闯关】在词向量 (Embedding) 空间里，如果两个词的意思非常接近（比如「拿铁」和「卡布奇诺」），它们的向量会发生什么？',
          optionsZh: [
            'A. 两个向量方向几乎相反，余弦相似度接近 -1',
            'B. 两个向量在空间里靠得很近、指向相似方向，余弦相似度 cos(θ) 接近 1',
            'C. 两个向量的数字全部变成 0',
            'D. 词表编号 ID 必须相邻（比如 101 和 102）',
          ],
          correctIndex: 1,
          explanationZh:
            '完全正确！词表编号 ID 只是随机字典页码，而 Embedding 向量坐标才真正代表语义——意思越像，空间距离越近、夹角越小！',
        },
      },

      // ==================== AI-003 ====================
      'node-ai-003-grad': {
        nodeId: 'node-ai-003-grad',
        stageLevel: 1,
        animationKind: 'neuron-gradient',
        beginnerAnalogyZh:
          '🌱 小白大白话：大模型里几百亿个参数是怎么变聪明的？想象你在漆黑的浓雾里站在半山腰，目标是走到海拔最低的「零误差山谷底」。你看不见谷底在哪，但你可以用脚探一探脚下地面往哪边倾斜（这就是算**梯度 Gradient**），然后顺着下坡方向迈出一步（步长就是**学习率 Learning Rate**）。每猜错一次题，就顺着下坡改一点点参数，走几万步就到谷底了！',
        deepReadingParagraphsZh: [
          '许多刚接触 AI 的朋友最困惑的问题是：“你说词向量有几千个维度，大模型里有几百亿个参数（权重），难道是程序员手工把这几百亿个数字一个个填进去的吗？”当然不是！刚出厂未经训练的模型，它脑子里的几百亿个参数全是用随机数瞎填的——这时候你问它“1+1等于几”，它可能会满嘴胡言乱语。',
          '那么，这团乱麻般的随机数是怎么一步步变成博古通今的智者的？答案只有四个字：**梯度下降（Gradient Descent）**。我们可以把它想象成你在陌生的酒店淋浴间调水温：一开始你随便拧了一个角度（初始权重 w），结果出来的水太烫了（预测值与理想水温差得很远，这个差距就叫 **损失函数 Loss**）。',
          '既然水太烫了，说明你刚才拧的方向偏右了，于是你往左微微回拧一点点；再伸手试一下水温，还差一点点，再微调一下……在数学上，“看一眼当前误差随参数变化的坡度方向”就叫做求导数或求**梯度（Gradient）**；而你“每次往回拧的幅度大小”，就叫做**学习率（Learning Rate, η）**。',
          '如果在浓雾笼罩的抛物线山谷里下山，学习率 η 的选择是一门精妙的艺术：如果步子迈得太小（比如 η=0.01），虽然稳妥，但走几百万步还停在半山腰；如果步子迈得太激进（比如 η=0.92），你一脚迈出去直接跨过了山谷底，踩到了对面更高的山坡上，下一步又跨回来，结果在山谷两侧剧烈震荡甚至飞出天外（训练崩溃 NaN）！只有配合恰当的黄金步长，小球才会顺着切线斜率一路丝滑滚落，稳稳停在误差为零的谷底。',
        ],
        guidedStepsZh: [
          '点击插图中的「👉 顺着斜坡往下走」，并切换右侧的「小步慢走 / 稳步入谷 / 步大震荡」观察小球下山轨迹',
        ],
        formulaBreakdownZh: [
          { symbol: 'L(w) = (y_pred - y_true)^2', meaningZh: '损失函数 (Loss)：模型猜的答案和标准答案差了多少（山坡的高度）' },
          { symbol: '∇L = dL / dw', meaningZh: '梯度 (Gradient)：当前位置山坡的坡度与方向（正数说明在右坡，应该往左走）' },
          { symbol: 'η (Learning Rate)', meaningZh: '学习率：下山每一步迈多大（太大容易跨过谷底震荡，太小训练太慢）' },
          { symbol: 'w_new = w - η · ∇L', meaningZh: '梯度下降核心公式：新参数 = 旧参数 - 步长 × 坡度' },
        ],
        coreMentalModel:
          '深度学习训练的闭环由四步组成：① 前向传播算预测值 → ② 损失函数 (Loss) 算误差海拔 → ③ 反向传播 (Backpropagation) 用链式法则算出每个参数的坡度梯度 → ④ 优化器按反梯度方向微调参数。',
        keyTakeaways: [
          '梯度指向函数增长最快的「上坡方向」，因此想要减小误差 Loss 必须减去梯度（往反方向下坡走）',
          '越接近山谷底，坡度 ∇L 越小，迈出的步子也会自然变小，平稳停在最低点',
          '工业界常用的 AdamW 优化器相当于给小球加上了「物理动量惯性」与「自适应步长」，过平地加速、过陡坡减速',
        ],
        codeOrFormulaSnippet:
          'grad = 2 * (w - target_w);  w_next = w - learning_rate * grad  // 梯度下降参数更新',
        flashcards: [
          {
            q: '如果训练大模型时把学习率 (Learning Rate) 设得过大，会发生什么现象？',
            a: '一步迈得太远直接跨过误差山谷底跳到对面更高的山坡上，导致 Loss 剧烈震荡甚至发散爆炸 (NaN)。',
          },
        ],
        quiz: {
          questionZh: '【小白闯关】当前模型参数在 w = 1.0 处，算出误差山坡的斜率（梯度）是 -4.0（说明往右是下坡）。根据公式 w_new = w - η·∇L，参数 w 接下来会怎么变？',
          optionsZh: [
            'A. 参数 w 变大（往右走，靠近 w=3.0 的山谷底）',
            'B. 参数 w 变小（往左爬上更高的山坡）',
            'C. 参数 w 保持 1.0 永远不动',
            'D. 直接把梯度清零',
          ],
          correctIndex: 0,
          explanationZh:
            '答对了！因为梯度是负数 (-4.0)，公式里减去一个负数等于加上正数，所以参数 w 会往右增大，顺着下坡滑向谷底 w=3.0！',
        },
      },

      // ==================== AI-004 ====================
      'node-ai-004-rnn-attn': {
        nodeId: 'node-ai-004-rnn-attn',
        stageLevel: 1,
        animationKind: 'rnn-vs-attention',
        beginnerAnalogyZh:
          '🌱 小白大白话：在 Transformer 诞生前，统治 AI 界的是 RNN（循环神经网络）。RNN 读长句子就像玩「排队传声筒」：第 1 个词传给第 2 个，第 2 个传给第 3 个……传到第 100 个词时，开头说的话早就忘得一干二净！而 Transformer 的 **注意力机制 (Attention)** 彻底掀翻了传声筒，改成了「微信群直接 @ 某人」——无论句子多长，末尾的词都能拉一条绿色专线直接读取开头任意词的完整信息！',
        deepReadingParagraphsZh: [
          '把时间拨回 2017 年之前，当时处理自然语言的主流模型叫做 RNN（循环神经网络）和 LSTM。它们阅读一句话的方式非常符合人类的线性直觉：从左往右，一个字一个字地读。每读一个新字，就把刚才读到的内容和脑海里的旧记忆揉在一起，捏成一个新的“记忆球”，传给下一个字。',
          '听起来很合理对不对？但一旦遇到长文章，灾难就降临了。这就好比让 100 个人排成一列玩「传声筒耳语游戏」：排第 1 的人说了一句“那只昨天清晨在花园草地上追蝴蝶的小猫”，经过中间十几个人的口口相传，等到第 16 个人听到“所以主人赶紧喂了它”时，最早关于“小猫”的记忆早就磨损得只剩 7% 的模糊残影了！更致命的是，因为后面的人必须苦苦等待前面的人把话传过来才能动工，昂贵的万卡 GPU 集群根本没法并行计算，只能干瞪眼排队。',
          '2017 年夏天，Google 的八位学者发表了那篇改变人类历史的论文《Attention Is All You Need》。他们提出了一个石破天惊的追问：为什么非要排队传话呢？如果我们在所有词与词之间都架起一座直通桥梁，让任何一个词都能在 1 步之内直接看到整篇文章里的所有其他词，会怎么样？',
          '这就是 **注意力机制（Attention）** 的灵魂所在！它把「排队传声筒」直接升级成了「百人圆桌会议 / 微信群直接 @ 某人」。当模型读到句尾的代词“它”时，“它”不需要向前面第 15 个词打听，而是直接向全场广播一条检索信号，瞬间跨越整句话与句首的“小猫”建立一条 1 步直达的高速光纤通道（路径长度永远是 O(1)）！从此，长距离遗忘瓶颈被彻底粉碎，而且整篇文章成千上万个词可以在 GPU 上同时并行计算——大模型爆发的时代大门，由此正式轰然开启。',
        ],
        guidedStepsZh: [
          '点击插图右上角的「长句 (16词·看传声筒失忆)」，对比上轨 RNN 颜色褪色失忆与下轨 Attention 跨句一步直连的巨大反差',
        ],
        formulaBreakdownZh: [
          { symbol: 'RNN Path Length = O(N)', meaningZh: '相隔 N 个词的两个字，在 RNN 里要经过 N 次串行接力才能通上话，极易梯度消失' },
          { symbol: 'Attention Path Length = O(1)', meaningZh: '在注意力机制里，任意两个词无论隔多远，永远是 1 步直连对话！' },
          { symbol: 'Parallelism (并行度)', meaningZh: 'RNN 必须等前一个字算完才能算后一个字；Attention 可以让整句所有词同时在 GPU 上并行计算！' },
        ],
        coreMentalModel:
          'Transformer 淘汰 RNN 的两大杀手锏：① 任意两位置交互路径长度从 O(N) 降为常数 O(1)，彻底解决长距离依赖遗忘；② 摆脱时间步串行依赖，训练时整篇文本可利用 GPU 矩阵乘一次性并行算完。',
        keyTakeaways: [
          '比如句子「那只昨天在花园里追蝴蝶的**小猫**肚子饿了，所以喂了**它**」——判断「它」指代谁，必须跨越十几个词找回「小猫」',
          'RNN 把历史全部硬塞进一个固定长度的隐状态向量里，像用一个小行李箱装整座图书馆，必然丢信息',
          'Attention 不压缩历史，而是保留每个词的独立向量，需要时按相关性动态检索（软寻址）',
        ],
        codeOrFormulaSnippet:
          'RNN: h_t = tanh(W * h_{t-1} + U * x_t) [串行O(N)]  vs  Attention: Y = Softmax(QK^T)V [直连O(1)]',
        flashcards: [
          {
            q: '为什么 Transformer 训练大模型的速度比当年的 RNN / LSTM 快上百倍？',
            a: '因为 RNN 第 t 步必须苦等第 t-1 步算完，GPU 算力无法并行；而 Transformer 的 Self-Attention 可以把整句话所有词拼成矩阵一次性并行算完！',
          },
        ],
        quiz: {
          questionZh: '【小白闯关】在一篇 2000 字的文章末尾出现代词「它」，指向文章第 1 段的「小猫」。在 Attention 机制中，末尾的「它」需要经过几步传递才能读取到第 1 段「小猫」的信息？',
          optionsZh: [
            'A. 需要挨个经过中间 1999 个词的接力传递',
            'B. 只需 1 步（O(1) 全局直连），直接用 Query 和「小猫」的 Key 匹配读取 Value',
            'C. 根本无法读取超过 100 字以前的信息',
            'D. 必须把前文全部删掉才能读取',
          ],
          correctIndex: 1,
          explanationZh:
            '完全正确！无论两个词相隔 5 个字还是 5000 个字，在 Self-Attention 里它们之间永远只有 1 步点积直连（O(1) 路径长度）！',
        },
      },

      // ==================== AI-101 ====================
      'node-transformer': {
        nodeId: 'node-transformer',
        stageLevel: 2,
        animationKind: 'self-attention',
        beginnerAnalogyZh:
          '🌱 小白大白话：进了图书馆怎么找资料？每个词都分身出三个角色：**Query (Q)** 是你手里写的「检索小纸条」，**Key (K)** 是书架上每本书脊贴的「分类标签」，**Value (V)** 是书里真正的「干货内容」。拿着你的 Q 纸条去和所有书的 K 标签做比对（算内积打分），哪本书标签最匹配（Softmax 权重最高），就把哪本书的 V 干货多抄一点回来！',
        deepReadingParagraphsZh: [
          '当我们真正走进 Transformer 的殿堂，最核心的机关就是 **自注意力层（Self-Attention）**。为什么每个词进到这一层，都要先一分为三，变成 Query（查询 Q）、Key（键 K）和 Value（值 V）三个向量呢？这其实借鉴了数据库与图书馆检索的经典哲学。',
          '想象你在读一句话：“我在深度学习 AI”。当读到末尾的「AI」这个词时，它想搞清楚整句话里谁和自己关系最紧密。于是，「AI」写了一张寻人启事小纸条（Query 向量）：“我是名词宾语 AI，谁是支配我的动词和修饰我的核心词？”与此同时，句中的每一个词都亮出了自己胸前的身份名牌（Key 向量）——比如「学」的名牌上写着“我是核心及物动词”，「深/度」写着“我是修饰程度副词”。',
          '接下来，「AI」手里的 Q 纸条与全句所有词的 K 名牌逐一做内积乘法（点积），算出来的分数再除以 √d_k（防止维度太高导致分数爆炸），最后通过 Softmax 转换成加起来等于 100% 的百分比权重。拿到这组百分比后，只需把每个词怀里揣着的真正语义干货（Value 向量）按百分比调配一杯鸡尾酒，就得到了融合整句上下文后的全新「AI」表征！',
          '但这里还有一个绝妙的细节：如果只做点积，“狗咬人”和“人咬狗”算出来的内积是一模一样的，因为点积本身不分先后顺序！为了教模型认识词序，当今主流大模型（如 LLaMA、DeepSeek、Qwen）都采用了中国学者苏剑林提出的 **RoPE（旋转位置编码）**。它把每个词的向量看作二维复平面上的一根时钟指针：站在第 m 个位置的词，指针就逆时针旋转 m×θ 度；站在第 n 个位置的词，就旋转 n×θ 度。当两根指针做内积时，它们的夹角恰好等于 (m - n)×θ——只取决于两个词隔了几个身位，而与它们站在句首还是句尾的绝对位置无关！',
        ],
        guidedStepsZh: [
          '点击插图上方的不同汉字切换 Query 提问词，并观察右侧 RoPE 罗盘指针如何随位置 m 旋转不同角度',
        ],
        formulaBreakdownZh: [
          { symbol: 'Q, K, V', meaningZh: 'Query（检索提问）、Key（候选标签）、Value（实际内容），均由词向量乘以各自权重矩阵得到' },
          { symbol: 'Q · K^T / √d_k', meaningZh: '相关性打分：Q 和 K 越像内积越大；除以 √d_k 是为了防止分数太大把 Softmax 撑爆' },
          { symbol: 'RoPE (e^{i·mθ})', meaningZh: '旋转位置编码：第 m 个词旋转 mθ 角度，让点积自动只取决于两词相隔几个身位 (m-n)' },
        ],
        coreMentalModel:
          'Self-Attention 的本质是「动态软寻址字典」：每个词发出 Query 向量去和所有词的 Key 做内积匹配，经过 RoPE 复平面旋转注入相对位置 (m-n)θ 后，再用 Softmax(·/τ) 归一化成权重对 Value 加权求和。',
        keyTakeaways: [
          '除以 √d_k 是为了防止高维内积方差随维度增长，避免 Softmax 进入梯度接近 0 的饱和区',
          'RoPE 通过对 Q_m、K_n 分别旋转 mθ 和 nθ 角度，使内积天然只依赖相对距离 (m - n)',
          'Prefill 阶段并行算整句属算力受限 (Compute-bound)，Decode 阶段逐词生成属显存带宽受限 (Memory-bound)',
        ],
        codeOrFormulaSnippet:
          'Attention(Q, K, V) = softmax((RoPE(Q, m) @ RoPE(K, n).T) / (sqrt(d_k) * tau)) @ V',
        flashcards: [
          {
            q: '为什么 Scaled Dot-Product Attention 必须除以 √d_k？',
            a: '假设 Q、K 元素均值为 0、方差为 1，则内积方差为 d_k；除以 √d_k 将方差拉回 1，避免 Softmax 极化导致梯度消失。',
          },
          {
            q: 'RoPE 旋转位置编码如何用绝对位置操作实现相对位置感知？',
            a: '利用复数内积性质 <R(mθ)q, R(nθ)k> = <q, R((n-m)θ)k>，旋转矩阵相乘后角度相减只剩相对距离 (m-n)。',
          },
        ],
        quiz: {
          questionZh: '当把 Softmax 温度参数 τ 从 1.0 调低到 0.2 时，注意力权重分布会发生什么变化？',
          optionsZh: [
            'A. 权重趋于均匀分布，所有词平分注意力',
            'B. 分布高度尖锐化（Approaching Argmax），注意力集中到得分最高的极少数 Token',
            'C. Q 和 K 的向量维度自动减半',
            'D. RoPE 旋转角度变为原来的 5 倍',
          ],
          correctIndex: 1,
          explanationZh:
            '正确！Logits 除以更小的 τ 会放大得分差距，经过指数函数 exp(x/τ) 后，最高分词权重接近 100%，分布变得极度尖锐。',
        },
      },

      // ==================== AI-105 ====================
      'node-ai-105-lora-rag': {
        nodeId: 'node-ai-105-lora-rag',
        stageLevel: 3,
        animationKind: 'lora-rag',
        beginnerAnalogyZh:
          '🌱 小白大白话：通用大模型虽然博学，但它没看过你们公司的内部文档，重训一次又要花几百万美元。怎么办？有两个省钱绝招：① **RAG（检索增强生成）** 就像「让学霸带着你的笔记本去开卷考试」——提问前先用向量搜索找出相关的 3 段私有笔记塞进 Prompt 里；② **LoRA（低秩微调）** 就像「不动新华字典原书，只在旁边贴几张薄薄的便利贴」——冻结原模型 99% 的权重，只训练一对极小的瘦长矩阵 A 和 B（不到 1% 参数），就能教会它专属行话与格式！',
        deepReadingParagraphsZh: [
          '当我们想把一个通用的开源大模型（如 Qwen 或 DeepSeek）改造成懂自己专业领域的私人助手时，往往会面临两条技术路线的抉择：是应该用 **RAG（检索增强生成）**，还是做 **LoRA（低秩微调）**？其实，用“考试”来打比方，你一秒钟就能分清它们的边界。',
          'RAG 就像是「开卷考试」。你完全不需要去改动学霸（大模型）脑子里的任何神经元，只需要把你的私人笔记、公司制度、财报文档切成几百字一段的小卡片，算出它们的 Embedding 向量存进本地数据库。当你提问时，系统先去数据库里搜出最相关的 3 张卡片，连同你的问题一起贴在试卷上交给大模型：“请严格根据这三段参考资料回答”。它的最大优势是**零训练成本、知识随时更新、且每一句话都能标注出处防幻觉**。',
          '那什么时候需要 LoRA 微调呢？当你想改变模型的「说话语气、特定输出格式（如严苛的医疗病历结构）或某种深层领域推理直觉」时，光靠塞参考资料就不够了。但如果把整个 70B 大模型的所有参数全部放开去重新训练（全量微调），不仅需要几十张昂贵的 A100 显卡，还很容易让模型患上“灾难性遗忘”——学会了写病历，却把原本优秀的通用逻辑忘光了。',
          '微软研究院提出的 **LoRA（Low-Rank Adaptation）** 给出了一个神来之笔：它把原本厚重的 4096×4096 权重矩阵 W_0 彻底冰冻锁死，然后在旁边并联贴上一张极薄的“便利贴”——由一个瘦长矩阵 B(4096×8) 乘以一个扁平矩阵 A(8×4096) 组成。原本要改 1678 万个参数，现在只需要训练 6.5 万个参数（省去 99.6% 的显存）！更妙的是，等微调结束准备上线时，根据矩阵乘法分配律，直接把这张便利贴 B×A 叠加进原矩阵 W_0 里，推理时连 0.1 毫秒的额外延迟都不会增加！',
        ],
        guidedStepsZh: [
          '点击插图中的「① 开卷翻书 (RAG) / ② 书旁贴便利贴 (LoRA) / ③ 合璧」，并切换秩 r=4/8/16 查看节省的参数比例',
        ],
        formulaBreakdownZh: [
          { symbol: 'W_0 ∈ R^{d×d} (Frozen)', meaningZh: '冻结的预训练大模型原始权重（不计算梯度、不占优化器显存）' },
          { symbol: 'ΔW = B · A (r ≪ d)', meaningZh: 'LoRA 旁路：用瘦高矩阵 B(d×r) 乘以扁平矩阵 A(r×d)，参数量从 d² 骤降为 2dr' },
          { symbol: 'Top-K Chunks (RAG)', meaningZh: '从本地向量数据库里检索出余弦相似度最高的 K 段私有文档切片注入上下文' },
        ],
        coreMentalModel:
          '大模型领域适配黄金法则：「外挂新知识用 RAG，内化新技能/语气格式用 LoRA」。LoRA 利用微调权重变化量 ΔW 的「低内在秩 (Low Intrinsic Rank)」假设，将可训练参数压缩 100–1000 倍，并在推理时无损合并回主干矩阵。',
        keyTakeaways: [
          '当 d=4096、秩 r=8 时，原矩阵有 1677 万参数，而 LoRA 的 A+B 仅有 6.5 万参数（可训练参数减少 99.6%！）',
          'RAG 无需训练即可实时更新知识库且可溯源防幻觉；LoRA 则擅长改变模型遵循特定输出格式、代码风格与领域推理习惯',
          '推理部署时，直接算好 W_final = W_0 + (α/r)·B·A 覆盖原矩阵，推理速度与原模型一模一样（零额外延迟）',
        ],
        codeOrFormulaSnippet:
          'h = W_0 @ x + (alpha / r) * (B @ (A @ x))  // 训练时冻结 W_0 只训 A, B；推理时直接合并 W = W_0 + B@A',
        flashcards: [
          {
            q: '为什么 LoRA 微调后的模型在上线推理时不会增加任何额外计算延迟？',
            a: '因为矩阵加法满足分配律 W_0·x + B·A·x = (W_0 + B·A)·x，上线前直接把 B·A 乘好加进 W_0 里即可，推理时依然只做一次矩阵乘。',
          },
        ],
        quiz: {
          questionZh: '【实战闯关】如果你的需求是「让客服机器人每天都能准确回答今天刚发布的最新商品价格与库存」，最先应该采用什么方案？',
          optionsZh: [
            'A. 每天从头预训练一次千亿参数大模型',
            'B. 使用 RAG（检索增强生成），将最新商品库切片向量化，提问时实时检索注入上下文',
            'C. 把温度参数调到 2.5 让模型自由发挥猜价格',
            'D. 删除模型的词表',
          ],
          correctIndex: 1,
          explanationZh:
            '非常准确！高频变动、要求精准溯源的事实性数据最适合用 RAG「开卷考试」实时检索；而固定话术风格则适合搭配 LoRA 微调。',
        },
      },

      // ==================== AI-701 ====================
      'node-ai-701-quant': {
        nodeId: 'node-ai-701-quant',
        stageLevel: 3,
        animationKind: 'quantization-smooth',
        beginnerAnalogyZh:
          '🌱 小白大白话：为什么 70 亿参数模型原本要 14GB 显存，量化后只要 3.8GB 就能在普通笔记本上飞快运行？想象搬家打包：**FP16** 是给每个数字配一个豪华大木箱（占 16 比特，能精确表示 `3.14159`）；而 **INT4 量化** 是把数字四舍五入放进 16 个紧凑的小塑料盒里（只占 4 比特，体积直接缩小 4 倍！）。唯一的麻烦是如果队伍里突然冒出一个身高 3 米的「巨人离群值 (Outlier)」，会把刻度撑爆导致普通人全被挤成一团——**SmoothQuant / AWQ** 就是先把巨人的身高勻一半给权重，让所有人都舒舒服服住进小盒子里！',
        deepReadingParagraphsZh: [
          '如果你想在自己的 MacBook 或家用游戏显卡上本地运行一个大模型，一定会遇到诸如 `Q4_K_M`、`AWQ-INT4`、`GPTQ` 这样的神秘代号。它们背后共同指向一项让端侧 AI 成为可能的核心技术——**模型量化（Quantization）**。',
          '算一笔最简单的账：一个 70 亿参数（7B）的模型，如果用标准的 16 位半精度浮点数（FP16，每个参数占 2 个字节）存储，光把权重装进内存就要占掉 70亿 × 2B = 14 GB！如果我们把每个高精度小数四舍五入映射到 4 比特整数（INT4，总共只有 -8 到 +7 这 16 个刻度档位），每个参数就只占 0.5 个字节，整个模型瞬间瘦身到 3.8 GB！更惊喜的是，因为大模型逐字生成时 90% 的时间都花在“从内存搬运权重到芯片”的路上，包裹体积缩小为原来的 1/4 后，你的笔记本生成文字的速度反而飙升了近 3 倍！',
          '然而，直接粗暴地做四舍五入，往往会让模型突然“变傻”。清华大学与 MIT 的研究者在剖析大模型内部激活值时发现了一个奇特现象：当模型规模超过 6.7B 后，会有极少数固定通道突然冒出比普通数值（~1.0）大出几十倍的**极端离群尖峰（Outliers，比如高达 48.0）**！',
          '这就好比用一把只有 16 个格子的刻度尺去量身高：本来大家都在 1.6 米到 1.8 米之间，每个格子可以精确到厘米；结果队伍里混进了一座 48 米高的铁塔，为了装下这座铁塔，每个格子的跨度被迫拉大到 3 米，导致所有普通人的身高全被四舍五入成了同一个数字！**SmoothQuant** 提出的解法堪称四两拨千斤：既然激活值 X 某列太大、而对应的权重 W 很平缓，我们就在做矩阵乘法前，先给激活值 X 除以一个平滑系数 s 把尖峰削平，同时给权重 W 乘上同一个 s——两边一除一乘，数学乘积 (X/s)·(s·W) = X·W 分毫不差，却让量化误差瞬间从 18.4% 降到了 0.9%！',
        ],
        guidedStepsZh: [
          '切换插图中的「FP16 / INT8 / INT4」并点击右侧「开启 SmoothQuant 削平离群尖峰」，对比 Ch#3 离群值与量化误差变化',
        ],
        formulaBreakdownZh: [
          { symbol: 'Scale Δ = (X_max - X_min) / (2^b - 1)', meaningZh: '量化步长（每个小格子的宽度）：最大值越大，格子越粗，精度损失越大' },
          { symbol: 'Q(x) = round(x / Δ)', meaningZh: '把连续的小数四舍五入映射成整数格子编号（INT8 是 -128..127，INT4 是 -8..7）' },
          { symbol: 'Y = (X · diag(s)^{-1}) · (diag(s) · W)', meaningZh: 'SmoothQuant 恒等变换：给激活值 X 除以缩放因子 s 压平尖峰，同时给权重 W 乘以 s，乘积结果分毫不差！' },
        ],
        coreMentalModel:
          '模型量化 (Quantization) 将高精度浮点数 (FP16/BF16) 线性映射到低比特整数网格 (INT8/INT4/FP4)。针对激活值通道常出现极端离群值 (Outliers) 撑大步长 Δ 的痛点，SmoothQuant/AWQ 通过跨层等价缩放与显著权重保护实现近乎无损的 4-bit 压缩。',
        keyTakeaways: [
          'LLM 推理的 Decode 阶段受限于显存带宽（搬运权重的时间远大于计算时间），INT4 量化不仅省 75% 显存，还能让搬运速度提速 3 倍以上！',
          '大模型参数量超过 6.7B 后，少数固定通道会出现比普通值大 100 倍的激活离群值 (Activation Outliers)',
          'AWQ (Activation-aware Weight Quantization) 发现只需保护对大激活值最敏感的 1% 权重通道，就能大幅降低 INT4 困惑度损失',
        ],
        codeOrFormulaSnippet:
          'X_smooth = X / s;  W_smooth = W * s;  W_int4 = clamp(round(W_smooth / scale), -8, 7)',
        flashcards: [
          {
            q: '为什么把大模型从 FP16 量化为 INT4 后，不仅显存占用降为 1/4，连生成文字的速度也变快了 2~3 倍？',
            a: '因为单 Token 生成是典型的显存带宽受限 (Memory-bound) 任务，耗时主要花在从显存搬运权重到计算单元上；权重体积缩小为 1/4 后，显存搬运耗时大幅缩短！',
          },
        ],
        quiz: {
          questionZh: '【实战闯关】SmoothQuant 是如何在不改变矩阵乘法最终结果 Y = X·W 的前提下，消除激活值 X 中的极端离群尖峰的？',
          optionsZh: [
            'A. 直接把超过 10 的数字全部删掉变成 0',
            'B. 给激活值 X 除以平滑因子 s 把尖峰压低，同时给权重 W 乘以相同的 s，利用 (X/s)·(s·W) = X·W 保持数学结果严格相等',
            'C. 把 INT4 改回 FP64',
            'D. 停止运行注意力层',
          ],
          correctIndex: 1,
          explanationZh:
            '太赞了！一边除以 s、另一边乘以 s，两边难度中和，既压平了激活值尖峰方便量化，又在数学上严格恒等！',
        },
      },

      // ==================== AI-108 (NEW: AI AGENT & MCP) ====================
      'node-ai-108-agent': {
        nodeId: 'node-ai-108-agent',
        stageLevel: 3,
        animationKind: 'lora-rag',
        beginnerAnalogyZh:
          '🌱 小白大白话：单纯的大模型就像一位「被关在玻璃房里的智者」——他满腹经纶，但既没有手去帮你查今天的机票、也没法帮你修改电脑里的代码文件。而 **AI Agent（智能体）** 就是给这位智者配了一部对讲机和工具箱（Tools / MCP 协议）：他先在脑子里想一步（Thought），然后发指令调工具查数据（Action），看到工具返回的结果（Observation）后再想下一步，直到把活儿真正干完！',
        deepReadingParagraphsZh: [
          '如果说 ChatGPT 刚诞生时是一个“你说一句、它回一句”的聊天顾问，那么当今 AI 领域最核心的范式演进，就是从被动问答走向主动干活的 **AI Agent（自主智能体）**。一个只会生成文字的概率接龙模型，究竟是怎么学会操作浏览器、运行代码、甚至帮你管理日程账本的呢？',
          '秘诀在于普林斯顿与 Google 学者提出的 **ReAct（Reasoning + Acting，推理与行动协同）** 循环框架。实际上，大模型自己并没有长出双手，而是宿主程序在系统提示词里和它约定了一套严谨的“工单格式”：每当遇到需要操作外部世界的任务，模型先输出一段 `Thought（内心思考：我需要先读取用户的账本文件）`，紧接着输出一段结构化的 JSON 指令 `Action: read_ledger(month="2026-11")` 并暂停生成。',
          '此时，守在旁边的宿主环境捕获到这条 JSON 指令，真正去调用本地函数或数据库，拿到返回结果后，把结果包装成 `Observation（观察结果：11月共支出 ¥4,280）` 重新塞回模型的上下文里，让模型继续往下接龙！通过「思考 → 调工具 → 看结果 → 修正计划再调工具」的多轮闭环，哪怕第一遍代码报错了，Agent 也能看着报错信息自己改好重跑。',
          '为了让成千上万的应用不再各自发明一套五花八门的工具接口，开源社区推出了 **MCP（Model Context Protocol，模型上下文协议）**。它就像硬件世界里的 **USB-C 万能接口**：无论你是本地笔记库、Git 仓库还是个人账本，只要提供一个标准的 MCP Server 接口，任何支持 MCP 的 AI 客户端都能即插即用地安全调用它！',
        ],
        guidedStepsZh: [
          '观察智能体如何结合检索上下文与工具调用完成复杂多步任务',
        ],
        formulaBreakdownZh: [
          { symbol: 'Thought_t', meaningZh: '第 t 步的内心推理：分析当前进度、拆解下一步子目标' },
          { symbol: 'Action_t = Tool(args)', meaningZh: '模型输出结构化 JSON 函数调用请求（如查询文件、执行测试）' },
          { symbol: 'Observation_t', meaningZh: '宿主环境执行工具后返回给模型的真实世界反馈结果' },
        ],
        coreMentalModel:
          'Agent = LLM（规划与推理大脑）+ Memory（长短期记忆与 RAG）+ Tools（基于 JSON Schema / MCP 协议的工具执行器）+ ReAct 闭环反馈控制流。',
        keyTakeaways: [
          '大模型本身并不直接执行代码或联网，而是输出结构化 Tool Call 请求，由外部沙箱执行后将结果回填至上下文',
          'ReAct 循环之所以远超单次零样本回答，是因为允许模型根据真实环境报错 (Observation) 动态纠偏',
          'MCP 协议通过统一的 Resources（读数据）、Tools（调动作）与 Prompts 原语，解耦了模型端与本地工具端',
        ],
        codeOrFormulaSnippet:
          'while not done: thought, action = LLM(history); obs = Env.run(action); history.append(thought, action, obs)',
        flashcards: [
          {
            q: '在 Tool Calling（工具调用）过程中，到底是大模型自己去执行了 Python 函数，还是外部宿主程序执行的？',
            a: '大模型只负责生成「要调用哪个函数及参数是什么」的 JSON 文本；真正的函数执行是由外部宿主程序（沙箱）完成的，执行完再把结果文本塞回给大模型。',
          },
        ],
        quiz: {
          questionZh: '【实战闯关】在 ReAct 智能体循环（Thought → Action → Observation）中，如果某一步工具调用返回了报错信息，智能体接下来会怎么做？',
          optionsZh: [
            'A. 直接死机退出',
            'B. 在下一轮 Thought 中分析 Observation 里的报错原因，修正参数后发起新的 Action 重试',
            'C. 假装没看见报错，编造一个假结果',
            'D. 把用户硬盘格式化',
          ],
          correctIndex: 1,
          explanationZh:
            '完全正确！这正是 Agent 具备自主解决问题能力的关键——把环境返回的报错当作新的 Observation 上下文，推理修正方案后再次行动。',
        },
      },

      // ==================== AI-109 (NEW: DEEPSEEK-R1 & RL GRPO) ====================
      'node-ai-109-rl-r1': {
        nodeId: 'node-ai-109-rl-r1',
        stageLevel: 3,
        animationKind: 'speculative-decoding',
        beginnerAnalogyZh:
          '🌱 小白大白话：怎么培养一个奥数冠军？如果只让他死记硬背名师写好的解题步骤（这叫 **SFT 监督微调**），遇到没见过的难题他还是会懵。**DeepSeek-R1** 用了更绝的办法：不逼他背步骤，而是发给他一摞厚厚的演草纸（`<think>` 思维链标签），让他对同一道题自己尝试写出 8 种解法，只要最终答案算对了就发小红花奖励（**GRPO 强化学习**）！结果模型自己在演草纸上顿悟出了“写到一半发现不对、自己划掉重算”的深度反思能力！',
        deepReadingParagraphsZh: [
          '在很长一段时间里，我们训练大模型就像教小学生背范文：先收集几百万道人类专家写好详细步骤的题目，让模型一字一句地模仿（这叫 SFT 监督微调）。但模仿有个天花板——模型只能学到人类写出来的套路，遇到需要拐十几个弯的复杂数学、算法竞赛或架构推演时，它往往因为“想得太浅”而一步踏错、步步皆错。',
          'DeepSeek-R1 与 OpenAI o1 掀起了大模型下半场的「测试时计算扩展（Test-Time Scaling）」革命：与其把参数越堆越大，不如让模型在开口回答前，先在 `<think>...</think>` 思维链草稿纸上进行长达几千字的自我推演、分叉尝试与自我验算！',
          '更传奇的是 DeepSeek-R1-Zero 的发现：研究人员完全跳过了人工编写解题步骤的阶段，直接把基础模型扔进纯粹的**强化学习（Reinforcement Learning）**环境里，只设定两条极简的硬规则奖励——① 最终答案跟标准答案一致就加分；② 思考过程乖乖写在 `<think>` 标签里就加分。至于草稿纸里怎么想，完全不管！',
          '为了解决传统强化学习 PPO 算法需要额外训练一个跟原模型一样庞大的“裁判模型（Critic Value Network）”导致显存翻倍的痛点，DeepSeek 提出了 **GRPO（群组相对策略优化）**：针对同一个问题，让模型一口气采样生成 G=8 份不同的思考草稿，直接拿这 8 份草稿的平均得分当作及格线——高于平均分的草稿路径予以强化，低于平均分的予以抑制！训练到中期时，模型突然迎来了著名的 **“Aha Moment（顿悟时刻）”**：它在没有任何人类示范的情况下，自己学会了在草稿纸里写出 *"Wait, let me re-evaluate this step..."（等等，我刚才那步好像漏了边界条件，让我重新算一遍）*！',
        ],
        guidedStepsZh: [
          '观察多候选路径采样与验证机制如何筛选出高奖励推理链条',
        ],
        formulaBreakdownZh: [
          { symbol: '<think> ... </think>', meaningZh: '模型的内部演草纸（思维链 CoT）：允许自由试错、回溯与自我验算' },
          { symbol: 'A_i = (r_i - mean(r)) / std(r)', meaningZh: 'GRPO 组内相对优势：用同一题 G 个采样回答的均值为基准，无需昂贵的 Critic 网络！' },
          { symbol: 'Rule-based Reward', meaningZh: '可验证规则奖励（如数学结果比对、代码编译通过单元测试），彻底杜绝奖励模型被钻空子' },
        ],
        coreMentalModel:
          'DeepSeek-R1 证明了通过 GRPO（组内相对策略优化）与纯粹的可验证规则奖励（准确性 + 格式奖励），大模型能自发涌现出长思维链（Long CoT）、自我反思纠错与回溯验证等高级慢思考能力。',
        keyTakeaways: [
          '传统 PPO 需要同时在显存里驻留 Policy、Reference、Reward、Value 四个大模型；GRPO 用组内均值替代 Value 网络，显存开销大幅减半',
          '对于数学、代码、逻辑推理等结果可精确验证的任务，硬规则奖励 (Rule-based Reward) 比神经网络打分器更防作弊 (Reward Hacking)',
          '通过将 R1 产出的高质量长思维链蒸馏 (Distillation) 给 7B/14B 小模型，小模型也能获得越级的深度推理能力',
        ],
        codeOrFormulaSnippet:
          'Advantage_i = (Reward_i - mean(Rewards_1..G)) / std(Rewards_1..G)  // GRPO 组内相对优势公式',
        flashcards: [
          {
            q: 'GRPO（群组相对策略优化）相比传统强化学习 PPO 省掉了哪个昂贵的组件？',
            a: '省掉了与主模型同等规模的 Critic（价值评估网络），改用同一问题采样出的多个回答的组内平均分作为 Baseline 基线，省下近一半训练显存。',
          },
        ],
        quiz: {
          questionZh: '【实战闯关】在 DeepSeek-R1 的强化学习训练中，所谓的「Aha Moment（顿悟时刻）」指的是模型自发学会了什么行为？',
          optionsZh: [
            'A. 学会了拒绝回答所有数学题',
            'B. 在没有任何人类示范的情况下，自发在思维链草稿中停下来审视前面的推导漏洞并自我纠错重算',
            'C. 把输出字数缩短到 1 个字',
            'D. 自动修改 GPU 硬件频率',
          ],
          correctIndex: 1,
          explanationZh:
            '太棒了！在纯强化学习激励下，模型发现“多花一点草稿篇幅检查并修正错误”能显著提高最终拿对答案的概率，从而自发涌现出了人类般的反思能力。',
        },
      },

      // ==================== AI-201 ====================
      'node-kv-cache': {
        nodeId: 'node-kv-cache',
        stageLevel: 4,
        animationKind: 'paged-attention',
        beginnerAnalogyZh:
          '🌱 小白大白话：传统显存分配就像「餐厅包厢死板订座」——哪怕只来 2 个人吃饭，只要他说“也许一会儿还有朋友来”，餐厅就得给他死死空出一张 32 人大圆桌，导致 60% 以上的座位全空着浪费！而 **vLLM PagedAttention** 改成了「4 人小方桌按需拼桌」——来 4 个词坐满一桌，第 5 个词来了再新开一桌，哪怕两桌在餐厅里不挨着，服务员拿一张「桌号对应表 (Block Table)」就能串起来，座位浪费瞬间降到 4% 以内！',
        deepReadingParagraphsZh: [
          '当大模型上线服务成千上万并发用户时，架构师面临的头号敌人不是算力不够，而是 **KV Cache 显存爆炸**。前文我们讲过，大模型每吐出一个新词，都要拿新词的 Query 去和前面所有历史词的 Key、Value 做比对。为了避免每次都把前面几千个词重新算一遍，我们把历史词的 K 和 V 缓存在显卡内存里，这就是 KV Cache。',
          '然而在 2023 年之前，主流推理框架管理 KV Cache 的方式极其粗放：因为事先不知道用户这一轮对话会聊 50 个字还是 2048 个字，系统干脆在对话刚开始时，就按最大长度（比如 2048）在显存里圈出一大块**连续的物理地皮**。结果大部分对话聊到 200 字就结束了，剩下 1800 个位置全在空转晒太阳！实测表明，传统框架有高达 60%～80% 的宝贵显存被这种内部碎片与预留空位白白浪费了。',
          'UC Berkeley 团队从操作系统的「虚拟内存分页（Paging）」中获得灵感，打造出了席卷开源界的 **vLLM 与 PagedAttention**。它的做法非常干脆：把整块物理显存切成一个个固定容纳 4 个（或 16 个）Token 的小方格子（Physical Block）。',
          '用户每生成满 4 个词，系统才按需发给他下一个空闲物理块——哪怕这几个物理块在显存条里东一块、西一块完全不挨着也没关系，只需维护一张轻巧的「逻辑页 → 物理块映射表（Block Table）」即可。更绝的是，当 100 个用户同时使用同一段长达 2000 字的 System Prompt 时，他们的页表可以直接指向同一批物理块（引用计数 RefCnt 设为 100），实现零拷贝显存共享！仅靠这一项系统创新，大模型推理吞吐量直接暴涨了 2 到 4 倍。',
        ],
        guidedStepsZh: [
          '点击插图中的「👉 新添 1 个词入席」，观察每满 4 个词如何开辟新的非连续物理页框，以及开启前缀共桌时的复用效果',
        ],
        formulaBreakdownZh: [
          { symbol: 'BLOCK_SIZE (如 4 或 16)', meaningZh: '每个物理显存小方桌能坐几个 Token 的 KV 向量' },
          { symbol: 'logical_idx // BLOCK_SIZE', meaningZh: '算出第几个词应该去查页表的第几行（逻辑页号）' },
          { symbol: 'RefCnt (引用计数)', meaningZh: '当前物理块被几个并发对话共同使用；只有当某人要改写时才触发写时复制 (Copy-on-Write)' },
        ],
        coreMentalModel:
          '借鉴操作系统虚拟内存分页思想，将连续的逻辑 KV Cache 切分为固定大小（如每块 4 或 16 个 Token）的物理 KV Block，通过 Block Table 动态映射，彻底消灭预分配碎片。',
        keyTakeaways: [
          '传统连续显存预分配需按 Max_Seq_Len 预留，高达 60%–80% 显存被内部碎片与预留空位浪费',
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
        quiz: {
          questionZh: '在 vLLM PagedAttention 中，一个请求只有在什么情况下才会产生内部显存碎片？',
          optionsZh: [
            'A. 每个物理块都会产生 50% 碎片',
            'B. 仅在序列最后一个尚未填满的物理 Block 中最多浪费 (BlockSize - 1) 个槽位',
            'C. 当开启 Copy-on-Write 前缀共享时',
            'D. 只有在 Batch Size = 1 时才会产生碎片',
          ],
          correctIndex: 1,
          explanationZh:
            '正确！由于物理块是按需逐块分配的，前面已填满的块利用率为 100%，只有最末尾一个块可能未满，浪费率 < 4%。',
        },
      },

      // ==================== AI-301 ====================
      'node-speculative': {
        nodeId: 'node-speculative',
        stageLevel: 4,
        animationKind: 'speculative-decoding',
        beginnerAnalogyZh:
          '🌱 小白大白话：请一位年薪千万的顶级大教授（70B 大模型）亲自一个字一个字敲键盘太慢了，但大教授「一眼批改一整行字」的速度和他「自己敲一个字」的速度几乎一样快！所以我们配一个手速飞快的实习生（1B Draft 小模型）先一口气连猜 4 个词，交由大教授用 1 次过目同时批改这 4 个词——猜对的全部保留，猜错的那一处大教授顺手改成正确词！既省了 2~3 倍时间，写出来的文章质量又 100% 是大教授本人的水准！',
        deepReadingParagraphsZh: [
          '为什么大教授“一眼批改 5 个词”和“自己写 1 个词”花的时间几乎一样呢？这源于现代 GPU 硬件的一个核心脾气：当生成单个词时，GPU 就像开着一辆载重 30 吨的重型卡车去拉一袋大米——95% 的时间都花在把 70B 模型权重从显存搬到计算单元的路上，而到了计算单元后，拉 1 袋大米（算 1 个词）和顺便拉 5 袋大米（同时算 5 个词）几乎不增加额外耗时！',
          '既然大模型单次前向传播的算力大量闲置，**投机采样（Speculative Decoding）** 便应运而生。我们找来一个体积只有大模型几十分之一的同源小模型（Draft Model），让它利用自己轻快的速度，快速往前连猜 γ=4 个候选词（比如：`[通过, 分页, 映射, 消除]`）。',
          '接着，把这 4 个候选词拼在一起，一次性送进 Target 大模型做单次并行前向传播。大模型在 1 个时间步里，同时算出这 4 个位置在自己心目中的真实概率分布，并逐一审阅实习生的草稿：如果前 3 个词「通过、分页、映射」完全符合大模型的标准，当场盖章通过；如果第 4 个词实习生猜错了，大模型就直接用自己在第 4 个位置算出的修正概率分布当场重采样一个正确的词（比如「零拷贝」）替换上去！',
          '如果运气好 4 个词全猜对了呢？别忘了大模型在第 4 个词的位置也做了一次前向计算，正好可以顺手白送第 5 个词！这意味着：大模型只跑了 1 次，却一口气吐出了 5 个词，而且经过拒绝采样定理严格证明，它生成的每一个词的概率分布，与大模型自己慢吞吞逐字算出来的结果**100% 数学等价、分毫无损**！',
        ],
        guidedStepsZh: [
          '点击插图中的切换按钮，对比「4词全中附赠1词（单步吐5词）」与「末词由导师朱批修正」两种情形',
        ],
        formulaBreakdownZh: [
          { symbol: 'γ (Draft Steps)', meaningZh: '实习生小模型每次连续快速往前猜几个候选词' },
          { symbol: 'α (Acceptance Rate)', meaningZh: '实习生猜的词被大教授点头认可的平均通过率（通常 70%~85%）' },
          { symbol: 'γ + 1 (Max Output)', meaningZh: '如果 γ 个词全猜对，大教授在最后一个位置还能免费多吐出 1 个新词，单步净赚 γ+1 个词！' },
        ],
        coreMentalModel:
          '利用 GPU 在单 Token Decode 时算力大量闲置（显存带宽受限）的特性：先用极快的小模型（Draft）连续猜 γ 个词，再让大模型（Target）用 1 次前向传播同时验证这 γ 个词，实现 2–3 倍无损加速。',
        keyTakeaways: [
          '验证阶段把 γ 个候选词拼成序列一次送入大模型，由于 GPU 算力富余，耗时与算 1 个词几乎相同',
          '若第 k 个候选词被拒绝，直接从修正分布 norm(max(0, p - q)) 中重采样第 k 个词，前面 k-1 个词全部保留',
          '每次大模型验证保底产出 1 个词、最高产出 γ+1 个词，数学上严格保持大模型原始分布无损',
        ],
        codeOrFormulaSnippet:
          'ExpectedTokensPerStep = (1 - alpha^(gamma + 1)) / (1 - alpha)  // alpha 为单步接受率',
        flashcards: [
          {
            q: '如果 Draft 小模型猜的 γ=4 个词全错了，投机采样这一步产出了几个有效 Token？',
            a: '依然至少产出 1 个有效 Token（由大模型在第一个被拒位置直接输出的修正概率分布采样得到）。',
          },
        ],
        quiz: {
          questionZh: '若 Draft 小模型连续猜了 γ=4 个词且全部通过大模型验证，本次大模型前向传播一共能吐出几个新 Token？',
          optionsZh: [
            'A. 1 个 Token',
            'B. 3 个 Token',
            'C. 4 个 Token',
            'D. 5 个 Token（γ + 1，含大模型在最后一个位置的免费 Bonus Token）',
          ],
          correctIndex: 3,
          explanationZh:
            '正确！大模型在并行验证 γ 个候选词的同时，最后一个位置的前向输出还能直接多采样出 1 个新词，因此最多产出 γ + 1 = 5 个 Token！',
        },
      },

      // ==================== AI-401 ====================
      'node-flash-attn': {
        nodeId: 'node-flash-attn',
        stageLevel: 4,
        animationKind: 'flash-attention',
        beginnerAnalogyZh:
          '🌱 小白大白话：把 GPU 想象成一位大厨：**片上 SRAM** 是大厨手边只有巴掌大但伸手即拿的「切菜案板」（速度 19 TB/s 极快），而 **HBM 显存** 是远在走廊尽头的「地下大冷库」（速度慢 10 倍）。传统 Attention 算完一步半成品就要跑回地下冷库放一次、再跑回来拿一次，时间全耽误在路上了！**FlashAttention** 则是把食材切成一盘一盘的小分块 (Tile)，端上案板后一口气切完炒完直接出锅，中间绝不往返地下冷库！',
        deepReadingParagraphsZh: [
          '在探讨 FlashAttention 之前，我们需要认识一下 GPU 芯片内部悬殊的“贫富差距”：以经典的 A100 显卡为例，它那高达 80GB 的主显存（HBM）虽然容量巨大，但读写带宽只有 1.5 TB/s；而在计算核心紧挨着的片上缓存（SRAM），虽然容量只有区区 20MB，读写带宽却高达惊人的 19 TB/s——整整快了十倍以上！',
          '遗憾的是，传统的标准 Self-Attention 写法完全无视了这一硬件特性。当序列长度 N 达到 8192 时，它会先算出整个 8192×8192 的注意力打分矩阵 S，由于片上案板（SRAM）装不下这么大的矩阵，只能把它写回遥远的地下冷库（HBM）；紧接着下一行代码要做 Softmax 了，又把它从冷库搬回案板，算完概率矩阵 P 再写回冷库；最后乘以 V 时，第三次从冷库搬出来！算力明明快如闪电，GPU 却在无休止的搬运等待中空转。',
          '斯坦福大学 Tri Dao 提出的 **FlashAttention** 彻底重写了这一过程：既然案板小，我们就把 Q、K、V 切成一块块能装进 SRAM 的小砖块（Tiles）。每次只端一小块 K 和 V 上案板，在案板上当场算完点积、当场做 Softmax 缩放、当场乘进输出累加器 O 里，全程不把中间的 N×N 矩阵写回 HBM！',
          '这里唯一的数学难题是：Softmax 需要知道整行所有数的最大值 m 和总和 l 才能做除法，如果只看到第 1 小块，怎么算全局 Softmax 呢？FlashAttention 引入了精妙的 **Online Softmax（在线重缩放递推）**：先按当前分块的最大值 m_1 算一个临时结果；等端上第 2 块发现更大的极值 m_2 时，只需给刚才的旧结果乘上一个修正系数 `exp(m_1 - m_2)`，就能在数学上分毫不差地无缝折算成新基准下的精确值！',
        ],
        guidedStepsZh: [
          '点击插图中的「👉 将下一块书简调入片上案板」，观察每个分块如何在 SRAM 内在线更新极值 m 与缩放系数 α',
        ],
        formulaBreakdownZh: [
          { symbol: 'm_new = max(m_old, rowmax(S_ij))', meaningZh: '每端来一盘新食材 (Tile)，看看有没有比之前更高的最高分 m' },
          { symbol: 'exp(m_old - m_new)', meaningZh: '在线重缩放因子：如果发现了新最高分，只需把之前算好的旧总和乘上这个系数就能无缝对齐！' },
          { symbol: 'O(N²) → O(N) HBM 访存', meaningZh: '彻底消灭巨大的 N×N 注意力中间矩阵落盘，显存读写减少 5~9 倍' },
        ],
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
        quiz: {
          questionZh: 'FlashAttention 相较于标准 Attention，总 FLOPs（浮点计算次数）和实际运行速度分别如何变化？',
          optionsZh: [
            'A. FLOPs 大幅减少，所以速度变快',
            'B. FLOPs 略微增加（因重缩放与反向重算），但因 HBM 显存读写减少 5–9 倍而显著加速',
            'C. FLOPs 不变，仅通过近似丢弃小权重加速',
            'D. 只减少显存占用，运行速度反而变慢',
          ],
          correctIndex: 1,
          explanationZh:
            '正确！Attention 是典型的 Memory-bound 算子，FlashAttention 用极少量的片上额外重缩放计算换取了数量级的 HBM 带宽节省，而且结果 100% 精确无损。',
        },
      },

      // ==================== AI-501 ====================
      'node-moe-router': {
        nodeId: 'node-moe-router',
        stageLevel: 4,
        animationKind: 'moe-routing',
        beginnerAnalogyZh:
          '🌱 小白大白话：传统稠密大模型像「让全医院所有科室的主任一起会诊每一次普通感冒」——虽然医术高，但每次出诊费贵得吓人！而 **MoE（混合专家模型）** 就像医院门口设了一个超聪明的「分诊台 (Router)」：先由一位全科医生（**常驻共享专家 S0**）看基本体征，再由分诊台根据你的问题是写代码、算数学还是聊金融，精准点名 2 位专科主任（**Top-K 路由专家**）出诊，其余专家安心休息！既有全院 671B 的顶级医术储备，每次挂号却只需付 37B 的算力账单！',
        deepReadingParagraphsZh: [
          '随着大模型向万亿参数迈进，传统“稠密模型（Dense Model）”撞上了一堵算力高墙：如果你把模型做到 6710 亿参数（671B），那么每生成一个字，全部 6710 亿个参数都得参与一次乘法运算，推理成本高昂得令人窒息。有没有办法既拥有浩如烟海的百科知识容量，每次说话时又只动用一小部分参数呢？',
          '这就引出了人类大脑的工作方式与 **MoE（Mixture of Experts，稀疏混合专家架构）**。就像你在阅读这段计算机文字时，大脑里负责视觉和逻辑的皮层高度活跃，而负责运动协调和听觉的区域则处于低功耗静息状态。MoE 把 Transformer 里最占参数的 FFN 前馈层拆成了几十甚至上百个独立的“专科专家子网络”，并在门口设立了一个轻量级的**门控分诊台（Router）**。',
          '以惊艳全球的 DeepSeek-V3 架构为例，它开创性地采用了「常驻共享专家 + 细粒度路由专家」设计：每个 Token 进来，都会固定经过“常驻全科专家 S0”（掌握通用语法与常识），同时门控分诊台根据当前词的特征打分，从 256 个专科专家里精准点名得分最高的 Top-K 个专家唤醒作答，其余两百多个专家本轮完全休眠（消耗 0 算力）！',
          '训练 MoE 最凶险的陷阱叫做「路由坍缩（Routing Collapse）」：分诊台很容易偷懒，不管什么问题都往最初稍微强一点的那一两个“网红专家”手里塞，导致网红专家累死、其他专家荒废。为此，现代 MoE 会给每个专家动态维护一个“负载均衡偏置项（Bias Term）”——哪个专家排队太挤，就自动把它的挂号门槛分调高一点点；哪个专家太清闲，就给它加一点补贴分，从而在不干扰主模型学习的前提下，让全院所有专家各司其职、百花齐放。',
        ],
        guidedStepsZh: [
          '点击插图中的不同领域词（代码 / 数学 / 硬件 / 金融），观察门控分诊台如何精准唤醒对应的专席学者',
        ],
        formulaBreakdownZh: [
          { symbol: 'SharedExpert(x)', meaningZh: '常驻全科专家：每个 Token 必经之路，负责通用语法与基础常识' },
          { symbol: 'TopK(Softmax(x·W_g + b))', meaningZh: '门控分诊台：给所有专科专家打分，加上负载均衡偏置 b 后挑出前 K 名' },
          { symbol: 'Active 37B / Total 671B', meaningZh: '总参数容量 6710 亿，但处理每个词实际只激活 370 亿参数（省去 94% 算力）' },
        ],
        coreMentalModel:
          '稀疏混合专家 (Sparse MoE) 将庞大的 FFN 拆分为多个独立 Expert 子网络。每个 Token 经过轻量级 Router 门控打分后，仅激活得分最高的 Top-K 个路由专家（加固定共享专家），实现「超大参数容量、超低单步推理FLOPs」。',
        keyTakeaways: [
          'DeepSeek-V2/V3 采用「细粒度专家切分 + 常驻共享专家 (Shared Expert)」，隔离通用知识与垂直领域知识',
          '若不加约束，Router 极易坍缩为只选少数几个专家（赢家通吃），导致其余专家闲置与跨卡通信拥塞',
          '通过 Auxiliary Load-Balancing Loss 或无辅助损失动态偏置 (Bias Term) 保证各专家负载均衡',
        ],
        codeOrFormulaSnippet:
          'y = SharedFFN(x) + sum_{i in TopK(Softmax(x @ W_g + bias))} g_i * RoutedExpert_i(x)',
        flashcards: [
          {
            q: '为什么 DeepSeekMoE 要把部分专家设为常驻激活的「共享专家 (Shared Experts)」？',
            a: '让共享专家专门承载高频通用语法与常识，释放路由专家的参数容量去专注长尾专业领域，避免多个路由专家重复学习通用知识。',
          },
        ],
        quiz: {
          questionZh: '在 MoE 训练中，如果某个专家的负载持续过高（热门专家坍缩），无辅助损失负载均衡策略会如何调节？',
          optionsZh: [
            'A. 直接删除该专家的网络权重',
            'B. 动态调低该热门专家的路由偏置项 b_i（或调高冷门专家偏置），引导后续 Token 分流',
            'C. 把所有 Token 都广播给全部专家',
            'D. 停止更新 Router 的全部参数',
          ],
          correctIndex: 1,
          explanationZh:
            '正确！通过动态微调每个专家的路由偏置项 bias，既能实现均匀负载分流，又避免了传统辅助损失干扰主语言模型损失梯度。',
        },
      },

      // ==================== AI-601 ====================
      'node-3d-parallel': {
        nodeId: 'node-3d-parallel',
        stageLevel: 4,
        animationKind: 'distributed-parallel',
        beginnerAnalogyZh:
          '🌱 小白大白话：训练大模型就像 8 个人合写一本巨型百科全书。如果按传统 **数据并行 (Baseline DP)**，8 个人桌上都得摆一套完整的字典、完整的草稿纸和完整的参考书（每张卡重复占 112GB 显存，瞬间爆显存！）。而 **ZeRO-1/2/3** 则是「8 个人把参考书、草稿纸和字典拆开，每人只管 1/8 页，谁写到哪一页大家临时传阅一下」，单卡显存直接从 112GB 暴降到 14.1GB！',
        deepReadingParagraphsZh: [
          '当我们来到本卷的终章，目光将投向驱动万卡集群日夜轰鸣的终极工程艺术——**分布式 3D 并行（TP/PP/DP）与 ZeRO 零冗余优化器**。很多人第一次算训练显存账时都会大吃一惊：一个 70 亿参数（7B）的模型，推理时明明只占 14GB 显存，为什么一开训练，连 80GB 的顶级显卡都会瞬间爆显存（OOM）？',
          '原因在于混合精度训练的“16 字节铁律”：每 1 个参数，除了要存 2 字节的 FP16 模型参数本身、2 字节的 FP16 梯度草稿之外，Adam 优化器为了精准控制下山步长，还得在后台存一份 4 字节的 FP32 主权重备份、4 字节的一阶动量和 4 字节的二阶方差——光优化器状态就占了整整 12 字节（占总体的 75%）！合起来 7B × 16B = 112 GB！',
          '在传统的**数据并行（Data Parallelism）**中，8 张显卡各自都在显存里一模一样地存了这 112GB 的全套家当，造成了极大的重复浪费。微软 DeepSpeed 团队提出的 **ZeRO（Zero Redundancy Optimizer）** 一举打破了这种冗余：既然 8 张卡存的东西一模一样，不如把它们拆成 8 份！**ZeRO-1** 先把占大头的 84GB 优化器底档拆成 8 份，每张卡只管 10.5GB，单卡显存立刻从 112GB 暴降到 38.5GB；**ZeRO-2** 顺手把 14GB 梯度草稿也拆成 8 份；**ZeRO-3（即 PyTorch FSDP）** 则连 14GB 模型参数也一并拆开，哪一层要算的时候再通过高速网络临时拼合，算完即焚，让单卡显存直接降到 14.1GB！',
          '而在超大规模集群中，架构师会将三种并行编织成精密的三维网格：在单台服务器内部 8 张卡之间，利用高达 900 GB/s 的 NVLink 超高速总线做 **张量并行（TP，把单个矩阵乘法横竖切开同算）**；跨服务器之间，用 **流水线并行（PP，每台机器管几层，用 1F1B 微批次交错调度压扁空闲等待气泡）** 与 **ZeRO 数据并行（DP）** 协同扩展。这，就是当代人类构建超级人工智能帝国的工程底座。',
        ],
        guidedStepsZh: [
          '点击插图中的「各自备全套 / ZeRO-1 / ZeRO-2 / ZeRO-3」，观察三大卷宗显存如何从 112GB 逐级分摊降至 14.1GB',
        ],
        formulaBreakdownZh: [
          { symbol: '2B + 2B + 12B = 16B/param', meaningZh: '混合精度下每个参数占 16 字节：FP16 参数 2B + FP16 梯度 2B + FP32 Adam 状态 12B' },
          { symbol: 'ZeRO-1 / 2 / 3', meaningZh: '分别按数据并行卡数 N 切分：1 阶切优化器(12B)、2 阶加切梯度(2B)、3 阶连参数(2B)一起切' },
          { symbol: 'Bubble = (P - 1) / (P - 1 + M)', meaningZh: '流水线空闲气泡占比：微批次数 M 越多，GPU 空等气泡越小' },
        ],
        coreMentalModel:
          '大模型分布式训练需协同三大维度：张量并行 (TP) 切分单层矩阵乘（需极高带宽 NVLink）、流水线并行 (PP) 按层切分模型并通过 1F1B 微批次调度压缩气泡、数据并行 (DP + ZeRO-1/2/3) 切分优化器状态/梯度/参数以消除冗余副本。',
        keyTakeaways: [
          '混合精度训练下，1B 参数模型仅模型状态就占 16 Bytes/param（FP16 参数 2B + 梯度 2B + FP32 Adam 状态 12B）',
          'ZeRO-1 切分优化器状态（省 4x），ZeRO-2 切分优化器+梯度（省 8x），ZeRO-3 连参数一并切分（线性随卡数缩减）',
          '1F1B 流水线调度让前向与反向微批次交错执行，气泡率等于 (P - 1) / (P - 1 + M)',
        ],
        codeOrFormulaSnippet:
          'BubbleRatio = (PP_Stages - 1) / (PP_Stages - 1 + MicroBatches);  ModelStateBytes = Params * (2 + 2 + 12 / ZeRO_Factor)',
        flashcards: [
          {
            q: '为什么张量并行 (TP) 通常限制在单机 8 卡 NVLink 内部，而不跨机使用？',
            a: '因为 TP 在每一层的 Attention 和 MLP 前向/反向中都需要高频 AllReduce 同步激活值，跨机网卡带宽远低于 NVLink，通信延迟会成为严重瓶颈。',
          },
        ],
        quiz: {
          questionZh: '在 FP16 + Adam 混合精度训练中，每 1 个参数对应的 16 Bytes 模型状态里，占比最大的是哪一部分？',
          optionsZh: [
            'A. FP16 模型参数本身（2 Bytes）',
            'B. FP16 梯度（2 Bytes）',
            'C. FP32 优化器状态（Master Weights 4B + Momentum 4B + Variance 4B = 共 12 Bytes，占 75%）',
            'D. 随机数种子（16 Bytes）',
          ],
          correctIndex: 2,
          explanationZh:
            '正确！Adam 优化器状态占了整整 12 Bytes（75%），因此 ZeRO-1 仅切分优化器状态就能立竿见影节省大半显存且通信开销极小。',
        },
      },
    },
  },
  {
    id: 'pack-cs-systems',
    domainId: 'cs-systems',
    icon: '核',
    titleZh: '计算机底层与分布式一致性离线包',
    titleEn: 'CS Systems & Distributed Consensus Pack',
    version: 'v1.3',
    sizeKb: 28,
    nodeCount: 2,
    localFilePath: 'knowledge-packs/cs-systems-consensus.pack.json',
    descriptionZh: '含 CSAPP 存储器山、Cache Line 伪共享剖析、Raft 任期状态机及 Local-First 离线同步设计。',
    chapters: {
      'node-cuda-mem': {
        nodeId: 'node-cuda-mem',
        stageLevel: 2,
        beginnerAnalogyZh:
          '🌱 小白大白话：CPU 算数据就像木匠干活——寄存器和 L1 缓存是木匠「围裙口袋里的螺丝刀」（1 秒钟就能拿到），而内存条是「100 米外仓库里的工具箱」。如果每次只拿一颗螺丝钉就跑一趟仓库，时间全浪费在跑路上了！所以 CPU 每次去仓库都会顺手把一整排工具盒（64 字节 Cache Line）一起端过来！',
        deepReadingParagraphsZh: [
          '在《深入理解计算机系统（CSAPP）》著名的“存储器山（Memory Mountain）”一章中，揭示了现代计算机硬件最深刻的矛盾：过去三十年里，CPU 算加减乘除的速度翻了几千倍，但主内存（DRAM）读取数据的延迟却只提升了几倍。这导致处理器绝大部分时间都在苦苦等待数据从内存路上赶来。',
          '为了弥合这道鸿沟，硬件设计师在 CPU 核心内部修筑了 L1、L2、L3 三级高速缓存（Cache），并定下了一条铁律：CPU 和内存打交道时，绝不按单字节零星拿取，而是每次固定抓取连续的 **64 字节（这叫一个 Cache Line 缓存行）**。这就意味着，如果你按顺序遍历一个数组（步长为 1），拿第 1 个元素时顺便就把后面 15 个整数全揣进围裙口袋了（空间局部性极佳）；反之如果乱序跳跃访问，每次都要重新跑一趟仓库。',
          '然而，这个贴心的“64 字节整排端”机制在多核并发编程时却可能引发隐蔽的性能杀手——**伪共享（False Sharing）**。假如线程 A 只修改变量 X，线程 B 只修改变量 Y，逻辑上它俩井水不犯河水；但偏偏 X 和 Y 在内存里挨在一起，被装进了同一个 64 字节的 Cache Line 里！结果核心 1 改一下 X，硬件缓存一致性协议（MESI）就会强行把核心 2 手里的整排工具盒判为作废；核心 2 改一下 Y，又把核心 1 的工具盒判为作废。两个核心在硬件层面疯狂互扇耳光，性能暴跌十倍以上！解法也非常优雅：用 `alignas(64)` 给变量做 64 字节对齐填充，让它们各自独占一排工具盒。',
        ],
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
        quiz: {
          questionZh: '消除多核并发计数器伪共享 (False Sharing) 最直接的工程手段是什么？',
          optionsZh: [
            'A. 把变量声明为全局变量',
            'B. 使用 alignas(64) 对齐填充或每个线程先在 Thread-Local 变量累加最后汇总',
            'C. 降低 CPU 主频',
            'D. 把 int64_t 改成 int8_t',
          ],
          correctIndex: 1,
          explanationZh: '正确！64 字节对齐填充可确保不同核心高频写的原子变量落在不同 Cache Line 上。',
        },
      },
      'node-raft': {
        nodeId: 'node-raft',
        stageLevel: 3,
        beginnerAnalogyZh:
          '🌱 小白大白话：两台断网的手机各自记了 5 笔账，连上 Wi-Fi 后怎么合并才不会打架？秘诀是给每笔账单发一个全球唯一的身份证号 (UUID) 和时间戳，合并时「遇到相同身份证号只留一份（幂等律），不同身份证号全收下再按时间排队（交换律）」——不管谁先发给谁，两边算出来的总账永远一模一样！这就是 CRDT 无冲突合并！',
        deepReadingParagraphsZh: [
          '当我们构建像本应用这样的「离线优先（Local-First）」个人工作台时，一个核心架构命题是：如何在完全不依赖中心化内网服务器的前提下，保证手机端、桌面端和备份文件之间的数据在任意断网、修改、重连后都能无损收敛到一致状态？',
          '在云端数据中心内部，工程师通常采用 **Raft 共识算法**：选出唯一的一个 Leader 节点负责接收写请求，只有当超过半数（Quorum）节点把日志落盘确认后，才算提交成功。但这种模式要求节点时刻在线——一旦你在飞机上或地下室断了网，系统就没法写了。',
          '而面向个人多端协同的 Local-First 软件，则广泛采用 **CRDT（无冲突复制数据类型）**。它的数学之美在于：只要我们把状态合并函数 `merge(A, B)` 设计成同时满足**交换律**（A并B 等于 B并A）、**结合律**与**幂等律**（自己并自己两次结果不变，即按唯一 ID 去重 + 按逻辑时钟最后更新时间 LWW 决胜），那么无论两台设备离线改了多久、无论同步包按什么顺序到达，合并后的最终账本在数学上必然 100% 严格一致！',
        ],
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
        quiz: {
          questionZh: '状态型 CRDT (CvRDT) 的合并函数 merge(A, B) 必须满足哪三条数学性质？',
          optionsZh: [
            'A. 交换律、结合律、幂等律 (Commutative, Associative, Idempotent)',
            'B. 线性、正交、可逆',
            'C. 单调递减、有界、连续',
            'D. 仅需满足先进先出 (FIFO)',
          ],
          correctIndex: 0,
          explanationZh:
            '正确！满足交换律、结合律与幂等律后，无论副本消息乱序、重复送达还是离线重连，最终状态必然一致。',
        },
      },
    },
  },
  {
    id: 'pack-wealth-quant',
    domainId: 'wealth-quant',
    icon: '财',
    titleZh: '家庭量化配置与复利模型离线包',
    titleEn: 'Household Quant & Compounding Pack',
    version: 'v1.2',
    sizeKb: 22,
    nodeCount: 1,
    localFilePath: 'knowledge-packs/wealth-quant-compounding.pack.json',
    descriptionZh: '含凯利公式仓位控制、定投复利微分方程、恩格尔与拿铁因子诊断标准及双人合池预算模型。',
    chapters: {
      'node-kelly-dca': {
        nodeId: 'node-kelly-dca',
        stageLevel: 2,
        beginnerAnalogyZh:
          '🌱 小白大白话：为什么投资里「少亏钱」比「某一年暴赚」更重要？假如你有 10 万块，第一年跌了 50% 变成 5 万，第二年就算涨了 50% 也只有 7.5 万（还倒亏 25%）！这就叫「波动率税」。所以家庭理财最稳的滚雪球公式是：每月发工资先存下固定定投（本金引擎）+ 股债均衡控制最大回撤！',
        deepReadingParagraphsZh: [
          '在华尔街与量化投资界，有一条被称为“复利第一铁律”的数学不等式：**几何平均收益率永远小于或等于算术平均收益率（g ≈ μ - σ²/2）**。公式里的 `σ²/2` 有一个形象的名字——**波动率税（Volatility Drag）**。',
          '为什么波动本身会吞噬你的财富？设想两个组合：组合 A 第一年暴涨 +80%，第二年暴跌 -50%，算术平均每年还赚 +15%，但實際上 100 万本金先变 180 万再腰斩成 90 万，两年下来反而倒亏 10%！而组合 B 每年稳稳增值 +10%，两年后变成 121 万，轻松跑赢暴涨暴跌的组合 A。这就是为什么巴菲特反复强调：“投资的第一条准则是不要亏钱，第二条准则是永远记住第一条。”',
          '落回到我们每个月的家庭资产管理中，真正的财富飞轮由两个齿轮啮合驱动：第一齿轮是**月度净储蓄率（Saving Rate）**——通过双人共同生活合池记账、隔离大额心愿单与拿铁因子，把每月发薪后的固定定投当作“必须最先支付给未来自己的账单”；第二齿轮是**低回撤资产配置**——通过宽基指数、红利资产与国债/现金底仓的动态再平衡（低买高卖），在保住家庭安全边际的前提下，静待复利指数曲线的拐点到来。',
        ],
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
        quiz: {
          questionZh: '若某投资组合第一年下跌 50%，第二年上涨 50%，两年累计收益率为多少？',
          optionsZh: ['A. 0%（不亏不赚）', 'B. -25%（本金仅剩 75%）', 'C. +25%', 'D. -10%'],
          correctIndex: 1,
          explanationZh:
            '正确！1.0 × (1 - 0.5) × (1 + 0.5) = 0.75，亏损 25%。这就是「波动率税」的直观体现，控制最大回撤至关重要。',
        },
      },
    },
  },
];

// ============================================================================
// ★ BUILT-IN CURATED HIGH-SIGNAL NEWS & LONG-FORM DIGEST LIBRARY (书院晨报)
// ============================================================================

export const DEFAULT_NEWS_FILTER: NewsFilterOptions = {
  category: 'all',
  minSignalScore: 80,
  readingDepth: 'all',
  searchQuery: '',
  mutedKeywordsCsv: '震惊, 暴富, 必看, 割韭菜',
  onlyBookmarked: false,
  hideRead: false,
};

export const DEFAULT_NEWS_DIGEST_ITEMS: readonly NewsDigestItem[] = [
  {
    id: 'news-deepseek-r1-grpo',
    categoryId: 'ai-frontier',
    sourceName: 'AI 架构精读 · 深度长文',
    publishedAt: '2026-11-03',
    readMinutes: 6,
    signalScore: 98,
    titleZh: '深度拆解：为什么纯强化学习 (GRPO) 能让大模型自发涌现「慢思考与自我纠错」？',
    summaryZh:
      '告别昂贵的人工思维链标注与 Critic 价值网络，用组内相对奖励基线与可验证规则激发模型在 <think> 草稿纸上的顿悟时刻。',
    paragraphsZh: [
      '过去两年里，行业训练大模型推理能力的标准流水线一直是“收集人类专家写的解题步骤做监督微调（SFT）”。然而人类写下的成稿往往是润色后的最终正确路径，省略了中间大量试错、碰壁和推倒重来的真实思考过程。模型死记硬背这些步骤后，一旦遇到稍微变形的陌生难题就会束手无策。',
      '以 DeepSeek-R1 为代表的新一代推理模型彻底扭转了这一范式：它不再规定模型“每一步必须怎么想”，而是把模型放进纯粹的强化学习赛场中，只对最终结果是否算对（以及格式是否规范）发放硬性规则奖励。通过 GRPO（群组相对策略优化），系统针对同一道题让模型并行写出 8 份不同的思考草稿，直接拿这 8 份草稿的平均分作为基线，奖励高于平均分的探索路径。',
      '令人振奋的现象在训练中期出现了：模型自己发现，那些在 `<think>` 标签里多花几百个词去检查边界条件、甚至写下“不对，刚才的假设有漏洞，我换个方向重算一次”的草稿，最终拿到正确结果的概率远高于一味闷头往下写的草稿！于是，“自我反思、回溯验算、分情况讨论”这些原本被认为只有人类高阶意识才具备的元认知能力，在强化学习的自然选择下自发涌现了出来。',
    ],
    keyTakeawaysZh: [
      '测试时计算扩展 (Test-Time Scaling)：用推理阶段的思考 Token 长度换取数量级的逻辑准确率提升',
      'GRPO 用组内采样均值替代庞大的 Critic 价值网络，节省近 50% 训练显存',
      '长思维链能力可通过蒸馏 (Distillation) 迁移给端侧 7B/14B 轻量模型',
    ],
    tags: ['DeepSeek', 'GRPO', '强化学习', '思维链', '慢思考'],
    relatedNodeCode: 'AI-109',
    bookmarked: true,
    read: false,
  },
  {
    id: 'news-mcp-agent-architecture',
    categoryId: 'ai-frontier',
    sourceName: '开源协议观察 · 技术简报',
    publishedAt: '2026-11-03',
    readMinutes: 5,
    signalScore: 95,
    titleZh: 'MCP (Model Context Protocol) 演进：为什么说它是 AI Agent 时代的 USB-C 接口？',
    summaryZh:
      '通过标准化的 Resources、Tools 与 Prompts 三大原语，让大模型在不耦合任何私有内网的前提下，安全连接本地文件与工具链。',
    paragraphsZh: [
      '在 AI Agent 落地早期，每家工具厂商和每个本地应用都要为不同的大模型单独编写一套胶水代码（Glue Code）：连本地 SQLite 要写一套插件，连 Git 仓库又要写另一套接口，不仅维护成本极高，还容易引入权限泄露风险。',
      'MCP（模型上下文协议）的核心贡献，是将“AI 大脑”与“本地数据/工具”彻底解耦。任何本地数据源只需按照 JSON-RPC 标准暴露三类能力：只读的数据上下文（Resources，如读取本地 Markdown 笔记）、可执行的操作函数（Tools，如运行单测或记一笔账）、以及预置的工作流模板（Prompts）。',
      '对于追求极致隐私与离线可控的开发者而言，基于 stdio（标准输入输出管道）运行的本地 MCP Server 全程在用户本机沙箱进程内通信，无需经过任何第三方云端中转，真正实现了零内网耦合与数据主权可控。',
    ],
    keyTakeawaysZh: [
      '三大核心原语：Resources（读数据）、Tools（调动作）、Prompts（标准模板）',
      '本地 stdio 传输模式天然支持 100% 离线沙箱通信，零外部网络暴露',
      '一次编写 MCP Server，即可被所有兼容客户端即插即用复用',
    ],
    tags: ['Agent', 'MCP', '开源协议', 'Local-First'],
    relatedNodeCode: 'AI-108',
    bookmarked: true,
    read: false,
  },
  {
    id: 'news-vllm-flashinfer-kv',
    categoryId: 'sys-open',
    sourceName: 'Systems & GPU 周刊',
    publishedAt: '2026-11-02',
    readMinutes: 7,
    signalScore: 94,
    titleZh: '端侧与服务端推理加速新进展：从 PagedAttention、MLA 到 INT4 KV Cache 量化',
    summaryZh:
      '当上下文窗口扩展到 128K 时，如何通过多头潜在注意力 (MLA) 低秩压缩与 FP4/INT4 量化把显存占用再砍掉 75%？',
    paragraphsZh: [
      '在长文本推理（如一次读完一整本代码库或长篇财报）场景下，制约吞吐量的最大瓶颈早已从模型权重转移到了随序列长度线性膨胀的 KV Cache 上。vLLM 的 PagedAttention 解决了显存碎片浪费问题，但每个 Token 实打实的 KV 向量体积依然庞大。',
      '新一代系统优化正从两个维度同时突围：其一是架构层的 **MLA（Multi-head Latent Attention，多头潜在注意力）**，它将原本庞大的 Key 和 Value 矩阵联合投影压缩进一个极低维度的潜在向量（Latent Vector）中缓存，推理时再动态吸收进权重矩阵，直接把 KV Cache 体积压缩了 80% 以上；其二是算子层的 **KV Cache INT4/FP8 在线量化**，配合 FlashAttention 片上反量化流水线，让单张消费级显卡也能轻松承载超长上下文并发。',
    ],
    keyTakeawaysZh: [
      'PagedAttention 消灭了碎片，而 MLA 与 KV 量化则直接缩小了每个 Token 的缓存字节数',
      '片上 SRAM 即时反量化（On-the-fly Dequantization）避免了显存带宽瓶颈',
    ],
    tags: ['vLLM', 'PagedAttention', 'MLA', '量化', 'CUDA'],
    relatedNodeCode: 'AI-201',
    bookmarked: false,
    read: false,
  },
  {
    id: 'news-local-first-sqlite-crdt',
    categoryId: 'sys-open',
    sourceName: '架构师书斋 · 工程哲学',
    publishedAt: '2026-11-02',
    readMinutes: 6,
    signalScore: 92,
    titleZh: 'Local-First 本地优先软件宣言：为什么真正属于你自己的个人工具不应该绑架在云端？',
    summaryZh:
      '借鉴 Ink & Switch 实验室的七大准则：零网络延迟响应、断网完全可用、长久的文件寿命与基于 CRDT 的多端无损同步。',
    paragraphsZh: [
      '你是否有过这样的经历：几年前认真记在某个云端笔记或记账 App 里的珍贵数据，因为厂商停服、涨价或网络抽风，突然再也打不开了？传统的云端 SaaS 软件把服务端数据库当作“唯一真相源”，用户手里的客户端只是一个脆弱的远程显示器。',
      '由开源先驱 Ink & Switch 提出的 **Local-First（本地优先）** 架构哲学给出了截然不同的答案：用户设备本地的存储（如 SQLite、IndexedDB 与本地 JSON/CSV 沙箱）才是一等公民！每一次点击、记账、写批注都在本机毫秒级完成，哪怕拔掉网线飞往大洋彼岸，软件的每一项核心功能都分毫不损。',
      '同时，通过开放透明的 `.json` / `.csv` / `.md` 导出标准与幂等集合合并算法，你的心血数据可以随时打包带走、放入 Git 仓库长久保存，哪怕十年后再打开依然清晰可读。',
    ],
    keyTakeawaysZh: [
      '本机存储是一等公民：0 毫秒网络等待、100% 离线可用、零内网耦合',
      '开放格式备份（JSON / CSV / Markdown）保证数据跨越十年的长久可读性',
    ],
    tags: ['Local-First', 'CRDT', '架构哲学', '隐私安全'],
    relatedNodeCode: 'SYS-202',
    bookmarked: true,
    read: false,
  },
  {
    id: 'news-quant-barbell-dca',
    categoryId: 'wealth-macro',
    sourceName: '家庭量化笔记 · 资产配置',
    publishedAt: '2026-11-01',
    readMinutes: 5,
    signalScore: 93,
    titleZh: '纳西姆·塔勒布「杠铃策略」在家庭理财中的实践：90% 极度稳健底仓 + 10% 高赔率成长',
    summaryZh:
      '远离“中等风险、平庸收益”的脆弱资产，用稳固的家庭储蓄现金流与红利/国债底仓抵御黑天鹅，同时保留捕捉时代红利的期权。',
    paragraphsZh: [
      '在《反脆弱》与《黑天鹅》中，纳西姆·塔勒布提出了一个反直觉却历经市场检验的配置法则——**杠铃策略（Barbell Strategy）**。他指出，现实世界中的极端风险往往难以用正态分布预测，最危险的做法恰恰是把全部资金投进“看似稳健、实则暗藏回撤风险”的单一中等风险资产里。',
      '杠铃的一端（占家庭资产的 80%~85%）应当极其保守稳固：包括 6 个月家庭刚需备用金、低波动红利资产与储蓄国债，确保无论宏观环境如何剧烈波动，家庭生活品质与双人合池预算都稳如磐石，永远不会被迫在市场底部割肉变现。',
      '杠铃的另一端（占 15%~20%）则配置长期高成长的宽基指数与科技生产力资产，并配合每月的工资现金流定投。因为左端底仓给了你充足的心理安全感，你才能在市场情绪恐慌时从容逆向定投，吃满长期复利的微笑曲线。',
    ],
    keyTakeawaysZh: [
      '杠铃配置：左端 85% 现金流/红利安全底仓防黑天鹅 + 右端 15% 高成长定投博取长期复利',
      '充足的家庭应急底仓是避免在市场底部被迫止损出局的最大护城河',
    ],
    tags: ['杠铃策略', '资产配置', '定投', '反脆弱', '复利'],
    relatedNodeCode: 'FIN-101',
    bookmarked: false,
    read: false,
  },
  {
    id: 'news-deep-essay-deliberate-practice',
    categoryId: 'deep-essay',
    sourceName: '书院长文 · 认知科学',
    publishedAt: '2026-10-31',
    readMinutes: 8,
    signalScore: 96,
    titleZh: '《刻意练习》与费曼学习法精读：为什么「低水平勤奋刷时长」不如一次「主动复述与建模」？',
    summaryZh:
      '从被动高亮划线的虚假获得感，走向构建心智模型（Mental Models）、间隔重复闪卡与费曼白话拆解的深度学习闭环。',
    paragraphsZh: [
      '认知心理学家安德斯·艾利克森在研究各领域顶尖专家时发现：单纯机械地重复某件事一万小时，并不会让人自动成为大师；真正拉开差距的，是始终处于“舒适区边缘（学习区）”的**刻意练习（Deliberate Practice）**。',
      '在阅读与技术学习中，最常见的陷阱就是“被动阅读幻觉”——一口气收藏了五十篇长文、拿荧光笔画满了整页书，合上书本却连最核心的三个因果链条都复述不出来。这是因为大脑把“看这行字很眼熟”误当成了“我已经掌握了它的推导逻辑”。',
      '物理学家理查德·费曼生前推崇的学习法则恰好是破除这种幻觉的利器：每学完一个新概念，假装面前坐着一位完全没有背景知识的朋友，试着用最朴素的生活比喻和三句话把它的来龙去脉讲清楚；哪里卡壳讲不顺，哪里就是你知识图谱里真正的盲区。这也是为什么我们在「星途书院」的每一章里，都坚持以大白话比喻开篇、以可拨动的插图验证、以你亲手写下的页边手札收尾。',
    ],
    keyTakeawaysZh: [
      '警惕被动收藏与机械划线的“熟悉度幻觉”，用主动提取（自测与闪卡）强化神经突触连接',
      '费曼检验标准：能否脱口讲出一个无需专业术语的生活比喻',
    ],
    tags: ['刻意练习', '费曼学习法', '心智模型', '深度阅读'],
    relatedNodeCode: 'AI-001',
    bookmarked: true,
    read: false,
  },
  {
    id: 'news-noisy-clickbait-sample',
    categoryId: 'ai-frontier',
    sourceName: '网络营销号汇总',
    publishedAt: '2026-11-01',
    readMinutes: 2,
    signalScore: 42,
    titleZh: '震惊！明天程序员将全部失业？学会这3个必看咒语轻松躺赚暴富！',
    summaryZh: '典型贩卖焦虑与标题党低信噪比水文示例（默认会被书院晨报的「高信噪比 ≥80」与「静音词黑名单」自动拦截过滤）。',
    paragraphsZh: [
      '这是一篇用于演示「智能信噪比与黑名单过滤器」的低质量噪音文章样本。当开启信噪比过滤（≥80）或静音词（如“震惊、暴富、必看”）时，此类营销噪音会被自动清出你的书房视野。',
    ],
    keyTakeawaysZh: ['低信噪比营销水文，已被智能过滤器识别'],
    tags: ['营销噪音', '标题党'],
    bookmarked: false,
    read: false,
  },
];

export const KNOWLEDGE_STORAGE_KEY = 'viastela.knowledge_graph.v1';

// ============================================================================
// ★ SMART NEWS FILTER & CLIPPER ENGINE FUNCTIONS
// ============================================================================

/**
 * Computes a Signal-to-Noise Score (0..100) for any article text based on
 * technical/analytical depth vs clickbait hype words.
 */
export function scoreArticleSignalToNoise(input: {
  title: string;
  body: string;
}): {
  signalScore: number;
  estimatedReadMinutes: number;
  detectedNoiseWords: string[];
  detectedSignalKeywords: string[];
} {
  const combined = `${input.title} ${input.body}`;
  const noisePool = ['震惊', '暴富', '必看', '割韭菜', '躺赚', '颠覆人类', '速看', '删前速看', '99%的人不知道'];
  const signalPool = [
    'Attention',
    'Transformer',
    'KV',
    '显存',
    '量化',
    'LoRA',
    'RAG',
    'Agent',
    'MCP',
    'GRPO',
    '分布式',
    '架构',
    '复利',
    '回撤',
    '夏普',
    '定投',
    'CRDT',
    '缓存',
    '推理',
    '模型',
    '算法',
  ];

  const detectedNoiseWords = noisePool.filter((w) => combined.includes(w));
  const detectedSignalKeywords = signalPool.filter((w) =>
    combined.toLowerCase().includes(w.toLowerCase()),
  );

  let score = 82;
  score += Math.min(16, detectedSignalKeywords.length * 4);
  score -= detectedNoiseWords.length * 18;
  if (input.body.length > 300) score += 4;
  const signalScore = Math.max(15, Math.min(99, score));
  const estimatedReadMinutes = Math.max(2, Math.min(25, Math.ceil(combined.length / 220)));

  return {
    signalScore,
    estimatedReadMinutes,
    detectedNoiseWords,
    detectedSignalKeywords,
  };
}

/**
 * Multi-dimensional News & Digest Filter
 */
export function filterNewsDigestItems(
  items: readonly NewsDigestItem[],
  filter: NewsFilterOptions,
): {
  visibleItems: NewsDigestItem[];
  filteredOutNoiseCount: number;
  totalCount: number;
} {
  const mutedList = filter.mutedKeywordsCsv
    .split(/[,，;；\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const query = filter.searchQuery.trim().toLowerCase();

  let filteredOutNoiseCount = 0;
  const visibleItems: NewsDigestItem[] = [];

  for (const item of items) {
    const textBlob = `${item.titleZh} ${item.summaryZh} ${item.tags.join(' ')}`.toLowerCase();
    const hitsMutedWord = mutedList.some((mw) => textBlob.includes(mw));
    const belowSignal = item.signalScore < filter.minSignalScore;

    if (hitsMutedWord || belowSignal) {
      filteredOutNoiseCount += 1;
      continue;
    }
    if (filter.category !== 'all' && item.categoryId !== filter.category) continue;
    if (filter.onlyBookmarked && !item.bookmarked) continue;
    if (filter.hideRead && item.read) continue;
    if (filter.readingDepth === 'quick' && item.readMinutes > 5) continue;
    if (filter.readingDepth === 'deep' && item.readMinutes < 6) continue;
    if (query && !textBlob.includes(query)) continue;

    visibleItems.push(item);
  }

  return {
    visibleItems,
    filteredOutNoiseCount,
    totalCount: items.length,
  };
}

/**
 * Clips a custom article / RSS text into the clean Book-Style News Reader
 */
export function clipCustomNewsArticle(input: {
  title: string;
  categoryId: NewsCategoryId;
  sourceName?: string;
  rawText: string;
}): {
  state: KnowledgeGraphState;
  addedItem: NewsDigestItem;
} {
  const cur = readKnowledgeGraphState();
  const cleanTitle = input.title.trim() || '自定义剪藏长文精读';
  const rawBody = input.rawText.trim() || cleanTitle;
  const paragraphs = rawBody
    .split(/\r?\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const scored = scoreArticleSignalToNoise({ title: cleanTitle, body: rawBody });
  const newItem: NewsDigestItem = {
    id: `news-clip-${Date.now()}`,
    categoryId: input.categoryId,
    sourceName: input.sourceName?.trim() || '个人剪藏净读',
    publishedAt: new Date().toISOString().slice(0, 10),
    readMinutes: scored.estimatedReadMinutes,
    signalScore: scored.signalScore,
    titleZh: cleanTitle,
    summaryZh: (paragraphs[0] ?? cleanTitle).slice(0, 90),
    paragraphsZh: paragraphs.length > 0 ? paragraphs : [cleanTitle],
    keyTakeawaysZh: paragraphs.slice(0, 3).map((p) => p.slice(0, 72)),
    tags: scored.detectedSignalKeywords.length > 0 ? scored.detectedSignalKeywords.slice(0, 4) : ['个人剪藏', '深度阅读'],
    bookmarked: true,
    read: false,
  };

  const existingNews = cur.newsItems ?? [...DEFAULT_NEWS_DIGEST_ITEMS];
  const next = writeKnowledgeGraphState({
    ...cur,
    newsItems: [newItem, ...existingNews],
  });
  return { state: next, addedItem: newItem };
}

export function toggleNewsItemStatus(
  itemId: string,
  field: 'bookmarked' | 'read',
): KnowledgeGraphState {
  const cur = readKnowledgeGraphState();
  const existingNews = cur.newsItems ?? [...DEFAULT_NEWS_DIGEST_ITEMS];
  const nextNews = existingNews.map((item) =>
    item.id === itemId ? { ...item, [field]: !item[field] } : item,
  );
  return writeKnowledgeGraphState({
    ...cur,
    newsItems: nextNews,
  });
}

export function updateNewsFilterOptions(
  patch: Partial<NewsFilterOptions>,
): KnowledgeGraphState {
  const cur = readKnowledgeGraphState();
  const nextFilter: NewsFilterOptions = {
    ...(cur.newsFilter ?? DEFAULT_NEWS_FILTER),
    ...patch,
  };
  return writeKnowledgeGraphState({
    ...cur,
    newsFilter: nextFilter,
  });
}

// ============================================================================
// ★ STAGE 1 BEGINNER SIMULATIONS (AI-001 ~ AI-004) & STAGE 3 SIMULATIONS (AI-105, AI-701)
// ============================================================================

/**
 * Interactive Simulation AI-001: Tokenization & Next-Token Probability Solitaire
 */
export function computeTokenNextWordSimulation(input: {
  generatedStep: number;
  samplingMode: 'greedy' | 'top-p';
}): {
  baseTokens: { text: string; id: number; color: string }[];
  generatedTokens: { text: string; id: number; probPct: number }[];
  candidates: { token: string; tokenId: number; probPct: number; chosen: boolean }[];
  fullSentence: string;
  stepDescZh: string;
} {
  const baseTokens = [
    { text: '学习', id: 1024, color: '#38bdf8' },
    { text: 'AI', id: 2048, color: '#f5b942' },
    { text: '最棒的', id: 4096, color: '#34d399' },
    { text: '方式', id: 5120, color: '#f472b6' },
    { text: '是', id: 618, color: '#a78bfa' },
  ];

  const greedyPath = [
    {
      chosen: { text: '动手', id: 7301, probPct: 54 },
      pool: [
        { token: '动手', tokenId: 7301, probPct: 54 },
        { token: '边玩', tokenId: 7399, probPct: 26 },
        { token: '阅读', tokenId: 8102, probPct: 14 },
        { token: '背诵', tokenId: 9011, probPct: 6 },
      ],
    },
    {
      chosen: { text: '交互', id: 8821, probPct: 61 },
      pool: [
        { token: '交互', tokenId: 8821, probPct: 61 },
        { token: '拆解', tokenId: 8840, probPct: 24 },
        { token: '写码', tokenId: 8901, probPct: 10 },
        { token: '刷题', tokenId: 9100, probPct: 5 },
      ],
    },
    {
      chosen: { text: '看动画', id: 9527, probPct: 68 },
      pool: [
        { token: '看动画', tokenId: 9527, probPct: 68 },
        { token: '做实验', tokenId: 9600, probPct: 20 },
        { token: '画图谱', tokenId: 9712, probPct: 9 },
        { token: '记笔记', tokenId: 9805, probPct: 3 },
      ],
    },
    {
      chosen: { text: '！', id: 101, probPct: 88 },
      pool: [
        { token: '！', tokenId: 101, probPct: 88 },
        { token: '。', tokenId: 102, probPct: 10 },
        { token: '~', tokenId: 103, probPct: 2 },
      ],
    },
  ];

  const topPPath = [
    {
      chosen: { text: '边玩', id: 7399, probPct: 26 },
      pool: greedyPath[0]!.pool,
    },
    {
      chosen: { text: '拆解', id: 8840, probPct: 24 },
      pool: greedyPath[1]!.pool,
    },
    {
      chosen: { text: '做实验', id: 9600, probPct: 20 },
      pool: greedyPath[2]!.pool,
    },
    {
      chosen: { text: '！', id: 101, probPct: 88 },
      pool: greedyPath[3]!.pool,
    },
  ];

  const path = input.samplingMode === 'greedy' ? greedyPath : topPPath;
  const step = Math.max(0, Math.min(path.length - 1, input.generatedStep));
  const generatedTokens = path.slice(0, step + 1).map((p) => p.chosen);
  const currentStepData = path[step]!;
  const candidates = currentStepData.pool.map((c) => ({
    ...c,
    chosen: c.token === currentStepData.chosen.text,
  }));

  const fullSentence =
    baseTokens.map((t) => t.text).join('') + generatedTokens.map((t) => t.text).join('');

  return {
    baseTokens,
    generatedTokens,
    candidates,
    fullSentence,
    stepDescZh: `第 ${step + 1}/4 步接龙：模型看到前文「${baseTokens.map((t) => t.text).join('')}${generatedTokens
      .slice(0, -1)
      .map((t) => t.text)
      .join('')}」，通过 ${
      input.samplingMode === 'greedy' ? 'Greedy 贪婪选择最高概率词' : 'Top-P 核采样抽中高潜创意词'
    } 吐出 Token「${currentStepData.chosen.text} (#${currentStepData.chosen.id}, 概率 ${currentStepData.chosen.probPct}%)」，并将其拼回句尾准备猜下一个词！`,
  };
}

/**
 * Interactive Simulation AI-002: Word Embedding 2D Semantic Galaxy & Vector Arithmetic
 */
export function computeWordEmbeddingSimulation(input: {
  clusterId: 'pets' | 'coffee' | 'tech';
  showRoyaltyAnalogy: boolean;
}): {
  points: {
    word: string;
    x: number;
    y: number;
    dims: [number, number, number];
    color: string;
  }[];
  cosineSimilarity: number;
  pairLabelZh: string;
  summaryZh: string;
} {
  if (input.showRoyaltyAnalogy) {
    const points = [
      { word: '国王 (King)', x: 28, y: 24, dims: [0.85, 0.96, 0.12] as [number, number, number], color: '#f5b942' },
      { word: '男人 (Man)', x: 24, y: 74, dims: [0.86, 0.18, 0.15] as [number, number, number], color: '#38bdf8' },
      { word: '女人 (Woman)', x: 74, y: 72, dims: [0.88, 0.20, 0.14] as [number, number, number], color: '#f472b6' },
      { word: '女王 (Queen)', x: 78, y: 22, dims: [0.87, 0.95, 0.11] as [number, number, number], color: '#34d399' },
    ];
    return {
      points,
      cosineSimilarity: 0.97,
      pairLabelZh: 'v(国王) - v(男人) + v(女人) ≈ v(女王)',
      summaryZh:
        '✨ 向量加减法奇迹：「国王 [0.85, 0.96]」减去「男人 [0.86, 0.18]」得到纯粹的「皇室属性向量 [0, +0.78]」，再加上「女人 [0.88, 0.20]」，箭头终点精准落在「女王 [0.87, 0.95]」（余弦相似度 0.97）！',
    };
  }

  const allPoints = [
    { word: '小猫', x: 18, y: 26, dims: [0.95, 0.45, 0.05] as [number, number, number], color: '#34d399' },
    { word: '小狗', x: 26, y: 32, dims: [0.92, 0.52, 0.06] as [number, number, number], color: '#34d399' },
    { word: '拿铁', x: 52, y: 68, dims: [0.35, 0.88, 0.18] as [number, number, number], color: '#f5b942' },
    { word: '美式咖啡', x: 60, y: 74, dims: [0.30, 0.84, 0.22] as [number, number, number], color: '#f5b942' },
    { word: 'GPU显卡', x: 84, y: 28, dims: [0.04, 0.15, 0.98] as [number, number, number], color: '#38bdf8' },
    { word: 'Transformer', x: 78, y: 36, dims: [0.06, 0.20, 0.95] as [number, number, number], color: '#38bdf8' },
  ];

  const meta =
    input.clusterId === 'pets'
      ? { sim: 0.98, pair: 'cos(小猫, 小狗) = 0.98 · 距离极近' }
      : input.clusterId === 'coffee'
        ? { sim: 0.96, pair: 'cos(拿铁, 美式咖啡) = 0.96 · 同属饮品星团' }
        : { sim: 0.95, pair: 'cos(GPU显卡, Transformer) = 0.95 · 同属 AI 算力星团' };

  return {
    points: allPoints,
    cosineSimilarity: meta.sim,
    pairLabelZh: meta.pair,
    summaryZh: `语义相近的词拥有相似的多维打分卡（Embedding 向量），在几何空间中自然聚集成星团；而跨领域词（如「小猫」与「GPU显卡」）夹角接近 90°，余弦相似度仅 0.09！`,
  };
}

/**
 * Interactive Simulation AI-003: Neuron Weight, Loss Valley & Gradient Descent
 */
export function computeNeuronGradientSimulation(input: {
  stepCount: number;
  learningRate: number;
}): {
  targetWeight: number;
  currentWeight: number;
  currentLoss: number;
  currentGradient: number;
  trajectory: { step: number; w: number; loss: number }[];
  statusZh: string;
  stepDescZh: string;
} {
  const targetWeight = 3.0;
  const lr = Math.max(0.05, Math.min(0.95, input.learningRate));
  const steps = Math.max(0, Math.min(8, input.stepCount));

  let w = 0.2;
  const trajectory: { step: number; w: number; loss: number }[] = [
    { step: 0, w: Number(w.toFixed(2)), loss: Number(((w - targetWeight) ** 2).toFixed(2)) },
  ];

  for (let s = 1; s <= steps; s += 1) {
    const grad = 2 * (w - targetWeight);
    w = w - lr * grad;
    trajectory.push({
      step: s,
      w: Number(w.toFixed(2)),
      loss: Number(((w - targetWeight) ** 2).toFixed(2)),
    });
  }

  const last = trajectory[trajectory.length - 1]!;
  const currentGradient = Number((2 * (last.w - targetWeight)).toFixed(2));
  const statusZh =
    lr > 0.75
      ? '⚠️ 学习率过大 (η=0.92)：一步迈太远跨过谷底，在山谷两侧剧烈震荡！'
      : lr < 0.12
        ? '🐢 学习率偏小 (η=0.08)：每次只挪一小步，下山收敛较慢但很平稳'
        : '✅ 黄金学习率 (η=0.25)：顺着斜率稳步滑入 w=3.0 零误差山谷底！';

  return {
    targetWeight,
    currentWeight: last.w,
    currentLoss: last.loss,
    currentGradient,
    trajectory,
    statusZh,
    stepDescZh: `第 ${steps} 步更新：当前参数 w=${last.w}（目标最优解 w=3.0），误差海拔 Loss=${last.loss}，脚下山坡斜率 ∇L=${currentGradient}。${statusZh}`,
  };
}

/**
 * Interactive Simulation AI-004: RNN Sequential Decay vs Attention Direct Link
 */
export function computeRnnVsAttentionSimulation(input: {
  sentenceLength: 4 | 8 | 16;
}): {
  sentenceLength: 4 | 8 | 16;
  rnnRetentionPct: number;
  attentionRetentionPct: number;
  rnnStepsRequired: number;
  attentionStepsRequired: number;
  tokens: string[];
  summaryZh: string;
} {
  const len = input.sentenceLength;
  const rnnRetentionPct = len === 4 ? 62 : len === 8 ? 28 : 7;
  const attentionRetentionPct = len === 4 ? 98 : len === 8 ? 97 : 96;

  const sample4 = ['小猫', '饿了', '喂了', '它'];
  const sample8 = ['小猫', '在院子', '追蝴蝶', '跑累了', '肚子', '很饿', '就喂了', '它'];
  const sample16 = [
    '小猫',
    '昨天',
    '清晨',
    '在花园',
    '草地上',
    '欢快地',
    '追逐着',
    '彩色的',
    '小蝴蝶',
    '跑了一天',
    '精疲力尽',
    '肚子咕咕',
    '直叫唤',
    '于是主人',
    '赶紧喂了',
    '它',
  ];

  const tokens = len === 4 ? sample4 : len === 8 ? sample8 : sample16;

  return {
    sentenceLength: len,
    rnnRetentionPct,
    attentionRetentionPct,
    rnnStepsRequired: len - 1,
    attentionStepsRequired: 1,
    tokens,
    summaryZh: `当句长 L=${len} 词时：传统 RNN 需要串行接力传递 ${len - 1} 次，句首「小猫」传到句尾「它」时记忆仅剩 ${rnnRetentionPct}%；而 Attention 无论隔多远永远是 1 步直连 (O(1))，记忆保留高达 ${attentionRetentionPct}%！`,
  };
}

/**
 * Interactive Simulation AI-105: RAG vs LoRA Low-Rank Adaptation
 */
export function computeLoraRagSimulation(input: {
  mode: 'rag' | 'lora' | 'hybrid';
  loraRank: 4 | 8 | 16;
}): {
  mode: 'rag' | 'lora' | 'hybrid';
  loraRank: number;
  hiddenDim: number;
  fullParamsMillion: number;
  loraParamsMillion: number;
  paramSavingPct: number;
  extraInferenceLatencyMs: number;
  summaryZh: string;
} {
  const hiddenDim = 4096;
  const fullParamsMillion = Number(((hiddenDim * hiddenDim) / 1_000_000).toFixed(2));
  const loraParamsMillion = Number(((2 * hiddenDim * input.loraRank) / 1_000_000).toFixed(3));
  const paramSavingPct = Number(((1 - loraParamsMillion / fullParamsMillion) * 100).toFixed(2));
  const extraInferenceLatencyMs = input.mode === 'lora' ? 0 : 12;

  const modeDesc =
    input.mode === 'rag'
      ? '📚 纯 RAG 模式：从向量库实时检索 Top-3 私有文档切片塞入 Prompt，无需训练即可回答最新动态事实'
      : input.mode === 'lora'
        ? `🩹 纯 LoRA 模式 (Rank r=${input.loraRank})：冻结主干矩阵 W_0 (16.78M 参数)，仅训练旁路低秩矩阵 A×B (${loraParamsMillion}M 参数，节省 ${paramSavingPct}% 显存)，上线合并后 0 额外推理延迟`
        : `⚡ RAG + LoRA 双剑合璧：用 RAG 实时挂载最新私有知识库防幻觉，同时用 LoRA (r=${input.loraRank}) 内化专业领域推理风格与固定 JSON 输出格式！`;

  return {
    mode: input.mode,
    loraRank: input.loraRank,
    hiddenDim,
    fullParamsMillion,
    loraParamsMillion,
    paramSavingPct,
    extraInferenceLatencyMs,
    summaryZh: modeDesc,
  };
}

/**
 * Interactive Simulation AI-701: FP16 -> INT4 Quantization & SmoothQuant Outlier Smoothing
 */
export function computeQuantizationSimulation(input: {
  precision: 'fp16' | 'int8' | 'int4';
  smoothOutliers: boolean;
}): {
  precision: 'fp16' | 'int8' | 'int4';
  smoothOutliers: boolean;
  modelVramGb: number;
  speedupFactor: number;
  quantErrorPct: number;
  activationChannels: { name: string; rawVal: number; smoothedVal: number }[];
  summaryZh: string;
} {
  const modelVramGb =
    input.precision === 'fp16' ? 14.0 : input.precision === 'int8' ? 7.0 : 3.8;
  const speedupFactor =
    input.precision === 'fp16' ? 1.0 : input.precision === 'int8' ? 1.8 : 2.9;

  const quantErrorPct =
    input.precision === 'fp16'
      ? 0.0
      : input.precision === 'int8'
        ? input.smoothOutliers
          ? 0.2
          : 4.6
        : input.smoothOutliers
          ? 0.9
          : 18.4;

  const activationChannels = [
    { name: 'Ch#1 常规', rawVal: 1.2, smoothedVal: 1.2 },
    { name: 'Ch#2 常规', rawVal: -0.9, smoothedVal: -0.9 },
    { name: 'Ch#3 离群尖峰!', rawVal: 48.0, smoothedVal: input.smoothOutliers ? 3.2 : 48.0 },
    { name: 'Ch#4 常规', rawVal: 1.5, smoothedVal: 1.5 },
  ];

  return {
    precision: input.precision,
    smoothOutliers: input.smoothOutliers,
    modelVramGb,
    speedupFactor,
    quantErrorPct,
    activationChannels,
    summaryZh: `7B 模型在 ${input.precision.toUpperCase()} 精度下：显存从 14.0 GB 降至 ${modelVramGb} GB（解码提速 ${speedupFactor}x）。${
      input.smoothOutliers
        ? `开启 SmoothQuant 后，Ch#3 的 48.0 极端离群尖峰被等价分摊给权重矩阵，量化误差从 18.4% 骤降至 ${quantErrorPct}%！`
        : `未平滑离群值时，Ch#3 的 48.0 尖峰把量化刻度尺撑得过大，导致普通小数值精度受损（误差 ${quantErrorPct}%）。`
    }`,
  };
}

// ============================================================================
// ★ STAGE 2 & STAGE 4 SIMULATIONS (AI-101 ~ AI-601)
// ============================================================================

export function computeAttentionSimulation(input: {
  focusTokenIdx: number;
  stepIdx: number;
  temperature: number;
  headIdx?: number;
}): {
  tokens: readonly string[];
  focusTokenIdx: number;
  headIdx: number;
  headNameZh: string;
  stepIdx: number;
  stepTitleZh: string;
  stepDescZh: string;
  weightsPct: number[];
  ropeAngleDeg: number;
  entropyInfoZh: string;
} {
  const tokens = ['我', '在', '深', '度', '学', 'AI'] as const;
  const idx = Math.max(0, Math.min(tokens.length - 1, input.focusTokenIdx));
  const headIdx = Math.max(0, Math.min(2, input.headIdx ?? 0));
  const tau = Math.max(0.2, Math.min(2.5, input.temperature));

  const headNames = [
    'Head #1 · 语义核心指代头',
    'Head #2 · 邻近局部语法头',
    'Head #3 · 全局句首锚定头',
  ] as const;

  const headMatrices: readonly (readonly (readonly number[])[])[] = [
    [
      [2.6, 1.4, 0.9, 0.8, 1.9, 1.7],
      [1.3, 2.4, 1.8, 1.6, 2.1, 1.2],
      [0.8, 1.2, 2.7, 2.5, 2.2, 1.9],
      [0.7, 1.1, 2.5, 2.6, 2.3, 1.8],
      [1.8, 1.5, 2.0, 2.1, 2.8, 2.9],
      [1.6, 1.1, 1.9, 1.8, 2.7, 3.1],
    ],
    [
      [3.0, 2.1, 0.6, 0.5, 0.5, 0.5],
      [2.5, 2.8, 1.9, 0.6, 0.5, 0.5],
      [0.7, 2.6, 2.9, 2.0, 0.6, 0.5],
      [0.5, 0.8, 2.7, 2.9, 2.1, 0.6],
      [0.5, 0.6, 0.9, 2.7, 2.9, 2.2],
      [0.5, 0.5, 0.7, 1.1, 2.8, 3.1],
    ],
    [
      [3.2, 1.1, 1.0, 1.0, 1.5, 1.6],
      [2.6, 2.0, 1.2, 1.1, 1.4, 1.3],
      [2.4, 1.2, 2.1, 2.2, 1.5, 1.8],
      [2.3, 1.1, 2.2, 2.1, 1.6, 1.9],
      [2.5, 1.3, 1.5, 1.5, 2.2, 2.8],
      [2.7, 1.2, 1.8, 1.7, 2.6, 2.9],
    ],
  ];

  const matrix = headMatrices[headIdx] ?? headMatrices[0]!;
  const row = matrix[idx] ?? matrix[5]!;
  const scaled = row.map((v) => v / tau);
  const maxVal = Math.max(...scaled);
  const exps = scaled.map((v) => Math.exp(v - maxVal));
  const sumExp = exps.reduce((a, b) => a + b, 0) || 1;
  const weightsPct = exps.map((e) => Math.round((e / sumExp) * 100));
  const ropeAngleDeg = idx * 32;

  const steps: { title: string; desc: string }[] = [
    {
      title: `步骤 1/4 · Q/K/V 线性投影与 RoPE 复平面旋转 (${ropeAngleDeg}°)`,
      desc: `词「${tokens[idx]}」(位置 m=${idx}) 映射出 Q/K/V 向量，并在 2D 复平面逆时针旋转 mθ = ${ropeAngleDeg}°，使点积天然感知相对距离 (m-n)。`,
    },
    {
      title: '步骤 2/4 · 缩放点积打分 S = (Q · K^T) / √d_k',
      desc: `在「${headNames[headIdx]}」中，「${tokens[idx]}」的 Query 与全部 6 个词的 Key 并行计算内积，除以 √d_k 稳定方差。`,
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
      desc: `按注意力权重 [${weightsPct.map((w) => `${w}%`).join(', ')}] 对各词 Value 加权求和，拼接多头输出得到上下文表征。`,
    },
  ];

  const stepObj = steps[Math.max(0, Math.min(3, input.stepIdx))] ?? steps[0]!;
  const maxWeight = Math.max(...weightsPct);
  const entropyInfoZh = `${headNames[headIdx]} · 峰值权重 ${maxWeight}% · RoPE 旋转 ${ropeAngleDeg}°`;

  return {
    tokens,
    focusTokenIdx: idx,
    headIdx,
    headNameZh: headNames[headIdx]!,
    stepIdx: Math.max(0, Math.min(3, input.stepIdx)),
    stepTitleZh: stepObj.title,
    stepDescZh: stepObj.desc,
    weightsPct,
    ropeAngleDeg,
    entropyInfoZh,
  };
}

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

export function computeFlashAttentionSimulation(input: {
  activeTileIdx: number;
}): {
  activeTileIdx: number;
  totalTiles: number;
  runningMax: number;
  runningSumExp: number;
  rescaleFactor: number;
  standardHbmReadsMb: number;
  flashHbmReadsMb: number;
  ioReductionFactor: number;
  stepDescZh: string;
} {
  const totalTiles = 4;
  const idx = Math.max(0, Math.min(totalTiles - 1, input.activeTileIdx));
  const maxProgression = [1.8, 2.4, 2.4, 3.1];
  const prevMax = idx === 0 ? 1.8 : maxProgression[idx - 1]!;
  const curMax = maxProgression[idx]!;
  const rescaleFactor = Number(Math.exp(prevMax - curMax).toFixed(2));
  const sumProgression = [3.2, 7.8, 12.4, 18.6];
  const standardHbmReadsMb = 128;
  const flashHbmReadsMb = 16;

  return {
    activeTileIdx: idx,
    totalTiles,
    runningMax: curMax,
    runningSumExp: sumProgression[idx]!,
    rescaleFactor,
    standardHbmReadsMb,
    flashHbmReadsMb,
    ioReductionFactor: Number((standardHbmReadsMb / flashHbmReadsMb).toFixed(1)),
    stepDescZh: `正在 GPU 片上 SRAM 处理第 ${idx + 1}/${totalTiles} 个 KV 分块 (Tile #${idx + 1})：在线更新局部最大值 m=${curMax}，用缩放因子 exp(m_old - m_new)=${rescaleFactor} 动态修正历史累加器 O，全程 0 次中间矩阵写回 HBM！`,
  };
}

export function computeMoeRoutingSimulation(input: {
  tokenIdx: number;
  topK: number;
  loadBalanceEnabled: boolean;
}): {
  tokens: readonly { text: string; domain: string }[];
  tokenIdx: number;
  topK: number;
  experts: {
    id: string;
    nameZh: string;
    isShared: boolean;
    scorePct: number;
    selected: boolean;
    loadCount: number;
  }[];
  activeParamsBillion: number;
  totalParamsBillion: number;
  summaryZh: string;
} {
  const tokens = [
    { text: 'def_attn()', domain: '代码/算子' },
    { text: '∇L_aux', domain: '数学推导' },
    { text: 'NVLink带宽', domain: '系统硬件' },
    { text: '夏普比率', domain: '量化金融' },
  ] as const;
  const tIdx = Math.max(0, Math.min(tokens.length - 1, input.tokenIdx));
  const topK = Math.max(1, Math.min(3, input.topK));

  const rawScoresByToken: readonly (readonly number[])[] = [
    [42, 28, 11, 8, 6, 5],
    [16, 46, 18, 9, 6, 5],
    [14, 12, 44, 16, 8, 6],
    [9, 18, 8, 45, 12, 8],
  ];
  const raw = rawScoresByToken[tIdx] ?? rawScoresByToken[0]!;
  const scores = input.loadBalanceEnabled
    ? raw.map((s, i) => (i === 0 ? Math.max(12, s - 6) : i >= 4 ? s + 6 : s))
    : [...raw];

  const rankedIndices = scores
    .map((s, idx) => ({ s, idx }))
    .sort((a, b) => b.s - a.s)
    .slice(0, topK)
    .map((item) => item.idx);

  const expertMeta = [
    { id: 'E1', nameZh: '路由专家 E1 · 代码生成' },
    { id: 'E2', nameZh: '路由专家 E2 · 数学推理' },
    { id: 'E3', nameZh: '路由专家 E3 · CUDA 系统' },
    { id: 'E4', nameZh: '路由专家 E4 · 量化金融' },
    { id: 'E5', nameZh: '路由专家 E5 · 逻辑规划' },
    { id: 'E6', nameZh: '路由专家 E6 · 多语对齐' },
  ];

  const experts = [
    {
      id: 'S0',
      nameZh: '常驻共享专家 S0 · 通用语法常识',
      isShared: true,
      scorePct: 100,
      selected: true,
      loadCount: 100,
    },
    ...expertMeta.map((meta, idx) => ({
      id: meta.id,
      nameZh: meta.nameZh,
      isShared: false,
      scorePct: scores[idx] ?? 10,
      selected: rankedIndices.includes(idx),
      loadCount: input.loadBalanceEnabled ? 15 + ((idx * 3) % 5) : idx === 0 ? 48 : 8 + idx * 3,
    })),
  ];

  const totalParamsBillion = 671;
  const activeParamsBillion = 12 + topK * 12.5;

  return {
    tokens,
    tokenIdx: tIdx,
    topK,
    experts,
    activeParamsBillion,
    totalParamsBillion,
    summaryZh: `Token「${tokens[tIdx]!.text}」经 Router 门控打分，激活 1 个常驻共享专家 + Top-${topK} 路由专家（仅激活 ${activeParamsBillion}B / ${totalParamsBillion}B 参数，算力节省 ${Math.round((1 - activeParamsBillion / totalParamsBillion) * 100)}%）。`,
  };
}

export function computeDistributedParallelSimulation(input: {
  zeroStage: 0 | 1 | 2 | 3;
  microBatches: number;
  ppStages?: number;
}): {
  zeroStage: 0 | 1 | 2 | 3;
  ppStages: number;
  microBatches: number;
  paramMemGb: number;
  gradMemGb: number;
  optimMemGb: number;
  totalMemPerGpuGb: number;
  bubbleRatioPct: number;
  summaryZh: string;
} {
  const dpWorldSize = 8;
  const ppStages = input.ppStages ?? 4;
  const m = Math.max(4, Math.min(16, input.microBatches));
  const baseParamGb = 14;
  const baseGradGb = 14;
  const baseOptimGb = 84;

  const paramMemGb =
    input.zeroStage === 3 ? Number((baseParamGb / dpWorldSize).toFixed(1)) : baseParamGb;
  const gradMemGb =
    input.zeroStage >= 2 ? Number((baseGradGb / dpWorldSize).toFixed(1)) : baseGradGb;
  const optimMemGb =
    input.zeroStage >= 1 ? Number((baseOptimGb / dpWorldSize).toFixed(1)) : baseOptimGb;
  const totalMemPerGpuGb = Number((paramMemGb + gradMemGb + optimMemGb).toFixed(1));
  const bubbleRatioPct = Math.round(((ppStages - 1) / (ppStages - 1 + m)) * 100);

  return {
    zeroStage: input.zeroStage,
    ppStages,
    microBatches: m,
    paramMemGb,
    gradMemGb,
    optimMemGb,
    totalMemPerGpuGb,
    bubbleRatioPct,
    summaryZh: `7B 模型在 8 卡 DP (${input.zeroStage === 0 ? '无 ZeRO' : `ZeRO-${input.zeroStage}`}) 下：单卡模型状态显存从 112.0 GB 降至 ${totalMemPerGpuGb} GB；1F1B 流水线 (${m} 个微批次) 空闲气泡率压至 ${bubbleRatioPct}%。`,
  };
}

export function buildDefaultKnowledgeState(): KnowledgeGraphState {
  const aiPack = CATALOG_CHAPTER_PACKS[0]!;
  return {
    nodes: DEFAULT_KNOWLEDGE_NODES.map((n) => ({ ...n })),
    installedPackIds: [aiPack.id],
    offlineContents: { ...aiPack.chapters },
    newsItems: DEFAULT_NEWS_DIGEST_ITEMS.map((item) => ({ ...item })),
    newsFilter: { ...DEFAULT_NEWS_FILTER },
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
    const defaultMap = new Map(DEFAULT_KNOWLEDGE_NODES.map((dn) => [dn.id, dn]));
    const existingIds = new Set(parsed.nodes.map((n) => n.id));
    const upgradedExisting = parsed.nodes.map((n) => {
      const def = defaultMap.get(n.id);
      return def ? { ...def, status: n.status, studyMinutes: n.studyMinutes, reviewLevel: n.reviewLevel, userNote: n.userNote } : { ...n, stageLevel: n.stageLevel ?? 2 };
    });
    const mergedNodes = [
      ...upgradedExisting,
      ...DEFAULT_KNOWLEDGE_NODES.filter((dn) => !existingIds.has(dn.id)),
    ];
    const installed = Array.isArray(parsed.installedPackIds)
      ? parsed.installedPackIds
      : ['pack-ai-infra'];
    const mergedContents: Record<string, KnowledgeChapterContent> = {
      ...(parsed.offlineContents ?? {}),
    };
    for (const pack of CATALOG_CHAPTER_PACKS) {
      if (installed.includes(pack.id)) {
        Object.assign(mergedContents, pack.chapters);
      }
    }
    const existingNews = Array.isArray(parsed.newsItems) ? parsed.newsItems : [];
    const existingNewsIds = new Set(existingNews.map((item) => item.id));
    const mergedNews = [
      ...existingNews,
      ...DEFAULT_NEWS_DIGEST_ITEMS.filter((d) => !existingNewsIds.has(d.id)),
    ];
    return {
      nodes: mergedNodes,
      installedPackIds: installed,
      offlineContents: mergedContents,
      newsItems: mergedNews,
      newsFilter: { ...DEFAULT_NEWS_FILTER, ...(parsed.newsFilter ?? {}) },
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
    stageLevel: 3,
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
    stageLevel: 3,
    beginnerAnalogyZh: `🌱 自定义双链章节手稿：${lines[0] ?? cleanTitle}`,
    deepReadingParagraphsZh: lines,
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
  lockedCount: number;
  totalStudyMinutes: number;
  installedPacksCount: number;
  totalCatalogPacksCount: number;
  cachedSizeKb: number;
  storageKey: string;
  packFolderRelPath: string;
} {
  const masteredCount = state.nodes.filter((n) => n.status === 'mastered').length;
  const learningCount = state.nodes.filter((n) => n.status === 'learning').length;
  const lockedCount = state.nodes.filter((n) => n.status === 'locked').length;
  const totalStudyMinutes = state.nodes.reduce((s, n) => s + n.studyMinutes, 0);
  const cachedSizeKb = CATALOG_CHAPTER_PACKS.filter((p) =>
    state.installedPackIds.includes(p.id),
  ).reduce((s, p) => s + p.sizeKb, 4);

  return {
    totalNodes: state.nodes.length,
    masteredCount,
    learningCount,
    lockedCount,
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
