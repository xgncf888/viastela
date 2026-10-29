import {
  accessTokenAudience,
  verifyEs256AccessToken,
  wwwAuthenticate,
  type Jwks,
  type ProjectUrls,
  type VerifiedAccessToken,
} from './jwt.ts';

export type McpDependencies = {
  urls: ProjectUrls;
  now: () => Date;
  jwks: () => Promise<Jwks>;
};

const protocolVersions = new Set(['2025-03-26', '2025-06-18']);

type Identity = { sub: string; client_id: string | null };

/**
 * Streamable HTTP MCP endpoint.
 * This module does not log. Callers must not log the request, its headers, or the token.
 */
export async function handleMcp(request: Request, deps: McpDependencies): Promise<Response> {
  const url = new URL(request.url);
  if (isMetadataPath(url.pathname)) return metadataResponse(request.method, deps.urls);

  const token = bearer(request);
  if (!token) return unauthorized(deps.urls.metadata);
  const identity = await verify(token, deps);
  if (!identity) return unauthorized(deps.urls.metadata);

  if (request.method === 'GET' || request.method === 'DELETE') return methodNotAllowed();
  if (request.method !== 'POST') return methodNotAllowed();

  const version = request.headers.get('mcp-protocol-version');
  if (version && !protocolVersions.has(version)) return plain(400, { error: 'unsupported_protocol_version' });

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) return plain(415, { error: 'unsupported_media_type' });

  let message: unknown;
  try {
    message = await request.json();
  } catch {
    return plain(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } });
  }
  if (Array.isArray(message) || !isRecord(message)) {
    return plain(400, { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'invalid request' } });
  }
  return rpc(message, identity, acceptsJson(request));
}

function metadataResponse(method: string, urls: ProjectUrls): Response {
  if (method !== 'GET' && method !== 'HEAD') return methodNotAllowed();
  const body = {
    resource: urls.resource,
    authorization_servers: [urls.issuer],
    bearer_methods_supported: ['header'],
  };
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  if (method === 'HEAD') return new Response(null, { status: 200, headers });
  return new Response(JSON.stringify(body), { status: 200, headers });
}

async function verify(token: string, deps: McpDependencies): Promise<VerifiedAccessToken | null> {
  let jwks: Jwks;
  try {
    jwks = await deps.jwks();
  } catch {
    return null;
  }
  return verifyEs256AccessToken(token, {
    jwks,
    issuer: deps.urls.issuer,
    audience: accessTokenAudience,
    now: deps.now(),
  });
}

function rpc(message: Record<string, unknown>, identity: VerifiedAccessToken, asJson: boolean): Response {
  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return rpcError(message.id, -32600, 'invalid request', asJson);
  }
  const method = message.method;
  const notification = !Object.hasOwn(message, 'id');
  if (notification) {
    if (method === 'notifications/initialized' || method === 'notifications/cancelled') return accepted();
    return plain(400, { jsonrpc: '2.0', error: { code: -32601, message: 'method not found' } });
  }
  if (method === 'initialize') {
    const requested = isRecord(message.params) && typeof message.params.protocolVersion === 'string'
      ? message.params.protocolVersion
      : '2025-06-18';
    const protocolVersion = protocolVersions.has(requested) ? requested : '2025-06-18';
    return rpcResult(message.id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'mcp', version: '0.0.0' },
    }, asJson);
  }
  if (method === 'ping') return rpcResult(message.id, {}, asJson);
  if (method === 'tools/list') {
    return rpcResult(message.id, {
      tools: [{
        name: 'whoami',
        description: '返回已验证令牌中的 sub 和 client_id。',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      }],
    }, asJson);
  }
  if (method === 'tools/call') {
    const params = isRecord(message.params) ? message.params : null;
    const name = params && typeof params.name === 'string' ? params.name : '';
    if (name !== 'whoami') return rpcError(message.id, -32602, 'unknown tool', asJson);
    return rpcResult(message.id, toolResult(identity), asJson);
  }
  return rpcError(message.id, -32601, 'method not found', asJson);
}

function toolResult(identity: VerifiedAccessToken): { content: { type: 'text'; text: string }[]; structuredContent: Identity } {
  const structuredContent: Identity = { sub: identity.sub, client_id: identity.clientId };
  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
    structuredContent,
  };
}

function unauthorized(metadata: string): Response {
  return json(401, { error: 'invalid_token' }, { 'www-authenticate': wwwAuthenticate(metadata), 'cache-control': 'no-store' });
}

function rpcResult(id: unknown, result: unknown, asJson: boolean): Response {
  return rpcResponse({ jsonrpc: '2.0', id, result }, asJson);
}

function rpcError(id: unknown, code: number, message: string, asJson: boolean): Response {
  return rpcResponse({ jsonrpc: '2.0', id, error: { code, message } }, asJson);
}

function rpcResponse(body: unknown, asJson: boolean): Response {
  if (!asJson) {
    return new Response(`event: message\ndata: ${JSON.stringify(body)}\n\n`, {
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store' },
    });
  }
  return json(200, body, { 'cache-control': 'no-store' });
}

function accepted(): Response {
  return new Response(null, { status: 202, headers: { 'cache-control': 'no-store' } });
}

function methodNotAllowed(): Response {
  return plain(405, { error: 'method_not_allowed' });
}

function plain(status: number, body: unknown): Response {
  return json(status, body, { 'cache-control': 'no-store' });
}

function json(status: number, body: unknown, extra?: Record<string, string>): Response {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' });
  if (extra) {
    for (const [name, value] of Object.entries(extra)) headers.set(name, value);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function isMetadataPath(pathname: string): boolean {
  return pathname.includes('/.well-known/oauth-protected-resource');
}

function bearer(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1];
  return token.length > 0 ? token : null;
}

function acceptsJson(request: Request): boolean {
  const accept = request.headers.get('accept');
  if (!accept) return true;
  const types = accept.split(',').map((part) => part.split(';')[0]?.trim().toLowerCase() ?? '');
  if (types.includes('application/json') || types.includes('*/*')) return true;
  return !types.includes('text/event-stream');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
