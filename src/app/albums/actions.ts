"use server";

import { redirect } from "next/navigation";

import { formText } from "@/lib/form-data";
import { createAlbum, currentActor } from "@/server/data";

export type AlbumFormState = { errors?: Record<string, string> };

export async function createAlbumAction(_prev: AlbumFormState, formData: FormData): Promise<AlbumFormState> {
  const actor = await currentActor();
  const result = await createAlbum(actor, {
    title: formText(formData, "title"),
    description: formText(formData, "description"),
  });
  if (!result.ok) return { errors: result.errors };
  redirect(`/albums/${result.id}`);
}
