import { brand } from '@/config/brand';

export const CHARIOTEER_PLUGIN_PROTOCOL_VERSION = '1.0.0' as const;

export const VALID_PLUGIN_KINDS = [
  'perspective',
  'data-provider',
  'gateway',
  'tool-bridge',
] as const;

export type CharioteerPluginKind = (typeof VALID_PLUGIN_KINDS)[number];

export const VALID_PLUGIN_SCOPES = ['open-source', 'internal'] as const;

export type CharioteerPluginScope = (typeof VALID_PLUGIN_SCOPES)[number];

export const VALID_HOST_PERMISSIONS = [
  'ssh',
  'pty',
  'worktree',
  'gateway',
  'event-bus',
] as const;

export type CharioteerHostPermission = (typeof VALID_HOST_PERMISSIONS)[number];

export type CharioteerSidebarTrack = {
  id: string;
  title: string;
  shortcut: string;
  badge: string;
  entryUrl: string;
};

export type CharioteerCommandContribution = {
  id: string;
  title: string;
  shortcut: string;
  category: 'record' | 'navigate' | 'data';
};

export type CharioteerDataProviderContribution = {
  id: string;
  label: string;
  targetPerspective: string;
};

export type CharioteerPluginManifest = {
  protocolVersion: typeof CHARIOTEER_PLUGIN_PROTOCOL_VERSION;
  id: string;
  name: string;
  version: string;
  kind: CharioteerPluginKind;
  scope: CharioteerPluginScope;
  description: string;
  permissions: readonly CharioteerHostPermission[];
  entrypoints: {
    ui: string;
    manifest: string;
  };
  contributions: {
    sidebarTracks: readonly CharioteerSidebarTrack[];
    commands: readonly CharioteerCommandContribution[];
    dataProviders: readonly CharioteerDataProviderContribution[];
  };
};

export type RuntimeHostMode = 'standalone' | 'charioteer-host';

export type WorkbenchTelemetryBadges = {
  today?: string;
  assets?: string;
  trend?: string;
  timeline?: string;
};

export function buildCharioteerPluginManifest(
  badges: WorkbenchTelemetryBadges = {},
): CharioteerPluginManifest {
  const pluginId = `@charioteer/${brand.slug}`;
  return {
    protocolVersion: CHARIOTEER_PLUGIN_PROTOCOL_VERSION,
    id: pluginId,
    name: `${brand.displayName} · ${brand.webName}个人工作台`,
    version: '1.0.0',
    kind: 'perspective',
    scope: 'open-source',
    description:
      '个人节律（晨重、力量训练、专注学习）与长期净值轨迹工作台，支持独立多端运行或按 Charioteer 协议挂载。',
    permissions: ['event-bus'],
    entrypoints: {
      ui: '/',
      manifest: '/charioteer-plugin.json',
    },
    contributions: {
      sidebarTracks: [
        {
          id: 'today',
          title: `${brand.webName} · 今日工作台`,
          shortcut: '⌘1',
          badge: badges.today ?? '今日',
          entryUrl: '/',
        },
        {
          id: 'assets',
          title: `${brand.webName} · 长期资产`,
          shortcut: '⌘2',
          badge: badges.assets ?? '净值',
          entryUrl: '/assets',
        },
        {
          id: 'trend',
          title: `${brand.webName} · 均重趋势`,
          shortcut: '⌘3',
          badge: badges.trend ?? '趋势',
          entryUrl: '/trend',
        },
        {
          id: 'timeline',
          title: `${brand.webName} · 时间线台账`,
          shortcut: '⌘4',
          badge: badges.timeline ?? '台账',
          entryUrl: '/timeline',
        },
      ],
      commands: [
        {
          id: `${brand.slug}.quickRecordWeight`,
          title: '快速记录晨重 / 复测',
          shortcut: '⌘K',
          category: 'record',
        },
        {
          id: `${brand.slug}.quickRecordTraining`,
          title: '快速记录力量训练组数',
          shortcut: '⇧⌘T',
          category: 'record',
        },
        {
          id: `${brand.slug}.quickRecordStudy`,
          title: '快速记录专注学习时长',
          shortcut: '⇧⌘L',
          category: 'record',
        },
        {
          id: `${brand.slug}.quickRecordJournal`,
          title: '快速记录时间块与日常随笔',
          shortcut: '⇧⌘J',
          category: 'record',
        },
        {
          id: `${brand.slug}.navigateToday`,
          title: '切换至 今日节律工作台',
          shortcut: '⌘1',
          category: 'navigate',
        },
        {
          id: `${brand.slug}.navigateAssets`,
          title: '切换至 长期资产与持仓',
          shortcut: '⌘2',
          category: 'navigate',
        },
        {
          id: `${brand.slug}.navigateTrend`,
          title: '切换至 均重与平滑趋势',
          shortcut: '⌘3',
          category: 'navigate',
        },
        {
          id: `${brand.slug}.navigateTimeline`,
          title: '切换至 时间线与日志台账',
          shortcut: '⌘4',
          category: 'navigate',
        },
        {
          id: `${brand.slug}.navigateMe`,
          title: '切换至 账户偏好与插件协议',
          shortcut: '⌘5',
          category: 'navigate',
        },
      ],
      dataProviders: [
        {
          id: `${brand.slug}.personal-ledger`,
          label: 'Local-First Personal Ledger & Offline Outbox',
          targetPerspective: pluginId,
        },
      ],
    },
  };
}

