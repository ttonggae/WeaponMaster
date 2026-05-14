import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from "firebase/auth";
import type { AuthProfile } from "../types";
import type { FirebaseServices } from "./FirebaseApp";

export class FirebaseAuthService {
  constructor(private readonly services: FirebaseServices) {}

  async signInGoogle(): Promise<AuthProfile> {
    const auth = getAuth(this.services.app);
    if (auth.currentUser) {
      return this.toProfile(auth.currentUser);
    }

    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      return this.toProfile(credential.user);
    } catch (error) {
      const code = this.errorCode(error);
      if (code === "auth/popup-closed-by-user") {
        throw new Error("Google sign-in was closed before completion.");
      }
      if (code === "auth/operation-not-allowed") {
        throw new Error("Google sign-in is disabled. Enable Authentication > Sign-in method > Google.");
      }
      if (code === "auth/unauthorized-domain") {
        throw new Error("This domain is not authorized in Firebase Authentication settings.");
      }
      throw new Error(`Google sign-in failed${code ? `: ${code}` : ""}.`);
    }
  }

  private toProfile(user: User): AuthProfile {
    return {
      uid: user.uid,
      displayName: user.displayName?.trim() || `Player-${user.uid.slice(0, 6)}`,
      photoURL: user.photoURL,
    };
  }

  private errorCode(error: unknown): string {
    if (typeof error === "object" && error && "code" in error) {
      return String((error as { code?: unknown }).code ?? "");
    }
    return "";
  }
}
