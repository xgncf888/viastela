/**
 * Pure React 19 Native DOM Engine for Web, macOS (WKWebView), Windows (WebView2),
 * iOS (WKWebView), and Android (WebView).
 *
 * Replaces `react-native-web` in Vite builds with direct, zero-overhead HTML5 elements
 * (`<div>`, `<span>`, `<input>`, `<textarea>`), native CSS Flexbox/Grid, hardware-accelerated
 * scrolling, and native keyboard/pointer event handling.
 */
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';

export const Platform = {
  OS: 'web' as const,
  select<T>(spec: { web?: T; default?: T; ios?: T; android?: T }): T | undefined {
    return spec.web !== undefined ? spec.web : spec.default;
  },
};

const UNITLESS_CSS_PROPS = new Set([
  'opacity',
  'flex',
  'flexGrow',
  'flexShrink',
  'fontWeight',
  'lineClamp',
  'zIndex',
  'aspectRatio',
  'order',
  'scale',
  'zoom',
]);

function unwrapAnimatedValue(value: unknown): unknown {
  if (value && typeof value === 'object' && '_value' in (value as Record<string, unknown>)) {
    return (value as { _value: unknown })._value;
  }
  return value;
}

export function flattenAndNormalizeStyle(input: unknown): CSSProperties {
  const raw: Record<string, unknown> = {};
  const walk = (item: unknown) => {
    if (!item || typeof item !== 'object') return;
    if (Array.isArray(item)) {
      for (const sub of item) walk(sub);
      return;
    }
    Object.assign(raw, item as Record<string, unknown>);
  };
  walk(input);

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'paddingHorizontal') {
      out.paddingLeft = normalizeCssValue('paddingLeft', value);
      out.paddingRight = normalizeCssValue('paddingRight', value);
    } else if (key === 'paddingVertical') {
      out.paddingTop = normalizeCssValue('paddingTop', value);
      out.paddingBottom = normalizeCssValue('paddingBottom', value);
    } else if (key === 'marginHorizontal') {
      out.marginLeft = normalizeCssValue('marginLeft', value);
      out.marginRight = normalizeCssValue('marginRight', value);
    } else if (key === 'marginVertical') {
      out.marginTop = normalizeCssValue('marginTop', value);
      out.marginBottom = normalizeCssValue('marginBottom', value);
    } else if (key === 'fontVariant' && Array.isArray(value)) {
      out.fontVariantNumeric = value.join(' ');
    } else if (key === 'transform' && Array.isArray(value)) {
      const parts: string[] = [];
      for (const t of value) {
        if (t && typeof t === 'object') {
          for (const [tk, tvRaw] of Object.entries(t as Record<string, unknown>)) {
            const tv = unwrapAnimatedValue(tvRaw);
            if (tk === 'scale' || tk === 'scaleX' || tk === 'scaleY') {
              parts.push(`${tk}(${String(tv)})`);
            } else if (tk.startsWith('translate')) {
              parts.push(`${tk}(${typeof tv === 'number' ? `${tv}px` : String(tv)})`);
            } else if (tk.startsWith('rotate') || tk.startsWith('skew')) {
              parts.push(`${tk}(${String(tv)})`);
            }
          }
        }
      }
      if (parts.length > 0) out.transform = parts.join(' ');
    } else if (
      key === 'shadowColor' ||
      key === 'shadowOpacity' ||
      key === 'shadowRadius' ||
      key === 'shadowOffset' ||
      key === 'elevation'
    ) {
      continue;
    } else {
      out[key] = normalizeCssValue(key, value);
    }
  }

  const hasBorder =
    (typeof raw.borderWidth === 'number' && raw.borderWidth > 0) ||
    (typeof raw.borderTopWidth === 'number' && raw.borderTopWidth > 0) ||
    (typeof raw.borderBottomWidth === 'number' && raw.borderBottomWidth > 0) ||
    (typeof raw.borderLeftWidth === 'number' && raw.borderLeftWidth > 0) ||
    (typeof raw.borderRightWidth === 'number' && raw.borderRightWidth > 0);
  if (hasBorder && !out.borderStyle) {
    out.borderStyle = 'solid';
    if (raw.borderWidth === undefined) {
      out.borderTopWidth = out.borderTopWidth ?? '0px';
      out.borderBottomWidth = out.borderBottomWidth ?? '0px';
      out.borderLeftWidth = out.borderLeftWidth ?? '0px';
      out.borderRightWidth = out.borderRightWidth ?? '0px';
    }
  }

  return out as CSSProperties;
}

