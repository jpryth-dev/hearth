import Link from "next/link";

import { Button, Page } from "@/components/ui";
import { orNotFound } from "@/lib/or-not-found";
import { currentActor, getAlbum, listAlbumAccess, listPhotos } from "@/server/data";

import { AlbumForm } from "../album-form";
import { deleteAlbumAction, revokeAccessAction, updateAlbumAction } from "./actions";
import { ShareForm } from "./share-form";
import { UploadPhotos } from "./upload-photos";

export const metadata = { title: "Album · Hearth" };

const ROLE_LABEL = { OWNER: "Owner", CONTRIBUTE: "Can add photos", VIEW: "Can view" } as const;

export default async function AlbumPage({ params }: PageProps<"/albums/[id]">) {
  const actor = await currentActor();
  const { id } = await params;
  const album = await orNotFound(getAlbum(actor, id));
  const isOwner = album.role === "OWNER";
  const members = isOwner ? await listAlbumAccess(actor, album.id) : [];
  const photos = await listPhotos(actor, album.id);
  const canUpload = album.role === "OWNER" || album.role === "CONTRIBUTE";

  return (
    <Page title={album.title}>
      {album.description && <p className="mb-4">{album.description}</p>}
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {isOwner ? "Your album" : `Shared by ${album.ownerName} · ${ROLE_LABEL[album.role]}`}
      </p>
      <section className="mt-8">
        {canUpload && <UploadPhotos albumId={album.id} />}
        {photos.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">No photos yet.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-3 gap-2" aria-label="Photos">
            {photos.map((p) => (
              <li key={p.id}>
                <Link href={`/photos/${p.id}`} className="block aspect-square overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
                  {/* Plain <img> on purpose: see the photo page. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumbUrl} alt={`Photo added by ${p.uploadedBy}`} className="h-full w-full object-cover" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner && (
        <>
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-medium">Shared with</h2>
            {members.length === 0 ? (
              <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">Only you can see this album.</p>
            ) : (
              <ul className="mb-4 divide-y divide-zinc-200 dark:divide-zinc-800">
                {members.map((m) => (
                  <li key={m.userId} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div>
                      <div className="font-medium">{m.displayName}</div>
                      <div className="text-zinc-600 dark:text-zinc-400">
                        {m.email} · {ROLE_LABEL[m.accessLevel]}
                      </div>
                    </div>
                    <form action={revokeAccessAction}>
                      <input type="hidden" name="albumId" value={album.id} />
                      <input type="hidden" name="userId" value={m.userId} />
                      <Button type="submit" aria-label={`Remove ${m.displayName}`}>
                        Remove
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <ShareForm albumId={album.id} />
          </section>

          <section className="mt-10">
            <h2 className="mb-3 text-lg font-medium">Edit album</h2>
            <AlbumForm action={updateAlbumAction} albumId={album.id} initial={album} submitLabel="Save" />
          </section>

          <section className="mt-10">
            <h2 className="mb-3 text-lg font-medium">Delete album</h2>
            <form action={deleteAlbumAction} className="flex flex-col gap-3">
              <input type="hidden" name="albumId" value={album.id} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" required /> Delete this album for everyone it&apos;s shared with
              </label>
              <div>
                <Button type="submit">Delete album</Button>
              </div>
            </form>
          </section>
        </>
      )}

      <p className="mt-10 text-sm">
        <Link className="underline" href="/">
          All albums
        </Link>
      </p>
    </Page>
  );
}
