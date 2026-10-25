// The test purchase behind /pro's "Unlock Pro" (docs/DESIGN.md, 05 · Test
// purchase). The spec's grant-test-entitlement Edge Function, and the client
// call to it, aren't built yet: Supabase changes were out of scope for this
// build. Until they exist, grantTestEntitlement() fails at once with
// TestPurchaseUnavailableError. It makes no network or Supabase call.

/**
 * True when this build offers the test purchase: EXPO_PUBLIC_TEST_PURCHASES
 * is "1". Expo inlines the value at build time; set it only in the EAS
 * development and preview environments and in local .env, never in production.
 */
export function testPurchasesEnabled(): boolean {
  return process.env.EXPO_PUBLIC_TEST_PURCHASES === "1";
}

/** Error codes grant-test-entitlement answers with (DESIGN.md, 05 · Test purchase). */
export type TestPurchaseErrorCode = "test_purchases_off" | "account_required" | "unauthorized" | "internal_error";

/** The function refused, with its error code. */
export class TestPurchaseError extends Error {
  constructor(readonly code: TestPurchaseErrorCode | (string & {}), message: string = code) {
    super(message);
    this.name = "TestPurchaseError";
  }
}

/**
 * The test purchase can't run in this build, because its server function
 * doesn't exist yet. The message is for logs: /pro shows the Error table's
 * "Test purchases are off on this server." instead.
 */
export class TestPurchaseUnavailableError extends Error {
  constructor() {
    super("Test purchases need the grant-test-entitlement function, which isn't built yet.");
    this.name = "TestPurchaseUnavailableError";
  }
}

/**
 * Grants the signed-in account the custom_rooms entitlement for testing,
 * exactly as scripts/grant-test-access.sql does by hand. Today it always
 * rejects with TestPurchaseUnavailableError.
 *
 * Once grant-test-entitlement exists, this becomes
 * `supabase.functions.invoke("grant-test-entitlement", { body: {} })` in
 * src/lib/escapd-api.ts, and a FunctionsHttpError should be rethrown as
 * TestPurchaseError with the `error` code from `await error.context.json()`.
 */
export async function grantTestEntitlement(): Promise<void> {
  throw new TestPurchaseUnavailableError();
}
