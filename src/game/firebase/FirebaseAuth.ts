import { getAuth, signInAnonymously } from "firebase/auth";
import type { FirebaseServices } from "./FirebaseApp";

export class FirebaseAuthService {
  constructor(private readonly services: FirebaseServices) {}

  async signInAnonymous(): Promise<string> {
    const auth = getAuth(this.services.app);
    try {
      const credential = await signInAnonymously(auth);
      return credential.user.uid;
    } catch (error) {
      const code = this.errorCode(error);
      const message = this.errorMessage(error);
      if (code === "auth/operation-not-allowed" || message.includes("OPERATION_NOT_ALLOWED")) {
        throw new Error(
          "Firebase Anonymous Auth is disabled. Enable Authentication > Sign-in method > Anonymous.",
        );
      }
      if (code === "auth/admin-restricted-operation" || message.includes("ADMIN_ONLY_OPERATION")) {
        throw new Error("Firebase anonymous sign-up is restricted for this project.");
      }
      if (code === "auth/configuration-not-found" || message.includes("CONFIGURATION_NOT_FOUND")) {
        throw new Error("Firebase Authentication is not initialized for this project.");
      }
      throw new Error(`Firebase anonymous login failed${code ? `: ${code}` : ""}.`);
    }
  }

  private errorCode(error: unknown): string {
    if (typeof error === "object" && error && "code" in error) {
      return String((error as { code?: unknown }).code ?? "");
    }
    return "";
  }

  private errorMessage(error: unknown): string {
    if (typeof error === "object" && error && "message" in error) {
      return String((error as { message?: unknown }).message ?? "");
    }
    return "";
  }
}