function normalizeCssValue(key: string, rawValue: unknown): unknown {
  const value = unwrapAnimatedValue(rawValue);
  if (typeof value === 'number' && !UNITLESS_CSS_PROPS.has(key)) {
    return `${value}px`;
  }
  return value;
}

function buildDataAttrs(
  dataSet?: Record<string, unknown>,
  testID?: string,
): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (testID) attrs['data-testid'] = testID;
  if (dataSet && typeof dataSet === 'object') {
    for (const [k, v] of Object.entries(dataSet)) {
      if (v !== undefined && v !== null) {
        const kebab = k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        attrs[`data-${kebab}`] = String(v);
      }
    }
  }
  return attrs;
}

export interface AccessibilityProps {
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  accessibilityState?: {
    disabled?: boolean;
    selected?: boolean;
    busy?: boolean;
    expanded?: boolean;
  };
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
  accessibilityElementsHidden?: boolean;
  importantForAccessibility?: string;
  role?: string;
  'aria-hidden'?: boolean;
  'aria-busy'?: boolean;
  'aria-selected'?: boolean;
  'aria-expanded'?: boolean;
}

function buildAriaAttrs(props: AccessibilityProps): Record<string, unknown> {
  const aria: Record<string, unknown> = {};
  if (typeof props.accessibilityLabel === 'string') {
    aria['aria-label'] = props.accessibilityLabel;
  }
  if (props.accessibilityRole === 'button') {
    aria.role = 'button';
  } else if (props.accessibilityRole === 'header') {
    aria.role = 'heading';
  } else if (props.accessibilityRole === 'alert') {
    aria.role = 'alert';
  } else if (typeof props.role === 'string') {
    aria.role = props.role;
  }
  if (props.accessibilityLiveRegion && props.accessibilityLiveRegion !== 'none') {
    aria['aria-live'] = props.accessibilityLiveRegion;
  }
  if (
    props['aria-hidden'] === true ||
    props.accessibilityElementsHidden === true ||
    props.importantForAccessibility === 'no-hide-descendants'
  ) {
    aria['aria-hidden'] = 'true';
  }
  if (props['aria-busy'] !== undefined) {
    aria['aria-busy'] = String(props['aria-busy']);
  }
  if (props['aria-selected'] !== undefined) {
    aria['aria-selected'] = String(props['aria-selected']);
  }
  if (props['aria-expanded'] !== undefined) {
    aria['aria-expanded'] = String(props['aria-expanded']);
  }
  const state = props.accessibilityState;
  if (state) {
    if (state.disabled !== undefined) aria['aria-disabled'] = String(state.disabled);
    if (state.selected !== undefined && aria['aria-selected'] === undefined) {
      aria['aria-selected'] = String(state.selected);
    }
    if (state.busy !== undefined && aria['aria-busy'] === undefined) {
      aria['aria-busy'] = String(state.busy);
    }
    if (state.expanded !== undefined && aria['aria-expanded'] === undefined) {
      aria['aria-expanded'] = String(state.expanded);
    }
  }
  return aria;
}

export const StyleSheet = {
  create<T extends Record<string, unknown>>(styles: T): T {
    return styles;
  },
  flatten: flattenAndNormalizeStyle,
  hairlineWidth: 1,
  absoluteFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  absoluteFillObject: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
};

export interface LayoutChangeEvent {
  nativeEvent: {
    layout: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
}

export type ViewStyle = Record<string, unknown>;
export type TextStyle = Record<string, unknown>;
export type StyleProp<T> = T | T[] | null | undefined | false;

export interface ViewProps extends AccessibilityProps {
  style?: unknown;
  children?: ReactNode;
  testID?: string;
  dataSet?: Record<string, unknown>;
  className?: string;
  pointerEvents?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
}

export function View(props: ViewProps) {
  const { style, children, testID, dataSet, className, onLayout, pointerEvents, ...rest } = props;
  const localRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!onLayout || !localRef.current) return undefined;
    const el = localRef.current;
    const report = () => {
      const rect = el.getBoundingClientRect();
      onLayout({
        nativeEvent: {
          layout: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        },
      });
    };
    report();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(report);
      ro.observe(el);
      return () => ro.disconnect();
    }
    return undefined;
  }, [onLayout]);

  const normalizedStyle = flattenAndNormalizeStyle([
    { display: 'flex', flexDirection: 'column', boxSizing: 'border-box', minWidth: 0 },
    pointerEvents ? { pointerEvents } : null,
    style,
  ]);

  return (
    <div
      ref={localRef}
      className={className}
      style={normalizedStyle}
      {...buildDataAttrs(dataSet, testID)}
      {...buildAriaAttrs(rest)}
    >
      {children}
    </div>
  );
}

