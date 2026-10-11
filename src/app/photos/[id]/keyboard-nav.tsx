"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Left/right arrow keys move through the album; Escape goes back to it. */
export function KeyboardNav({ previous, next, album }: { previous: string | null; next: string | null; album: string }) {
  const router = useRouter();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft" && previous) router.push(previous);
      if (e.key === "ArrowRight" && next) router.push(next);
      if (e.key === "Escape") router.push(album);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, previous, next, album]);
  return null;
}
