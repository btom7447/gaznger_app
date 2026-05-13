import * as SecureStore from "expo-secure-store";
import { PersistStorage } from "zustand/middleware";

/**
 * Zustand persist adapter backed by expo-secure-store. Wraps every
 * call in try/catch — an unhandled rejection from SecureStore on
 * Android (which has happened on some Pixel builds + LG builds) used
 * to tear down the entire JS surface. We'd rather lose persistence
 * for one write than crash the app.
 *
 * Used by useSessionStore (tokens — sensitive). Do NOT use for stores
 * that fire many writes per second; SecureStore is slow + the 2KB-per-
 * key Android limit applies. Use AsyncStorage for non-sensitive stores.
 */
export const secureStorage: PersistStorage<any> = {
  getItem: async (name) => {
    try {
      const value = await SecureStore.getItemAsync(name);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await SecureStore.setItemAsync(name, JSON.stringify(value));
    } catch {
      // Swallow — caller (Zustand) doesn't observe failures, and the
      // in-memory store stays correct. Worst case: a kill-and-resume
      // loses the persisted state.
    }
  },
  removeItem: async (name) => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      // Swallow as above.
    }
  },
};
