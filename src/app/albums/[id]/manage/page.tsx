import Link from "next/link";

import { Button, Page } from "@/components/ui";
import { orNotFound } from "@/lib/or-not-found";
import { currentActor, getAlbum, listAlbumAccess } from "@/server/data";

import { AlbumForm } from "../../album-form";
import { deleteAlbumAction, revokeAccessAction, updateAlbumAction } from "../actions";
import { ShareForm } from "./share-form";

export const metadata = { title: "Manage album · Hearth" };

const LEVEL_LABEL = { CONTRIBUTE: "Can add photos", VIEW: "Can view" } as const;

export default async function ManageAlbumPage({ params }: PageProps<"/albums/[id]/manage">) {
  const actor = await currentActor();
  const { id } = await params;
  // Owner-only: listAlbumAccess requires OWNER, so anyone else gets the same
  // 404 as a missing album (and the attempt is audited).
  const members = await orNotFound(listAlbumAccess(actor, id));
  const album = await orNotFound(getAlbum(actor, id));

  return (
    <Page>
      <Link href={`/albums/${album.id}`} className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
        ← Back to {album.title}
      </Link>
      <h1 className="mt-2 mb-8 text-2xl font-semibold tracking-tight">Manage “{album.title}”</h1>

      <section>
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
                    {m.email} · {LEVEL_LABEL[m.accessLevel]}
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
        <h2 className="mb-3 text-lg font-medium">Details</h2>
        <AlbumForm action={updateAlbumAction} albumId={album.id} initial={album} submitLabel="Save" />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-medium">Delete album</h2>
        <form action={deleteAlbumAction} className="flex flex-col gap-3">
          <input type="hidden" name="albumId" value={album.id} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" required /> Delete this album and its photos for everyone it&apos;s shared with
          </label>
          <div>
            <Button type="submit">Delete album</Button>
          </div>
        </form>
      </section>
    </Page>
  );
}
