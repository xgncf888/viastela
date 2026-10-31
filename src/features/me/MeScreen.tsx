import { useState } from 'react';
import { Platform, Share, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';

import { brand } from '@/config/brand';
import {
  buildCharioteerPluginManifest,
  CHARIOTEER_PLUGIN_PROTOCOL_VERSION,
  detectRuntimeHostMode,
} from '@/core/charioteer-plugin';
import { backupFilename, buildPersonalDataBackup } from '@/core/data-export';
import { computeLocalDay } from '@/core/local-day';
import { signOut } from '@/data/auth';
import { useAuth } from '@/features/auth/AuthProvider';
import { homeScreenInstallHint } from '@/features/me/home-screen-hint';
import { RemindersCard } from '@/features/me/RemindersCard';
import { useShellInset } from '@/features/shell/AppShell';
import { excludePending } from '@/features/weight/weight-copy';
import { useWeight } from '@/features/weight/WeightProvider';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Content } from '@/ui/Content';
import { layoutClassForWidth } from '@/ui/layout-class';
import { Field, ScreenHeader, Stack } from '@/ui/layout';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { showToast } from '@/ui/toast';

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
  const { daySwitch, timeZone, saveDaySwitch } = weight;
  const inset = useShellInset();
  const { width } = useWindowDimensions();
  const layout = layoutClassForWidth(width);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const value = draft ?? daySwitch;
  const hint = installHint();

  const liveWeights = excludePending(weight.records ?? [], weight.pendingDeleteIds ?? new Set());
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
      showToast({ text: '已保存' });
    } catch (saveError) {
      setError(saveError instanceof Error && saveError.message.includes('04:00') ? saveError.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  async function onExportBackup() {
    const now = new Date();
    const localDay = computeLocalDay(now, timeZone, daySwitch);
    const payload = buildPersonalDataBackup({
      exportedAt: now,
      timeZone,
      daySwitch,
      weights: liveWeights,
      trainingSets: [],
      studyRecords: [],
    });
    const json = JSON.stringify(payload, null, 2);
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
        showToast({ text: `已导出 ${filename}` });
        return;
      } catch {
        // Fall through to clipboard or Share API if Blob download is restricted.
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(json);
        showToast({ text: '已复制 JSON 备份到剪贴板' });
        return;
      }
    }

    try {
      await Share.share({
        title: filename,
        message: json,
      });
    } catch {
      showToast({ text: '导出未完成，请重试', tone: 'error' });
    }
  }

  async function onCopyPluginManifest() {
    const json = JSON.stringify(pluginManifest, null, 2);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(json);
      showToast({ text: '已复制 Charioteer 插件清单 (charioteer-plugin.json)' });
      return;
    }
    try {
      await Share.share({
        title: 'charioteer-plugin.json',
        message: json,
      });
    } catch {
      showToast({ text: '复制未完成，请重试', tone: 'error' });
    }
  }

  return (
    <Screen>
      <Content width="wide" inset={inset}>
        <ScreenHeader kicker="我的" title={brand.displayName} />
        <Card>
          <Stack gap="md">
            <Text variant="heading">账户与记账偏好</Text>
            <Field label="邮箱" value={session?.email ?? '未登录'} />
            <Field
              label="当前时区"
              value={timeZone}
              hint="每条记录写下当时的时区。之后换城市，旧记录的归属日不变。"
            />
            <TextField
              label="日切时间"
              value={value}
              onChangeText={setDraft}
              placeholder="04:00"
              helper="默认 04:00。改了只影响之后的新记录，已经记下的归属日不会变。"
              error={error}
            />
            <Button label="保存" onPress={() => void onSave()} loading={saving} loadingLabel="保存中…" />
            {hint ? <Field label="添加到主屏幕" value={hint} /> : null}
          </Stack>
        </Card>
        {Platform.OS === 'web' ? <RemindersCard /> : null}
        <Card>
          <Stack gap="md">
            <Text variant="heading">个人工作台与 Charioteer 插件协议</Text>
            <Field
              label="当前运行形态"
              value={
                hostMode === 'charioteer-host'
                  ? '已挂载至 Charioteer 宿主 (Perspective 插件模式)'
                  : '独立应用运行 (Standalone Local-First 工作台)'
              }
            />
            <Field
              label="Charioteer 插件标识"
              value={`${pluginManifest.id} · Protocol v${CHARIOTEER_PLUGIN_PROTOCOL_VERSION} (${pluginManifest.kind})`}
              hint="保持独立跨端应用体验的同时，支持通过 /charioteer-plugin.json 注册到 Charioteer 通用宿主。"
            />
            {Platform.OS === 'web' && layout !== 'compact' ? (
              <Field
                label="工作台全局快捷键"
                value="⌘K 快记面板 · ⌘P 指令面板 · ⇧⌘T/L/J 专项快记 · ⌘1–⌘5 切换栏目"
              />
            ) : null}
            <Button
              label="复制 Charioteer 插件清单"
              variant="secondary"
              onPress={() => void onCopyPluginManifest()}
            />
          </Stack>
        </Card>
        <Card>
          <Stack gap="md">
            <Text variant="heading">个人数据备份</Text>
            <Text variant="muted">将当前体重与个人记录导出为结构化 JSON 文件，方便本地留存或跨端迁移。</Text>
            <Button label="导出 JSON 备份" variant="secondary" onPress={() => void onExportBackup()} />
          </Stack>
        </Card>
        <Button label="隐私政策" variant="ghost" onPress={() => router.push('/privacy')} />
        <Stack gap="lg">
          <Button
            label="退出登录"
            variant="secondary"
            loading={signingOut}
            onPress={() => {
              setSigningOut(true);
              void signOut().finally(() => setSigningOut(false));
            }}
          />
          <Button label="删除账号" variant="ghost" tone="danger" onPress={() => router.push('/account/delete')} />
        </Stack>
      </Content>
    </Screen>
  );
}
