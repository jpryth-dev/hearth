"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { formText } from "@/lib/form-data";
import { orNotFound } from "@/lib/or-not-found";
import { currentActor, deleteAlbum, grantAlbumAccess, revokeAlbumAccess, updateAlbum } from "@/server/data";

import type { AlbumFormState } from "../actions";

// Every action re-checks through the data layer: they are reachable by direct
// POST with any albumId, regardless of what the page showed.

export async function updateAlbumAction(_prev: AlbumFormState, formData: FormData): Promise<AlbumFormState> {
  const actor = await currentActor();
  const albumId = formText(formData, "albumId");
  const result = await orNotFound(
    updateAlbum(actor, albumId, { title: formText(formData, "title"), description: formText(formData, "description") }),
  );
  if (!result.ok) return { errors: result.errors };
  revalidatePath(`/albums/${albumId}`);
  return {};
}

export type ShareFormState = { status: "idle" | "ok" | "error"; message?: string };

const GRANT_MESSAGES = {
  granted: "Shared.",
  changed: "Access level changed.",
  unchanged: "They already have that access.",
  invalid_email: "Enter a valid email address.",
  invalid_level: "Choose an access level.",
  no_such_member: "No Hearth member uses that address. Ask an admin to invite them first.",
  self: "You own this album already.",
} as const;

export async function grantAccessAction(_prev: ShareFormState, formData: FormData): Promise<ShareFormState> {
  const actor = await currentActor();
  const albumId = formText(formData, "albumId");
  const result = await orNotFound(
    grantAlbumAccess(actor, albumId, formText(formData, "email"), formText(formData, "accessLevel")),
  );
  revalidatePath(`/albums/${albumId}`);
  return result.ok
    ? { status: "ok", message: GRANT_MESSAGES[result.change] }
    : { status: "error", message: GRANT_MESSAGES[result.reason] };
}

export async function revokeAccessAction(formData: FormData): Promise<void> {
  const actor = await currentActor();
  const albumId = formText(formData, "albumId");
  await orNotFound(revokeAlbumAccess(actor, albumId, formText(formData, "userId")));
  revalidatePath(`/albums/${albumId}`);
}

export async function deleteAlbumAction(formData: FormData): Promise<void> {
  const actor = await currentActor();
  await orNotFound(deleteAlbum(actor, formText(formData, "albumId")));
  redirect("/");
}
