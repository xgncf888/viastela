import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import {
  type CharioteerCommandContribution,
  type CharioteerPluginManifest,
  filterWorkbenchCommands,
  type RuntimeHostMode,
} from '@/core/charioteer-plugin';
import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';

export function WorkbenchSidebarPanel({
  mode,
  weightLogged,
  trainingLogged,
  studyLogged,
  onQuickRecord,
  onOpenPalette,
}: {
  mode: RuntimeHostMode;
  weightLogged: boolean;
  trainingLogged: boolean;
  studyLogged: boolean;
  onQuickRecord: () => void;
  onOpenPalette: () => void;
}) {
  const { color } = useTheme();
  const loggedCount = (weightLogged ? 1 : 0) + (trainingLogged ? 1 : 0) + (studyLogged ? 1 : 0);

  return (
    <View style={styles.sidebarPanel}>
      <View style={styles.commandRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="打开快速记录面板"
          onPress={onQuickRecord}
          style={({ pressed }) => [
            styles.commandBtn,
            {
              backgroundColor: pressed ? color.pressed : color.card,
              borderColor: color.line,
            },
          ]}
        >
          <Text variant="caption" style={styles.semibold}>
            + 快记
          </Text>
          <View style={[styles.kbdPill, { backgroundColor: color.fill, borderColor: color.line }]}>
            <Text variant="caption" tone="muted" style={styles.mono}>
              ⌘K
            </Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="打开工作台指令面板"
          onPress={onOpenPalette}
          style={({ pressed }) => [
            styles.commandBtn,
            {
              backgroundColor: pressed ? color.pressed : color.card,
              borderColor: color.line,
            },
          ]}
        >
          <Text variant="caption" tone="muted">
            指令
          </Text>
          <View style={[styles.kbdPill, { backgroundColor: color.fill, borderColor: color.line }]}>
            <Text variant="caption" tone="muted" style={styles.mono}>
              ⌘P
            </Text>
          </View>
        </Pressable>
      </View>

      <View style={[styles.telemetryBox, { backgroundColor: color.card, borderColor: color.line }]}>
        <View style={styles.telemetryHeader}>
          <Text variant="caption" style={styles.semibold}>
            今日节律
          </Text>
          <Text variant="caption" tone="muted" style={styles.mono}>
            {`${loggedCount}/3 已记`}
          </Text>
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
            <Text variant="caption" tone={weightLogged ? 'ink' : 'muted'}>
              晨重
            </Text>
          </View>
          <View style={styles.dotItem}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: trainingLogged ? color.pos : 'transparent',
                  borderColor: trainingLogged ? color.pos : color.line,
                },
              ]}
            />
            <Text variant="caption" tone={trainingLogged ? 'ink' : 'muted'}>
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
            <Text variant="caption" tone={studyLogged ? 'ink' : 'muted'}>
              学习
            </Text>
          </View>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="查看 Charioteer 插件协议状态"
        onPress={onOpenPalette}
        style={({ pressed }) => [
          styles.protocolBadge,
          {
            backgroundColor: pressed ? color.pressed : color.fill,
            borderColor: color.line,
          },
        ]}
      >
        <View
          style={[
            styles.modeDot,
            { backgroundColor: mode === 'charioteer-host' ? color.pos : color.accent },
          ]}
        />
        <View style={styles.protocolTextWrap}>
          <Text variant="caption" style={styles.semibold} numberOfLines={1}>
            {mode === 'charioteer-host' ? 'Charioteer 宿主已挂载' : '独立工作台 · Local-First'}
          </Text>
          <Text variant="caption" tone="muted" style={styles.mono} numberOfLines={1}>
            Plugin SDK v1.0 · Ready
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

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
}) {
  const { color } = useTheme();
  return (
    <View
      testID="today-workbench-console"
      style={[styles.consoleCard, { backgroundColor: color.card, borderColor: color.line }]}
    >
      <View style={styles.consoleHeader}>
        <View style={styles.consoleTitleGroup}>
          <Text variant="heading">工作台节律总览</Text>
          <View style={[styles.modePill, { backgroundColor: color.fill, borderColor: color.line }]}>
            <View
              style={[
                styles.modeDot,
                { backgroundColor: mode === 'charioteer-host' ? color.pos : color.accent },
              ]}
            />
            <Text variant="caption" tone="muted" style={styles.mono}>
              {mode === 'charioteer-host' ? 'CHARIOTEER PLUGIN' : 'STANDALONE WORKBENCH'}
            </Text>
          </View>
        </View>
        <View style={styles.quickDispatchRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="快捷记晨重"
            onPress={onQuickWeight}
            style={({ pressed }) => [
              styles.dispatchChip,
              { backgroundColor: pressed ? color.pressed : color.fill, borderColor: color.line },
            ]}
          >
            <Text variant="caption">+ 晨重</Text>
            <Text variant="caption" tone="muted" style={styles.mono}>
              ⌘K
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="快捷记训练"
            onPress={onQuickTraining}
            style={({ pressed }) => [
              styles.dispatchChip,
              { backgroundColor: pressed ? color.pressed : color.fill, borderColor: color.line },
            ]}
          >
            <Text variant="caption">+ 训练</Text>
            <Text variant="caption" tone="muted" style={styles.mono}>
              ⇧⌘T
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="快捷记学习"
            onPress={onQuickStudy}
            style={({ pressed }) => [
              styles.dispatchChip,
              { backgroundColor: pressed ? color.pressed : color.fill, borderColor: color.line },
            ]}
          >
            <Text variant="caption">+ 学习</Text>
            <Text variant="caption" tone="muted" style={styles.mono}>
              ⇧⌘L
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="快捷记时间块"
            onPress={onQuickJournal}
            style={({ pressed }) => [
              styles.dispatchChip,
              { backgroundColor: pressed ? color.pressed : color.fill, borderColor: color.line },
            ]}
          >
            <Text variant="caption">+ 时间块</Text>
            <Text variant="caption" tone="muted" style={styles.mono}>
              ⇧⌘J
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.hairline, { backgroundColor: color.line }]} />

      <View style={styles.metricsGrid}>
        <View style={[styles.metricCell, { backgroundColor: color.surface, borderColor: color.line }]}>
          <Text variant="caption" tone="muted">
            今日完成度
          </Text>
          <Text variant="metric" style={styles.tabular}>
            {`${loggedCount} / 3`}
          </Text>
          <Text variant="caption" tone="muted">
            晨重 · 训练 · 学习
          </Text>
        </View>
        <View style={[styles.metricCell, { backgroundColor: color.surface, borderColor: color.line }]}>
          <Text variant="caption" tone="muted">
            7日晨重打卡
          </Text>
          <Text variant="metric" style={styles.tabular}>
            {`${activeWeightDays} / 7 天`}
          </Text>
          <Text variant="caption" tone="muted">
            连续节律追踪
          </Text>
        </View>
        <View style={[styles.metricCell, { backgroundColor: color.surface, borderColor: color.line }]}>
          <Text variant="caption" tone="muted">
            今日训练容量
          </Text>
          <Text variant="metric" style={styles.tabular}>
            {`${trainingSetsCount} 组`}
          </Text>
          <Text variant="caption" tone="muted">
            {trainingVolumeKg > 0 ? `累计负荷 ${Math.round(trainingVolumeKg)} kg` : '待记录训练组'}
          </Text>
        </View>
        <View style={[styles.metricCell, { backgroundColor: color.surface, borderColor: color.line }]}>
          <Text variant="caption" tone="muted">
            今日专注时长
          </Text>
          <Text variant="metric" style={styles.tabular}>
            {`${studyMinutes} 分钟`}
          </Text>
          <Text variant="caption" tone="muted">
            {studyCount > 0 ? `已完成 ${studyCount} 项主题` : '待记录专注学习'}
          </Text>
        </View>
      </View>
    </View>
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
          style={[styles.paletteSheet, { backgroundColor: color.card, borderColor: color.line }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.paletteTop}>
            <View style={styles.paletteTitleRow}>
              <Text variant="heading">工作台指令与 Charioteer 插件协议</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="关闭指令面板"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeBtn,
                  { backgroundColor: pressed ? color.pressed : color.fill, borderColor: color.line },
                ]}
              >
                <Text variant="caption" tone="muted">
                  Esc
                </Text>
              </Pressable>
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
                  { backgroundColor: pressed ? color.fill : 'transparent' },
                ]}
              >
                <View style={styles.commandItemLeft}>
                  <Text variant="body">{cmd.title}</Text>
                  <Text variant="caption" tone="muted" style={styles.mono}>
                    {cmd.id}
                  </Text>
                </View>
                <View style={[styles.kbdPill, { backgroundColor: color.fill, borderColor: color.line }]}>
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
                  ? '当前已作为 Charioteer Perspective 插件挂载运行'
                  : '当前以独立应用运行，支持随时通过 charioteer-plugin.json 注册至 Charioteer 宿主'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="复制插件清单 JSON"
              onPress={onCopyManifest}
              style={({ pressed }) => [
                styles.copyManifestBtn,
                { backgroundColor: pressed ? color.pressed : color.card, borderColor: color.line },
              ]}
            >
              <Text variant="caption">复制插件清单</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sidebarPanel: {
    gap: theme.space.sm,
    paddingTop: theme.space.sm,
  },
  commandRow: {
    flexDirection: 'row',
    gap: theme.space.xs,
  },
  commandBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs + 2,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
  },
  kbdPill: {
    paddingHorizontal: theme.space.xs + 2,
    paddingVertical: 2,
    borderRadius: theme.radius.bar * 2,
    borderWidth: theme.border.width,
  },
  telemetryBox: {
    padding: theme.space.sm,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
    gap: theme.space.xs,
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
    paddingTop: 2,
  },
  dotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs,
  },
  statusDot: {
    width: theme.layout.dot + 2,
    height: theme.layout.dot + 2,
    borderRadius: theme.radius.pill,
    borderWidth: theme.border.width,
  },
  protocolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs + 2,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
  },
  modeDot: {
    width: theme.layout.dot + 2,
    height: theme.layout.dot + 2,
    borderRadius: theme.radius.pill,
  },
  protocolTextWrap: {
    flex: 1,
  },
  consoleCard: {
    borderRadius: theme.radius.card,
    borderWidth: theme.border.width,
    padding: theme.space.md,
    gap: theme.space.ms,
  },
  consoleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  consoleTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    flexWrap: 'wrap',
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs,
    paddingHorizontal: theme.space.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    borderWidth: theme.border.width,
  },
  quickDispatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs,
    flexWrap: 'wrap',
  },
  dispatchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
  },
  hairline: {
    height: theme.border.width,
    alignSelf: 'stretch',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  metricCell: {
    flex: 1,
    minWidth: 140,
    padding: theme.space.ms,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
    gap: 2,
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
  closeBtn: {
    paddingHorizontal: theme.space.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
  },
  searchInput: {
    minHeight: theme.layout.control,
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
  copyManifestBtn: {
    paddingHorizontal: theme.space.ms,
    paddingVertical: theme.space.xs + 2,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
  },
  semibold: {
    fontWeight: theme.fontWeight.semibold,
  },
  mono: {
    fontFamily: theme.fontFamily.mono,
    fontVariant: ['tabular-nums'],
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
