import { describe, expect, test } from '@jest/globals';

import {
  buildCharioteerPluginManifest,
  CHARIOTEER_PLUGIN_PROTOCOL_VERSION,
  detectRuntimeHostMode,
  filterWorkbenchCommands,
  validateCharioteerPluginManifest,
} from './charioteer-plugin';

describe('charioteer-plugin protocol v1.0', () => {
  test('builds a valid @charioteer/plugin-sdk v1.0.0 perspective manifest', () => {
    const manifest = buildCharioteerPluginManifest({
      today: '已记 3/3',
      trend: '74.2 kg',
    });

    expect(manifest.protocolVersion).toBe(CHARIOTEER_PLUGIN_PROTOCOL_VERSION);
    expect(manifest.id).toBe('@charioteer/viastela');
    expect(manifest.kind).toBe('perspective');
    expect(manifest.scope).toBe('open-source');
    expect(manifest.permissions).toEqual(['event-bus']);
    expect(manifest.contributions.sidebarTracks).toHaveLength(4);
    expect(manifest.contributions.sidebarTracks[0]?.badge).toBe('已记 3/3');
    expect(manifest.contributions.sidebarTracks[2]?.badge).toBe('74.2 kg');

    const validation = validateCharioteerPluginManifest(manifest);
    expect(validation).toEqual({ valid: true, errors: [] });
  });

  test('rejects invalid manifests with descriptive errors matching @charioteer/plugin-sdk', () => {
    expect(validateCharioteerPluginManifest(null).valid).toBe(false);
    const bad = validateCharioteerPluginManifest({
      protocolVersion: '0.9.0',
      id: 'invalid-id',
      name: '',
      kind: 'unknown',
      scope: 'private',
      permissions: ['root-shell'],
    });
    expect(bad.valid).toBe(false);
    expect(bad.errors.length).toBeGreaterThanOrEqual(5);
  });

  test('detects standalone vs charioteer-host runtime mode', () => {
    expect(detectRuntimeHostMode({})).toBe('standalone');
    expect(detectRuntimeHostMode({ hasHostGlobal: true })).toBe('charioteer-host');
    expect(detectRuntimeHostMode({ search: '?host=charioteer' })).toBe('charioteer-host');
    expect(detectRuntimeHostMode({ search: '?tab=today' })).toBe('standalone');
  });

  test('filters workbench commands by title, id, or shortcut', () => {
    const manifest = buildCharioteerPluginManifest();
    const commands = manifest.contributions.commands;
    expect(filterWorkbenchCommands(commands, '').length).toBe(commands.length);
    expect(filterWorkbenchCommands(commands, '晨重').map((c) => c.shortcut)).toEqual(['⌘K']);
    expect(filterWorkbenchCommands(commands, '⇧⌘t')).toHaveLength(1);
  });
});
