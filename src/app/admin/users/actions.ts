"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { formText } from "@/lib/form-data";
import { requireAdminContext } from "@/server/auth";
import { disableUser, enableUser, type StatusChangeResult } from "@/server/auth/users";

function finish(result: StatusChangeResult): never {
  revalidatePath("/admin/users");
  redirect(result.ok ? "/admin/users" : `/admin/users?notice=${result.reason}`);
}

export async function disableUserAction(formData: FormData): Promise<void> {
  const ctx = await requireAdminContext();
  finish(await disableUser(ctx, formText(formData, "userId")));
}

export async function enableUserAction(formData: FormData): Promise<void> {
  const ctx = await requireAdminContext();
  finish(await enableUser(ctx, formText(formData, "userId")));
}
