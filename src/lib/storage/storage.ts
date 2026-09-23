import "server-only";

/**
 * Object storage, for application code.
 *
 * The guard is the whole point of this file: it keeps R2 credentials out of
 * any client bundle. The implementation lives in objects.ts so that the seed —
 * which runs outside Next and cannot resolve "server-only" — can write files
 * through exactly the same path the app reads them from.
 */
export * from "./objects";
