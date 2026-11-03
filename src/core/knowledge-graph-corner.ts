/**
 * Study Corner & Personal Knowledge Graph Engine (学习角 · 从小白到架构师渐进式 AI 动画讲堂与知识图谱)
 *
 * Inspired by open-source best practices:
 * - 3Blue1Brown / Distill.pub / Karpathy Zero-to-Hero: Progressive visual intuition from absolute beginner
 *   (Tokens, Embeddings, Gradient Descent, RNN vs Attention) to industrial LLM systems (PagedAttention,
 *   Speculative Decoding, FlashAttention, MoE, 3D Parallelism, LoRA/RAG, INT4 Quantization).
 * - Obsidian / Logseq: Bidirectional `[[WikiLinks]]` & local-first Markdown notes.
 * - Roadmap.sh: 4-Stage progressive skill-tree (`L1 小白入门` -> `L2 核心原理` -> `L3 微调与量化` -> `L4 工业级系统`).
 * - Kiwix / Anki: Zero-bloat app bundle! The app only ships a lightweight skeleton index;
 *   heavy chapter contents & animations are installed on-demand as modular Offline Chapter Packs.
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
    zh: '第 1 阶：零基础小白直觉营',
    en: 'Stage 1: Zero-to-One Intuition',
    subtitleZh: '无需任何数学与编程背景，用「文字接龙、性格打分卡、下山调水温、微信群@人」4 个生活比喻彻底看懂 AI 底层逻辑',
    color: '#34d399',
  },
  {
    level: 2,
    badge: 'L2 · 核心架构',
    zh: '第 2 阶：Transformer 核心原理',
    en: 'Stage 2: Transformer Core',
    subtitleZh: '掌握 Q/K/V 动态软寻址、多头注意力分工、RoPE 复平面旋转编码与计算机底层内存局部性',
    color: '#f5b942',
  },
  {
    level: 3,
    badge: 'L3 · 微调与端侧',
    zh: '第 3 阶：私有定制与端侧量化',
    en: 'Stage 3: Customization & Quantization',
    subtitleZh: '学会用 RAG 开卷检索、LoRA 低秩便利贴定制专属模型，并用 INT4 量化把大模型装进个人笔记本',
    color: '#38bdf8',
  },
  {
    level: 4,
    badge: 'L4 · 工业级系统',
    zh: '第 4 阶：工业级推理与集群训练',
    en: 'Stage 4: Industrial LLM Infra',
    subtitleZh: '深入 vLLM 显存分页、投机采样双轨竞速、FlashAttention 片上分块、MoE 专家路由与 3D 分布式并行',
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
  { id: 'ai-infra', icon: '智', zh: 'AI 从零到架构师动画课 (12课)', en: 'AI Zero-to-Hero Interactive Labs (12)', color: '#f5b942' },
  { id: 'cs-systems', icon: '核', zh: '计算机底层与分布式', en: 'Systems & Distributed', color: '#38bdf8' },
  { id: 'wealth-quant', icon: '财', zh: '资产配置与复利模型', en: 'Asset Allocation & Quant', color: '#34d399' },
  { id: 'product-arch', icon: '架', zh: '跨端架构与工程效能', en: 'Cross-Platform Arch', color: '#f472b6' },
] as const;

/**
 * Lightweight Graph Skeleton: Progressive 14-Node Curriculum from AI-001 (Beginner) to AI-701 (Industrial)
 */
