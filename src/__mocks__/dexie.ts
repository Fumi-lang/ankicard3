/** Dexie.jsのテスト用モック */

class MockTable {
  private data: Record<string, unknown>[] = [];

  async add(item: unknown) { this.data.push(item as Record<string, unknown>); }
  async put(item: unknown) {
    const obj = item as Record<string, unknown>;
    const idx = this.data.findIndex((d) => d.id === obj.id);
    if (idx >= 0) this.data[idx] = obj;
    else this.data.push(obj);
  }
  async get(id: string) { return this.data.find((d) => (d as { id: string }).id === id); }
  async delete(id: string) { this.data = this.data.filter((d) => (d as { id: string }).id !== id); }
  async toArray() { return [...this.data]; }
  where(_field: string) {
    return {
      equals: (_val: unknown) => ({
        toArray: async () => this.data,
        delete: async () => { this.data = []; },
        sortBy: async (_key: string) => this.data,
      }),
      belowOrEqual: (_val: unknown) => ({ toArray: async () => this.data }),
      between: (_a: unknown, _b: unknown, _c: boolean, _d: boolean) => ({ toArray: async () => this.data }),
    };
  }
  orderBy(_field: string) { return { reverse: () => ({ toArray: async () => this.data }) }; }
  async bulkAdd(items: unknown[]) { this.data.push(...(items as Record<string, unknown>[])); }
}

export default class Dexie {
  version(_v: number) { return { stores: (_schema: unknown) => {} }; }
}
