"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Notice } from "@/components/ui";
import { MAX_UPLOAD_BYTES, UPLOAD_ACCEPT } from "@/lib/schemas";

export function UploadPhotos({ albumId }: { albumId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<{ tone: "ok" | "error"; text: string }[]>([]);

  async function upload(files: File[]) {
    setBusy(true);
    const results: typeof messages = [];
    let added = 0;
    for (const file of files) {
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
    setMessages(results);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Add photos
        <input
          type="file"
          accept={UPLOAD_ACCEPT}
          multiple
          disabled={busy}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length > 0) void upload(files);
          }}
        />
      </label>
      {busy && <p className="text-sm">Uploading…</p>}
      {messages.map((m, i) => (
        <Notice key={i} tone={m.tone}>
          {m.text}
        </Notice>
      ))}
    </div>
  );
}
