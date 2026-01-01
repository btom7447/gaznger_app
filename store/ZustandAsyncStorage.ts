import AsyncStorage from "@react-native-async-storage/async-storage";
import { PersistStorage } from "zustand/middleware";

export const zustandAsyncStorage: PersistStorage<any> = {
  getItem: async (name) => {
    const value = await AsyncStorage.getItem(name);
    return value ? JSON.parse(value) : null; // ✅ parse string to object
  },
  setItem: async (name, value) => {
    await AsyncStorage.setItem(name, JSON.stringify(value)); // ✅ stringify object to string
  },
  removeItem: async (name) => {
    await AsyncStorage.removeItem(name);
  },
};
