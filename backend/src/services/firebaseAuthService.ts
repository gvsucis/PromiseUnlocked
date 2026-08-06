import axios from "axios";
import { firebaseAuthSchema } from "@/validation/firebaseAuthSchema";
import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
import { db as firestore } from "@/services/firestore";

const CLIENT_FIREBASE_API_KEY = process.env.CLIENT_FIREBASE_API_KEY;

const endpoints = {
  login: `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CLIENT_FIREBASE_API_KEY}`,
  register: `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${CLIENT_FIREBASE_API_KEY}`,
};

function mapFirebaseError(code: string) {
  switch (code) {
    case "EMAIL_NOT_FOUND":
    case "INVALID_PASSWORD":
      return { status: 401, message: "Invalid credentials" };
    case "EMAIL_EXISTS":
      return { status: 409, message: "Email already in use" };
    default:
      return { status: 400, message: code };
  }
}

export async function firebaseLogin(email: string, password: string) {
  const parseResult = firebaseAuthSchema.safeParse({ email, password });
  if (!parseResult.success) {
    return {
      success: false,
      status: 400,
      message: "Validation failed",
      details: parseResult.error.issues,
    };
  }
  try {
    const response = await axios.post(endpoints.login, {
      email,
      password,
      returnSecureToken: true,
    });
    const userId = response.data.localId;
    // Ensure user profile exists in Firestore
    const userDoc = await firestore.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      await firestore.collection("users").doc(userId).set({
        uid: userId,
        email,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        role: "user",
        metadata: {},
      });
    }
    return {
      success: true,
      data: {
        idToken: response.data.idToken,
        refreshToken: response.data.refreshToken,
        userId,
      },
    };
  } catch (error: any) {
    const code = error.response?.data?.error?.message;
    if (code) {
      const mapped = mapFirebaseError(code);
      return { success: false, ...mapped };
    }
    return { success: false, status: 500, message: "Login failed", details: error.message };
  }
}

export async function firebaseRegister(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string
) {
  const parseResult = firebaseAuthSchema.safeParse({ email, password });
  if (!parseResult.success) {
    return {
      success: false,
      status: 400,
      message: "Validation failed",
      details: parseResult.error.issues,
    };
  }
  try {
    const response = await axios.post(endpoints.register, {
      email,
      password,
      returnSecureToken: true,
    });
    // Create user profile in Firestore (users collection)
    const userId = response.data.localId;
    const fullName = [firstName, lastName].filter(Boolean).join(" ") || undefined;
    await firestore
      .collection("users")
      .doc(userId)
      .set({
        uid: userId,
        email,
        displayName: fullName ?? null,
        fullName: fullName ?? null,
        photoURL: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        role: "user",
        metadata: {},
      });
    return {
      success: true,
      data: {
        idToken: response.data.idToken,
        refreshToken: response.data.refreshToken,
        userId,
        firstName,
        lastName,
        role: response.data.role,
      },
    };
  } catch (error: any) {
    const code = error.response?.data?.error?.message;
    if (code) {
      const mapped = mapFirebaseError(code);
      return { success: false, ...mapped };
    }
    return { success: false, status: 500, message: "Registration failed", details: error.message };
  }
}
