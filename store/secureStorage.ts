import * as SecureStore from "expo-secure-store";
import { PersistStorage } from "zustand/middleware";

export const secureStorage: PersistStorage<any> = {
  getItem: async (name) => {
    const value = await SecureStore.getItemAsync(name);
    return value ? JSON.parse(value) : null;
  },
  setItem: async (name, value) => {
    await SecureStore.setItemAsync(name, JSON.stringify(value));
  },
  removeItem: async (name) => {
    await SecureStore.deleteItemAsync(name);
  },
};
