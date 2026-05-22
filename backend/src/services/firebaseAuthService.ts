import axios from "axios";
import { firebaseAuthSchema } from "../validation/firebaseAuthSchema";
import "dotenv/config";
import { db as firestore } from "./firestore";

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

const endpoints = {
  login: `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
  register: `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
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
        email,
        createdAt: new Date().toISOString(),
        role: "user",
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
    // Only include firstName/lastName if defined
    const userProfile: any = {
      email,
      firstName,
      lastName,
      createdAt: new Date().toISOString(),
      role: "user",
    };
    if (firstName !== undefined) userProfile.firstName = firstName;
    if (lastName !== undefined) userProfile.lastName = lastName;
    await firestore.collection("users").doc(userId).set(userProfile);
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
