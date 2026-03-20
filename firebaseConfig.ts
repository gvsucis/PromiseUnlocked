import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD9KKN0M--DKCwdi5WkLn6dLkycRlHqva8",
  authDomain: "promise-unlocked-sign-up-888a0.firebaseapp.com",
  projectId: "promise-unlocked-sign-up-888a0",
  storageBucket: "promise-unlocked-sign-up-888a0.appspot.com",
  messagingSenderId: "524335478039",
  appId: "1:524335478039:web:231ca9dff07c64a631b352",
  measurementId: "G-Q2KT88BSST"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;