import { createElement, useEffect } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';

import { brand } from '@/config/brand';
import { BrandMark } from '@/ui/BrandMark';
import { Center, Row } from '@/ui/layout';
import { documentEdges, Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { theme } from '@/ui/theme';
import { useTheme } from '@/ui/ThemeProvider';
import { useReducedMotion } from '@/ui/use-reduced-motion';

const ORBIT_SIZE = 72;
const ORBIT_STROKE = 2;
const ORBIT_RADIUS = (ORBIT_SIZE - ORBIT_STROKE * 2) / 2;
const ORBIT_CIRCUMFERENCE = 2 * Math.PI * ORBIT_RADIUS;
const ORBIT_ARC = ORBIT_CIRCUMFERENCE * 0.32;

const bootSpin = new Animated.Value(0);
const bootPulse = new Animated.Value(1);
const bootRotate = bootSpin.interpolate({
  inputRange: [0, 1],
  outputRange: ['0deg', '360deg'],
});

function BootOrbitRing({ trackColor, arcColor }: { trackColor: string; arcColor: string }) {
  const viewBox = `0 0 ${ORBIT_SIZE} ${ORBIT_SIZE}`;
  const center = ORBIT_SIZE / 2;
  const dashArray = `${ORBIT_ARC} ${ORBIT_CIRCUMFERENCE}`;
  if (Platform.OS === 'web') {
    return createElement(
      'svg',
      { width: ORBIT_SIZE, height: ORBIT_SIZE, viewBox, 'aria-hidden': true },
      createElement('circle', {
        cx: center,
        cy: center,
        r: ORBIT_RADIUS,
        fill: 'none',
        stroke: trackColor,
        strokeWidth: ORBIT_STROKE,
      }),
      createElement('circle', {
        cx: center,
        cy: center,
        r: ORBIT_RADIUS,
        fill: 'none',
        stroke: arcColor,
        strokeWidth: ORBIT_STROKE,
        strokeLinecap: 'round',
        strokeDasharray: dashArray,
      }),
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: Svg, Circle } = require('react-native-svg') as typeof import('react-native-svg');
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: ORBIT_SIZE, height: ORBIT_SIZE }}>
      <Svg width={ORBIT_SIZE} height={ORBIT_SIZE} viewBox={viewBox}>
        <Circle cx={center} cy={center} r={ORBIT_RADIUS} fill="none" stroke={trackColor} strokeWidth={ORBIT_STROKE} />
        <Circle
          cx={center}
          cy={center}
          r={ORBIT_RADIUS}
          fill="none"
          stroke={arcColor}
          strokeWidth={ORBIT_STROKE}
          strokeLinecap="round"
          strokeDasharray={dashArray}
        />
      </Svg>
    </View>
  );
}

/**
 * Cross-platform (Web, iOS, Android) startup screen.
 * Pairs the BrandMark with a smooth orbital progress arc, wordmark badge,
 * and pulsing status indicator while respecting reduced-motion settings.
 */
export function BootScreen() {
  const { color } = useTheme();
  const reducedMotion = useReducedMotion() === true;

  useEffect(() => {
    if (reducedMotion) {
      bootSpin.setValue(0);
      bootPulse.setValue(1);
      return undefined;
    }
    const useNativeDriver = Platform.OS !== 'web';
    bootSpin.setValue(0);
    bootPulse.setValue(0.72);
    const spinLoop = Animated.loop(
      Animated.timing(bootSpin, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver,
      }),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bootPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
        Animated.timing(bootPulse, {
          toValue: 0.65,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
      ]),
    );
    spinLoop.start();
    pulseLoop.start();
    return () => {
      spinLoop.stop();
      pulseLoop.stop();
      bootSpin.setValue(0);
      bootPulse.setValue(1);
    };
  }, [reducedMotion]);

  return (
    <Screen edges={documentEdges}>
      <Center>
        <View style={{ alignItems: 'center', gap: theme.space.md }}>
          <View
            style={{
              width: ORBIT_SIZE,
              height: ORBIT_SIZE,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Animated.View
              style={{
                position: 'absolute',
                width: ORBIT_SIZE,
                height: ORBIT_SIZE,
                transform: reducedMotion ? undefined : [{ rotate: bootRotate }],
              }}
            >
              <BootOrbitRing trackColor={color.line} arcColor={color.accent} />
            </Animated.View>
            <BrandMark size={theme.layout.mark + theme.space.sm} />
          </View>

          <View style={{ alignItems: 'center', gap: theme.space.xs }}>
            <Row gap="xs" align="center">
              <Text variant="title">{brand.displayName}</Text>
              <View
                style={{
                  backgroundColor: color.fill,
                  borderColor: color.line,
                  borderWidth: theme.border.width,
                  borderRadius: theme.radius.sm,
                  paddingHorizontal: theme.space.sm,
                  paddingVertical: theme.space.xs,
                }}
              >
                <Text variant="caption" tone="muted">
                  {brand.webName.toUpperCase()}
                </Text>
              </View>
            </Row>
            <Animated.View style={{ opacity: reducedMotion ? 1 : bootPulse }}>
              <Text variant="muted">正在打开</Text>
            </Animated.View>
          </View>
        </View>
      </Center>
    </Screen>
  );
}
