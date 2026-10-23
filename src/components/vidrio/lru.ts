// A small least-recently-used map: reading or writing a key makes it the newest; past `max` the oldest entries
// that `canEvict` allows go (and `onEvict` hears of each). The newest entry is never evicted, and an entry still
// in use stays even past `max` (it goes on a later write, once it is free).
export class Lru<V> {
  private readonly map = new Map<string, V>();
  private readonly max: number;
  private readonly canEvict: (value: V, key: string) => boolean;
  private readonly onEvict: (value: V, key: string) => void;

  constructor(max: number, canEvict: (value: V, key: string) => boolean = () => true, onEvict: (value: V, key: string) => void = () => {}) {
    this.max = max;
    this.canEvict = canEvict;
    this.onEvict = onEvict;
  }

  get size(): number {
    return this.map.size;
  }

  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size <= this.max) return;
    // (oldest first: a Map iterates in insertion order, and deleting while iterating is safe)
    for (const [k, v] of this.map) {
      if (this.map.size <= this.max) break;
      if (k === key || !this.canEvict(v, k)) continue;
      this.map.delete(k);
      this.onEvict(v, k);
    }
  }

  keys(): string[] {
    return [...this.map.keys()];
  }
}
