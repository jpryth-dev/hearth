"use client";

import { useActionState } from "react";

import { Button, Field, Notice } from "@/components/ui";

import { acceptAction, type AcceptFormState } from "./actions";

export function AcceptForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<AcceptFormState, FormData>(acceptAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        You&apos;re joining as <strong>{email}</strong>.
      </p>
      <Field label="Your name, as family will see it" name="displayName" required maxLength={60} autoComplete="name" />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Joining…" : "Join Hearth"}
        </Button>
      </div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
    </form>
  );
}
