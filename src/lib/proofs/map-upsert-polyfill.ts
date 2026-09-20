/**
 * `Map.prototype.getOrInsert` and friends, for browsers that don't have them.
 *
 * pdf.js 6 uses these internally. They only reached Chrome, Firefox and Safari
 * during 2025, so without this the proof viewer throws on any browser a year
 * or two old — and a good share of the people approving a funeral proof are on
 * exactly those devices. Each method is defined only when it is missing, so a
 * current browser keeps its own.
 */

type Upsertable<K, V> = {
  has(key: K): boolean;
  get(key: K): V | undefined;
  set(key: K, value: V): unknown;
};

function define(target: object, name: string, value: () => unknown): void {
  if (name in target) return;

  Object.defineProperty(target, name, {
    value,
    writable: true,
    enumerable: false,
    configurable: true,
  });
}

function getOrInsert<K, V>(this: Upsertable<K, V>, key: K, value: V): V {
  if (this.has(key)) return this.get(key) as V;
  this.set(key, value);
  return value;
}

function getOrInsertComputed<K, V>(
  this: Upsertable<K, V>,
  key: K,
  callback: (key: K) => V,
): V {
  if (this.has(key)) return this.get(key) as V;
  const value = callback(key);
  this.set(key, value);
  return value;
}

export function installMapUpsertPolyfill(): void {
  for (const proto of [Map.prototype, WeakMap.prototype]) {
    define(proto, "getOrInsert", getOrInsert as () => unknown);
    define(proto, "getOrInsertComputed", getOrInsertComputed as () => unknown);
  }
}
