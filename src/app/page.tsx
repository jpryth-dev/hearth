import Link from "next/link";

import { Page, primaryButtonClass } from "@/components/ui";
import { currentActor, listVisibleAlbums } from "@/server/data";

import { createAlbumAction } from "./albums/actions";
import { AlbumForm } from "./albums/album-form";

export default async function Home() {
  const actor = await currentActor();
  const albums = await listVisibleAlbums(actor);

  return (
    <Page wide>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Albums</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Welcome, {actor.displayName}</p>
        </div>
        <details className="group relative">
          <summary className={`${primaryButtonClass} cursor-pointer list-none`}>
            <span aria-hidden>＋</span> New album
          </summary>
          <div className="absolute right-0 z-10 mt-2 w-80 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            <AlbumForm action={createAlbumAction} submitLabel="Create album" />
          </div>
        </details>
      </div>

      {albums.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          No albums yet. Create one, or ask family to share theirs.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3" aria-label="Albums">
          {albums.map((a) => (
            <li key={a.id}>
              <Link href={`/albums/${a.id}`} className="group block">
                <div className="aspect-square overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                  {a.coverUrl ? (
                    // Plain <img> on purpose: next/image would cache photo files
                    // outside the access check. The URL is signed and short-lived.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.coverUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-zinc-500">No photos yet</div>
                  )}
                </div>
                <div className="mt-2 font-medium group-hover:underline">{a.title}</div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  {a.role === "OWNER" ? "Yours" : `Shared by ${a.ownerName}`} · {a.photoCount}{" "}
                  {a.photoCount === 1 ? "photo" : "photos"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
