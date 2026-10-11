"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button, Notice } from "@/components/ui";

import { verifyAction, type VerifyFormState } from "./actions";

export function VerifyForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<VerifyFormState, FormData>(verifyAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </div>
      {state.error && (
        <Notice tone="error">
          {state.error} <Link className="underline" href="/login">Back to sign in</Link>
        </Notice>
      )}
    </form>
  );
}
