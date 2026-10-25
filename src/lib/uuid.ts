// Hermes has no crypto.randomUUID; Expo's native module supplies one.
// Jest (Node) has the global, so tests use that.
import { uuid } from "expo-modules-core";

export function newId(): string {
  const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return webCrypto?.randomUUID ? webCrypto.randomUUID() : uuid.v4();
}
