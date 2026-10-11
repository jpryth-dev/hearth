"use server";

import { redirect } from "next/navigation";

import { formText } from "@/lib/form-data";
import { recordAudit } from "@/server/audit";
import { startSession } from "@/server/auth";
import { consumeSignInToken } from "@/server/auth/sign-in";
import { requestIp } from "@/server/request";

export type VerifyFormState = { error?: string };

export async function verifyAction(_prev: VerifyFormState, formData: FormData): Promise<VerifyFormState> {
  const ip = await requestIp();
  const result = await consumeSignInToken(formText(formData, "token"), ip);
  if (!result.ok) return { error: "This link has expired or already been used. Request a new one." };

  await startSession(result.userId);
  await recordAudit({ action: "LOGIN_SUCCESS", actorUserId: result.userId, ipAddress: ip, details: { via: "link" } });
  redirect("/");
}
