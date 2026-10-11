"use client";

import { useActionState } from "react";

import { Button, Field, Notice } from "@/components/ui";

import type { AlbumFormState } from "./actions";

/** Title and description fields, shared by create and edit. */
export function AlbumForm({
  action,
  albumId,
  initial,
  submitLabel,
}: {
  action: (prev: AlbumFormState, formData: FormData) => Promise<AlbumFormState>;
  albumId?: string;
  initial?: { title: string; description: string | null };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {albumId && <input type="hidden" name="albumId" value={albumId} />}
      <Field label="Title" name="title" required maxLength={100} defaultValue={initial?.title} />
      {state.errors?.title && <Notice tone="error">{state.errors.title}</Notice>}
      <Field label="Description (optional)" name="description" maxLength={1000} defaultValue={initial?.description ?? ""} />
      {state.errors?.description && <Notice tone="error">{state.errors.description}</Notice>}
      <div>
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
