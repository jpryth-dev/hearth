import Link from "next/link";

import { Page, secondaryButtonClass } from "@/components/ui";
import { orNotFound } from "@/lib/or-not-found";
import { currentActor, getAlbum, listPhotos } from "@/server/data";

import { PhotoGallery } from "./photo-gallery";

export const metadata = { title: "Album · Hearth" };

const ROLE_LABEL = { CONTRIBUTE: "You can add photos", VIEW: "You can view" } as const;

export default async function AlbumPage({ params }: PageProps<"/albums/[id]">) {
  const actor = await currentActor();
  const { id } = await params;
  const album = await orNotFound(getAlbum(actor, id));
  const photos = await listPhotos(actor, album.id);
  const isOwner = album.role === "OWNER";

  return (
    <Page wide>
      <Link href="/" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
        ← Albums
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{album.title}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {album.role === "OWNER" ? "Your album" : `Shared by ${album.ownerName} · ${ROLE_LABEL[album.role]}`} · {photos.length}{" "}
            {photos.length === 1 ? "photo" : "photos"}
          </p>
          {album.description && <p className="mt-2 max-w-prose">{album.description}</p>}
        </div>
        {isOwner && (
          <Link href={`/albums/${album.id}/manage`} className={secondaryButtonClass}>
            Manage album
          </Link>
        )}
      </div>
      <PhotoGallery
        albumId={album.id}
        canUpload={album.role === "OWNER" || album.role === "CONTRIBUTE"}
        photos={photos.map((p) => ({ id: p.id, thumbUrl: p.thumbUrl, uploadedBy: p.uploadedBy }))}
      />
    </Page>
  );
}
