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
};

export default AsyncStorage;
