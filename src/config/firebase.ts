import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore, setLogLevel } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getAuth, initializeAuth } from "firebase/auth";
import * as FirebaseAuth from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCZKgqKsdbPr1OdpElH2Xz28EGSPrwMJaY",
  authDomain: "promise-unlocked-for-sure.firebaseapp.com",
  projectId: "promise-unlocked-for-sure",
  storageBucket: "promise-unlocked-for-sure.firebasestorage.app",
  messagingSenderId: "26141705792",
  appId: "1:26141705792:web:c20f90f4e21e999c7a01a5",
  measurementId: "G-Q8ZTZ5N8L7",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

function createFirestoreInstance() {
  if (Platform.OS === "web") {
    return getFirestore(app);
  }

  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
  } catch {
    // Firestore can already be initialized during hot reload; reuse existing instance.
    return getFirestore(app);
  }
}

setLogLevel("error");

export const db = createFirestoreInstance();

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
