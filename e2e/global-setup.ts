import { execFileSync } from "node:child_process";

/**
 * Reseeds before every run.
 *
 * The suite buys things, uploads proofs and approves them, so a second run
 * against the leftovers of the first would fail on state it didn't create.
 * Starting from the same database every time is what makes the run mean
 * anything.
 */
export default function globalSetup(): void {
  execFileSync("npm", ["run", "db:seed"], {
    stdio: process.env.CI ? "inherit" : "ignore",
  });
}