export function validateCharioteerPluginManifest(manifest: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be a non-null object'] };
  }
  const candidate = manifest as Record<string, unknown>;
  if (candidate.protocolVersion !== CHARIOTEER_PLUGIN_PROTOCOL_VERSION) {
    errors.push(
      `Unsupported protocolVersion "${String(candidate.protocolVersion)}" (expected "${CHARIOTEER_PLUGIN_PROTOCOL_VERSION}")`,
    );
  }
  if (
    typeof candidate.id !== 'string' ||
    !/^@[a-z0-9-]+\/[a-z0-9-]+$/.test(candidate.id)
  ) {
    errors.push(`Invalid plugin id "${String(candidate.id)}" (must match @scope/name)`);
  }
  if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
    errors.push('Plugin manifest requires a string `name`');
  }
  if (
    typeof candidate.kind !== 'string' ||
    !VALID_PLUGIN_KINDS.includes(candidate.kind as CharioteerPluginKind)
  ) {
    errors.push(
      `Invalid plugin kind "${String(candidate.kind)}" (expected one of: ${VALID_PLUGIN_KINDS.join(', ')})`,
    );
  }
  if (
    typeof candidate.scope !== 'string' ||
    !VALID_PLUGIN_SCOPES.includes(candidate.scope as CharioteerPluginScope)
  ) {
    errors.push(
      `Invalid plugin scope "${String(candidate.scope)}" (expected one of: ${VALID_PLUGIN_SCOPES.join(', ')})`,
    );
  }
  if (Array.isArray(candidate.permissions)) {
    for (const perm of candidate.permissions) {
      if (
        typeof perm !== 'string' ||
        !VALID_HOST_PERMISSIONS.includes(perm as CharioteerHostPermission)
      ) {
        errors.push(`Unknown host permission "${String(perm)}"`);
      }
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function detectRuntimeHostMode(input: {
  hasHostGlobal?: boolean;
  search?: string;
  embeddedInFrame?: boolean;
}): RuntimeHostMode {
  if (input.hasHostGlobal) return 'charioteer-host';
  const search = input.search ?? '';
  if (
    search.includes('charioteerHost=1') ||
    search.includes('host=charioteer') ||
    search.includes('perspective=charioteer')
  ) {
    return 'charioteer-host';
  }
  return 'standalone';
}

export function filterWorkbenchCommands(
  commands: readonly CharioteerCommandContribution[],
  query: string,
): CharioteerCommandContribution[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...commands];
  return commands.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(normalized) ||
      cmd.id.toLowerCase().includes(normalized) ||
      cmd.shortcut.toLowerCase().includes(normalized),
  );
}