function imageUri(source: unknown): string | undefined {
  if (Array.isArray(source)) {
    for (const item of source) {
      const uri = imageUri(item);
      if (uri) return uri;
    }
    return undefined;
  }
  if (typeof source === 'string' && source.length > 0) return source;
  if (source && typeof source === 'object' && 'uri' in source) {
    const uri = (source as { uri?: unknown }).uri;
    if (typeof uri === 'string' && uri.length > 0) return uri;
  }
  return undefined;
}

/** Web stand-in for React Native `Image`. URI sources only; Metro `require()` ids are native. */
export function Image({
  source,
  style,
  resizeMode = 'cover',
  accessibilityLabel,
  alt,
  testID,
  ...rest
}: {
  source?: unknown;
  style?: unknown;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  alt?: string;
  testID?: string;
} & AccessibilityProps) {
  const hidden =
    rest.accessibilityElementsHidden === true ||
    rest.importantForAccessibility === 'no-hide-descendants' ||
    rest['aria-hidden'] === true;
  const fit =
    resizeMode === 'contain'
      ? 'contain'
      : resizeMode === 'stretch'
        ? 'fill'
        : resizeMode === 'center' || resizeMode === 'repeat'
          ? 'none'
          : 'cover';
  return (
    <img
      src={imageUri(source)}
      alt={hidden ? '' : (alt ?? accessibilityLabel ?? '')}
      style={flattenAndNormalizeStyle([{ display: 'block', objectFit: fit }, style])}
      {...buildDataAttrs(undefined, testID)}
      {...(hidden ? { 'aria-hidden': 'true' as const } : buildAriaAttrs({ ...rest, accessibilityLabel }))}
    />
  );
}

export interface TextProps extends AccessibilityProps {
  style?: unknown;
  children?: ReactNode;
  numberOfLines?: number;
  maxFontSizeMultiplier?: number;
  testID?: string;
  dataSet?: Record<string, unknown>;
  className?: string;
}

export function Text(props: TextProps) {
  const { style, children, numberOfLines, testID, dataSet, className, ...rest } = props;
  const clampStyle =
    numberOfLines === 1
      ? {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }
      : numberOfLines !== undefined && numberOfLines > 1
        ? {
            display: '-webkit-box',
            WebkitLineClamp: numberOfLines,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }
        : null;

  const normalizedStyle = flattenAndNormalizeStyle([
    { boxSizing: 'border-box' },
    clampStyle,
    style,
  ]);

  if (rest.accessibilityRole === 'header') {
    return (
      <h2
        className={className}
        style={normalizedStyle}
        {...buildDataAttrs(dataSet, testID)}
        {...buildAriaAttrs(rest)}
      >
        {children}
      </h2>
    );
  }

  return (
    <span
      className={className}
      style={normalizedStyle}
      {...buildDataAttrs(dataSet, testID)}
      {...buildAriaAttrs(rest)}
    >
      {children}
    </span>
  );
}

export interface PressableProps extends AccessibilityProps {
  style?: unknown | ((state: { pressed: boolean; hovered: boolean }) => unknown);
  children?: ReactNode | ((state: { pressed: boolean; hovered: boolean }) => ReactNode);
  disabled?: boolean;
  hitSlop?: unknown;
  onPress?: (event?: unknown) => void;
  onPressIn?: (event?: unknown) => void;
  onPressOut?: (event?: unknown) => void;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
  dataSet?: Record<string, unknown>;
  className?: string;
}

