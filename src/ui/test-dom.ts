/** Minimal document so react-dom can mount in Jest's node environment. */
class El {
  nodeType = 1;
  nodeName: string;
  tagName: string;
  style: Record<string, string> = {};
  childNodes: (El | TextNode)[] = [];
  attributes: Record<string, string> = {};
  parentNode: El | null = null;
  ownerDocument: DocumentShim | null = null;
  namespaceURI = 'http://www.w3.org/1999/xhtml';

  constructor(name: string) {
    this.nodeName = name.toUpperCase();
    this.tagName = this.nodeName;
  }

  get children(): El[] {
    return this.childNodes.filter((node): node is El => node.nodeType === 1);
  }

  get firstChild(): El | TextNode | null {
    return this.childNodes[0] ?? null;
  }

  get firstElementChild(): El | null {
    return this.children[0] ?? null;
  }

  get nextSibling(): El | TextNode | null {
    if (!this.parentNode) return null;
    const index = this.parentNode.childNodes.indexOf(this);
    return this.parentNode.childNodes[index + 1] ?? null;
  }

  get textContent(): string {
    return this.childNodes.map((node) => node.textContent).join('');
  }

  set textContent(value: string) {
    const text = new TextNode(String(value));
    text.parentNode = this;
    this.childNodes = value === '' ? [] : [text];
  }

  appendChild<T extends El | TextNode>(child: T): T {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild<T extends El | TextNode>(child: T): T {
    this.childNodes = this.childNodes.filter((node) => node !== child);
    child.parentNode = null;
    return child;
  }

  insertBefore<T extends El | TextNode>(child: T, before: El | TextNode | null): T {
    child.parentNode = this;
    const index = before ? this.childNodes.indexOf(before) : -1;
    if (index < 0) this.childNodes.push(child);
    else this.childNodes.splice(index, 0, child);
    return child;
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = String(value);
  }

  removeAttribute(name: string): void {
    delete this.attributes[name];
  }

  getAttribute(name: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }

  hasAttribute(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.attributes, name);
  }

  getAttributeNames(): string[] {
    return Object.keys(this.attributes);
  }

  private listeners = new Map<string, Set<(event: Event) => void>>();

  addEventListener(type: string, listener: (event: Event) => void): void {
    const bucket = this.listeners.get(type) ?? new Set<(event: Event) => void>();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: Event): boolean {
    const bucket = this.listeners.get(event.type);
    bucket?.forEach((listener) => listener(event));
    const bubbling = 'bubbles' in event && event.bubbles === true;
    if (bubbling && this.parentNode) this.parentNode.dispatchEvent(event);
    return true;
  }
  getElementById(id: string): El | null {
    const walk = (node: El): El | null => {
      if (node.getAttribute('id') === id) return node;
      for (const child of node.children) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return this.ownerDocument ? walk(this.ownerDocument.documentElement) : null;
  }
  focus(): void {}
  blur(): void {}
  contains(): boolean {
    return false;
  }

  getBoundingClientRect(): { x: number; y: number; top: number; left: number; right: number; bottom: number; width: number; height: number } {
    return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }
}

class TextNode {
  nodeType = 3;
  nodeName = '#text';
  parentNode: El | null = null;
  textContent: string;
  data: string;

  constructor(text: string) {
    this.textContent = text;
    this.data = text;
  }

  get nextSibling(): El | TextNode | null {
    if (!this.parentNode) return null;
    const index = this.parentNode.childNodes.indexOf(this);
    return this.parentNode.childNodes[index + 1] ?? null;
  }
}

class Host {}
class HTMLElement extends Host {}
class Element extends Host {}
class Node extends Host {}
class HTMLIFrameElement extends HTMLElement {}

type DocumentShim = {
  nodeType: number;
  nodeName: string;
  body: El;
  documentElement: El;
  activeElement: null;
  defaultView: typeof globalThis;
  createElement: (name: string) => El;
  createElementNS: (namespace: string, name: string) => El;
  head: El;
  createTextNode: (text: string) => TextNode;
  getElementById: (id: string) => El | null;
  addEventListener: () => void;
  removeEventListener: () => void;
};

function element(document: DocumentShim, name: string): El {
  const node = new El(name);
  node.ownerDocument = document;
  return node;
}

const documentShim = {
  nodeType: 9,
  nodeName: '#document',
  activeElement: null,
  defaultView: globalThis,
  createElement(name: string) {
    return element(documentShim, name);
  },
  createElementNS(_namespace: string, name: string) {
    return element(documentShim, name);
  },
  createTextNode(text: string) {
    return new TextNode(text);
  },
  getElementById(id: string) {
    const walk = (node: El): El | null => {
      if (node.getAttribute('id') === id) return node;
      for (const child of node.children) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return documentShim.documentElement ? walk(documentShim.documentElement) : null;
  },
  addEventListener() {},
  removeEventListener() {},
} as DocumentShim;

documentShim.documentElement = element(documentShim, 'html');
documentShim.head = element(documentShim, 'head');
documentShim.body = element(documentShim, 'body');
documentShim.documentElement.appendChild(documentShim.head);
documentShim.documentElement.appendChild(documentShim.body);
targetShadow();

function targetShadow() {
  (globalThis as unknown as { ShadowRoot: typeof Host }).ShadowRoot = class ShadowRoot extends Host {};
}

const target = globalThis as unknown as Record<string, unknown>;
target.document = documentShim;
target.window = globalThis;
target.HTMLElement = HTMLElement;
target.Element = Element;
target.Node = Node;
target.HTMLIFrameElement = HTMLIFrameElement;
target.__announcements = [];
target.__reduceMotion = false;

if (typeof globalThis.getComputedStyle !== 'function') {
  target.getComputedStyle = () => ({});
}
if (typeof globalThis.requestAnimationFrame !== 'function') {
  target.requestAnimationFrame = (callback: FrameRequestCallback) =>
    setTimeout(() => callback(Date.now()), 0) as unknown as number;
}
if (typeof globalThis.cancelAnimationFrame !== 'function') {
  target.cancelAnimationFrame = (handle?: number | null) => {
    if (handle != null) clearTimeout(handle);
  };
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
