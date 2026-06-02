// Global fetch interceptor that stamps every same-origin API request with the
// caller's active workspace via the `x-workspace-id` header. This is the single
// client-side choke point: it covers both the generated API client
// (custom-fetch) and any raw `fetch("/api/...")` calls scattered across pages,
// so no request can reach the backend without a workspace context.
//
// The active workspace id is read from localStorage (kept in sync by
// use-workspace.tsx). The server still authoritatively validates that the
// caller may access the requested workspace, so this header is a convenience,
// not a trust boundary.

const STORAGE_KEY = "opypal_current_workspace";
const HEADER = "x-workspace-id";

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function isApiRequest(url: string): boolean {
  return url.includes("/api/") || /\/api(\?|$)/.test(url);
}

let installed = false;

export function installWorkspaceFetchInterceptor(): void {
  if (installed) return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    let wsId: string | null = null;
    try {
      wsId = localStorage.getItem(STORAGE_KEY);
    } catch {
      wsId = null;
    }

    if (!wsId || !isApiRequest(urlOf(input))) {
      return originalFetch(input, init);
    }

    if (input instanceof Request) {
      const headers = new Headers(input.headers);
      if (!headers.has(HEADER)) headers.set(HEADER, wsId);
      return originalFetch(new Request(input, { headers }));
    }

    const headers = new Headers(init?.headers);
    if (!headers.has(HEADER)) headers.set(HEADER, wsId);
    return originalFetch(input, { ...init, headers });
  };
}
