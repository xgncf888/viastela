import { createElement, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';

import {
  CATALOG_CHAPTER_PACKS,
  computeKnowledgeGraphStats,
  computeStudioUnlockables,
  importCustomMarkdownKnowledgeNode,
  installKnowledgeChapterPack,
  KNOWLEDGE_DOMAINS,
  type KnowledgeDomainId,
  type KnowledgeGraphState,
  offloadKnowledgeChapterPack,
  readKnowledgeGraphState,
  updateKnowledgeNodeProgress,
} from '@/core/knowledge-graph-corner';
import { readBookkeepingState } from '@/data/bookkeeping';
import { recordPledgeReward } from '@/data/life-gamification';

import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { showToast } from './toast';
import { useI18n } from './use-i18n';

/**
 * Interactive SVG Knowledge Graph DAG + Bidirectional Link Canvas
 */
function KnowledgeGraphSvgCanvas({
  state,
  selectedNodeId,
  onSelectNode,
  isDark,
}: {
  state: KnowledgeGraphState;
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
  isDark: boolean;
}) {
  if (Platform.OS !== 'web') return null;

  const width = 560;
  const height = 188;
  const toX = (pct: number) => 28 + (pct / 100) * (width - 56);
  const toY = (pct: number) => 24 + (pct / 100) * (height - 48);

  const nodeMap = new Map(state.nodes.map((n) => [n.id, n]));

  return createElement(
    'svg',
    {
      width: '100%',
      height,
      viewBox: `0 0 ${width} ${height}`,
      style: { overflow: 'visible' },
    },
    // Bidirectional link dashed lines
    state.nodes.flatMap((node) =>
      node.bidirectionalLinks.map((targetId) => {
        const target = nodeMap.get(targetId);
        if (!target || node.id > target.id) return null;
        return createElement('line', {
          key: `bi-${node.id}-${target.id}`,
          x1: toX(node.x),
          y1: toY(node.y),
          x2: toX(target.x),
          y2: toY(target.y),
          stroke: isDark ? 'rgba(245, 185, 66, 0.24)' : 'rgba(184, 130, 40, 0.26)',
          strokeWidth: 1.2,
          strokeDasharray: '4 4',
        });
      }),
    ),
    // Prerequisite directed edges
    state.nodes.flatMap((node) =>
      node.prerequisites.map((preId) => {
        const pre = nodeMap.get(preId);
        if (!pre) return null;
        const isUnlocked = pre.status === 'mastered';
        return createElement('line', {
          key: `pre-${pre.id}-${node.id}`,
          x1: toX(pre.x),
          y1: toY(pre.y),
          x2: toX(node.x),
          y2: toY(node.y),
          stroke: isUnlocked ? '#34d399' : isDark ? '#475569' : '#94a3b8',
          strokeWidth: 2.2,
        });
      }),
    ),
    // Graph Nodes
    state.nodes.map((node) => {
      const cx = toX(node.x);
      const cy = toY(node.y);
      const isSelected = node.id === selectedNodeId;
      const isCached = Boolean(state.offlineContents[node.id]);
      const statusColor =
        node.status === 'mastered'
          ? '#34d399'
          : node.status === 'learning'
            ? '#f5b942'
            : '#64748b';
      return createElement(
        'g',
        {
          key: node.id,
          style: { cursor: 'pointer' },
          onClick: () => onSelectNode(node.id),
        },
        isSelected
          ? createElement('circle', {
              cx,
              cy,
              r: 22,
              fill: `${statusColor}22`,
              stroke: statusColor,
              strokeWidth: 1.5,
              strokeDasharray: '3 2',
            })
          : null,
        createElement('circle', {
          cx,
          cy,
          r: 15,
          fill: isDark ? '#18181b' : '#ffffff',
          stroke: statusColor,
          strokeWidth: isSelected ? 2.8 : 2,
        }),
        createElement(
          'text',
          {
            x: cx,
            y: cy + 3.5,
            textAnchor: 'middle',
            fill: statusColor,
            fontSize: '8.5',
            fontWeight: '700',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          },
          node.code,
        ),
        createElement(
          'text',
          {
            x: cx,
            y: cy + 28,
            textAnchor: 'middle',
            fill: isSelected ? (isDark ? '#fde68a' : '#92560c') : isDark ? '#e2e8f0' : '#334155',
            fontSize: '9.5',
            fontWeight: isSelected ? '700' : '500',
          },
          `${node.title.slice(0, 10)}${isCached ? ' ●' : ' ○'}`,
        ),
      );
    }),
  );
}

export function KnowledgeGraphCornerHub({
  localDay,
  totalStudyMinutesLive = 0,
  onLogStudyMinutes,
}: {
  localDay: string;
  totalStudyMinutesLive?: number;
  onLogStudyMinutes?: (title: string, mins: number) => void;
}) {
  const { scheme } = useTheme();
  const { t } = useI18n();
  const isDark = scheme === 'dark';

  const [kgState, setKgState] = useState<KnowledgeGraphState>(readKnowledgeGraphState);
  const [selectedDomain, setSelectedDomain] = useState<KnowledgeDomainId | 'all'>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node-transformer');
  const [showPackManager, setShowPackManager] = useState(false);
  const [showAddNodeBox, setShowAddNodeBox] = useState(false);
  const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);

  // Custom Markdown Node inputs
  const [customTitle, setCustomTitle] = useState('');
  const [customDomain, setCustomDomain] = useState<KnowledgeDomainId>('ai-infra');
  const [customMd, setCustomMd] = useState('');

  const bkState = readBookkeepingState();
  const stats = useMemo(() => computeKnowledgeGraphStats(kgState), [kgState]);
  const unlockables = useMemo(
    () =>
      computeStudioUnlockables({
        currentSavedCny: bkState.wealthPlan.currentSavedCny,
        totalStudyMinutes: Math.max(stats.totalStudyMinutes, totalStudyMinutesLive),
        teamStreakDays: bkState.coupleProfile.teamStreakDays,
        masteredNodesCount: stats.masteredCount,
      }),
    [bkState.wealthPlan.currentSavedCny, bkState.coupleProfile.teamStreakDays, stats.totalStudyMinutes, stats.masteredCount, totalStudyMinutesLive],
  );

  const selectedNode = useMemo(
    () => kgState.nodes.find((n) => n.id === selectedNodeId) ?? kgState.nodes[0]!,
    [kgState.nodes, selectedNodeId],
  );
  const selectedContent = kgState.offlineContents[selectedNode.id] ?? null;

  const pal = isDark
    ? {
        bg: '#141311',
        cardBg: '#191816',
        elevated: '#201e1b',
        border: 'rgba(255, 255, 255, 0.10)',
        goldBorder: 'rgba(245, 185, 66, 0.32)',
        ink: '#f8fafc',
        sub: '#cbd5e1',
        muted: '#94a3b8',
        gold: '#f5b942',
        goldText: '#fde68a',
        emerald: '#34d399',
        sky: '#38bdf8',
        pillBg: 'rgba(255, 255, 255, 0.06)',
        pillActiveBg: 'rgba(245, 185, 66, 0.16)',
        inputBg: '#0e0d0b',
      }
    : {
        bg: '#f7f4ec',
        cardBg: '#ffffff',
        elevated: '#faf8f2',
        border: 'rgba(38, 36, 31, 0.12)',
        goldBorder: 'rgba(184, 130, 40, 0.32)',
        ink: '#26241f',
        sub: '#524e46',
        muted: '#7a756c',
        gold: '#b88228',
        goldText: '#92560c',
        emerald: '#1f5e4b',
        sky: '#0284c7',
        pillBg: 'rgba(38, 36, 31, 0.05)',
        pillActiveBg: 'rgba(204, 120, 92, 0.14)',
        inputBg: '#f3efe6',
      };

  const visibleNodes = useMemo(
    () =>
      selectedDomain === 'all'
        ? kgState.nodes
        : kgState.nodes.filter((n) => n.domainId === selectedDomain),
    [kgState.nodes, selectedDomain],
  );

  return (
    <View style={[styles.container, { backgroundColor: pal.bg, borderColor: pal.goldBorder }]}>
      {/* 1. Studio Level & Gear Unlockables Strip (2.5D 书房财富与自律装扮升级) */}
      <View style={[styles.topStrip, { backgroundColor: pal.elevated, borderBottomColor: pal.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontWeight: '700' }}>
            {t('书房藏品与等级解锁（随净资产、双人连击与知识节点自动进化）', 'Studio Gear & Level Unlocks')}
          </Text>
          <Text variant="caption" style={{ color: pal.muted, fontSize: 10, fontFamily: theme.fontFamily.mono }}>
            {t(
              `已解锁 ${unlockables.filter((u) => u.unlocked).length}/${unlockables.length} 件微缩陈列`,
              `Unlocked ${unlockables.filter((u) => u.unlocked).length}/${unlockables.length}`,
            )}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {unlockables.map((item) => (
            <View
              key={item.id}
              style={[
                styles.gearBadge,
                {
                  backgroundColor: item.unlocked ? `${item.color}18` : pal.pillBg,
                  borderColor: item.unlocked ? item.color : pal.border,
                  opacity: item.unlocked ? 1 : 0.65,
                },
              ]}
            >
              <Text variant="caption" style={{ color: item.unlocked ? item.color : pal.muted, fontSize: 10.5, fontWeight: '700' }}>
                {`[${item.icon}] ${t(item.titleZh, item.titleEn)} ${item.unlocked ? '✓' : `${item.progressPct}%`}`}
              </Text>
              <Text variant="caption" style={{ color: pal.muted, fontSize: 9 }}>
                {item.requirementZh}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* 2. Knowledge Graph Header & On-Demand Offline Chapter Pack Controls */}
      <View style={[styles.headerRow, { borderBottomColor: pal.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <Text variant="label" style={{ color: pal.ink, fontSize: 13.5, fontWeight: '700' }}>
            {t('学习角 · 个人知识图谱', 'Study Corner · Knowledge Graph')}
          </Text>
          <View style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}>
            <Text variant="caption" style={{ color: pal.goldText, fontSize: 10, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
              {t(
                `主包骨架仅 4KB · 已按需缓存 ${stats.installedPacksCount}/${stats.totalCatalogPacksCount} 章节包 (${stats.cachedSizeKb} KB)`,
                `Index 4KB · Cached ${stats.installedPacksCount}/${stats.totalCatalogPacksCount} packs (${stats.cachedSizeKb} KB)`,
              )}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="打开离线章节包按需下载与卸载管理器"
            onPress={() => setShowPackManager((prev) => !prev)}
            style={[
              styles.microBtn,
              {
                backgroundColor: showPackManager ? pal.pillActiveBg : pal.pillBg,
                borderColor: showPackManager ? pal.gold : pal.sky,
              },
            ]}
          >
            <Text variant="caption" style={{ color: showPackManager ? pal.goldText : pal.sky, fontSize: 10.5, fontWeight: '700' }}>
              {showPackManager ? t('收起离线章节包 ▲', 'Close Packs ▲') : t('离线章节包管理 (按需下载/卸载)', 'Offline Chapter Packs')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="新建或导入支持双向链接的自定义知识图谱节点"
            onPress={() => setShowAddNodeBox((prev) => !prev)}
            style={[styles.microBtn, { backgroundColor: pal.pillBg, borderColor: pal.border }]}
          >
            <Text variant="caption" style={{ color: pal.ink, fontSize: 10.5, fontWeight: '600' }}>
              {showAddNodeBox ? t('收起新建', 'Close') : t('＋ 导入/新建 [[双链]] 节点', '＋ Add [[Wiki]] Node')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 3. On-Demand Offline Chapter Pack Manager Drawer (Kiwix / Obsidian / Anki Pattern) */}
      {showPackManager ? (
        <View style={[styles.drawerBox, { backgroundColor: pal.elevated, borderBottomColor: pal.border }]}>
          <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5, lineHeight: 16 }}>
            {t(
              '架构说明：借鉴 Obsidian / Kiwix / Anki 开源方案，App 本体仅内置 <4KB 的「知识图谱拓扑骨架（节点坐标、前置依赖与掌握进度）」，绝不撑大安装包体积；详细推导公式、代码模板与复习闪卡按章节包按需下载到本地缓存，学完可随时卸载释放空间且不丢失学习记录。',
              'Zero-bloat architecture: App ships only a <4KB graph skeleton index. Heavy chapter notes & flashcards are downloaded/cached on demand and can be offloaded anytime.',
            )}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CATALOG_CHAPTER_PACKS.map((pack) => {
              const isInstalled = kgState.installedPackIds.includes(pack.id);
              return (
                <View
                  key={pack.id}
                  style={[
                    styles.packCard,
                    {
                      backgroundColor: pal.cardBg,
                      borderColor: isInstalled ? pal.emerald : pal.border,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text variant="caption" style={{ color: pal.ink, fontSize: 11.5, fontWeight: '700' }}>
                      {`[${pack.icon}] ${t(pack.titleZh, pack.titleEn)}`}
                    </Text>
                    <Text variant="caption" style={{ color: pal.muted, fontSize: 9.5, fontFamily: theme.fontFamily.mono }}>
                      {`${pack.version} · ${pack.sizeKb} KB`}
                    </Text>
                  </View>
                  <Text variant="caption" style={{ color: pal.sub, fontSize: 10 }}>
                    {pack.descriptionZh}
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <Text
                      variant="caption"
                      style={{
                        color: isInstalled ? pal.emerald : pal.muted,
                        fontSize: 10,
                        fontWeight: '700',
                      }}
                    >
                      {isInstalled ? t('● 已缓存离线包', '● Cached Offline') : t('○ 未下载（仅骨架）', '○ Skeleton Only')}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={isInstalled ? `卸载章节包 ${pack.titleZh}` : `离线下载章节包 ${pack.titleZh}`}
                      onPress={() => {
                        if (isInstalled) {
                          setKgState(offloadKnowledgeChapterPack(pack.id));
                          showToast({
                            text: t(
                              `已卸载「${pack.titleZh}」正文缓存（释放 ${pack.sizeKb} KB，节点掌握进度已保留）`,
                              `Offloaded ${pack.titleEn} (${pack.sizeKb} KB freed)`,
                            ),
                          });
                        } else {
                          const { state: next } = installKnowledgeChapterPack(pack.id);
                          setKgState(next);
                          showToast({
                            text: t(
                              `✓ 已离线缓存「${pack.titleZh}」（${pack.sizeKb} KB），断网可随时查阅推导与闪卡`,
                              `✓ Cached ${pack.titleEn} offline`,
                            ),
                          });
                        }
                      }}
                      style={[
                        styles.microBtn,
                        {
                          backgroundColor: isInstalled ? pal.pillBg : `${pal.emerald}20`,
                          borderColor: isInstalled ? pal.border : pal.emerald,
                        },
                      ]}
                    >
                      <Text
                        variant="caption"
                        style={{
                          color: isInstalled ? pal.sub : pal.emerald,
                          fontSize: 10,
                          fontWeight: '700',
                        }}
                      >
                        {isInstalled ? t('卸载释放空间', 'Offload') : t('⬇ 离线下载章节', '⬇ Download Pack')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* 4. Add Custom Markdown [[WikiLink]] Node Drawer */}
      {showAddNodeBox ? (
        <View style={[styles.drawerBox, { backgroundColor: pal.elevated, borderBottomColor: pal.border }]}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextInput
              value={customTitle}
              onChangeText={setCustomTitle}
              placeholder={t('节点名称（如：FlashAttention-3 异步流水线）', 'Node title…')}
              placeholderTextColor={pal.muted}
              style={[styles.inputField, { flex: 1, minWidth: 160, backgroundColor: pal.inputBg, borderColor: pal.border, color: pal.ink }]}
            />
            {KNOWLEDGE_DOMAINS.map((d) => {
              const sel = customDomain === d.id;
              return (
                <Pressable
                  key={d.id}
                  onPress={() => setCustomDomain(d.id)}
                  style={[styles.microBtn, { backgroundColor: sel ? `${d.color}22` : pal.pillBg, borderColor: sel ? d.color : pal.border }]}
                >
                  <Text variant="caption" style={{ color: sel ? d.color : pal.sub, fontSize: 10 }}>
                    {`[${d.icon}] ${d.zh}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <TextInput
              value={customMd}
              onChangeText={setCustomMd}
              placeholder={t('支持 [[AI-101]] 或 [[Transformer]] 双向链接语法，自动构建图谱连线…', 'Markdown notes with [[WikiLinks]]…')}
              placeholderTextColor={pal.muted}
              style={[styles.inputField, { flex: 1, backgroundColor: pal.inputBg, borderColor: pal.border, color: pal.ink }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="保存自定义双链知识节点"
              onPress={() => {
                const { state: next, addedNode } = importCustomMarkdownKnowledgeNode({
                  title: customTitle,
                  domainId: customDomain,
                  markdownBody: customMd || `关联 [[AI-101]] 核心推导笔记`,
                  prerequisiteNodeId: selectedNode.id,
                });
                setKgState(next);
                setSelectedNodeId(addedNode.id);
                setCustomTitle('');
                setCustomMd('');
                setShowAddNodeBox(false);
                showToast({ text: t(`✓ 已将节点「${addedNode.title}」加入知识图谱`, `✓ Added node ${addedNode.title}`) });
              }}
              style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
            >
              <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                {t('加入图谱', 'Add Node')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* 5. Main Split View: Left Interactive DAG Graph & Node List | Right Offline Chapter Reader & Flashcard */}
      <View style={styles.mainSplit}>
        {/* Left: Domain Filter + SVG Graph + Node Pills */}
        <View style={[styles.leftCol, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            <Pressable
              onPress={() => setSelectedDomain('all')}
              style={[
                styles.microBtn,
                {
                  backgroundColor: selectedDomain === 'all' ? pal.pillActiveBg : pal.pillBg,
                  borderColor: selectedDomain === 'all' ? pal.gold : pal.border,
                },
              ]}
            >
              <Text variant="caption" style={{ color: selectedDomain === 'all' ? pal.goldText : pal.sub, fontSize: 10, fontWeight: '700' }}>
                {t(`全部领域 (${kgState.nodes.length})`, `All (${kgState.nodes.length})`)}
              </Text>
            </Pressable>
            {KNOWLEDGE_DOMAINS.map((dom) => {
              const active = selectedDomain === dom.id;
              return (
                <Pressable
                  key={dom.id}
                  onPress={() => setSelectedDomain(dom.id)}
                  style={[
                    styles.microBtn,
                    {
                      backgroundColor: active ? `${dom.color}22` : pal.pillBg,
                      borderColor: active ? dom.color : pal.border,
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: active ? dom.color : pal.sub, fontSize: 10, fontWeight: active ? '700' : '500' }}>
                    {`[${dom.icon}] ${t(dom.zh, dom.en)}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <KnowledgeGraphSvgCanvas
            state={{ ...kgState, nodes: visibleNodes }}
            selectedNodeId={selectedNode.id}
            onSelectNode={(id) => {
              setSelectedNodeId(id);
              setShowFlashcardAnswer(false);
            }}
            isDark={isDark}
          />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {visibleNodes.map((node) => {
              const active = node.id === selectedNode.id;
              const isCached = Boolean(kgState.offlineContents[node.id]);
              return (
                <Pressable
                  key={node.id}
                  accessibilityRole="button"
                  accessibilityLabel={`选择知识节点 ${node.title}`}
                  onPress={() => {
                    setSelectedNodeId(node.id);
                    setShowFlashcardAnswer(false);
                  }}
                  style={[
                    styles.microBtn,
                    {
                      backgroundColor: active ? pal.pillActiveBg : pal.pillBg,
                      borderColor: active ? pal.gold : pal.border,
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: active ? pal.goldText : pal.ink, fontSize: 10.5, fontWeight: active ? '700' : '500' }}>
                    {`${node.code} · ${node.title.slice(0, 12)} ${isCached ? '●' : '○'}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Right: Selected Node Inspector + On-Demand Offline Chapter Reader + Spaced Repetition Flashcard */}
        <View style={[styles.rightCol, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}>
                <Text variant="caption" style={{ color: pal.goldText, fontSize: 10, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
                  {selectedNode.code}
                </Text>
              </View>
              <Text variant="label" style={{ color: pal.ink, fontSize: 13, fontWeight: '700' }}>
                {selectedNode.title}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 5 }}>
              {(
                [
                  { id: 'locked', label: t('待解锁', 'Locked'), color: pal.muted },
                  { id: 'learning', label: t('学习中', 'Learning'), color: pal.gold },
                  { id: 'mastered', label: t('✓ 已掌握', '✓ Mastered'), color: pal.emerald },
                ] as const
              ).map((st) => {
                const active = selectedNode.status === st.id;
                return (
                  <Pressable
                    key={st.id}
                    accessibilityRole="button"
                    accessibilityLabel={`标记节点状态为 ${st.label}`}
                    onPress={() => {
                      const next = updateKnowledgeNodeProgress(selectedNode.id, { status: st.id });
                      setKgState(next);
                      if (st.id === 'mastered') {
                        recordPledgeReward(`点亮知识图谱节点：${selectedNode.title}`, localDay, 20);
                        showToast({ text: t(`✓ 已点亮节点「${selectedNode.title}」，心愿金库 +¥20`, '✓ Mastered node +¥20') });
                      }
                    }}
                    style={[
                      styles.microBtn,
                      {
                        backgroundColor: active ? `${st.color}22` : pal.pillBg,
                        borderColor: active ? st.color : pal.border,
                      },
                    ]}
                  >
                    <Text variant="caption" style={{ color: active ? st.color : pal.sub, fontSize: 10, fontWeight: active ? '700' : '500' }}>
                      {st.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text variant="caption" style={{ color: pal.sub, fontSize: 11 }}>
            {selectedNode.summary}
          </Text>

          {/* Check if offline chapter pack is installed for this node */}
          {selectedContent ? (
            <View style={{ gap: 8 }}>
              <View style={[styles.contentBox, { backgroundColor: pal.elevated, borderColor: pal.border }]}>
                <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                  {t('核心心智模型 (Mental Model)', 'Core Mental Model')}
                </Text>
                <Text variant="caption" style={{ color: pal.ink, fontSize: 11, lineHeight: 16 }}>
                  {selectedContent.coreMentalModel}
                </Text>
                {selectedContent.keyTakeaways.map((pt, idx) => (
                  <Text key={idx} variant="caption" style={{ color: pal.sub, fontSize: 10.5 }}>
                    {`• ${pt}`}
                  </Text>
                ))}
                <View style={[styles.codeBox, { backgroundColor: pal.inputBg, borderColor: pal.border }]}>
                  <Text variant="caption" style={{ color: pal.emerald, fontSize: 10, fontFamily: theme.fontFamily.mono }}>
                    {selectedContent.codeOrFormulaSnippet}
                  </Text>
                </View>
              </View>

              {/* Active Recall Flashcard + 1-Click Study Session Logger */}
              {selectedContent.flashcards[0] ? (
                <View style={[styles.contentBox, { backgroundColor: pal.elevated, borderColor: pal.goldBorder }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                      {`间隔重复闪卡 (Lv.${selectedNode.reviewLevel}) · Q: ${selectedContent.flashcards[0].q}`}
                    </Text>
                    <Pressable
                      onPress={() => setShowFlashcardAnswer((prev) => !prev)}
                      style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
                    >
                      <Text variant="caption" style={{ color: pal.goldText, fontSize: 9.5, fontWeight: '700' }}>
                        {showFlashcardAnswer ? t('隐藏答案', 'Hide') : t('翻转看答案', 'Flip Answer')}
                      </Text>
                    </Pressable>
                  </View>
                  {showFlashcardAnswer ? (
                    <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5 }}>
                      {`A: ${selectedContent.flashcards[0].a}`}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            <View style={[styles.contentBox, { backgroundColor: pal.elevated, borderColor: pal.goldBorder, alignItems: 'flex-start' }]}>
              <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontWeight: '700' }}>
                {t('该章节详细讲义与闪卡尚未下载到本地', 'Chapter pack not cached locally yet')}
              </Text>
              <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5 }}>
                {t(
                  '当前仅展示 <1KB 轻量拓扑节点骨架；点击下方按钮即可按需拉取并缓存该章节离线包。',
                  'Only lightweight node topology is loaded. Click below to cache the chapter pack offline.',
                )}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`立即下载并缓存 ${selectedNode.title} 所属离线章节包`}
                onPress={() => {
                  const { state: next, pack } = installKnowledgeChapterPack(selectedNode.packId);
                  setKgState(next);
                  showToast({
                    text: t(
                      `✓ 已按需下载并缓存「${pack?.titleZh ?? selectedNode.packId}」（${pack?.sizeKb ?? 20} KB）`,
                      '✓ Downloaded chapter pack offline',
                    ),
                  });
                }}
                style={[styles.microBtn, { backgroundColor: `${pal.emerald}22`, borderColor: pal.emerald }]}
              >
                <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, fontWeight: '700' }}>
                  {t('⬇ 一键下载该章节离线包 (约 20 KB)', '⬇ Download Offline Chapter Pack')}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Bottom Bar: Log 25m Pomodoro to this Knowledge Node */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text variant="caption" style={{ color: pal.muted, fontSize: 10, fontFamily: theme.fontFamily.mono }}>
              {`已在该节点投入 ${selectedNode.studyMinutes} 分钟 · 关联节点 ${selectedNode.bidirectionalLinks.length} 个`}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`在节点 ${selectedNode.title} 打卡 25 分钟深度研读`}
              onPress={() => {
                const next = updateKnowledgeNodeProgress(selectedNode.id, {
                  studyMinutes: selectedNode.studyMinutes + 25,
                  reviewLevel: selectedNode.reviewLevel + 1,
                });
                setKgState(next);
                onLogStudyMinutes?.(selectedNode.title, 25);
                recordPledgeReward(`知识图谱研读：${selectedNode.title} +25m`, localDay, 15);
                showToast({
                  text: t(
                    `✓ 已记入「${selectedNode.title}」+25m 研读时长，同步至 24H 时间轴与心愿金库 (+¥15)`,
                    `✓ Logged +25m on ${selectedNode.title}`,
                  ),
                });
              }}
              style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
            >
              <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                {t('＋ 研读打卡 25m（同步时间轴 & +¥15）', '＋ Log 25m Study')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 8,
  },
  topStrip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 6,
  },
  gearBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    gap: 1,
  },
  headerRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  drawerBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  packCard: {
    flex: 1,
    minWidth: 210,
    padding: 9,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  mainSplit: {
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  leftCol: {
    flex: 1,
    minWidth: 280,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  rightCol: {
    flex: 1.15,
    minWidth: 290,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  contentBox: {
    padding: 9,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  codeBox: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 2,
  },
  microBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  inputField: {
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    fontSize: 11,
  },
});
