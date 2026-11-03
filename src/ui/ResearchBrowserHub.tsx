import { createElement, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  BROWSER_HOT_QUERIES,
  BROWSER_SEARCH_ENGINES,
  buildStructuredMindMapForResult,
  type BrowserBookmarkItem,
  type BrowserSearchEngineId,
  type BrowserSearchResultItem,
  type BrowserViewMode,
  clipCustomNewsArticle,
  DEFAULT_BROWSER_BOOKMARKS,
  executeInAppBrowserSearch,
  importCustomMarkdownKnowledgeNode,
  readKnowledgeGraphState,
  searchLocalKnowledgeAndNews,
} from '@/core/knowledge-graph-corner';
import { recordPledgeReward } from '@/data/life-gamification';
import { incrementOrAddTimeBlock } from '@/data/time-block-tracker';

import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { showToast } from './toast';
import { useI18n } from './use-i18n';

export type BrowserTabSession = {
  id: string;
  title: string;
  queryInput: string;
  engine: BrowserSearchEngineId;
  viewMode: BrowserViewMode;
  results: BrowserSearchResultItem[];
  selectedResultId: string;
  history: string[];
  historyIdx: number;
};

export function createInitialBrowserTab(
  id: string,
  initialQuery = 'DeepSeek-R1',
  initialEngine: BrowserSearchEngineId = 'smart-all',
): BrowserTabSession {
  const initialResults = searchLocalKnowledgeAndNews(initialQuery, readKnowledgeGraphState());
  return {
    id,
    title: initialQuery,
    queryInput: initialQuery,
    engine: initialEngine,
    viewMode: 'reader',
    results: initialResults,
    selectedResultId: initialResults[0]?.id ?? '',
    history: [initialQuery],
    historyIdx: 0,
  };
}

