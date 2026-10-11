"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type DragEvent } from "react";

import { Notice, primaryButtonClass } from "@/components/ui";
import { MAX_UPLOAD_BYTES, UPLOAD_ACCEPT } from "@/lib/schemas";

export interface GalleryPhoto {
  id: string;
  thumbUrl: string;
  uploadedBy: string;
}

type Message = { tone: "ok" | "error"; text: string };

/**
 * The album's photo grid. Contributors also get the upload button and can
 * drop files anywhere on the gallery. The server checks every upload; the
 * size check here is only for a quicker message.
 */
export function PhotoGallery({
  albumId,
  canUpload,
  photos,
}: {
  albumId: string;
  canUpload: boolean;
  photos: GalleryPhoto[];
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [dragging, setDragging] = useState(false);

  async function upload(files: File[]) {
    const images = files.filter((f) => f.type === "" || f.type.startsWith("image/"));
    if (images.length === 0) return;
    const results: Message[] = [];
    let added = 0;
    setMessages([]);
    for (const [i, file] of images.entries()) {
      setProgress({ done: i, total: images.length });
      if (file.size > MAX_UPLOAD_BYTES) {
        results.push({ tone: "error", text: `${file.name}: over 25 MB.` });
        continue;
      }
      const res = await fetch(`/api/albums/${albumId}/photos`, {
        method: "POST",
        body: file,
        headers: { "Content-Type": "application/octet-stream", "X-Filename": encodeURIComponent(file.name) },
      });
      if (res.ok) {
        added++;
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        results.push({ tone: "error", text: `${file.name}: ${body.error ?? "upload failed."}` });
      }
    }
    if (added > 0) results.unshift({ tone: "ok", text: `Added ${added} photo${added === 1 ? "" : "s"}.` });
    setProgress(null);
    setMessages(results);
    router.refresh();
  }

  const dropProps = canUpload
    ? {
        onDragOver: (e: DragEvent) => {
          e.preventDefault();
          setDragging(true);
        },
        onDragLeave: () => setDragging(false),
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          setDragging(false);
          if (!progress) void upload(Array.from(e.dataTransfer.files));
        },
      }
    : {};

  return (
    <section {...dropProps} className={`rounded-2xl transition ${dragging ? "bg-zinc-100 ring-2 ring-zinc-400 dark:bg-zinc-900" : ""}`}>
      {canUpload && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className={`${primaryButtonClass} cursor-pointer px-6 py-3 text-base ${progress ? "pointer-events-none opacity-60" : ""}`}>
            <span aria-hidden className="text-lg leading-none">＋</span>
            Add photos
            <input
              type="file"
              aria-label="Add photos"
              accept={UPLOAD_ACCEPT}
              multiple
              className="sr-only"
              disabled={!!progress}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                void upload(files);
              }}
            />
          </label>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {progress ? `Uploading ${progress.done + 1} of ${progress.total}…` : "or drag photos here"}
          </span>
        </div>
      )}
      {messages.length > 0 && (
        <div className="mb-4 flex flex-col gap-1">
          {messages.map((m, i) => (
            <Notice key={i} tone={m.tone}>
              {m.text}
            </Notice>
          ))}
        </div>
      )}

      {photos.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-300 p-12 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          {canUpload ? "No photos yet. Add some, or drop them here." : "No photos yet."}
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-1 sm:gap-2" aria-label="Photos">
          {photos.map((p) => (
            <li key={p.id}>
              <Link
                href={`/photos/${p.id}`}
                className="group relative block aspect-square overflow-hidden bg-zinc-100 sm:rounded-lg dark:bg-zinc-800"
              >
                {/* Plain <img> on purpose: see the photo page. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.thumbUrl}
                  alt={`Photo added by ${p.uploadedBy}`}
                  className="h-full w-full object-cover transition-opacity group-hover:opacity-85"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
