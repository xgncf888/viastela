const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch {
      // Ignore quota/storage errors
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  },
  async getAllKeys(): Promise<readonly string[]> {
    try {
      if (typeof localStorage === 'undefined') return [];
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k !== null) keys.push(k);
      }
      return keys;
    } catch {
      return [];
    }
  },
  async multiRemove(keys: readonly string[]): Promise<void> {
    try {
      if (typeof localStorage === 'undefined') return;
      for (const k of keys) {
        localStorage.removeItem(k);
      }
    } catch {
      // Ignore storage errors
    }
  },
};

export default AsyncStorage;