export function Pressable(props: PressableProps) {
  const {
    style,
    children,
    disabled = false,
    onPress,
    onPressIn,
    onPressOut,
    onHoverIn,
    onHoverOut,
    onLayout,
    testID,
    dataSet,
    className,
    ...rest
  } = props;

  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const localRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!onLayout || !localRef.current) return undefined;
    const el = localRef.current;
    const rect = el.getBoundingClientRect();
    onLayout({
      nativeEvent: {
        layout: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      },
    });
    return undefined;
  }, [onLayout]);

  const resolvedStyleInput = typeof style === 'function' ? style({ pressed, hovered }) : style;
  const normalizedStyle = flattenAndNormalizeStyle([
    {
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      cursor: disabled ? 'default' : 'pointer',
      userSelect: 'none',
      WebkitUserSelect: 'none',
    },
    resolvedStyleInput,
  ]);

  const resolvedChildren = typeof children === 'function' ? children({ pressed, hovered }) : children;

  return (
    <div
      ref={localRef}
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={className}
      style={normalizedStyle}
      {...buildDataAttrs(dataSet, testID)}
      {...buildAriaAttrs({ ...rest, accessibilityRole: rest.accessibilityRole ?? 'button' })}
      aria-disabled={disabled ? 'true' : undefined}
      onMouseEnter={() => {
        if (disabled) return;
        setHovered(true);
        onHoverIn?.();
      }}
      onMouseLeave={() => {
        setHovered(false);
        if (pressed) {
          setPressed(false);
          onPressOut?.();
        }
        onHoverOut?.();
      }}
      onMouseDown={(e: ReactMouseEvent) => {
        if (disabled) return;
        setPressed(true);
        onPressIn?.(e);
      }}
      onMouseUp={(e: ReactMouseEvent) => {
        if (pressed) {
          setPressed(false);
          onPressOut?.(e);
        }
      }}
      onClick={(e: ReactMouseEvent) => {
        if (disabled) return;
        onPress?.(e);
      }}
      onKeyDown={(e: ReactKeyboardEvent) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPress?.(e);
        }
      }}
    >
      {resolvedChildren}
    </div>
  );
}

export interface ScrollViewProps extends ViewProps {
  contentContainerStyle?: unknown;
  scrollEventThrottle?: number;
  onScroll?: (event: {
    nativeEvent: {
      contentOffset: { x: number; y: number };
      contentSize: { width: number; height: number };
      layoutMeasurement: { width: number; height: number };
    };
  }) => void;
}

export function ScrollView(props: ScrollViewProps) {
  const { style, contentContainerStyle, children, onScroll, ...rest } = props;
  return (
    <div
      style={flattenAndNormalizeStyle([
        {
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
        },
        style,
      ])}
      onScroll={
        onScroll
          ? (e) => {
              const el = e.currentTarget;
              onScroll({
                nativeEvent: {
                  contentOffset: { x: el.scrollLeft, y: el.scrollTop },
                  contentSize: { width: el.scrollWidth, height: el.scrollHeight },
                  layoutMeasurement: { width: el.clientWidth, height: el.clientHeight },
                },
              });
            }
          : undefined
      }
      {...buildAriaAttrs(rest)}
    >
      <div
        style={flattenAndNormalizeStyle([
          { display: 'flex', flexDirection: 'column', minWidth: 0 },
          contentContainerStyle,
        ])}
      >
        {children}
      </div>
    </div>
  );
}

export interface TextInputProps extends AccessibilityProps {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  keyboardType?: string;
  inputMode?: string;
  autoCapitalize?: string;
  autoCorrect?: boolean;
  autoComplete?: string;
  multiline?: boolean;
  editable?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  style?: unknown;
}

export function TextInput(props: TextInputProps) {
  const {
    value,
    onChangeText,
    placeholder,
    multiline = false,
    editable = true,
    autoFocus = false,
    maxLength,
    style,
    ...rest
  } = props;
  const normalizedStyle = flattenAndNormalizeStyle([
    {
      boxSizing: 'border-box',
      fontFamily: 'inherit',
      outline: 'none',
    },
    style,
  ]);
  if (multiline) {
    return (
      <textarea
        value={value ?? ''}
        placeholder={placeholder}
        disabled={editable === false}
        autoFocus={autoFocus}
        maxLength={maxLength}
        style={normalizedStyle}
        onChange={(e) => onChangeText?.(e.target.value)}
        {...buildAriaAttrs(rest)}
      />
    );
  }
  return (
    <input
      value={value ?? ''}
      placeholder={placeholder}
      disabled={editable === false}
      autoFocus={autoFocus}
      maxLength={maxLength}
      style={normalizedStyle}
      onChange={(e) => onChangeText?.(e.target.value)}
      {...buildAriaAttrs(rest)}
    />
  );
}

export function Modal({
  visible,
  children,
  onRequestClose,
}: {
  visible?: boolean;
  transparent?: boolean;
  animationType?: string;
  onRequestClose?: () => void;
  children?: ReactNode;
}) {
  useEffect(() => {
    if (!visible || !onRequestClose || typeof window === 'undefined') return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onRequestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRequestClose, visible]);

  if (!visible) return null;
  return (
    <div
      data-slot="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </div>
  );
}

