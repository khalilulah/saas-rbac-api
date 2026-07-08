// src/features/api-keys/key-utils.ts
import crypto from "crypto";

const KEY_PREFIX = "sk_live_";

export function generateApiKey(): {
  rawKey: string;
  prefix: string;
  hash: string;
} {
  // 32 random bytes -> 64 hex characters of entropy. Not guessable.
  const secret = crypto.randomBytes(32).toString("hex");
  const rawKey = `${KEY_PREFIX}${secret}`;

  const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const prefix = rawKey.slice(0, 12); // e.g. "sk_live_a1b2" — just enough to be recognizable

  return { rawKey, prefix, hash };
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}
