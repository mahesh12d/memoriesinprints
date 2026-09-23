import { createHash } from "node:crypto";

/**
 * Refuses passwords that already appear in public breach data.
 *
 * Reusing a password that has leaked elsewhere is the most common way an
 * account is taken over — the attacker does not crack anything, they just try
 * a list. A strong-looking password is no defence if it is already on that
 * list.
 *
 * The password never leaves this server. Have I Been Pwned's range API takes
 * the first five characters of the SHA-1 hash and returns every suffix it
 * holds under that prefix — tens of thousands of them — and the comparison
 * happens here. They learn a five-character prefix shared by a vast number of
 * passwords, and nothing else.
 */

const RANGE_ENDPOINT = "https://api.pwnedpasswords.com/range";

/** Long enough not to hang a signup, short enough that nobody notices. */
const TIMEOUT_MS = 2500;

/**
 * Splits the response into suffixes and finds ours.
 *
 * Exported for the test: this parsing is the part that can silently stop
 * matching if the response format is misread, and a check that always returns
 * "not breached" is worse than no check, because it looks like it works.
 */
export function suffixIsListed(body: string, suffix: string): boolean {
  for (const line of body.split("\n")) {
    const [candidate] = line.split(":");
    if (candidate?.trim().toUpperCase() === suffix) return true;
  }
  return false;
}

export async function isBreachedPassword(plain: string): Promise<boolean> {
  const hash = createHash("sha1").update(plain).digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  try {
    const response = await fetch(`${RANGE_ENDPOINT}/${prefix}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "Add-Padding": "true" },
    });

    if (!response.ok) return false;

    return suffixIsListed(await response.text(), suffix);
  } catch {
    /**
     * Fails open, deliberately. If the service is slow or unreachable, a
     * family trying to set a password at the worst week of their life should
     * not be blocked by it. The password rules still apply; this check is an
     * extra, not the gate.
     */
    return false;
  }
}

export const BREACHED_MESSAGE =
  "That password has appeared in a known data breach, so it isn't safe to use here. Please choose a different one.";
