import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuth, initializeAuth } from "firebase/auth";
import * as FirebaseAuth from "firebase/auth";
import { CONFIG } from "./env";

const firebaseConfig = {
  apiKey: "AIzaSyD9KKN0M--DKCwdi5WkLn6dLkycRlHqva8",
  authDomain: "promise-unlocked-sign-up-888a0.firebaseapp.com",
  projectId: "promise-unlocked-sign-up-888a0",
  storageBucket: "promise-unlocked-sign-up-888a0.firebasestorage.app",
  messagingSenderId: "524335478039",
  appId: "1:524335478039:web:231ca9dff07c64a631b352",
  measurementId: "G-Q2KT88BSST"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);

type ReactNativePersistenceFactory = (storage: typeof AsyncStorage) => unknown;

const getReactNativePersistence = (
  FirebaseAuth as unknown as {
    getReactNativePersistence?: ReactNativePersistenceFactory;
  }
).getReactNativePersistence;

export const auth = (() => {
  try {
    if (getReactNativePersistence) {
      return initializeAuth(app, {
        // Firebase's RN persistence API is available at runtime on react-native builds.
        persistence: getReactNativePersistence(AsyncStorage) as never,
      });
    }

    return getAuth(app);
  } catch {
    // Auth can already be initialized during hot reload; reuse existing instance.
    return getAuth(app);
  }
})();
