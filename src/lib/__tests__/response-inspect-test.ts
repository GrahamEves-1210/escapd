import { describeResponse } from "../response-inspect";

const headers = (entries: Record<string, string>) => new Headers(entries);

describe("describeResponse", () => {
  it("names an HTML error page by its title, without the query string", () => {
    const line = describeResponse(
      "PUT",
      "https://abc.supabase.co/auth/v1/user?redirect_to=exp%3A%2F%2Fx",
      403,
      headers({ "content-type": "text/html; charset=UTF-8", server: "cloudflare" }),
      "<!DOCTYPE html><html><head><title>Attention Required! | Cloudflare</title></head><body>...</body></html>",
    );
    expect(line).toBe("PUT abc.supabase.co/auth/v1/user -> 403 text/html; charset=UTF-8 (cloudflare): Attention Required! | Cloudflare");
    expect(line).not.toContain("redirect_to");
  });

  it("falls back to the start of the body when there is no title", () => {
    expect(describeResponse("GET", "http://192.168.1.5:8081/auth/v1/user", 404, headers({}), "<pre>Cannot GET /auth/v1/user</pre>"))
      .toBe("GET 192.168.1.5:8081/auth/v1/user -> 404 no content-type: <pre>Cannot GET /auth/v1/user</pre>");
  });
});
