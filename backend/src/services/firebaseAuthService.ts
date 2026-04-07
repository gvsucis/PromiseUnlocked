import axios from "axios";
import { firebaseAuthSchema } from "../validation/firebaseAuthSchema";
import "dotenv/config";

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
      details: parseResult.error.errors,
    };
  }
  try {
    const response = await axios.post(endpoints.login, {
      email,
      password,
      returnSecureToken: true,
    });
    return {
      success: true,
      data: {
        idToken: response.data.idToken,
        refreshToken: response.data.refreshToken,
        userId: response.data.localId,
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

export async function firebaseRegister(email: string, password: string) {
  const parseResult = firebaseAuthSchema.safeParse({ email, password });
  if (!parseResult.success) {
    return {
      success: false,
      status: 400,
      message: "Validation failed",
      details: parseResult.error.errors,
    };
  }
  try {
    const response = await axios.post(endpoints.register, {
      email,
      password,
      returnSecureToken: true,
    });
    return {
      success: true,
      data: {
        idToken: response.data.idToken,
        refreshToken: response.data.refreshToken,
        userId: response.data.localId,
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
