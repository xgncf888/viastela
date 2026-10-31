import { useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import {
  type CharioteerCommandContribution,
  type CharioteerPluginManifest,
  filterWorkbenchCommands,
  type RuntimeHostMode,
} from '@/core/charioteer-plugin';
import { cardSurfaceStyle } from './Card';
import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';

export type TagChipTone = 'owner' | 'exec' | 'rev' | 'neutral' | 'pod';

/** Charioteer `.tag-chip` semantic badge (`role-owner` terracotta, `role-exec` forest green, `role-rev` amber, `pod` bordered). */
export function TagChip({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: TagChipTone;
}) {
  const { color } = useTheme();
  const palette =
    tone === 'owner'
      ? { bg: color.accentSoft, fg: color.accent, border: 'transparent', weight: theme.fontWeight.semibold }
      : tone === 'exec'
        ? { bg: color.greenSoft, fg: color.green, border: 'transparent', weight: theme.fontWeight.semibold }
        : tone === 'rev'
          ? { bg: color.warningSoft, fg: color.warning, border: 'transparent', weight: theme.fontWeight.semibold }
          : tone === 'pod'
            ? { bg: color.surface, fg: color.muted, border: color.line, weight: theme.fontWeight.medium }
            : { bg: color.pill, fg: color.muted, border: 'transparent', weight: theme.fontWeight.medium };

  return (
    <View
      style={[
        styles.tagChip,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: tone === 'pod' ? theme.border.width : 0,
        },
      ]}
    >
      <Text
        variant="caption"
        style={[
          styles.tagChipText,
          { color: palette.fg, fontWeight: palette.weight },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/** Charioteer `.pill-btn` tactile button (`default`, `primary`, `accent`, `green`). */
export function CockpitPillButton({
  label,
  variant = 'default',
  accessibilityLabel,
  onPress,
}: {
  label: string;
  variant?: 'default' | 'primary' | 'accent' | 'green';
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const palette =
    variant === 'primary'
      ? { bg: color.ink, fg: color.paper, border: color.ink }
      : variant === 'accent'
        ? { bg: color.accent, fg: color.onToast, border: color.accent }
        : variant === 'green'
          ? { bg: color.greenSoft, fg: color.green, border: color.greenSoft }
          : { bg: color.card, fg: color.ink, border: color.line };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pillBtn,
        variant === 'default' ? cardSurfaceStyle(pressed ? color.pressed : color.card, color.line) : null,
        {
          backgroundColor: pressed && variant === 'default' ? color.pressed : palette.bg,
          borderColor: palette.border,
          opacity: pressed && variant !== 'default' ? 0.88 : 1,
        },
      ]}
    >
      <Text
        variant="caption"
        style={[
          styles.pillBtnText,
          {
            color: palette.fg,
            fontWeight: variant === 'default' ? theme.fontWeight.medium : theme.fontWeight.semibold,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Charioteer top cockpit bar placed inside `ScreenHeader.trailing` on desktop/tablet (`<= 30px` height
 * so `ScreenHeader` height stays strictly unchanged and E2E `RECORD_Y_DESKTOP = 252` is preserved).
 */
export function CockpitHeaderBar({
  mode = 'standalone',
  hudText,
  onOpenRecord,
  onOpenPalette,
  onOpenScope,
  extra,
}: {
  mode?: RuntimeHostMode;
  hudText: string;
  onOpenRecord?: () => void;
  onOpenPalette?: () => void;
  onOpenScope?: () => void;
  extra?: ReactNode;
}) {
  const { color } = useTheme();
  return (
    <View style={styles.headerBar}>
      <View style={[styles.scopeBar, { backgroundColor: color.paperDeep, borderColor: color.line }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="切换工作台作用域"
          onPress={onOpenScope}
          style={[
            styles.scopePill,
            cardSurfaceStyle(color.card, color.line),
          ]}
        >
          <View
            style={[
              styles.podDot,
              { backgroundColor: mode === 'charioteer-host' ? color.accent : color.green },
            ]}
          />
          <Text variant="caption" style={styles.scopePillActiveText}>
            {mode === 'charioteer-host' ? 'Charioteer Host' : 'Local Mac'}
          </Text>
        </Pressable>
        {onOpenPalette ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="工作台指令面板"
            onPress={onOpenPalette}
            style={({ pressed }) => [
              styles.scopePill,
              { backgroundColor: pressed ? color.pressed : 'transparent' },
            ]}
          >
            <Text variant="caption" tone="muted" style={styles.scopePillText}>
              Plugin v1.0
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`状态总览 ${hudText}`}
        onPress={onOpenScope ?? onOpenPalette}
        style={({ pressed }) => [
          styles.trayHudPill,
          cardSurfaceStyle(pressed ? color.pressed : color.card, color.line),
          { borderColor: color.line },
        ]}
      >
        <View style={[styles.podDot, { backgroundColor: color.accent }]} />
        <Text variant="caption" style={styles.trayHudText} numberOfLines={1}>
          {hudText}
        </Text>
      </Pressable>

      {onOpenRecord ? (
        <CockpitPillButton
          label="＋ 快记 ⌘K"
          variant="accent"
          accessibilityLabel="顶部快捷记录"
          onPress={onOpenRecord}
        />
      ) : null}
      {extra}
    </View>
  );
}

/**
 * Charioteer `.side-foot` sidebar footer:
 * - `.side-gw` live runtime box with glowing green `.dot-live`
 * - `.side-foot-links` 3-button strip (`Search ⌘K`, `Cmds ⌘P`, `Scope ⌘B`)
 */
export function WorkbenchSidebarPanel({
  mode,
  weightLogged,
  trainingLogged,
  studyLogged,
  timeZone,
  onQuickRecord,
  onOpenPalette,
  onOpenScope,
}: {
  mode: RuntimeHostMode;
  weightLogged: boolean;
  trainingLogged: boolean;
  studyLogged: boolean;
  timeZone?: string;
  onQuickRecord: () => void;
  onOpenPalette: () => void;
  onOpenScope?: () => void;
}) {
  const { color } = useTheme();
  const loggedCount = (weightLogged ? 1 : 0) + (trainingLogged ? 1 : 0) + (studyLogged ? 1 : 0);

  return (
    <View style={styles.sidebarPanel}>
      <View
        style={[
          styles.telemetryBox,
          cardSurfaceStyle(color.card, color.line),
          { borderColor: color.line },
        ]}
      >
        <View style={styles.telemetryHeader}>
          <Text variant="caption" style={styles.semibold}>
            今日节律台账
          </Text>
          <TagChip
            label={loggedCount === 3 ? '3/3 已满' : `${loggedCount}/3 已记`}
            tone={loggedCount === 3 ? 'exec' : loggedCount > 0 ? 'owner' : 'neutral'}
          />
        </View>
        <View style={styles.dotRow}>
          <View style={styles.dotItem}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: weightLogged ? color.accent : 'transparent',
                  borderColor: weightLogged ? color.accent : color.line,
                },
              ]}
            />
            <Text variant="caption" tone={weightLogged ? 'ink' : 'muted'} style={styles.dotLabel}>
              晨重
            </Text>
          </View>
          <View style={styles.dotItem}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: trainingLogged ? color.green : 'transparent',
                  borderColor: trainingLogged ? color.green : color.line,
                },
              ]}
            />
            <Text variant="caption" tone={trainingLogged ? 'ink' : 'muted'} style={styles.dotLabel}>
              训练
            </Text>
          </View>
          <View style={styles.dotItem}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: studyLogged ? color.ink : 'transparent',
                  borderColor: studyLogged ? color.ink : color.line,
                },
              ]}
            />
            <Text variant="caption" tone={studyLogged ? 'ink' : 'muted'} style={styles.dotLabel}>
              学习
            </Text>
          </View>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="查看本地运行时与 Charioteer 插件连接"
        onPress={onOpenScope ?? onOpenPalette}
        style={({ pressed }) => [
          styles.sideGwBtn,
          cardSurfaceStyle(pressed ? color.pressed : color.card, color.line),
          { borderColor: color.line },
        ]}
      >
        <View style={[styles.dotLive, { backgroundColor: color.green }]} />
        <Text variant="caption" style={styles.sideGwText} numberOfLines={1}>
          {mode === 'charioteer-host'
            ? 'charioteer://plugin · 已挂载'
            : `local://viastela · ${timeZone ?? '已同步'}`}
        </Text>
      </Pressable>

      <View style={styles.sideFootLinks}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="快记快捷键"
          onPress={onQuickRecord}
          style={({ pressed }) => [
            styles.sideFootBtn,
            { backgroundColor: pressed ? color.pressed : 'transparent' },
          ]}
        >
          <Text variant="caption" tone="muted" style={styles.footBtnText}>
            Record
          </Text>
          <Text variant="caption" tone="muted" style={styles.footBtnKbd}>
            ⌘K
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="打开工作台指令面板"
          onPress={onOpenPalette}
          style={({ pressed }) => [
            styles.sideFootBtn,
            { backgroundColor: pressed ? color.pressed : 'transparent' },
          ]}
        >
          <Text variant="caption" tone="muted" style={styles.footBtnText}>
            Search
          </Text>
          <Text variant="caption" tone="muted" style={styles.footBtnKbd}>
            ⌘P
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="打开工作区作用域导览"
          onPress={onOpenScope ?? onOpenPalette}
          style={({ pressed }) => [
            styles.sideFootBtn,
            { backgroundColor: pressed ? color.pressed : 'transparent' },
          ]}
        >
          <Text variant="caption" tone="muted" style={styles.footBtnText}>
            Scope
          </Text>
          <Text variant="caption" tone="muted" style={styles.footBtnKbd}>
            ⌘B
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Charioteer `.led-strip` 5-block horizontal ledger strip + `.profiles` quick dispatch bar.
 */
export function WorkbenchConsoleCard({
  mode,
  loggedCount,
  activeWeightDays,
  trainingSetsCount,
  trainingVolumeKg,
  studyMinutes,
  studyCount,
  onQuickWeight,
  onQuickTraining,
  onQuickStudy,
  onQuickJournal,
  onOpenScope,
}: {
  mode: RuntimeHostMode;
  loggedCount: number;
  activeWeightDays: number;
  trainingSetsCount: number;
  trainingVolumeKg: number;
  studyMinutes: number;
  studyCount: number;
  onQuickWeight: () => void;
  onQuickTraining: () => void;
  onQuickStudy: () => void;
  onQuickJournal: () => void;
  onOpenScope?: () => void;
}) {
  const { color } = useTheme();
  return (
    <View testID="today-workbench-console" style={styles.consoleStack}>
      <View
        style={[
          styles.ledStrip,
          cardSurfaceStyle(color.card, color.line),
        ]}
      >
        <View style={[styles.ledBlk, { borderRightColor: color.lineSoft }]}>
          <Text variant="caption" tone="muted" style={styles.ledKey}>
            TODAY RHYTHM
          </Text>
          <Text
            variant="metric"
            style={[
              styles.ledVal,
              { color: loggedCount === 3 ? color.green : color.accent },
            ]}
          >
            {`${loggedCount} / 3 已记`}
          </Text>
          <Text variant="caption" tone="muted" style={styles.ledSub}>
            晨重 · 训练 · 学习
          </Text>
        </View>

        <View style={[styles.ledBlk, { borderRightColor: color.lineSoft }]}>
          <Text variant="caption" tone="muted" style={styles.ledKey}>
            7D CONSISTENCY
          </Text>
          <Text variant="metric" style={styles.ledVal}>
            {`${activeWeightDays} / 7 天`}
          </Text>
          <Text variant="caption" tone="muted" style={styles.ledSub}>
            近 7 日有效早安称
          </Text>
        </View>

        <View style={[styles.ledBlk, { borderRightColor: color.lineSoft }]}>
          <Text variant="caption" tone="muted" style={styles.ledKey}>
            TRAINING LOAD
          </Text>
          <Text variant="metric" style={styles.ledVal}>
            {`${trainingSetsCount} 组`}
          </Text>
          <Text variant="caption" tone="muted" style={styles.ledSub}>
            {trainingVolumeKg > 0 ? `累计负荷 ${Math.round(trainingVolumeKg)} kg` : '待记录训练组'}
          </Text>
        </View>

        <View style={[styles.ledBlk, { borderRightColor: color.lineSoft }]}>
          <Text variant="caption" tone="muted" style={styles.ledKey}>
            FOCUS TIME
          </Text>
          <Text variant="metric" style={styles.ledVal}>
            {`${studyMinutes} min`}
          </Text>
          <Text variant="caption" tone="muted" style={styles.ledSub}>
            {studyCount > 0 ? `已完成 ${studyCount} 项主题` : '待记录专注时长'}
          </Text>
        </View>

        <View style={styles.ledBlkLast}>
          <Text variant="caption" tone="muted" style={styles.ledKey}>
            RUNTIME HOST
          </Text>
          <Text variant="metric" style={[styles.ledVal, { color: color.green }]}>
            {mode === 'charioteer-host' ? 'Mounted' : 'Local-First'}
          </Text>
          <Text variant="caption" tone="muted" style={styles.ledSub}>
            @charioteer/viastela
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.profilesBar,
          cardSurfaceStyle(color.card, color.line),
        ]}
      >
        <View style={styles.profilesLeft}>
          <Text variant="caption" tone="muted" style={styles.profilesTitle}>
            Quick Dispatch (工作台快记)
          </Text>
          <CockpitPillButton
            label="＋ 晨重 ⌘K"
            accessibilityLabel="快捷记晨重"
            onPress={onQuickWeight}
          />
          <CockpitPillButton
            label="＋ 训练 ⇧⌘T"
            accessibilityLabel="快捷记训练"
            onPress={onQuickTraining}
          />
          <CockpitPillButton
            label="＋ 学习 ⇧⌘L"
            accessibilityLabel="快捷记学习"
            onPress={onQuickStudy}
          />
          <CockpitPillButton
            label="＋ 时间块 ⇧⌘J"
            accessibilityLabel="快捷记时间块"
            onPress={onQuickJournal}
          />
        </View>
        {onOpenScope ? (
          <CockpitPillButton
            label="Workspace Scope (⌘B) →"
            accessibilityLabel="查看工作台作用域与插件协议"
            onPress={onOpenScope}
          />
        ) : null}
      </View>
    </View>
  );
}

