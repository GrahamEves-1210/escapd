// Development diagnostics: when Supabase answers with something that isn't
// JSON (an HTML error page from a proxy, a captive portal, a firewall, or the
// wrong host), describe what actually answered instead of letting it surface
// as a bare "JSON Parse error: Unexpected character: <".

let last: string | null = null;

/** The most recent non-JSON response, described in one line (development only). */
export function lastNonJsonResponse() {
  return last;
}

export function describeResponse(method: string, url: string, status: number, headers: Headers, body: string) {
  let where = url;
  try {
    const parsed = new URL(url);
    where = `${parsed.host}${parsed.pathname}`; // never the query: it can carry tokens
  } catch {
    where = url.split("?")[0];
  }
  const type = headers.get("content-type") || "no content-type";
  const server = headers.get("server");
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(body)?.[1]?.trim();
  const snippet = title ?? body.replace(/\s+/g, " ").trim().slice(0, 120);
  return `${method} ${where} -> ${status} ${type}${server ? ` (${server})` : ""}: ${snippet || "(empty body)"}`;
}

/** fetch for the Supabase client that records and logs non-JSON responses. */
export async function inspectingFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  const type = response.headers.get("content-type") ?? "";
  if (response.status !== 204 && !type.includes("json")) {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");
      last = describeResponse(method, url, response.status, response.headers, await response.clone().text());
      console.warn(`[supabase] non-JSON response: ${last}`);
    } catch {
      // Diagnostics must never break the request itself.
    }
  }
  return response;
}
