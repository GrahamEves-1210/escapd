import { ApiError } from "../escapd-api";
import { EMAIL_PATTERN, errorDetail, linkEmailError } from "../account-errors";

jest.mock("../supabase", () => ({ supabase: {} }));

describe("linkEmailError", () => {
  it("explains an email that already has an account", () => {
    expect(linkEmailError(new ApiError("A user with this email address has already been registered", "email_exists")))
      .toMatch(/already has an ESCAPD account/);
  });

  it("asks the player to wait when rate limited", () => {
    expect(linkEmailError(new ApiError("email rate limit exceeded", "over_email_send_rate_limit"))).toMatch(/Wait a minute/);
  });

  it("recognises being offline", () => {
    expect(linkEmailError(new TypeError("Network request failed"))).toMatch(/offline/);
  });

  it("recognises a stored session that can't be used", () => {
    expect(linkEmailError(new ApiError("Auth session missing!"))).toMatch(/reopen the app/);
    expect(linkEmailError(new ApiError("Invalid Refresh Token: Already Used", "refresh_token_already_used"))).toMatch(/reopen the app/);
  });

  it("explains Supabase's built-in sender refusing an address", () => {
    expect(linkEmailError(new ApiError("Email address \"a@b.com\" not authorized", "email_address_not_authorized"))).toMatch(/Supabase team/);
  });

  it("never shows raw server text", () => {
    expect(linkEmailError(new ApiError("Database error saving new user", "unexpected_failure"))).toBe("Couldn't send the link. Try again.");
  });
});

describe("errorDetail", () => {
  it("names the library error, its HTTP status, code and message", () => {
    const original = Object.assign(new Error("Invalid Refresh Token: Already Used"), {
      name: "AuthApiError", status: 400, code: "refresh_token_already_used",
    });
    expect(errorDetail(new ApiError(original.message, original.code, original)))
      .toBe("AuthApiError HTTP 400 [refresh_token_already_used] Invalid Refresh Token: Already Used");
  });

  it("describes plain errors and non-errors", () => {
    expect(errorDetail(new TypeError("Network request failed"))).toBe("TypeError Network request failed");
    expect(errorDetail("boom")).toBe("boom");
  });
});

describe("EMAIL_PATTERN", () => {
  it("accepts ordinary addresses and rejects obvious typos", () => {
    expect(EMAIL_PATTERN.test("name@example.com")).toBe(true);
    expect(EMAIL_PATTERN.test("name@example")).toBe(false);
    expect(EMAIL_PATTERN.test("name example.com")).toBe(false);
  });
});
