import Link from "next/link";

import { Button, Page } from "@/components/ui";
import { orNotFound } from "@/lib/or-not-found";
import { currentActor, getPhoto } from "@/server/data";

import { deletePhotoAction } from "./actions";
import { KeyboardNav } from "./keyboard-nav";

export const metadata = { title: "Photo · Hearth" };

const arrow =
  "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-2xl text-white backdrop-blur hover:bg-black/70";

export default async function PhotoPage({ params }: PageProps<"/photos/[id]">) {
  const actor = await currentActor();
  const { id } = await params;
  const photo = await orNotFound(getPhoto(actor, id));
  const albumHref = `/albums/${photo.albumId}`;
  const previousHref = photo.previousId ? `/photos/${photo.previousId}` : null;
  const nextHref = photo.nextId ? `/photos/${photo.nextId}` : null;

  return (
    <Page wide>
      <KeyboardNav previous={previousHref} next={nextHref} album={albumHref} />
      <div className="mb-3 flex items-center justify-between gap-4 text-sm">
        <Link href={albumHref} className="text-zinc-600 hover:underline dark:text-zinc-400">
          ← {photo.albumTitle}
        </Link>
        <span className="text-zinc-600 dark:text-zinc-400">
          {photo.position} of {photo.total}
        </span>
      </div>

      <div className="relative flex items-center justify-center overflow-hidden rounded-2xl bg-zinc-950">
        {/* Plain <img>: next/image would fetch and cache the file through the
            optimizer, outside the album access check. The URL is signed and
            short-lived. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.fullUrl}
          alt={photo.originalFilename ?? "Photo"}
          width={photo.width ?? undefined}
          height={photo.height ?? undefined}
          className="max-h-[78vh] w-auto max-w-full object-contain"
        />
        {previousHref && (
          <Link href={previousHref} aria-label="Previous photo" className={`${arrow} left-3`}>
            ‹
          </Link>
        )}
        {nextHref && (
          <Link href={nextHref} aria-label="Next photo" className={`${arrow} right-3`}>
            ›
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold">{photo.originalFilename ?? "Photo"}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Added by {photo.uploadedBy}
            {photo.takenAt &&
              ` · Taken ${photo.takenAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })}`}
            {photo.camera && ` · ${photo.camera}`}
          </p>
        </div>
        {photo.canDelete && (
          <form action={deletePhotoAction}>
            <input type="hidden" name="photoId" value={photo.id} />
            <Button type="submit">Delete photo</Button>
          </form>
        )}
      </div>
    </Page>
  );
}
