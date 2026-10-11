"use server";

import { redirect } from "next/navigation";

import { formText } from "@/lib/form-data";
import { recordAudit } from "@/server/audit";
import { startSession } from "@/server/auth";
import { acceptInvitation } from "@/server/auth/invitations";
import { requestIp } from "@/server/request";

export type AcceptFormState = { error?: string };

export async function acceptAction(_prev: AcceptFormState, formData: FormData): Promise<AcceptFormState> {
  const ip = await requestIp();
  const result = await acceptInvitation(formText(formData, "token"), formText(formData, "displayName"), ip);
  if (!result.ok) {
    return {
      error:
        result.reason === "invalid_name"
          ? "Enter a name of up to 60 characters."
          : "This invitation is no longer valid. Ask whoever invited you for a new one.",
    };
  }
  await startSession(result.userId);
  await recordAudit({ action: "LOGIN_SUCCESS", actorUserId: result.userId, ipAddress: ip, details: { via: "invitation" } });
  redirect("/");
}