export function KeyboardAvoidingView({ style, children }: { behavior?: string; style?: unknown; children?: ReactNode }) {
  return <View style={style}>{children}</View>;
}

export function ActivityIndicator({ color, size = 16, ...rest }: { color?: string; size?: number } & AccessibilityProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '999px',
        border: `2px solid ${color ?? 'currentColor'}`,
        borderTopColor: 'transparent',
      }}
      {...buildAriaAttrs(rest)}
    />
  );
}

type WinDims = { width: number; height: number; scale: number; fontScale: number };
let cachedDims: WinDims = {
  width: typeof window !== 'undefined' ? window.innerWidth || 1280 : 1280,
  height: typeof window !== 'undefined' ? window.innerHeight || 800 : 800,
  scale: 1,
  fontScale: 1,
};

function subscribeResize(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 800;
    if (w !== cachedDims.width || h !== cachedDims.height) {
      cachedDims = { width: w, height: h, scale: 1, fontScale: 1 };
      onChange();
    }
  };
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}

export function useWindowDimensions(): WinDims {
  return useSyncExternalStore(
    subscribeResize,
    () => cachedDims,
    () => ({ width: 1280, height: 800, scale: 1, fontScale: 1 }),
  );
}

export function useColorScheme(): 'light' | 'dark' {
  return 'light';
}

export const AccessibilityInfo = {
  isReduceMotionEnabled(): Promise<boolean> {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return Promise.resolve(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    return Promise.resolve(false);
  },
  addEventListener(_event: string, _handler: (enabled: boolean) => void) {
    return { remove() {} };
  },
  announceForAccessibility(_msg: string) {},
};

export const Share = {
  async share(content: { message?: string; title?: string; url?: string }) {
    if (typeof navigator !== 'undefined' && navigator.clipboard && content.message) {
      await navigator.clipboard.writeText(content.message);
    }
    return { action: 'sharedAction' };
  },
};

class AnimatedValue {
  _value: number | string;
  constructor(v: number | string) {
    this._value = v;
  }
  setValue(v: number | string) {
    this._value = v;
  }
  interpolate(config: {
    inputRange: readonly number[];
    outputRange: readonly (number | string)[];
  }): AnimatedValue {
    const first = config?.outputRange?.[0] ?? 0;
    return new AnimatedValue(first);
  }
  stopAnimation(cb?: (value: number) => void) {
    cb?.(typeof this._value === 'number' ? this._value : 0);
  }
  addListener(_cb: (state: { value: number }) => void): string {
    return '0';
  }
  removeListener(_id: string) {}
  removeAllListeners() {}
}

export const Easing = {
  inOut: <T,>(fn: T): T => fn,
  in: <T,>(fn: T): T => fn,
  out: <T,>(fn: T): T => fn,
  ease: (t: number) => t,
  linear: (t: number) => t,
  quad: (t: number) => t * t,
  cubic: (t: number) => t * t * t,
  sin: (t: number) => t,
  circle: (t: number) => t,
  exp: (t: number) => t,
  bezier: (_x1: number, _y1: number, _x2: number, _y2: number) => (t: number) => t,
};

export const Animated = {
  Value: AnimatedValue,
  View,
  Text,
  timing(_val: unknown, _cfg: unknown) {
    return {
      start(cb?: (res: { finished: boolean }) => void) {
        cb?.({ finished: true });
      },
      stop() {},
      reset() {},
    };
  },
  spring(_val: unknown, _cfg: unknown) {
    return {
      start(cb?: (res: { finished: boolean }) => void) {
        cb?.({ finished: true });
      },
      stop() {},
      reset() {},
    };
  },
  sequence(_steps: unknown[]) {
    return {
      start(cb?: (res: { finished: boolean }) => void) {
        cb?.({ finished: true });
      },
      stop() {},
      reset() {},
    };
  },
  parallel(_steps: unknown[]) {
    return {
      start(cb?: (res: { finished: boolean }) => void) {
        cb?.({ finished: true });
      },
      stop() {},
      reset() {},
    };
  },
  loop(_anim: unknown) {
    return { start() {}, stop() {}, reset() {} };
  },
};

export const AppState = {
  currentState: "active",
  addEventListener(_type: string, handler: (state: string) => void) {
    if (typeof document === "undefined") return { remove() {} };
    const onVis = () => {
      handler(document.visibilityState === "hidden" ? "background" : "active");
    };
    document.addEventListener("visibilitychange", onVis);
    return {
      remove() {
        document.removeEventListener("visibilitychange", onVis);
      },
    };
  },
};
