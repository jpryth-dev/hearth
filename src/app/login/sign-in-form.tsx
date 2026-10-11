"use client";

import { useActionState } from "react";

import { Button, Field, Notice } from "@/components/ui";

import { requestSignInAction, type SignInFormState } from "./actions";

export function SignInForm() {
  const [state, action, pending] = useActionState<SignInFormState, FormData>(requestSignInAction, { status: "idle" });
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="Email address" name="email" type="email" required autoComplete="email" />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Email me a sign-in link"}
        </Button>
      </div>
      {state.status === "sent" && (
        <Notice tone="ok">If that address has a Hearth account, a sign-in link is on its way. It expires in 15 minutes.</Notice>
      )}
      {state.status === "error" && <Notice tone="error">Something went wrong sending the email. Try again.</Notice>}
    </form>
  );
}