export const DEFAULT_KNOWLEDGE_NODES: readonly KnowledgeNode[] = [
  // ==================== STAGE 1: 零基础小白入门 (AI-001 ~ AI-004) ====================
  {
    id: 'node-ai-001-token',
    domainId: 'ai-infra',
    stageLevel: 1,
    code: 'AI-001',
    title: '大模型是怎么说话的？Token 切词与下一词接龙动画',
    summary: '【零基础第1课】把句子切成积木块 (Token)，看大模型如何像玩文字接龙一样算出下一个词的概率',
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
    title: '文字怎么变成数字？词向量 Embedding 与语义星空动画',
    summary: '【零基础第2课】给每个词发一张多维特征打分卡，亲手体验「国王 - 男人 + 女人 = 女王」的向量魔法',
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
    title: '机器是怎么学会知识的？Loss 误差山谷与梯度下降动画',
    summary: '【零基础第3课】像蒙眼下山和调冷热水龙头一样，顺着斜率（梯度）一步步修正参数直到误差最小',
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
    title: '为什么旧模型会忘事？RNN 传声筒衰减 vs 注意力直连动画',
    summary: '【零基础第4课】对比串行传话筒的记忆衰减与微信群直接 @ 某人的全局注意力直连通道',
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

  // ==================== STAGE 2: 核心原理进阶 (AI-101 & SYS-101) ====================
  {
    id: 'node-transformer',
    domainId: 'ai-infra',
    stageLevel: 2,
    code: 'AI-101',
    title: 'Transformer 核心：Q/K/V 自注意力与 RoPE 旋转动画',
    summary: '【核心第5课】拆解 Query/Key/Value 三兄弟怎么配合打分，以及 2D 复平面旋转如何记住词序',
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

  // ==================== STAGE 3: 私有定制与端侧量化 (AI-105 & AI-701) ====================
  {
    id: 'node-ai-105-lora-rag',
    domainId: 'ai-infra',
    stageLevel: 3,
    code: 'AI-105',
    title: '怎么定制专属模型？RAG 开卷考试 vs LoRA 低秩微调动画',
    summary: '【进阶第6课】对比外挂知识库检索 (RAG) 与冻结主干只训 1% 旁路小矩阵 (LoRA) 的双剑合璧架构',
    x: 36,
    y: 44,
    prerequisites: ['node-transformer'],
    bidirectionalLinks: ['node-transformer', 'node-ai-701-quant'],
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
    title: '笔记本怎么跑大模型？FP16→INT4 量化与离群值平滑动画',
    summary: '【进阶第7课】把 16 位高精度浮点数装进 4 位小格子显存立省 75%，用 SmoothQuant 驯服离群尖峰',
    x: 56,
    y: 44,
    prerequisites: ['node-ai-105-lora-rag'],
    bidirectionalLinks: ['node-ai-105-lora-rag', 'node-kv-cache'],
    status: 'learning',
    studyMinutes: 30,
    reviewLevel: 2,
    userNote: '7B 模型 FP16 要 14GB 显存，INT4 量化后仅需 3.8GB，MacBook 也能流畅跑！',
    packId: 'pack-ai-infra',
  },

  // ==================== STAGE 4: 工业级推理与集群训练 (AI-201 ~ AI-601) ====================
  {
    id: 'node-kv-cache',
    domainId: 'ai-infra',
    stageLevel: 4,
    code: 'AI-201',
    title: 'KV Cache 与 vLLM PagedAttention 显存分页动画',
    summary: '【高阶第8课】虚拟页表映射、非连续物理显存块分配与 Copy-on-Write 前缀共享动画',
    x: 76,
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
    title: '投机采样 (Speculative Decoding) 双轨竞速动画',
    summary: '【高阶第9课】小模型串行快猜 γ 步 + 大模型单次前向并行验证的无损加速动画',
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
    title: 'FlashAttention SRAM 分块与 Online Softmax 动画',
    summary: '【高阶第10课】GPU HBM ⇄ 片上 SRAM Tiling 流水线与在线重缩放递推公式动画',
    x: 76,
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
    title: 'MoE 混合专家 Top-K 门控路由与负载均衡动画',
    summary: '【高阶第11课】DeepSeek/Mixtral 共享专家 + 路由专家激活与负载均衡辅助损失动画',
    x: 76,
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
    title: '分布式 3D 并行 (TP/PP/DP) 与 ZeRO 显存切分动画',
    summary: '【高阶第12课】1F1B 流水线气泡消除、NVLink 张量切分与 ZeRO-1/2/3 优化器状态分片动画',
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
 * Modular Offline Chapter Packs Catalog (On-Demand Downloadable / Offloadable)
 */
export const CATALOG_CHAPTER_PACKS: readonly KnowledgeChapterPack[] = [
  {
    id: 'pack-ai-infra',
    domainId: 'ai-infra',
    icon: '智',
    titleZh: 'AI 从零基础小白到架构师 12 课交互动画全集',
    titleEn: 'AI Zero-to-Hero 12 Interactive Animation Pack',
    version: 'v4.0',
    sizeKb: 86,
    nodeCount: 12,
    localFilePath: 'knowledge-packs/ai-infra-interactive.pack.json',
    descriptionZh:
      '从零基础小白（Token 文字接龙、词向量星空、梯度下降下山、RNN vs 注意力传声筒）一路手把手教到 Transformer、RAG/LoRA、INT4 量化、PagedAttention、投机采样、FlashAttention、MoE 与 3D 分布式并行，共 12 套交互 SVG 动画 + 符号字典 + 随堂自测。',
    chapters: {
      // ==================== AI-001 ====================
      'node-ai-001-token': {
        nodeId: 'node-ai-001-token',
        stageLevel: 1,
        animationKind: 'token-next-word',
        beginnerAnalogyZh:
          '🌱 小白大白话：别把大模型想得太玄乎！它本质上就是一个超级「词语接龙游戏机」。你输入半句话，它先把话切成一小块一小块的乐高积木（叫做 Token），然后翻遍字典给所有可能接在后面的词打分算概率，选出一个词吐给你；接着把这个新词拼到句子末尾，再猜下一个词，循环往复直到说完一整段话！',
        guidedStepsZh: [
          '第 1 步：观察上方输入句子是如何被切成带编号的彩色积木块 (Token ID) 的',
          '第 2 步：看右侧候选词概率条——模型正在预测当前句子后面最可能跟哪个词',
          '第 3 步：点击「切换 Greedy 稳健 / Top-P 创意采样」，对比只选最高分 vs 按概率掷骰子的区别',
          '第 4 步：连续点击「＋ 接龙生成下一个词」，亲眼看它如何一个词一个词拼出完整回答！',
        ],
        formulaBreakdownZh: [
          { symbol: 'w_1, w_2, ..., w_{t-1}', meaningZh: '已经说出口的前面那串词（上下文积木）' },
          { symbol: 'P(w_t | w_{<t})', meaningZh: '在看到前面所有词的条件下，第 t 个位置出现某个新词的概率' },
          { symbol: 'Tokenizer', meaningZh: '切词器：把人类文字切成模型词表里的数字编号（如「人工智能」→ #8921）' },
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
        guidedStepsZh: [
          '第 1 步：点击切换「宠物星团 / 咖啡饮品星团 / AI 硬件星团」，观察意思相近的词在坐标系里如何自动抱团',
          '第 2 步：观察右侧每个词的「特征维度打分条」（生命感、皇家/权力感、科技属性）',
          '第 3 步：点击开启「✨ 演示国王 - 男人 + 女人 = 女王 向量加减魔法」，看箭头如何在空间里平移合成！',
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
        guidedStepsZh: [
          '第 1 步：观察抛物线山谷图——横轴是模型参数 w，纵轴是预测误差 Loss（越低代表模型越准，谷底 w=3.0 是最优解）',
          '第 2 步：点击「👣 迈出一步梯度更新」，看小球如何算出当前斜率并往山谷底部滚动',
          '第 3 步：切换学习率 η：「0.08 太慢像蜗牛」、「0.25 黄金步长稳步进谷底」、「0.92 步子太大在山谷两侧来回震荡」！',
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
        guidedStepsZh: [
          '第 1 步：看上半部分【传统 RNN 传声筒】——信号从句首「小猫」一格格往右传，亮度和记忆保留率从 100% 暴跌到 11%',
          '第 2 步：看下半部分【Attention 全局直连】——句尾的「它」直接拉出一条高光专线跨越整句连向「小猫」，记忆保留率 96%！',
          '第 3 步：点击切换句子长度（短句 4 词 / 中句 8 词 / 长文 16 词），观察距离拉长时 RNN 如何彻底失忆而 Attention 稳如泰山！',
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
        guidedStepsZh: [
          '第 1 步：点击上方任意 Query 发起词（如「AI」或「学」），观察它发出的金色检索光束连向哪些词',
          '第 2 步：切换「H1·语义指代 / H2·邻近局部 / H3·全局句首」三个注意力头，看不同专家头如何关注不同语法关系',
          '第 3 步：切换温度 τ = 0.4（尖锐聚焦）vs τ = 1.6（雨露均沾），并观察右侧 2D 复平面里 RoPE 位置指针的旋转角度！',
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
        guidedStepsZh: [
          '第 1 步：点击切换「📚 RAG 开卷检索通道」、「🩹 LoRA 低秩旁路微调通道」与「⚡ RAG + LoRA 双剑合璧」',
          '第 2 步：调节 LoRA 的秩 `Rank r = 4 / 8 / 16`，观察旁路矩阵 `A(d×r) × B(r×d)` 相比原矩阵 `W_0(4096×4096)` 省下了多少倍显存',
          '第 3 步：观察推理阶段 LoRA 如何通过 `W_merged = W_0 + B·A` 直接合并进原权重，实现 **0 额外推理延迟**！',
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
        guidedStepsZh: [
          '第 1 步：点击切换精度档位 `FP16 (14.0 GB)` → `INT8 (7.0 GB)` → `INT4 (3.8 GB)`，观察模型体积与显存条如何缩减 75%',
          '第 2 步：观察中间的量化刻度尺——当存在「激活值离群尖峰 (Outlier = 48.0)」时，普通小数值被严重挤压丢失精度',
          '第 3 步：点击开启「✨ 开启 SmoothQuant 离群值平滑迁移」，看尖峰如何被数学等价摊平、量化误差瞬间从 18.4% 降到 0.9%！',
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

      // ==================== AI-201 ====================
      'node-kv-cache': {
        nodeId: 'node-kv-cache',
        stageLevel: 4,
        animationKind: 'paged-attention',
        beginnerAnalogyZh:
          '🌱 小白大白话：传统显存分配就像「餐厅包厢死板订座」——哪怕只来 2 个人吃饭，只要他说“也许一会儿还有朋友来”，餐厅就得给他死死空出一张 32 人大圆桌，导致 60% 以上的座位全空着浪费！而 **vLLM PagedAttention** 改成了「4 人小方桌按需拼桌」——来 4 个词坐满一桌，第 5 个词来了再新开一桌，哪怕两桌在餐厅里不挨着，服务员拿一张「桌号对应表 (Block Table)」就能串起来，座位浪费瞬间降到 4% 以内！',
        guidedStepsZh: [
          '第 1 步：点击「＋ 生成 1 个 Token」，观察每满 4 个词如何动态申请一个新的非连续物理页框（P#7 → P#2 → P#11）',
          '第 2 步：点击切换「✓ CoW 前缀共享开启」，看多个用户共享同一段 System Prompt 时如何直接复用物理块 P#7（引用计数 RefCnt=2）',
          '第 3 步：对比下方红色传统预分配浪费条 vs 绿色 PagedAttention 极低碎片条！',
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
        guidedStepsZh: [
          '第 1 步：选择实习生小模型单次快猜步数 `γ = 3 / 4 / 5`',
          '第 2 步：点击「切换全部命中 / 中途拒绝并重采样」，观察当第 k 个词被拒绝时，前面 k-1 个绿牌词如何稳稳保留，且大教授当场给出橙色修正词！',
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
        guidedStepsZh: [
          '第 1 步：点击 `KV Tile #1 .. #4` 或「推进至下一个 SRAM 分块」，观察数据块如何流式进入片上 SRAM',
          '第 2 步：观察每个分块里的 `m`（当前最高分）和 `α = exp(m_old - m_new)`（在线修正系数）如何动态刷新历史累加结果',
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
        guidedStepsZh: [
          '第 1 步：点击切换不同领域输入 Token（代码 `def_attn()` / 数学 `∇L_aux` / 硬件 `NVLink` / 金融 `夏普比率`），看分诊台点亮了哪几个专科专家',
          '第 2 步：切换 `Top-1 / Top-2 / Top-3`，观察激活参数量与节省算力百分比的变化',
          '第 3 步：开关「动态偏置负载均衡」，体会如何防止所有病人全挤向同一个网红专家！',
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
        guidedStepsZh: [
          '第 1 步：依次点击 `Baseline (无ZeRO)` → `ZeRO-1` → `ZeRO-2` → `ZeRO-3`，看三块显存卡片（参数 / 梯度 / Adam优化器状态）如何被逐级切分 8 份',
          '第 2 步：切换 `1F1B 微批次 M = 4 / 8 / 16`，观察流水线并行气泡率如何随微批次增加而摊薄！',
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
    version: 'v1.2',
    sizeKb: 24,
    nodeCount: 2,
    localFilePath: 'knowledge-packs/cs-systems-consensus.pack.json',
    descriptionZh: '含 CSAPP 存储器山、Cache Line 伪共享剖析、Raft 任期状态机及 Local-First 离线同步设计。',
    chapters: {
      'node-cuda-mem': {
        nodeId: 'node-cuda-mem',
        stageLevel: 2,
        beginnerAnalogyZh:
          '🌱 小白大白话：CPU 算数据就像木匠干活——寄存器和 L1 缓存是木匠「围裙口袋里的螺丝刀」（1 秒钟就能拿到），而内存条是「100 米外仓库里的工具箱」。如果每次只拿一颗螺丝钉就跑一趟仓库，时间全浪费在跑路上了！所以 CPU 每次去仓库都会顺手把一整排工具盒（64 字节 Cache Line）一起端过来！',
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
    version: 'v1.1',
    sizeKb: 19,
    nodeCount: 1,
    localFilePath: 'knowledge-packs/wealth-quant-compounding.pack.json',
    descriptionZh: '含凯利公式仓位控制、定投复利微分方程、恩格尔与拿铁因子诊断标准及双人合池预算模型。',
    chapters: {
      'node-kelly-dca': {
        nodeId: 'node-kelly-dca',
        stageLevel: 2,
        beginnerAnalogyZh:
          '🌱 小白大白话：为什么投资里「少亏钱」比「某一年暴赚」更重要？假如你有 10 万块，第一年跌了 50% 变成 5 万，第二年就算涨了 50% 也只有 7.5 万（还倒亏 25%）！这就叫「波动率税」。所以家庭理财最稳的滚雪球公式是：每月发工资先存下固定定投（本金引擎）+ 股债均衡控制最大回撤！',
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

export const KNOWLEDGE_STORAGE_KEY = 'viastela.knowledge_graph.v1';

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
    dims: [number, number, number]; // [生物/活力, 皇家/社交, 科技/算力]
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

  let w = 0.2; // Initial random guess
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
  const fullParamsMillion = Number(((hiddenDim * hiddenDim) / 1_000_000).toFixed(2)); // 16.78M
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

/**
 * Interactive Simulation 1: Self-Attention Q/K/V, Multi-Head & RoPE Rotation Frame
 */
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

/**
 * Interactive Simulation 5: Sparse MoE Top-K Router & Load Balancing
 */
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

/**
 * Interactive Simulation 6: 3D Parallelism (TP/PP/DP) & ZeRO Memory Sharding
 */
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
    beginnerAnalogyZh: `🌱 自定义双链笔记节点：${lines[0] ?? cleanTitle}`,
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
