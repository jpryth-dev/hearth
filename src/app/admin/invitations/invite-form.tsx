"use client";

import { useActionState } from "react";

import { Button, Field, Notice } from "@/components/ui";

import { inviteAction, type InviteFormState } from "./actions";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteFormState, FormData>(inviteAction, { status: "idle" });
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="Email address" name="email" type="email" required autoComplete="off" />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send invitation"}
        </Button>
      </div>
      {state.status === "sent" && <Notice tone="ok">Invitation sent to {state.email}.</Notice>}
      {state.status === "error" && <Notice tone="error">{state.message}</Notice>}
    </form>
  );
}
