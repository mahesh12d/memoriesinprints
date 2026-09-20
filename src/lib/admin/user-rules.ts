/**
 * The rules that stop an administrator locking the business out of its own
 * back office. Kept separate from the actions so they can be tested directly.
 */

export type UserRole = "customer" | "designer" | "proofreader" | "admin";

export type RoleChange = {
  /** The account being changed. */
  targetId: string;
  currentRole: UserRole;
  nextRole: UserRole;
  /** Who is making the change. */
  actorId: string;
  /** How many enabled admins exist right now, including the target. */
  adminCount: number;
};

export type Verdict = { allowed: true } | { allowed: false; reason: string };

/**
 * Two things must stay true: there is always at least one administrator, and
 * nobody quietly removes their own access and then wonders why the page has
 * stopped loading.
 */
export function canChangeRole(change: RoleChange): Verdict {
  const { targetId, currentRole, nextRole, actorId, adminCount } = change;

  if (currentRole === nextRole) {
    return { allowed: false, reason: "That is already their role." };
  }

  if (targetId === actorId && nextRole !== "admin") {
    return {
      allowed: false,
      reason:
        "You can't remove your own administrator access. Ask another administrator to do it.",
    };
  }

  if (currentRole === "admin" && nextRole !== "admin" && adminCount <= 1) {
    return {
      allowed: false,
      reason:
        "This is the only administrator left. Make someone else an administrator first.",
    };
  }

  return { allowed: true };
}

export type DisableChange = {
  targetId: string;
  targetRole: UserRole;
  actorId: string;
  /** Enabled admins right now, including the target. */
  adminCount: number;
  disable: boolean;
};

export function canDisable(change: DisableChange): Verdict {
  const { targetId, targetRole, actorId, adminCount, disable } = change;

  if (!disable) return { allowed: true };

  if (targetId === actorId) {
    return { allowed: false, reason: "You can't suspend your own account." };
  }

  if (targetRole === "admin" && adminCount <= 1) {
    return {
      allowed: false,
      reason:
        "This is the only administrator left. Make someone else an administrator first.",
    };
  }

  return { allowed: true };
}
