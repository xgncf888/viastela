import { useState } from 'react';
import { Platform, Share, TextInput, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';

import { brand } from '@/config/brand';
import {
  buildCharioteerPluginManifest,
  CHARIOTEER_PLUGIN_PROTOCOL_VERSION,
  detectRuntimeHostMode,
} from '@/core/charioteer-plugin';
import {
  backupFilename,
  buildPersonalDataBackup,
  parsePersonalDataBackup,
} from '@/core/data-export';
import { computeLocalDay } from '@/core/local-day';
import { signOut } from '@/data/auth';
import { readBookkeepingState, writeBookkeepingState } from '@/data/bookkeeping';
import {
  readPledgeVault,
  readSanctuaryStageState,
  readTimeCapsules,
  writePledgeVault,
  writeSanctuaryStageState,
  writeTimeCapsules,
} from '@/data/life-gamification';
import {
  readDailyHabits,
  readLifeMilestones,
  readOkrObjectives,
  writeDailyHabits,
  writeLifeMilestones,
  writeOkrObjectives,
} from '@/data/life-milestones-okr';
import {
  readMasteryGoals,
  readTimeBlocks,
  writeMasteryGoals,
  writeTimeBlocks,
} from '@/data/time-block-tracker';
import { useAuth } from '@/features/auth/AuthProvider';
import { homeScreenInstallHint } from '@/features/me/home-screen-hint';
import { RemindersCard } from '@/features/me/RemindersCard';
import { useShellInset } from '@/features/shell/AppShell';
import { useOptionalStudy } from '@/features/study/StudyProvider';
import { useOptionalTraining } from '@/features/training/TrainingProvider';
import { excludePending } from '@/features/weight/weight-copy';
import { useWeight } from '@/features/weight/WeightProvider';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Content } from '@/ui/Content';
import { useI18n } from '@/ui/use-i18n';
import { layoutClassForWidth } from '@/ui/layout-class';
import { Field, ScreenHeader, Stack } from '@/ui/layout';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { useTheme } from '@/ui/ThemeProvider';
import { theme } from '@/ui/theme';
import { showToast } from '@/ui/toast';
import { WearableSyncHub } from '@/ui/WearableSyncHub';

function installHint(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return homeScreenInstallHint({
    web: true,
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    standalone: window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
  });
}