export function ResearchBrowserHub({
  localDay,
  onSaveStudyRecord,
  onJumpToStudyTab,
}: {
  localDay: string;
  onSaveStudyRecord?: (topic: string, mins: number, note: string) => void;
  onJumpToStudyTab?: () => void;
}) {
  const { scheme } = useTheme();
  const { t } = useI18n();
  const isDark = scheme === 'dark';

  const [tabs, setTabs] = useState<BrowserTabSession[]>(() => [
    createInitialBrowserTab('tab-1', 'DeepSeek-R1', 'smart-all'),
    createInitialBrowserTab('tab-2', 'vLLM MCP', 'github'),
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  const [searching, setSearching] = useState<boolean>(false);
  const [bookmarks, setBookmarks] = useState<BrowserBookmarkItem[]>(() => [
    ...DEFAULT_BROWSER_BOOKMARKS,
  ]);
  const [iframeReloadTick, setIframeReloadTick] = useState<number>(0);

  const activeTab = useMemo(
    () => tabs.find((tb) => tb.id === activeTabId) ?? tabs[0]!,
    [tabs, activeTabId],
  );

  const activeResult = useMemo(
    () =>
      activeTab.results.find((item) => item.id === activeTab.selectedResultId) ??
      activeTab.results[0] ??
      null,
    [activeTab.results, activeTab.selectedResultId],
  );

  const activeMindMap = useMemo(
    () => (activeResult ? buildStructuredMindMapForResult(activeResult) : null),
    [activeResult],
  );

  const pal = isDark
    ? {
        deskBg: '#11100e',
        paperBg: '#191714',
        paperElevated: '#211e1a',
        spineShadow: '#0a0907',
        border: 'rgba(235, 220, 190, 0.14)',
        goldBorder: 'rgba(217, 169, 78, 0.36)',
        ink: '#f3efe6',
        sub: '#cbc3b3',
        muted: '#948c7d',
        gold: '#d9a94e',
        goldText: '#fde68a',
        emerald: '#34d399',
        pillActiveBg: 'rgba(217, 169, 78, 0.18)',
        inputBg: '#12100d',
      }
    : {
        deskBg: '#efeadd',
        paperBg: '#fbf8f0',
        paperElevated: '#f4efe2',
        spineShadow: '#dfd7c4',
        border: 'rgba(60, 50, 35, 0.14)',
        goldBorder: 'rgba(146, 104, 41, 0.32)',
        ink: '#26221b',
        sub: '#574f42',
        muted: '#857b6b',
        gold: '#92560c',
        goldText: '#7c4308',
        emerald: '#1f5e4b',
        pillActiveBg: 'rgba(184, 130, 40, 0.15)',
        inputBg: '#f3ede0',
      };

  function updateActiveTab(patch: Partial<BrowserTabSession>) {
    setTabs((prev) =>
      prev.map((tb) => (tb.id === activeTab.id ? { ...tb, ...patch } : tb)),
    );
  }

  async function runDirectSearch(
    rawInput: string,
    engineOverride?: BrowserSearchEngineId,
    pushHistory = true,
  ) {
    const targetEngine = engineOverride ?? activeTab.engine;
    const trimmed = rawInput.trim() || 'Transformer';
    setSearching(true);

    const nextHistory = pushHistory
      ? (() => {
          const sliced = activeTab.history.slice(0, activeTab.historyIdx + 1);
          if (sliced[sliced.length - 1] === trimmed) return sliced;
          return [...sliced, trimmed];
        })()
      : activeTab.history;
    const nextHistoryIdx = pushHistory ? nextHistory.length - 1 : activeTab.historyIdx;

    updateActiveTab({
      title: trimmed.slice(0, 18),
      queryInput: trimmed,
      engine: targetEngine,
      history: nextHistory,
      historyIdx: nextHistoryIdx,
    });

    try {
      const res = await executeInAppBrowserSearch({
        query: trimmed,
        engine: targetEngine,
        state: readKnowledgeGraphState(),
      });
      setTabs((prev) =>
        prev.map((tb) =>
          tb.id === activeTab.id
            ? {
                ...tb,
                title: trimmed.slice(0, 18),
                queryInput: trimmed,
                engine: targetEngine,
                results: res.results,
                selectedResultId: res.results[0]?.id ?? '',
                viewMode: res.resolvedOmnibox.kind === 'url' ? 'webview' : tb.viewMode,
                history: nextHistory,
                historyIdx: nextHistoryIdx,
              }
            : tb,
        ),
      );
    } finally {
      setSearching(false);
    }
  }

  function handleAddNewTab(presetQuery = 'Transformer', presetEngine: BrowserSearchEngineId = 'smart-all') {
    const newId = `tab-${Date.now()}`;
    const nextTab = createInitialBrowserTab(newId, presetQuery, presetEngine);
    setTabs((prev) => [...prev, nextTab]);
    setActiveTabId(newId);
    void executeInAppBrowserSearch({
      query: presetQuery,
      engine: presetEngine,
      state: readKnowledgeGraphState(),
    }).then((res) => {
      setTabs((prev) =>
        prev.map((tb) =>
          tb.id === newId
            ? {
                ...tb,
                results: res.results,
                selectedResultId: res.results[0]?.id ?? '',
              }
            : tb,
        ),
      );
    });
  }

  function handleCloseTab(tabId: string) {
    if (tabs.length <= 1) return;
    const nextTabs = tabs.filter((tb) => tb.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId && nextTabs[0]) {
      setActiveTabId(nextTabs[0].id);
    }
  }

  function openExternalUrl(url: string) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <View style={[styles.browserFrame, { backgroundColor: pal.deskBg, borderColor: pal.goldBorder }]}>
      {/* 1. Multi-Tab Strip (多标签页栏 + 三模视图切换: 纸书净读 / 思维导图拆解 / 网页原貌) */}
      <View style={[styles.tabStripBar, { backgroundColor: pal.paperElevated, borderBottomColor: pal.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {tabs.map((tb, idx) => {
            const isCurrent = tb.id === activeTab.id;
            const engMeta = BROWSER_SEARCH_ENGINES.find((e) => e.id === tb.engine);
            return (
              <View
                key={tb.id}
                style={[
                  styles.browserTabPill,
                  {
                    backgroundColor: isCurrent ? pal.paperBg : 'transparent',
                    borderColor: isCurrent ? pal.gold : pal.border,
                  },
                ]}
              >
                <Pressable
                  onPress={() => setActiveTabId(tb.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                >
                  <Text
                    variant="caption"
                    style={{
                      color: isCurrent ? pal.goldText : pal.sub,
                      fontSize: 11.5,
                      fontFamily: theme.fontFamily.serif,
                      fontWeight: isCurrent ? '700' : '500',
                    }}
                  >
                    {`${engMeta?.icon ?? '🌐'} 标签 ${idx + 1}: ${tb.title || '新标签页'}`}
                  </Text>
                </Pressable>
                {tabs.length > 1 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`关闭标签页 ${tb.title}`}
                    onPress={() => handleCloseTab(tb.id)}
                    style={{ paddingHorizontal: 4 }}
                  >
                    <Text variant="caption" style={{ color: pal.muted, fontSize: 11 }}>
                      ✕
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="新建浏览器标签页"
            onPress={() => handleAddNewTab('MCP Agent', 'github')}
            style={[styles.microBtn, { borderColor: pal.gold, backgroundColor: pal.pillActiveBg }]}
          >
            <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontWeight: '700' }}>
              {t('＋ 新建标签页', '＋ New Tab')}
            </Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Pressable
            onPress={() => updateActiveTab({ viewMode: 'reader' })}
            style={[
              styles.microBtn,
              {
                borderColor: activeTab.viewMode === 'reader' ? pal.gold : pal.border,
                backgroundColor: activeTab.viewMode === 'reader' ? pal.pillActiveBg : pal.paperBg,
              },
            ]}
          >
            <Text
              variant="caption"
              style={{
                color: activeTab.viewMode === 'reader' ? pal.goldText : pal.sub,
                fontSize: 11,
                fontFamily: theme.fontFamily.serif,
                fontWeight: '700',
              }}
            >
              {t('📖 纸书净读模式', '📖 Book Reader')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => updateActiveTab({ viewMode: 'mindmap' })}
            style={[
              styles.microBtn,
              {
                borderColor: activeTab.viewMode === 'mindmap' ? pal.emerald : pal.border,
                backgroundColor: activeTab.viewMode === 'mindmap' ? pal.pillActiveBg : pal.paperBg,
              },
            ]}
          >
            <Text
              variant="caption"
              style={{
                color: activeTab.viewMode === 'mindmap' ? pal.emerald : pal.sub,
                fontSize: 11,
                fontFamily: theme.fontFamily.serif,
                fontWeight: '700',
              }}
            >
              {t('🕸️ AI 思维导图拆解', '🕸️ Mind Map')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => updateActiveTab({ viewMode: 'webview' })}
            style={[
              styles.microBtn,
              {
                borderColor: activeTab.viewMode === 'webview' ? pal.gold : pal.border,
                backgroundColor: activeTab.viewMode === 'webview' ? pal.pillActiveBg : pal.paperBg,
              },
            ]}
          >
            <Text
              variant="caption"
              style={{
                color: activeTab.viewMode === 'webview' ? pal.goldText : pal.sub,
                fontSize: 11,
                fontFamily: theme.fontFamily.serif,
                fontWeight: '700',
              }}
            >
              {t('🖥 网页原貌窗口', '🖥 Web View')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 2. Omnibox Search Bar + 7 Search Engine Pills + Bookmarks Bar */}
      <View style={[styles.omniboxSection, { backgroundColor: pal.paperElevated, borderBottomColor: pal.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="后退"
              disabled={activeTab.historyIdx <= 0}
              onPress={() => {
                if (activeTab.historyIdx > 0) {
                  const nextIdx = activeTab.historyIdx - 1;
                  const prevQ = activeTab.history[nextIdx];
                  if (prevQ) {
                    updateActiveTab({ historyIdx: nextIdx });
                    void runDirectSearch(prevQ, activeTab.engine, false);
                  }
                }
              }}
              style={[styles.microBtn, { borderColor: pal.border, opacity: activeTab.historyIdx > 0 ? 1 : 0.4 }]}
            >
              <Text variant="caption" style={{ color: pal.ink, fontSize: 11, fontWeight: '700' }}>
                ◀
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="前进"
              disabled={activeTab.historyIdx >= activeTab.history.length - 1}
              onPress={() => {
                if (activeTab.historyIdx < activeTab.history.length - 1) {
                  const nextIdx = activeTab.historyIdx + 1;
                  const nextQ = activeTab.history[nextIdx];
                  if (nextQ) {
                    updateActiveTab({ historyIdx: nextIdx });
                    void runDirectSearch(nextQ, activeTab.engine, false);
                  }
                }
              }}
              style={[styles.microBtn, { borderColor: pal.border, opacity: activeTab.historyIdx < activeTab.history.length - 1 ? 1 : 0.4 }]}
            >
              <Text variant="caption" style={{ color: pal.ink, fontSize: 11, fontWeight: '700' }}>
                ▶
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="刷新"
              onPress={() => {
                setIframeReloadTick((t0) => t0 + 1);
                void runDirectSearch(activeTab.queryInput, activeTab.engine, false);
              }}
              style={[styles.microBtn, { borderColor: pal.border }]}
            >
              <Text variant="caption" style={{ color: pal.ink, fontSize: 11, fontWeight: '700' }}>
                ↻
              </Text>
            </Pressable>
          </View>

          <TextInput
            value={activeTab.queryInput}
            onChangeText={(txt) => updateActiveTab({ queryInput: txt })}
            onSubmitEditing={() => void runDirectSearch(activeTab.queryInput)}
            placeholder={t(
              '输入论文名 (ArXiv)、开源项目 (GitHub)、任意关键词或 https:// 网址回车直搜...',
              'Search ArXiv papers, GitHub repos, Google keywords, or enter https:// URL...',
            )}
            placeholderTextColor={pal.muted}
            style={[
              styles.omniboxInput,
              {
                borderColor: pal.gold,
                color: pal.ink,
                backgroundColor: pal.inputBg,
                fontFamily: theme.fontFamily.serif,
              },
            ]}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="立即执行搜索"
            onPress={() => void runDirectSearch(activeTab.queryInput)}
            style={[styles.primarySearchBtn, { backgroundColor: '#b88228', borderColor: '#b88228' }]}
          >
            <Text variant="caption" style={{ color: '#fffbeb', fontSize: 12.5, fontWeight: '700', fontFamily: theme.fontFamily.serif }}>
              {searching ? t('⏳ 正在检索...', '⏳ Searching...') : t('🔍 立即搜索', '🔍 Search')}
            </Text>
          </Pressable>

          {Platform.OS === 'web' ? (
            <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
              <Pressable
                onPress={() =>
                  openExternalUrl(
                    `https://www.google.com/search?q=${encodeURIComponent(activeTab.queryInput.trim() || 'AI')}`,
                  )
                }
                style={[styles.microBtn, { borderColor: pal.border, backgroundColor: pal.paperBg }]}
              >
                <Text variant="caption" style={{ color: pal.ink, fontSize: 10.5, fontFamily: theme.fontFamily.serif }}>
                  {t('↗ Google 直达', '↗ Google')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  openExternalUrl(
                    `https://arxiv.org/search/?query=${encodeURIComponent(activeTab.queryInput.trim() || 'Transformer')}&searchtype=all`,
                  )
                }
                style={[styles.microBtn, { borderColor: pal.border, backgroundColor: pal.paperBg }]}
              >
                <Text variant="caption" style={{ color: pal.ink, fontSize: 10.5, fontFamily: theme.fontFamily.serif }}>
                  {t('↗ ArXiv 直达', '↗ ArXiv')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  openExternalUrl(
                    `https://github.com/search?q=${encodeURIComponent(activeTab.queryInput.trim() || 'LLM')}&type=repositories`,
                  )
                }
                style={[styles.microBtn, { borderColor: pal.border, backgroundColor: pal.paperBg }]}
              >
                <Text variant="caption" style={{ color: pal.ink, fontSize: 10.5, fontFamily: theme.fontFamily.serif }}>
                  {t('↗ GitHub 直达', '↗ GitHub')}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* 7 Search Engine Selector Pills */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text variant="caption" style={{ color: pal.muted, fontSize: 11, fontFamily: theme.fontFamily.serif }}>
            {t('切换搜索引擎：', 'Search Engine:')}
          </Text>
          {BROWSER_SEARCH_ENGINES.map((eng) => {
            const isSel = activeTab.engine === eng.id;
            return (
              <Pressable
                key={eng.id}
                onPress={() => {
                  void runDirectSearch(activeTab.queryInput, eng.id, false);
                }}
                style={[
                  styles.microBtn,
                  {
                    borderColor: isSel ? pal.gold : pal.border,
                    backgroundColor: isSel ? pal.pillActiveBg : pal.paperBg,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{
                    color: isSel ? pal.goldText : pal.sub,
                    fontSize: 11,
                    fontFamily: theme.fontFamily.serif,
                    fontWeight: isSel ? '700' : '500',
                  }}
                >
                  {`${eng.icon} ${eng.zh}`}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Bookmarks & Hot Queries Row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text variant="caption" style={{ color: pal.muted, fontSize: 10.5, fontFamily: theme.fontFamily.serif }}>
              {t('⭐ 收藏书签：', '⭐ Bookmarks:')}
            </Text>
            {bookmarks.map((bm) => (
              <Pressable
                key={bm.id}
                onPress={() => void runDirectSearch(bm.queryOrUrl, bm.engineId, true)}
                style={[styles.microBtn, { borderColor: pal.border, backgroundColor: pal.paperBg }]}
              >
                <Text variant="caption" style={{ color: pal.ink, fontSize: 10.5, fontFamily: theme.fontFamily.serif }}>
                  {bm.title}
                </Text>
              </Pressable>
            ))}
            {activeResult ? (
              <Pressable
                onPress={() => {
                  const exists = bookmarks.some((b) => b.title === activeResult.title);
                  if (exists) {
                    showToast({ text: t('该词条已在书签栏中', 'Already bookmarked') });
                    return;
                  }
                  setBookmarks((prev) => [
                    ...prev,
                    {
                      id: `bm-${Date.now()}`,
                      title: `⭐ ${activeResult.title.slice(0, 14)}`,
                      url: activeResult.url,
                      engineId: activeTab.engine,
                      queryOrUrl: activeTab.queryInput,
                      badgeZh: activeResult.sourceBadgeZh,
                    },
                  ]);
                  showToast({ text: t('⭐ 已添加至浏览器书签栏！', '⭐ Added to Bookmarks!') });
                }}
                style={[styles.microBtn, { borderColor: pal.gold }]}
              >
                <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                  {t('＋ 收藏当前页', '＋ Bookmark')}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text variant="caption" style={{ color: pal.muted, fontSize: 10.5, fontFamily: theme.fontFamily.serif }}>
              {t('🔥 热门直搜：', '🔥 Hot:')}
            </Text>
            {BROWSER_HOT_QUERIES.map((hq) => (
              <Pressable
                key={hq.label}
                onPress={() => void runDirectSearch(hq.query, hq.engine ?? activeTab.engine, true)}
                style={[styles.microBtn, { borderColor: pal.border }]}
              >
                <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5, fontFamily: theme.fontFamily.serif }}>
                  {hq.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Search Result Cards Strip */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
          {activeTab.results.map((item) => {
            const isSel = activeResult?.id === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => updateActiveTab({ selectedResultId: item.id })}
                style={[
                  styles.resultCard,
                  {
                    borderColor: isSel ? pal.gold : pal.border,
                    backgroundColor: isSel ? pal.pillActiveBg : pal.paperBg,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <Text variant="caption" style={{ color: pal.goldText, fontSize: 10, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                    {item.sourceBadgeZh}
                  </Text>
                  <Text variant="caption" style={{ color: pal.emerald, fontSize: 10, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                    {`信噪比 ${item.signalScore}`}
                  </Text>
                </View>
                <Text
                  variant="caption"
                  numberOfLines={2}
                  style={{
                    color: isSel ? pal.goldText : pal.ink,
                    fontSize: 12,
                    fontFamily: theme.fontFamily.serif,
                    fontWeight: isSel ? '700' : '600',
                  }}
                >
                  {item.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 3. Main Browser Viewport: Reader Mode OR AI Mind-Map Mode OR Embedded Web Window */}
      <View style={{ padding: 16 }}>
        {activeResult ? (
          activeTab.viewMode === 'mindmap' && activeMindMap ? (
            <View style={[styles.bookPageFolio, { backgroundColor: pal.paperBg, borderColor: pal.goldBorder, borderLeftColor: pal.spineShadow }]}>
              <View style={[styles.bookRunningHeader, { borderBottomColor: pal.border }]}>
                <Text variant="caption" style={{ color: pal.emerald, fontSize: 12, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                  {`🕸️ AI 论文与项目结构化思维导图拆解 · ${activeMindMap.sourceBadgeZh}`}
                </Text>
                <Pressable
                  onPress={() => updateActiveTab({ viewMode: 'reader' })}
                  style={[styles.microBtn, { borderColor: pal.gold }]}
                >
                  <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                    {t('← 返回纸书全文净读', '← Back to Reader')}
                  </Text>
                </Pressable>
              </View>

              {/* Central Mind-Map Root Node */}
              <View style={[styles.mindMapRootCard, { backgroundColor: pal.paperElevated, borderColor: pal.gold }]}>
                <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                  {t('🌟 思维导图中心主题 (Root Node)', '🌟 Mind-Map Central Thesis')}
                </Text>
                <Text variant="title" style={{ color: pal.ink, fontSize: 20, lineHeight: 28, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                  {activeMindMap.centralTitle}
                </Text>
                <Text variant="body" style={{ color: pal.sub, fontSize: 13.5, lineHeight: 22, fontFamily: theme.fontFamily.serif }}>
                  {activeMindMap.oneLineEssenceZh}
                </Text>
              </View>

              {/* 4 Structured Mind-Map Branches */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {activeMindMap.branches.map((br) => (
                  <View
                    key={br.id}
                    style={[
                      styles.mindMapBranchCard,
                      {
                        backgroundColor: pal.paperElevated,
                        borderColor: pal.border,
                        borderLeftColor: br.colorHex,
                      },
                    ]}
                  >
                    <Text variant="label" style={{ color: br.colorHex, fontSize: 13.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                      {`${br.icon} ${br.labelZh}`}
                    </Text>
                    {br.bullets.map((bul, idx) => (
                      <Text
                        key={idx}
                        variant="body"
                        style={{
                          color: pal.ink,
                          fontSize: 13.5,
                          lineHeight: 22,
                          fontFamily: theme.fontFamily.serif,
                        }}
                      >
                        {`• ${bul}`}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>

              <View style={[styles.bookPageFooter, { borderTopColor: pal.border }]}>
                <Pressable
                  onPress={() => {
                    const { addedNode } = importCustomMarkdownKnowledgeNode({
                      title: `思维导图: ${activeResult.title.slice(0, 26)}`,
                      domainId: 'ai-infra',
                      markdownBody: activeMindMap.markdownExport,
                    });
                    onSaveStudyRecord?.(`思维导图精读: ${addedNode.title}`, 15, activeResult.sourceBadgeZh);
                    incrementOrAddTimeBlock({
                      localDay,
                      category: 'study',
                      title: `思维导图精读: ${addedNode.title}`,
                      deltaMinutes: 15,
                      goalId: null,
                    });
                    recordPledgeReward(localDay, 'study');
                    showToast({ text: t(`🕸️ 已将「${addedNode.title}」四维导图存入知识图谱并生成复习闪卡！`, '🕸️ Mind map saved to Knowledge Graph!') });
                  }}
                  style={[styles.pageTurnBtn, { backgroundColor: '#b88228', borderColor: '#b88228' }]}
                >
                  <Text variant="caption" style={{ color: '#fffbeb', fontSize: 12, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                    {t('📌 将整张思维导图存入我的知识图谱 (+15m)', '📌 Save Mind Map to Knowledge Graph (+15m)')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : activeTab.viewMode === 'reader' ? (
            <View style={[styles.bookPageFolio, { backgroundColor: pal.paperBg, borderColor: pal.goldBorder, borderLeftColor: pal.spineShadow }]}>
              <View style={[styles.bookRunningHeader, { borderBottomColor: pal.border }]}>
                <Text variant="caption" style={{ color: pal.muted, fontSize: 11.5, fontFamily: theme.fontFamily.serif }}>
                  {`🌐 探索浏览器 · 纸书净读模式 · ${activeResult.sourceBadgeZh}`}
                </Text>
                <Text variant="caption" style={{ color: pal.emerald, fontSize: 11.5, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                  {`信噪比评分 ${activeResult.signalScore}/100 · 预计阅读 ${activeResult.readMinutes} 分钟`}
                </Text>
              </View>

              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <Text variant="caption" style={{ color: pal.gold, fontSize: 11.5, fontFamily: theme.fontFamily.mono }}>
                    {`原文地址：${activeResult.url}`}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <Pressable
                      onPress={() => updateActiveTab({ viewMode: 'mindmap' })}
                      style={[styles.microBtn, { borderColor: pal.emerald }]}
                    >
                      <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                        {t('🕸️ 一键拆解为结构化思维导图 →', '🕸️ Deconstruct into Mind Map →')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => updateActiveTab({ viewMode: 'webview' })}
                      style={[styles.microBtn, { borderColor: pal.gold }]}
                    >
                      <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                        {t('🖥 切换至网页原貌窗口 →', '🖥 Switch to Web View →')}
                      </Text>
                    </Pressable>
                    {Platform.OS === 'web' ? (
                      <Pressable
                        onPress={() => openExternalUrl(activeResult.url)}
                        style={[styles.microBtn, { borderColor: pal.border }]}
                      >
                        <Text variant="caption" style={{ color: pal.ink, fontSize: 10.5, fontFamily: theme.fontFamily.serif }}>
                          {t('↗ 在新标签页打开原网页', '↗ Open External Tab')}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <Text
                  variant="title"
                  style={{
                    color: pal.ink,
                    fontSize: 22,
                    lineHeight: 32,
                    fontFamily: theme.fontFamily.serif,
                    fontWeight: '700',
                  }}
                >
                  {activeResult.title}
                </Text>
              </View>

              <View style={[styles.epigraphQuoteBox, { backgroundColor: pal.paperElevated, borderLeftColor: pal.gold, gap: 6 }]}>
                <Text variant="caption" style={{ color: pal.goldText, fontSize: 12, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                  {t('【核心提要 / Abstract】', '[Executive Summary / Abstract]')}
                </Text>
                <Text
                  variant="body"
                  style={{
                    color: pal.ink,
                    fontSize: 15,
                    lineHeight: 26,
                    fontFamily: theme.fontFamily.serif,
                  }}
                >
                  {activeResult.snippet}
                </Text>
              </View>

              <View style={{ gap: 14 }}>
                {activeResult.paragraphs.map((para, idx) => (
                  <Text
                    key={idx}
                    variant="body"
                    style={{
                      color: pal.ink,
                      fontSize: 16,
                      lineHeight: 29,
                      fontFamily: theme.fontFamily.serif,
                    }}
                  >
                    {`　　${para}`}
                  </Text>
                ))}
              </View>

              <View style={[styles.bookPageFooter, { borderTopColor: pal.border }]}>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Pressable
                    onPress={() => {
                      const { addedNode } = importCustomMarkdownKnowledgeNode({
                        title: activeResult.title.replace(/^【[^】]+】/, ''),
                        domainId: 'ai-infra',
                        markdownBody: `${activeResult.snippet}\n\n${activeResult.paragraphs.join('\n\n')}\n\n来源: ${activeResult.url} 关联 [[AI-101]]`,
                      });
                      onSaveStudyRecord?.(
                        `浏览器研读: ${addedNode.title}`,
                        15,
                        `来源: ${activeResult.sourceBadgeZh}`,
                      );
                      incrementOrAddTimeBlock({
                        localDay,
                        category: 'study',
                        title: `浏览器研读: ${addedNode.title}`,
                        deltaMinutes: 15,
                        goalId: null,
                      });
                      recordPledgeReward(localDay, 'study');
                      showToast({
                        text: t(
                          `📌 已将「${addedNode.title}」收录进知识图谱并记入 +15m 研读时长！`,
                          '📌 Saved to Knowledge Graph (+15m)!',
                        ),
                      });
                    }}
                    style={[styles.pageTurnBtn, { backgroundColor: '#b88228', borderColor: '#b88228' }]}
                  >
                    <Text variant="caption" style={{ color: '#fffbeb', fontSize: 12, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                      {t('📌 一键收录进我的知识图谱 (+15m)', '📌 Save to Knowledge Graph (+15m)')}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      clipCustomNewsArticle({
                        title: activeResult.title,
                        sourceName: activeResult.sourceBadgeZh,
                        categoryId: 'ai-frontier',
                        rawText: activeResult.paragraphs.join('\n'),
                      });
                      showToast({ text: t('📰 已存入学习角「书院晨报」净读列表！', '📰 Saved to News Digest!') });
                    }}
                    style={[styles.pageTurnBtn, { borderColor: pal.gold, backgroundColor: pal.pillActiveBg }]}
                  >
                    <Text variant="caption" style={{ color: pal.goldText, fontSize: 12, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                      {t('📰 存入晨报长文净读', '📰 Save to News Digest')}
                    </Text>
                  </Pressable>
                </View>

                {onJumpToStudyTab ? (
                  <Pressable
                    onPress={onJumpToStudyTab}
                    style={[styles.pageTurnBtn, { borderColor: pal.emerald }]}
                  >
                    <Text variant="caption" style={{ color: pal.emerald, fontSize: 12, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                      {t('📖 前往「学习角」查看知识图谱与插图读本 →', '📖 Go to Academy Book & Graph →')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={[styles.bookPageFolio, { backgroundColor: pal.paperBg, borderColor: pal.goldBorder, borderLeftColor: pal.spineShadow, paddingVertical: 14, paddingHorizontal: 16, minHeight: 560 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: pal.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Text variant="caption" style={{ color: pal.emerald, fontSize: 11, fontFamily: theme.fontFamily.mono, fontWeight: '700' }}>
                    🔒 HTTPS
                  </Text>
                  <Text variant="caption" numberOfLines={1} style={{ color: pal.ink, fontSize: 11.5, fontFamily: theme.fontFamily.mono, flex: 1 }}>
                    {activeResult.embedUrl}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => updateActiveTab({ viewMode: 'reader' })}
                    style={[styles.microBtn, { borderColor: pal.gold, backgroundColor: pal.pillActiveBg }]}
                  >
                    <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontFamily: theme.fontFamily.serif, fontWeight: '700' }}>
                      {t('📖 切回纸书净读模式', '📖 Switch to Reader Mode')}
                    </Text>
                  </Pressable>
                  {Platform.OS === 'web' ? (
                    <Pressable
                      onPress={() => openExternalUrl(activeResult.url)}
                      style={[styles.microBtn, { borderColor: pal.border }]}
                    >
                      <Text variant="caption" style={{ color: pal.ink, fontSize: 11, fontFamily: theme.fontFamily.serif }}>
                        {t('↗ 外部浏览器打开原网页', '↗ Open in New Tab')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {Platform.OS === 'web' ? (
                createElement('iframe', {
                  key: `${activeResult.embedUrl}-${iframeReloadTick}`,
                  src: activeResult.embedUrl,
                  title: activeResult.title,
                  sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms',
                  style: {
                    width: '100%',
                    height: 520,
                    border: 'none',
                    borderRadius: 8,
                    backgroundColor: '#ffffff',
                  },
                })
              ) : (
                <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>
                  <Text variant="body" style={{ color: pal.ink, fontFamily: theme.fontFamily.serif }}>
                    {activeResult.snippet}
                  </Text>
                </View>
              )}
            </View>
          )
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  browserFrame: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tabStripBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  browserTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  omniboxSection: {
    padding: 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  omniboxInput: {
    flex: 1,
    minWidth: 240,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 13.5,
  },
  primarySearchBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  microBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  resultCard: {
    flex: 1,
    minWidth: 210,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  bookPageFolio: {
    borderRadius: 10,
    borderWidth: 1.2,
    borderLeftWidth: 7,
    borderRightWidth: 3,
    borderBottomWidth: 4,
    paddingHorizontal: 26,
    paddingVertical: 20,
    gap: 16,
  },
  bookRunningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  epigraphQuoteBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 3.5,
    borderRadius: 6,
  },
  mindMapRootCard: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 6,
  },
  mindMapBranchCard: {
    flex: 1,
    minWidth: 250,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 4,
    gap: 6,
  },
  bookPageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  pageTurnBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
});
