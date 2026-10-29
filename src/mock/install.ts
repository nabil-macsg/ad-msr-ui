import { problem } from './core/http';
import { dispatch } from './core/router';
import { registerServices } from './services';

const DEMO_API = /^\/api\//;

/**
 * Answers every `/api/…` request in the browser from the demo's mock services, so the real
 * screens and their API client run unchanged without masar-backend. Other requests (assets,
 * the Vite dev server) go to the network as usual. Nothing here calls a real MASAR endpoint.
 */
export function installMockApi(): void {
  registerServices();
  const network = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request =
      input instanceof Request
        ? input
        : new Request(new URL(String(input), window.location.origin), init);
    const url = new URL(request.url);
    if (url.origin !== window.location.origin || !DEMO_API.test(url.pathname))
      return network(input, init);
    const text = ['GET', 'HEAD'].includes(request.method) ? '' : await request.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }
    // A short pause, so loading states show as they would against a server.
    await new Promise((resolve) => setTimeout(resolve, 120));
    const answer = await dispatch(request.method, url, request.headers, body);
    return answer ?? notInDemo();
  };
}

function notInDemo(): Response {
  return problem(404, 'NOT_IN_DEMO', 'This part of MASAR has no demo data yet.');
}
