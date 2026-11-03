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
 * - 3Blue1Brown / Distill.pub / Brendan Bycroft LLM Viz: Step-by-step interactive animated simulations
 *   for AI Infra & Distributed Systems concepts.
 */

export type KnowledgeDomainId = 'ai-infra' | 'cs-systems' | 'wealth-quant' | 'product-arch';

export type NodeMasteryStatus = 'locked' | 'learning' | 'mastered';

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

export type AiAnimationKind =
  | 'self-attention'
  | 'paged-attention'
  | 'speculative-decoding'
  | 'flash-attention'
  | 'moe-routing'
  | 'distributed-parallel';

export type KnowledgeChapterContent = {
  nodeId: string;
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
    title: 'Transformer 与 Self-Attention + RoPE 旋转动画',
    summary: 'Q/K/V 多头投影、2D RoPE 复平面旋转编码与温度 τ 注意力热力分布动态演示',
    x: 12,
    y: 22,
    prerequisites: [],
    bidirectionalLinks: ['node-kv-cache', 'node-flash-attn', 'node-cuda-mem'],
    status: 'mastered',
    studyMinutes: 95,
    reviewLevel: 4,
    userNote: '已完成手推 QK^T/sqrt(d_k) 梯度与 RoPE 相对位置内积不变性推导。',
    packId: 'pack-ai-infra',
  },
  {
    id: 'node-kv-cache',
    domainId: 'ai-infra',
    code: 'AI-201',
    title: 'KV Cache 与 vLLM PagedAttention 显存分页动画',
    summary: '虚拟页表映射、非连续物理显存块分配与 Copy-on-Write 前缀共享动画',
    x: 34,
    y: 16,
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
    code: 'AI-301',
    title: '投机采样 (Speculative Decoding) 双轨竞速动画',
    summary: '小模型串行快猜 γ 步 + 大模型单次前向并行验证的无损加速动画',
    x: 56,
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
    code: 'AI-401',
    title: 'FlashAttention SRAM 分块与 Online Softmax 动画',
    summary: 'GPU HBM ⇄ 片上 SRAM Tiling 流水线与在线重缩放递推公式动画',
    x: 76,
    y: 18,
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
    code: 'AI-501',
    title: 'MoE 混合专家 Top-K 门控路由与负载均衡动画',
    summary: 'DeepSeek/Mixtral 共享专家 + 路由专家激活与负载均衡辅助损失动画',
    x: 64,
    y: 46,
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
    code: 'AI-601',
    title: '分布式 3D 并行 (TP/PP/DP) 与 ZeRO 显存切分动画',
    summary: '1F1B 流水线气泡消除、NVLink 张量切分与 ZeRO-1/2/3 优化器状态分片动画',
    x: 88,
    y: 44,
    prerequisites: ['node-flash-attn', 'node-moe-router'],
    bidirectionalLinks: ['node-flash-attn', 'node-moe-router', 'node-raft'],
    status: 'locked',
    studyMinutes: 25,
    reviewLevel: 1,
    userNote: '节点内走 NVLink 做 TP，跨机走 RoCE/IB 做 PP 与 ZeRO-DP。',
    packId: 'pack-ai-infra',
  },
  {
    id: 'node-cuda-mem',
    domainId: 'cs-systems',
    code: 'SYS-101',
    title: 'CPU/GPU 内存层次与 Cache Line 伪共享剖析',
    summary: 'SRAM vs HBM 带宽差距、False Sharing 与零拷贝机制',
    x: 20,
    y: 76,
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
    x: 50,
    y: 80,
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
    code: 'FIN-101',
    title: '凯利公式、股债再平衡与家庭现金流池',
    summary: '安全边际、定投微笑曲线、最大回撤控制与双人合池预算模型',
    x: 82,
    y: 78,
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
    titleZh: 'AI Infra 交互式动画教学离线包 (Pro)',
    titleEn: 'AI Infra Interactive Animation Pack (Pro)',
    version: 'v3.0',
    sizeKb: 54,
    nodeCount: 6,
    localFilePath: 'knowledge-packs/ai-infra-interactive.pack.json',
    descriptionZh:
      '含 6 套可交互 SVG 教学动画（Self-Attention + RoPE 复平面旋转、PagedAttention 显存分页、Speculative 投机采样、FlashAttention SRAM 分块、MoE Top-K 门控路由、3D 并行 & ZeRO 显存切分）、随堂自测与艾宾浩斯闪卡。',
    chapters: {
      'node-transformer': {
        nodeId: 'node-transformer',
        animationKind: 'self-attention',
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
      'node-kv-cache': {
        nodeId: 'node-kv-cache',
        animationKind: 'paged-attention',
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
      'node-speculative': {
        nodeId: 'node-speculative',
        animationKind: 'speculative-decoding',
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
      'node-moe-router': {
        nodeId: 'node-moe-router',
        animationKind: 'moe-routing',
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
      'node-3d-parallel': {
        nodeId: 'node-3d-parallel',
        animationKind: 'distributed-parallel',
        coreMentalModel:
          '大模型分布式训练需协同三大维度：张量并行 (TP) 切分单层矩阵乘（需极高带宽 NVLink）、流水线并行 (PP) 按层切分模型并通过 1F1B 微批次调度压缩气泡、数据并行 (DP + ZeRO-1/2/3) 切分优化器状态/梯度/参数以消除冗余副本。',
        keyTakeaways: [
          '混合精度训练下，1B 参数模型仅模型状态就占 16 Bytes/param（FP16 参数 2B + 梯度 2B + FP32 Adam 状态 12B）',
          'ZeRO-1 切分优化器状态（省 4x），ZeRO-2 切分优化器+梯度（省 8x），ZeRO-3 连参数一并切分（线性随卡数缩减）',
          '1F1B 流水线调度让前向与反向微批次交错执行，气泡率等于 (P - 1) / M（M 为微批次数，P 为流水线级数）',
        ],
        codeOrFormulaSnippet:
          'BubbleRatio = (PP_Stages - 1) / MicroBatches;  ModelStateBytes = Params * (2 + 2 + 12 / ZeRO_Factor)',
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
    // Head 0: Semantic alignment
    [
      [2.6, 1.4, 0.9, 0.8, 1.9, 1.7],
      [1.3, 2.4, 1.8, 1.6, 2.1, 1.2],
      [0.8, 1.2, 2.7, 2.5, 2.2, 1.9],
      [0.7, 1.1, 2.5, 2.6, 2.3, 1.8],
      [1.8, 1.5, 2.0, 2.1, 2.8, 2.9],
      [1.6, 1.1, 1.9, 1.8, 2.7, 3.1],
    ],
    // Head 1: Local window (attends strongly to i-1 and i)
    [
      [3.0, 2.1, 0.6, 0.5, 0.5, 0.5],
      [2.5, 2.8, 1.9, 0.6, 0.5, 0.5],
      [0.7, 2.6, 2.9, 2.0, 0.6, 0.5],
      [0.5, 0.8, 2.7, 2.9, 2.1, 0.6],
      [0.5, 0.6, 0.9, 2.7, 2.9, 2.2],
      [0.5, 0.5, 0.7, 1.1, 2.8, 3.1],
    ],
    // Head 2: Global anchor & verb-object link
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
  // Baseline 7B model in mixed precision: Params=14GB, Grads=14GB, Optim=84GB => Total 112GB
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
