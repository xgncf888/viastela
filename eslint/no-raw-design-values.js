const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const COLOR_FN = /^(?:rgb|hsl|hwb|lab|lch|oklab|oklch)a?\(/i;
const SIZE_KEYS = new Set([
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingHorizontal',
  'paddingVertical',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'gap',
  'rowGap',
  'columnGap',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderWidth',
  'borderTopWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRightWidth',
  'top',
  'left',
  'right',
  'bottom',
  'flexBasis',
]);

function propertyName(node) {
  if (!node.key) return null;
  if (node.key.type === 'Identifier') return node.key.name;
  if (node.key.type === 'Literal') return String(node.key.value);
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require design tokens for colors and sizes in screens and feature UI.',
    },
    schema: [],
    messages: {
      color: 'Use a color from src/ui/theme.ts instead of a raw color.',
      size: 'Use a size from src/ui/theme.ts instead of a raw number.',
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        const value = node.value.trim();
        if (HEX.test(value) || COLOR_FN.test(value)) {
          context.report({ node, messageId: 'color' });
        }
      },
      Property(node) {
        const name = propertyName(node);
        if (!name || !SIZE_KEYS.has(name)) return;
        if (node.value.type === 'Literal' && typeof node.value.value === 'number' && node.value.value !== 0) {
          context.report({ node: node.value, messageId: 'size' });
        }
        if (
          node.value.type === 'UnaryExpression' &&
          node.value.operator === '-' &&
          node.value.argument.type === 'Literal' &&
          typeof node.value.argument.value === 'number'
        ) {
          context.report({ node: node.value, messageId: 'size' });
        }
      },
    };
  },
};