/**
 * Charioteer Stage-2 Style Workspace Scope & Plugin Architecture Overlay (`⌘B`).
 */
export function WorkbenchScopeModal({
  visible,
  mode,
  manifest,
  onClose,
  onCopyManifest,
}: {
  visible: boolean;
  mode: RuntimeHostMode;
  manifest: CharioteerPluginManifest;
  onClose: () => void;
  onCopyManifest: () => void;
}) {
  const { color } = useTheme();
  const [selectedScope, setSelectedScope] = useState<'local' | 'cloud' | 'charioteer'>(
    mode === 'charioteer-host' ? 'charioteer' : 'local',
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.scopeOverlay, { backgroundColor: color.paper }]}>
        <View style={styles.scopeTopStrip}>
          <CockpitPillButton label="关闭导览 (Esc) →" onPress={onClose} />
        </View>

        <ScrollView contentContainerStyle={styles.scopeStage}>
          <View style={styles.scopeHeader}>
            <View style={[styles.scopeTopBadge, { backgroundColor: color.pill }]}>
              <View style={[styles.podDot, { backgroundColor: color.accent }]} />
              <Text variant="caption" style={styles.mono}>
                {`${manifest.id} · Local-First Personal OS & Perspective Host`}
              </Text>
            </View>
            <Text variant="title" style={styles.scopeMainTitle}>
              个人日常节律、长期净值与时间线，一处静默归档。
            </Text>
            <Text variant="body" tone="muted" style={styles.scopeMainSub}>
              共用本地优先离线队列（Outbox）与暖纸双模视觉令牌，既可作为 macOS / iOS / Android / Web 独立应用运行，也可按 Charioteer 协议零侵入挂载。
            </Text>
          </View>

          <View style={styles.scopeCardsGrid}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="独立本地工作台模式"
              onPress={() => setSelectedScope('local')}
              style={[
                styles.choiceCard,
                cardSurfaceStyle(color.card, color.line),
                {
                  borderColor: selectedScope === 'local' ? color.accent : color.line,
                  borderWidth: selectedScope === 'local' ? 2 : theme.border.width,
                },
              ]}
            >
              <Text variant="caption" style={[styles.choiceTag, { color: color.accent }]}>
                STANDALONE LOCAL
              </Text>
              <Text variant="heading">独立个人工作台 (默认)</Text>
              <Text variant="muted" style={styles.choiceDesc}>
                在 macOS 原生壳（WKURLSchemeHandler）与各端独立运行，内置本地持久账本与离线发件箱（Outbox），断网或无后端时依然秒存秒看。
              </Text>
              <Text variant="caption" tone="muted" style={styles.choiceFooter}>
                默认 · app://localhost &amp; Local Outbox
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="多端云同步账本模式"
              onPress={() => setSelectedScope('cloud')}
              style={[
                styles.choiceCard,
                cardSurfaceStyle(color.card, color.line),
                {
                  borderColor: selectedScope === 'cloud' ? color.green : color.line,
                  borderWidth: selectedScope === 'cloud' ? 2 : theme.border.width,
                },
              ]}
            >
              <Text variant="caption" style={[styles.choiceTag, { color: color.green }]}>
                MULTI-DEVICE SYNC
              </Text>
              <Text variant="heading">多端实时云账本 + JSON 备份</Text>
              <Text variant="muted" style={styles.choiceDesc}>
                网络恢复时自动重放离线队列（Online Auto-Replay），支持随时在「我的」页面一键导出结构化 JSON 全量备份。
              </Text>
              <Text variant="caption" tone="muted" style={styles.choiceFooter}>
                sync://supabase · Auto-Replay
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Charioteer 插件挂载模式"
              onPress={() => setSelectedScope('charioteer')}
              style={[
                styles.choiceCard,
                cardSurfaceStyle(color.card, color.line),
                {
                  borderColor: selectedScope === 'charioteer' ? color.ink : color.line,
                  borderWidth: selectedScope === 'charioteer' ? 2 : theme.border.width,
                },
              ]}
            >
              <Text variant="caption" style={[styles.choiceTag, { color: color.ink }]}>
                CHARIOTEER PLUGIN
              </Text>
              <Text variant="heading">Charioteer 宿主插件挂载</Text>
              <Text variant="muted" style={styles.choiceDesc}>
                遵循 @charioteer/plugin-sdk v1.0.0 规范，通过 /charioteer-plugin.json 向宿主贡献 4 条侧栏轨道与 9 项全局快捷指令。
              </Text>
              <Text variant="caption" tone="muted" style={styles.choiceFooter}>
                {`${manifest.id} · Protocol v${manifest.protocolVersion}`}
              </Text>
            </Pressable>
          </View>

          <View style={styles.scopeBottomActions}>
            <CockpitPillButton
              label="复制 charioteer-plugin.json 清单"
              onPress={onCopyManifest}
            />
            <CockpitPillButton
              label="进入工作台 →"
              variant="accent"
              onPress={onClose}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export function WorkbenchCommandPalette({
  visible,
  mode,
  manifest,
  onClose,
  onExecuteCommand,
  onCopyManifest,
}: {
  visible: boolean;
  mode: RuntimeHostMode;
  manifest: CharioteerPluginManifest;
  onClose: () => void;
  onExecuteCommand: (command: CharioteerCommandContribution) => void;
  onCopyManifest: () => void;
}) {
  const { color } = useTheme();
  const [query, setQuery] = useState('');
  const filtered = filterWorkbenchCommands(manifest.contributions.commands, query);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: color.overlay }]} onPress={onClose}>
        <Pressable
          style={[
            styles.paletteSheet,
            cardSurfaceStyle(color.card, color.line),
            { borderColor: color.line },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.paletteTop}>
            <View style={styles.paletteTitleRow}>
              <View style={styles.paletteTitleCluster}>
                <Text variant="heading">Command Palette</Text>
                <TagChip
                  label={mode === 'charioteer-host' ? 'Charioteer Mounted' : 'Standalone OS'}
                  tone={mode === 'charioteer-host' ? 'exec' : 'owner'}
                />
              </View>
              <CockpitPillButton label="Esc" onPress={onClose} />
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="输入指令名称或快捷键过滤（如：晨重、训练、⌘1）…"
              placeholderTextColor={color.muted}
              autoFocus={Platform.OS === 'web'}
              style={[
                styles.searchInput,
                {
                  color: color.ink,
                  backgroundColor: color.surface,
                  borderColor: color.line,
                },
              ]}
            />
          </View>

          <View style={[styles.hairline, { backgroundColor: color.line }]} />

          <ScrollView style={styles.commandList}>
            {filtered.map((cmd) => (
              <Pressable
                key={cmd.id}
                accessibilityRole="button"
                accessibilityLabel={cmd.title}
                onPress={() => {
                  onExecuteCommand(cmd);
                  setQuery('');
                }}
                style={({ pressed }) => [
                  styles.commandItem,
                  { backgroundColor: pressed ? color.accentSoft : 'transparent' },
                ]}
              >
                <View style={styles.commandItemLeft}>
                  <Text variant="body">{cmd.title}</Text>
                  <Text variant="caption" tone="muted" style={styles.mono}>
                    {cmd.id}
                  </Text>
                </View>
                <View style={[styles.kbdPill, { backgroundColor: color.pill }]}>
                  <Text variant="caption" tone="muted" style={styles.mono}>
                    {cmd.shortcut}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <View style={[styles.hairline, { backgroundColor: color.line }]} />

          <View style={[styles.paletteFooter, { backgroundColor: color.surface }]}>
            <View style={styles.paletteFooterInfo}>
              <Text variant="caption" style={styles.semibold}>
                {`${manifest.id} · Protocol v${manifest.protocolVersion}`}
              </Text>
              <Text variant="caption" tone="muted">
                {mode === 'charioteer-host'
                  ? '已作为 Charioteer Perspective 插件挂载运行'
                  : '独立应用运行中 · 支持通过 charioteer-plugin.json 挂载至 Charioteer'}
              </Text>
            </View>
            <CockpitPillButton label="复制插件清单" onPress={onCopyManifest} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tagChip: {
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagChipText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10.5,
    lineHeight: 14,
  },
  pillBtn: {
    height: 28,
    paddingHorizontal: 11,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  pillBtnText: {
    fontSize: 12,
    lineHeight: 16,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    maxHeight: 32,
  },
  scopeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 11,
    borderWidth: theme.border.width,
    gap: 2,
  },
  scopePill: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scopePillActiveText: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: theme.fontWeight.semibold,
  },
  scopePillText: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: theme.fontWeight.medium,
  },
  podDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: theme.radius.pill,
  },
  trayHudPill: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: theme.border.width,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trayHudText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: theme.fontWeight.medium,
  },
  sidebarPanel: {
    gap: 6,
    paddingTop: theme.space.xs,
  },
  telemetryBox: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
    gap: 6,
  },
  telemetryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dotLabel: {
    fontSize: 11.5,
    lineHeight: 15,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: theme.radius.pill,
    borderWidth: theme.border.width,
  },
  sideGwBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dotLive: {
    width: 7,
    height: 7,
    borderRadius: theme.radius.pill,
  },
  sideGwText: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },
  sideFootLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  sideFootBtn: {
    flex: 1,
    height: 26,
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  footBtnText: {
    fontSize: 11,
    lineHeight: 14,
  },
  footBtnKbd: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10,
    lineHeight: 13,
  },
  consoleStack: {
    gap: theme.space.sm,
  },
  ledStrip: {
    borderRadius: theme.radius.card,
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
  ledBlk: {
    flex: 1,
    minWidth: 140,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRightWidth: theme.border.width,
    gap: 2,
  },
  ledBlkLast: {
    flex: 1,
    minWidth: 140,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  ledKey: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: 0.4,
  },
  ledVal: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: theme.fontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },
  ledSub: {
    fontSize: 11.5,
    lineHeight: 15,
  },
  profilesBar: {
    borderRadius: theme.radius.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  profilesLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  profilesTitle: {
    fontWeight: theme.fontWeight.semibold,
    marginRight: 4,
  },
  scopeOverlay: {
    flex: 1,
  },
  scopeTopStrip: {
    height: 52,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  scopeStage: {
    paddingHorizontal: 32,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 28,
    maxWidth: 1080,
    alignSelf: 'center',
    width: '100%',
  },
  scopeHeader: {
    alignItems: 'center',
    maxWidth: 680,
    gap: 10,
  },
  scopeTopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  scopeMainTitle: {
    textAlign: 'center',
  },
  scopeMainSub: {
    textAlign: 'center',
  },
  scopeCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    width: '100%',
  },
  choiceCard: {
    flex: 1,
    minWidth: 260,
    padding: 22,
    borderRadius: theme.radius.sheet,
    gap: 10,
  },
  choiceTag: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: 0.6,
  },
  choiceDesc: {
    lineHeight: 20,
  },
  choiceFooter: {
    marginTop: 'auto',
    paddingTop: 10,
    fontFamily: theme.fontFamily.mono,
  },
  scopeBottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hairline: {
    height: theme.border.width,
    alignSelf: 'stretch',
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.page,
  },
  paletteSheet: {
    width: '100%',
    maxWidth: 560,
    borderRadius: theme.radius.sheet,
    borderWidth: theme.border.width,
    overflow: 'hidden',
  },
  paletteTop: {
    padding: theme.space.md,
    gap: theme.space.sm,
  },
  paletteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paletteTitleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  searchInput: {
    minHeight: 38,
    paddingHorizontal: theme.space.ms,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
    fontSize: theme.font.sm,
  },
  commandList: {
    maxHeight: 280,
    padding: theme.space.xs,
  },
  commandItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.ms,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.sm,
  },
  commandItemLeft: {
    gap: 2,
  },
  kbdPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  paletteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.space.md,
    gap: theme.space.sm,
  },
  paletteFooterInfo: {
    flex: 1,
    gap: 2,
  },
  semibold: {
    fontWeight: theme.fontWeight.semibold,
  },
  mono: {
    fontFamily: theme.fontFamily.mono,
    fontVariant: ['tabular-nums'],
  },
});
