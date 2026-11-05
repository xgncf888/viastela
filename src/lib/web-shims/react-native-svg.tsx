import { createElement, type ReactNode } from 'react';

type SvgProps = Record<string, unknown> & { children?: ReactNode };

function createSvgElement(tag: string) {
  return function WebSvgNode({ children, ...rest }: SvgProps) {
    return createElement(tag, rest, children);
  };
}

const Svg = createSvgElement('svg');
export const Path = createSvgElement('path');
export const Circle = createSvgElement('circle');
export const Line = createSvgElement('line');
export const Polyline = createSvgElement('polyline');
export const Polygon = createSvgElement('polygon');
export const Rect = createSvgElement('rect');
export const G = createSvgElement('g');
export const Defs = createSvgElement('defs');
export const LinearGradient = createSvgElement('linearGradient');
export const RadialGradient = createSvgElement('radialGradient');
export const Stop = createSvgElement('stop');
export const Text = createSvgElement('text');

export default Svg;
