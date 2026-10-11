"use client";

import { useActionState } from "react";

import { Button, Field, Notice } from "@/components/ui";

import { grantAccessAction, type ShareFormState } from "./actions";

export function ShareForm({ albumId }: { albumId: string }) {
  const [state, action, pending] = useActionState<ShareFormState, FormData>(grantAccessAction, { status: "idle" });
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="albumId" value={albumId} />
      <Field label="Member's email" name="email" type="email" required autoComplete="off" />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Access
        <select
          name="accessLevel"
          defaultValue="VIEW"
          className="rounded-md border border-zinc-300 px-3 py-2 text-base font-normal dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="VIEW">Can view</option>
          <option value="CONTRIBUTE">Can add photos</option>
        </select>
      </label>
      <div>
        <Button type="submit" disabled={pending}>
          Share
        </Button>
      </div>
      {state.status !== "idle" && <Notice tone={state.status === "ok" ? "ok" : "error"}>{state.message}</Notice>}
    </form>
  );
}
