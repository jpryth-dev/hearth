"use server";

import { redirect } from "next/navigation";

import { formText } from "@/lib/form-data";
import { orNotFound } from "@/lib/or-not-found";
import { currentActor, deletePhoto } from "@/server/data";

export async function deletePhotoAction(formData: FormData): Promise<void> {
  const actor = await currentActor();
  const albumId = await orNotFound(deletePhoto(actor, formText(formData, "photoId")));
  redirect(`/albums/${albumId}`);
}
