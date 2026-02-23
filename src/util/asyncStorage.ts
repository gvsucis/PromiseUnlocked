import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getJSONFromStorage<T>(key: string, fallback: T): Promise<T> {
  try {
    const rawValue = await AsyncStorage.getItem(key);

    if (!rawValue) {
      return fallback;
    }

    return JSON.parse(rawValue) as T;
  } catch (error) {
    console.error(`Error reading storage key "${key}":`, error);
    return fallback;
  }
}

export async function setJSONInStorage<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing storage key "${key}":`, error);
    throw error;
  }
}

export async function removeFromStorage(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing storage key "${key}":`, error);
    throw error;
  }
}

export async function removeManyFromStorage(keys: string[]): Promise<void> {
  try {
    await AsyncStorage.multiRemove(keys);
  } catch (error) {
    console.error("Error removing multiple storage keys:", error);
    throw error;
  }
}