export function MeScreen() {
  const { session } = useAuth();
  const weight = useWeight();
  const training = useOptionalTraining();
  const study = useOptionalStudy();
  const { daySwitch, timeZone, saveDaySwitch } = weight;
  const inset = useShellInset();
  const { width } = useWindowDimensions();
  const layout = layoutClassForWidth(width);
  const { color } = useTheme();
  const { t } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showRestoreBox, setShowRestoreBox] = useState(false);
  const [restoreJsonText, setRestoreJsonText] = useState('');
  const value = draft ?? daySwitch;
  const hint = installHint();

  const liveWeights = excludePending(weight.records ?? [], weight.pendingDeleteIds ?? new Set());
  const liveTrainingSets = excludePending(training?.sets ?? [], training?.pendingDeleteIds ?? new Set());
  const liveStudyRecords = excludePending(study?.records ?? [], study?.pendingDeleteIds ?? new Set());
  const pluginManifest = buildCharioteerPluginManifest();
  const hostMode =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? detectRuntimeHostMode({
          hasHostGlobal: Boolean(
            (window as unknown as { __charioteerHost?: unknown }).__charioteerHost,
          ),
          search: window.location?.search ?? '',
        })
      : 'standalone';

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      await saveDaySwitch(value);
      setDraft(null);
      showToast({ text: t('已保存', 'Saved') });
    } catch (saveError) {
      setError(
        saveError instanceof Error && saveError.message.includes('04:00')
          ? saveError.message
          : t('保存失败，请重试', 'Save failed, please retry'),
      );
    } finally {
      setSaving(false);
    }
  }

  function buildFullBackupPayload() {
    const now = new Date();
    const localDay = computeLocalDay(now, timeZone, daySwitch);
    const payload = buildPersonalDataBackup({
      exportedAt: now,
      timeZone,
      daySwitch,
      weights: liveWeights,
      trainingSets: liveTrainingSets,
      studyRecords: liveStudyRecords,
      sanctuary: {
        timeBlocks: readTimeBlocks(),
        masteryGoals: readMasteryGoals(),
        objectives: readOkrObjectives(),
        habits: readDailyHabits(),
        milestones: readLifeMilestones(),
        pledgeVault: readPledgeVault(),
        stageState: readSanctuaryStageState(),
        timeCapsules: readTimeCapsules(),
        bookkeeping: readBookkeepingState(),
      },
    });
    return { localDay, payload, json: JSON.stringify(payload, null, 2) };
  }

  async function onExportBackup() {
    const { localDay, json } = buildFullBackupPayload();
    const filename = backupFilename(localDay);

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        showToast({ text: t(`✓ 已导出全量备份 ${filename}`, `✓ Exported full backup ${filename}`) });
        return;
      } catch {
        // Fall through to clipboard or Share API if Blob download is restricted.
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(json);
        showToast({ text: t('✓ 已复制全量 JSON 备份到剪贴板', '✓ Copied full JSON backup to clipboard') });
        return;
      }
    }

    try {
      await Share.share({
        title: filename,
        message: json,
      });
    } catch {
      showToast({ text: t('导出未完成，请重试', 'Export failed, please retry'), tone: 'error' });
    }
  }

  async function onCopySyncSnapshot() {
    const { json } = buildFullBackupPayload();
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(json);
      showToast({
        text: t(
          '✓ 已复制跨端同步 JSON 到剪贴板（可在手机/电脑端粘贴恢复）',
          '✓ Copied cross-device JSON snapshot to clipboard',
        ),
      });
      return;
    }
    try {
      await Share.share({ title: 'viastela-sync.json', message: json });
    } catch {
      showToast({ text: t('复制失败，请重试', 'Copy failed'), tone: 'error' });
    }
  }

  function applyParsedBackup(rawText: string) {
    try {
      const parsed = parsePersonalDataBackup(rawText);
      if (parsed.sanctuary) {
        if (parsed.sanctuary.timeBlocks) writeTimeBlocks(parsed.sanctuary.timeBlocks);
        if (parsed.sanctuary.masteryGoals) writeMasteryGoals(parsed.sanctuary.masteryGoals);
        if (parsed.sanctuary.objectives) writeOkrObjectives(parsed.sanctuary.objectives);
        if (parsed.sanctuary.habits) writeDailyHabits(parsed.sanctuary.habits);
        if (parsed.sanctuary.milestones) writeLifeMilestones(parsed.sanctuary.milestones);
        if (parsed.sanctuary.pledgeVault) writePledgeVault(parsed.sanctuary.pledgeVault);
        if (parsed.sanctuary.stageState) writeSanctuaryStageState(parsed.sanctuary.stageState);
        if (parsed.sanctuary.timeCapsules) writeTimeCapsules(parsed.sanctuary.timeCapsules);
        if (parsed.sanctuary.bookkeeping) writeBookkeepingState(parsed.sanctuary.bookkeeping);
      }
      for (const w of parsed.weights.slice(-10)) {
        void weight.saveWeight(w.weightKg);
      }
      setShowRestoreBox(false);
      setRestoreJsonText('');
      showToast({
        text: t(
          `✓ 已成功恢复备份（含微缩书房、时间块、OKR 与 ${parsed.counts.weights} 条体重）`,
          `✓ Restored backup (${parsed.counts.weights} weights + Sanctuary state)`,
        ),
      });
    } catch (err) {
      showToast({
        text:
          err instanceof Error
            ? err.message
            : t('备份 JSON 格式有误，请检查后重试', 'Invalid backup JSON format'),
        tone: 'error',
      });
    }
  }

  async function onPasteAndRestoreClipboard() {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      try {
        const clip = await navigator.clipboard.readText();
        if (clip && clip.trim().startsWith('{')) {
          applyParsedBackup(clip.trim());
          return;
        }
      } catch {
        // Fall back to manual paste box
      }
    }
    setShowRestoreBox(true);
  }

  async function onCopyPluginManifest() {
    const json = JSON.stringify(pluginManifest, null, 2);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(json);
      showToast({
        text: t(
          '已复制 Charioteer 插件清单 (charioteer-plugin.json)',
          'Copied Charioteer plugin manifest (charioteer-plugin.json)',
        ),
      });
      return;
    }
    try {
      await Share.share({
        title: 'charioteer-plugin.json',
        message: json,
      });
    } catch {
      showToast({ text: t('复制未完成，请重试', 'Copy failed, please retry'), tone: 'error' });
    }
  }

  return (
    <Screen>
      <Content width="wide" inset={inset}>
        <ScreenHeader kicker={t('我的', 'Profile')} title={brand.displayName} />
        <Card>
          <Stack gap="md">
            <Text variant="heading">{t('账户与记账偏好', 'Account & Accounting Preferences')}</Text>
            <Field
              label={t('账户 / 存储模式', 'Account / Storage Mode')}
              value={
                session?.email === 'local@device.offline'
                  ? t('本地离线存储（免登录模式 · 数据保存在本机）', 'Local-First Offline Mode (Stored on device)')
                  : (session?.email ?? t('未登录', 'Signed out'))
              }
            />
            <Field
              label={t('当前时区', 'Current Time Zone')}
              value={timeZone}
              hint={t(
                '每条记录写下当时的时区。之后换城市，旧记录的归属日不变。',
                'Each entry records its local time zone so past dates never shift when traveling.',
              )}
            />
            <TextField
              label={t('日切时间', 'Day-Switch Cutoff')}
              value={value}
              onChangeText={setDraft}
              placeholder="04:00"
              helper={t(
                '默认 04:00。改了只影响之后的新记录，已经记下的归属日不会变。',
                'Default 04:00. Only affects future entries; past days remain unchanged.',
              )}
              error={error}
            />
            <Button
              label={t('保存', 'Save')}
              onPress={() => void onSave()}
              loading={saving}
              loadingLabel={t('保存中…', 'Saving…')}
            />
            {hint ? <Field label={t('添加到主屏幕', 'Add to Home Screen')} value={hint} /> : null}
          </Stack>
        </Card>
        {Platform.OS === 'web' ? <RemindersCard /> : null}
        <Card>
          <Stack gap="md">
            <Text variant="heading">
              {t('全量数据备份与跨端同步（Mac ⇄ 手机）', 'Full Backup & Cross-Device Sync (Mac ⇄ Mobile)')}
            </Text>
            <Field
              label={t('全量数据概览', 'Full Data Summary')}
              value={t(
                `体重 ${liveWeights.length} · 训练 ${liveTrainingSets.length} · 学习 ${liveStudyRecords.length}`,
                `Weights ${liveWeights.length} · Workouts ${liveTrainingSets.length} · Study ${liveStudyRecords.length}`,
              )}
            />
            <Text variant="muted">
              {t(
                '一键导出或复制包含「晨重、训练组数、学习时长、24H时间块、在读书页码、健身小人次数、心愿金库与OKR」的全量 JSON，支持在手机或另一台电脑上一键粘贴恢复。',
                'Export or copy your complete Sanctuary JSON (weights, workouts, study sessions, 24H time blocks, book progress, wishes & OKRs) and restore on any device in one tap.',
              )}
            </Text>
            <Stack gap="sm">
              <Button
                label={t('导出 JSON 备份', 'Export JSON Backup')}
                variant="secondary"
                onPress={() => void onExportBackup()}
              />
              <Button
                label={t('复制跨端同步码 (JSON)', 'Copy Sync JSON')}
                variant="secondary"
                onPress={() => void onCopySyncSnapshot()}
              />
              <Button
                label={t('粘贴 / 导入恢复备份', 'Paste / Restore JSON Backup')}
                variant="ghost"
                onPress={() => void onPasteAndRestoreClipboard()}
              />
            </Stack>
            {showRestoreBox ? (
              <View
                style={{
                  padding: theme.space.sm,
                  borderRadius: theme.radius.sm,
                  borderWidth: theme.border.width,
                  borderColor: color.line,
                  backgroundColor: color.surface,
                  gap: theme.space.xs,
                }}
              >
                <Text variant="caption">
                  {t(
                    '将导出的 JSON 备份内容粘贴在下方，点击「立即恢复」即可同步全部数据：',
                    'Paste your exported JSON backup below and tap Restore Now:',
                  )}
                </Text>
                <TextInput
                  value={restoreJsonText}
                  onChangeText={setRestoreJsonText}
                  placeholder='{"version": 1, "weights": [...], "sanctuary": {...}}'
                  placeholderTextColor={color.muted}
                  multiline
                  style={{
                    minHeight: theme.layout.row,
                    padding: theme.space.xs,
                    borderRadius: theme.radius.sm,
                    borderWidth: theme.border.width,
                    borderColor: color.line,
                    color: color.ink,
                    fontFamily: theme.fontFamily.mono,
                    fontSize: theme.font.caption,
                  }}
                />
                <Stack gap="xs">
                  <Button
                    label={t('✓ 立即恢复数据', '✓ Restore Now')}
                    onPress={() => applyParsedBackup(restoreJsonText)}
                  />
                  <Button
                    label={t('取消', 'Cancel')}
                    variant="ghost"
                    onPress={() => {
                      setShowRestoreBox(false);
                      setRestoreJsonText('');
                    }}
                  />
                </Stack>
              </View>
            ) : null}
          </Stack>
        </Card>
        <Card>
          <Stack gap="md">
            <Text variant="heading">
              {t('个人工作台与 Charioteer 插件协议', 'Personal Workbench & Charioteer Plugin Protocol')}
            </Text>
            <Field
              label={t('当前运行形态', 'Runtime Mode')}
              value={
                hostMode === 'charioteer-host'
                  ? t('已挂载至 Charioteer 宿主 (Perspective 插件模式)', 'Mounted in Charioteer Host (Perspective Plugin)')
                  : t('独立应用运行 (Standalone Local-First 工作台)', 'Standalone App (Local-First Workbench)')
              }
            />
            <Field
              label={t('Charioteer 插件标识', 'Plugin Identifier')}
              value={`${pluginManifest.id} · Protocol v${CHARIOTEER_PLUGIN_PROTOCOL_VERSION} (${pluginManifest.kind})`}
              hint={t(
                '保持独立跨端应用体验的同时，支持通过 /charioteer-plugin.json 注册到 Charioteer 通用宿主。',
                'Runs standalone across macOS/iOS/Android/Web and mounts into Charioteer via /charioteer-plugin.json.',
              )}
            />
            {Platform.OS === 'web' && layout !== 'compact' ? (
              <Field
                label={t('工作台全局快捷键', 'Global Shortcuts')}
                value={t(
                  '⌘K 快记面板 · ⌘P 指令面板 · ⌘T 切换黑金/暖色 · ⌥L 切换中/英 · ⌘1–⌘5 切换栏目',
                  '⌘K Quick Log · ⌘P Command Palette · ⌘T Theme · ⌥L Language · ⌘1–⌘5 Tabs',
                )}
              />
            ) : null}
            <Button
              label={t('复制 Charioteer 插件清单', 'Copy Charioteer Plugin Manifest')}
              variant="secondary"
              onPress={() => void onCopyPluginManifest()}
            />
          </Stack>
        </Card>
        {Platform.OS === 'web' ? (
          <WearableSyncHub
            latestWeightKg={liveWeights[0]?.weightKg}
            onSyncWeightKg={(kg) => weight.saveWeight(kg)}
          />
        ) : null}
        <Button
          label={t('隐私政策', 'Privacy Policy')}
          variant="ghost"
          onPress={() => router.push('/privacy')}
        />
        <Stack gap="lg">
          <Button
            label={t('退出登录', 'Sign Out')}
            variant="secondary"
            loading={signingOut}
            onPress={() => {
              setSigningOut(true);
              void signOut().finally(() => setSigningOut(false));
            }}
          />
          <Button
            label={t('删除账号', 'Delete Account')}
            variant="ghost"
            tone="danger"
            onPress={() => router.push('/account/delete')}
          />
        </Stack>
      </Content>
    </Screen>
  );
}
