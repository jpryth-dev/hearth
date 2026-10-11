"use server";

import { revalidatePath } from "next/cache";

import { formText } from "@/lib/form-data";
import { requireAdmin } from "@/server/auth";
import { createInvitation, revokeInvitation, type InviteResult } from "@/server/auth/invitations";
import { ForbiddenError } from "@/server/errors";
import { requestIp } from "@/server/request";

export type InviteFormState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

export async function inviteAction(_prev: InviteFormState, formData: FormData): Promise<InviteFormState> {
  // Actions are reachable by direct POST, so re-check here, not just on the page.
  const admin = await requireAdmin();
  const email = formText(formData, "email");

  let result: InviteResult;
  try {
    result = await createInvitation(admin, email, await requestIp());
  } catch (error) {
    if (error instanceof ForbiddenError) throw error;
    // Only the error class: SMTP errors can echo message content.
    console.error("Invitation email failed:", error instanceof Error ? error.name : "unknown");
    return { status: "error", message: "The invitation email couldn't be sent. Try again." };
  }
  if (!result.ok) {
    const message =
      result.reason === "already_member" ? "That person already has an account." : "Enter a valid email address.";
    return { status: "error", message };
  }
  revalidatePath("/admin/invitations");
  return { status: "sent", email: email.trim().toLowerCase() };
}

export async function revokeAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  await revokeInvitation(admin, formText(formData, "id"), await requestIp());
  revalidatePath("/admin/invitations");
}
