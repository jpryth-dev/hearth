import Link from "next/link";

import { Button, Page } from "@/components/ui";
import { orNotFound } from "@/lib/or-not-found";
import { currentActor, getPhoto } from "@/server/data";

import { deletePhotoAction } from "./actions";

export const metadata = { title: "Photo · Hearth" };

export default async function PhotoPage({ params }: PageProps<"/photos/[id]">) {
  const actor = await currentActor();
  const { id } = await params;
  const photo = await orNotFound(getPhoto(actor, id));

  return (
    <Page title={photo.originalFilename ?? "Photo"}>
      {/* Plain <img>: next/image would fetch and cache the file through the
          optimizer, outside the album access check. The URL is signed and
          short-lived. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.fullUrl}
        alt={photo.originalFilename ?? "Photo"}
        width={photo.width ?? undefined}
        height={photo.height ?? undefined}
        className="h-auto w-full rounded-md"
      />
      <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-zinc-600 dark:text-zinc-400">Added by</dt>
        <dd>{photo.uploadedBy}</dd>
        {photo.takenAt && (
          <>
            <dt className="text-zinc-600 dark:text-zinc-400">Taken</dt>
            <dd>{photo.takenAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })}</dd>
          </>
        )}
        {photo.camera && (
          <>
            <dt className="text-zinc-600 dark:text-zinc-400">Camera</dt>
            <dd>{photo.camera}</dd>
          </>
        )}
      </dl>
      {photo.canDelete && (
        <form action={deletePhotoAction} className="mt-6">
          <input type="hidden" name="photoId" value={photo.id} />
          <Button type="submit">Delete photo</Button>
        </form>
      )}
      <p className="mt-10 text-sm">
        <Link className="underline" href={`/albums/${photo.albumId}`}>
          Back to {photo.albumTitle}
        </Link>
      </p>
    </Page>
  );
}
