import { AiError } from "../errors";

/** Enough for a server that moves /v1 around; more is a loop. */
const MAX_REDIRECTS = 3;

export const REDIRECT_REFUSED =
  "The AI server sent the request to another address. RolePebble won't send your API key there: put that address in Settings → AI provider instead.";

/**
 * A fetch for requests that carry an API key (E11-5): the AI server's address
 * is set by the user, so a redirect to another host is refused instead of
 * followed with the key attached. Same-origin redirects that keep the method
 * and body (307, 308) are still followed.
 */
export function keyGuardedFetch(fetchImpl: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    let url = new URL(input instanceof Request ? input.url : String(input));
    for (let hops = 0; ; hops++) {
      const response = await fetchImpl(url, { ...init, redirect: "manual" });
      const location = response.headers.get("location");
      if (response.status < 300 || response.status >= 400 || !location) return response;

      const next = new URL(location, url);
      const keepsRequest = response.status === 307 || response.status === 308;
      if (next.origin !== url.origin || !keepsRequest || hops >= MAX_REDIRECTS) {
        throw AiError.config(REDIRECT_REFUSED);
      }
      url = next;
    }
  };
}
