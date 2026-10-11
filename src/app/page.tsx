import Link from "next/link";

import { Page } from "@/components/ui";
import { currentActor, listVisibleAlbums } from "@/server/data";

import { createAlbumAction } from "./albums/actions";
import { AlbumForm } from "./albums/album-form";

export default async function Home() {
  const actor = await currentActor();
  const albums = await listVisibleAlbums(actor);

  return (
    <Page title={`Welcome, ${actor.displayName}`}>
      <h2 className="mb-3 text-lg font-medium">Albums</h2>
      {albums.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No albums yet. Create one, or ask family to share theirs.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {albums.map((a) => (
            <li key={a.id} className="py-3">
              <Link href={`/albums/${a.id}`} className="font-medium underline">
                {a.title}
              </Link>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                {a.role === "OWNER" ? "Yours" : `Shared by ${a.ownerName}`}
              </div>
            </li>
          ))}
        </ul>
      )}
      <h2 className="mt-10 mb-3 text-lg font-medium">New album</h2>
      <AlbumForm action={createAlbumAction} submitLabel="Create album" />
    </Page>
  );
}
