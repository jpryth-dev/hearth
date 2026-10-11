"use server";

import { redirect } from "next/navigation";

import { recordAudit } from "@/server/audit";
import { endSession } from "@/server/auth";
import { requestIp } from "@/server/request";

export async function signOutAction(): Promise<void> {
  const user = await endSession();
  if (user) {
    await recordAudit({ action: "LOGOUT", actorUserId: user.id, ipAddress: await requestIp() });
  }
  redirect("/login");
}
