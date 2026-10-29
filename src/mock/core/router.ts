import { type Handler, type MockRequest, MockError, problem } from './http';

interface Route {
  readonly method: string;
  readonly pattern: RegExp;
  readonly names: readonly string[];
  readonly handler: Handler;
}

const routes: Route[] = [];

/**
 * Registers a handler for `METHOD /api/v1/path/:param`. When several routes match, the one with the
 * fewest parameters wins (`/masters/fleet/options` over `/masters/fleet/:id` over
 * `/masters/:resource/:id`); among equals, the one registered last.
 */
export function route(method: string, path: string, handler: Handler): void {
  const names: string[] = [];
  const source = path.replace(/:([A-Za-z]+)/g, (_, name: string) => {
    names.push(name);
    return '([^/]+)';
  });
  routes.unshift({ method, pattern: new RegExp(`^${source}$`), names, handler });
}

/** Answers a request from the registered routes, or null when no route matches. */
export async function dispatch(
  method: string,
  url: URL,
  headers: Headers,
  body: unknown,
): Promise<Response | null> {
  let best: { r: Route; match: RegExpExecArray } | null = null;
  for (const r of routes) {
    if (r.method !== method) continue;
    const match = r.pattern.exec(url.pathname);
    if (match && (!best || r.names.length < best.r.names.length)) best = { r, match };
  }
  if (best) {
    const { r, match } = best;
    const params = Object.fromEntries(
      r.names.map((name, i) => [name, decodeURIComponent(match[i + 1] ?? '')]),
    );
    const req: MockRequest = {
      method,
      path: url.pathname,
      params,
      query: url.searchParams,
      headers,
      body,
    };
    try {
      return await r.handler(req);
    } catch (error) {
      if (error instanceof MockError)
        return problem(error.status, error.code, error.message, error.details);
      throw error;
    }
  }
  return null;
}
