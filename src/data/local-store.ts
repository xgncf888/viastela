export type LocalStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
};

let override: LocalStore | null = null;

/** Tests inject a memory store. Production uses AsyncStorage on web and native. */
export function setLocalStoreForTests(store: LocalStore | null): void {
  override = store;
}

export function createMemoryLocalStore(): LocalStore {
  const items = new Map<string, string>();
  return {
    async getItem(key) {
      return items.get(key) ?? null;
    },
    async setItem(key, value) {
      items.set(key, value);
    },
    async removeItem(key) {
      items.delete(key);
    },
    async getAllKeys() {
      return [...items.keys()];
    },
  };
}

export async function localStore(): Promise<LocalStore> {
  if (override) return override;
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  return {
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
    removeItem: (key) => AsyncStorage.removeItem(key),
    getAllKeys: () => AsyncStorage.getAllKeys(),
  };
}
