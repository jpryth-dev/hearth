"use server";

import { formText } from "@/lib/form-data";
import { requestSignInLink } from "@/server/auth/sign-in";
import { requestIp } from "@/server/request";

export type SignInFormState = { status: "idle" | "sent" | "error" };

export async function requestSignInAction(_prev: SignInFormState, formData: FormData): Promise<SignInFormState> {
  try {
    await requestSignInLink(formText(formData, "email"), await requestIp());
  } catch (error) {
    // Only the error class: SMTP errors can echo message content.
    console.error("Sign-in email failed:", error instanceof Error ? error.name : "unknown");
    return { status: "error" };
  }
  // Same answer whether or not the address has an account.
  return { status: "sent" };
}
