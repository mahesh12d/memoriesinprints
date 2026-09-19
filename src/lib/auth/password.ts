import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id at OWASP's recommended settings (19 MiB, 2 passes).
 * Tuned so a single hash costs roughly 50–100ms on a small server — slow enough
 * to make offline cracking expensive, fast enough not to be a login bottleneck.
 */
const OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plain, OPTIONS);
  } catch {
    // A malformed hash in the database should read as "wrong password",
    // never as a crash on the login route.
    return false;
  }
}

/**
 * Burn roughly the same amount of time as a real verification when the email
 * doesn't exist, so response timing can't be used to enumerate accounts.
 */
export async function fakeVerifyDelay(): Promise<void> {
  await hash("timing-equaliser", OPTIONS);
}
