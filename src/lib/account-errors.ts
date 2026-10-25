// Player-facing copy for failures while adding an email to a guest account.
// Branch on the Supabase Auth error code; fall back to the message for older
// servers that don't send one.
import { ApiError, isNetworkError } from "./escapd-api";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Auth codes meaning the stored session can't be used (it never reached /user).
const SESSION_CODES = new Set([
  "session_not_found", "session_expired", "refresh_token_not_found", "refresh_token_already_used", "bad_jwt",
]);

export function linkEmailError(error: unknown): string {
  if (isNetworkError(error)) return "You're offline. Connect, then try again.";
  const code = error instanceof ApiError ? error.code ?? "" : "";
  const message = error instanceof Error ? error.message : "";
  if (code === "email_exists" || /already (been )?registered|already exists/i.test(message)) {
    return "That email already has an ESCAPD account. Signing in to an existing account isn't in this test build yet, so use another email.";
  }
  if (code.startsWith("over_email_send_rate_limit") || code === "over_request_rate_limit" || /rate limit/i.test(message)) {
    return "Too many emails just now. Wait a minute, then try again.";
  }
  if (code === "email_address_invalid" || code === "validation_failed") {
    return "That email address doesn't look right.";
  }
  if (code === "email_address_not_authorized" || /not authorized/i.test(message)) {
    // Supabase's built-in sender only mails the project's team members.
    return "This address can't receive email from the test server yet. Use the email on your Supabase team, or set up custom SMTP.";
  }
  if (SESSION_CODES.has(code) || /session missing|invalid refresh token/i.test(message)) {
    return "Your sign-in on this phone has expired. Close and reopen the app, then try again.";
  }
  return "Couldn't send the link. Try again.";
}

/**
 * One line naming the real error, for logs and the development build's screen:
 * the library error's name, HTTP status, code, and message.
 */
export function errorDetail(error: unknown): string {
  const original = error instanceof ApiError && error.original instanceof Error ? error.original : error;
  if (!(original instanceof Error)) return String(original);
  const status = (original as { status?: unknown }).status;
  const code = (original as { code?: unknown }).code ?? (error instanceof ApiError ? error.code : undefined);
  return [original.name, status ? `HTTP ${status}` : null, code ? `[${code}]` : null, original.message].filter(Boolean).join(" ");
}
