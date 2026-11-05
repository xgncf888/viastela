import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';

import { readCrayonAvatar, writeCrayonAvatar } from '@/data/crayon-avatar';
import { Row, Stack } from '@/ui/layout';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/ThemeProvider';
import { theme } from '@/ui/theme';
import {
  crayonboxUri,
  crayonPortraitFile,
  CRAYON_PORTRAITS,
  DEFAULT_CRAYON_AVATAR,
  type CrayonPortraitId,
} from '@/ui/crayonbox';

function portraitFrame(selected: boolean, borderColor: string) {
  return {
    width: theme.layout.avatar,
    height: theme.layout.avatar,
    borderRadius: theme.radius.pill,
    overflow: 'hidden' as const,
    borderWidth: selected ? theme.border.indicator : theme.border.width,
    borderColor,
  };
}

export function AvatarPicker() {
  const { color } = useTheme();
  const [avatarId, setAvatarId] = useState<CrayonPortraitId>(DEFAULT_CRAYON_AVATAR);
  const [open, setOpen] = useState(false);
  const picked = useRef(false);

  useEffect(() => {
    let live = true;
    void readCrayonAvatar().then((id) => {
      if (live && !picked.current) setAvatarId(id);
    });
    return () => {
      live = false;
    };
  }, []);

  function choose(id: CrayonPortraitId) {
    picked.current = true;
    setAvatarId(id);
    setOpen(false);
    void writeCrayonAvatar(id);
  }

  return (
    <Stack gap="sm">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="更换头像"
        accessibilityState={{ expanded: open }}
        testID="me-avatar"
        onPress={() => setOpen((value) => !value)}
        style={portraitFrame(true, color.accent)}
      >
        <Image
          source={{ uri: crayonboxUri(crayonPortraitFile(avatarId)) }}
          resizeMode="cover"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.portrait}
        />
      </Pressable>
      {open ? (
        <Stack gap="xs">
          <Text variant="caption">选择头像</Text>
          <Row gap="sm" wrap>
            {CRAYON_PORTRAITS.map((portrait) => {
              const selected = portrait.id === avatarId;
              return (
                <Pressable
                  key={portrait.id}
                  accessibilityRole="button"
                  accessibilityLabel={portrait.label}
                  accessibilityState={{ selected }}
                  testID={`me-avatar-option-${portrait.id}`}
                  onPress={() => choose(portrait.id)}
                  style={portraitFrame(selected, selected ? color.accent : color.line)}
                >
                  <Image
                    source={{ uri: crayonboxUri(portrait.file) }}
                    resizeMode="cover"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={styles.portrait}
                  />
                </Pressable>
              );
            })}
          </Row>
        </Stack>
      ) : null}
    </Stack>
  );
}

const styles = StyleSheet.create({
  portrait: {
    width: theme.layout.avatar,
    height: theme.layout.avatar,
  },
});
