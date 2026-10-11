import { redirect } from "next/navigation";

import { Page } from "@/components/ui";
import { getCurrentUser } from "@/server/auth";

import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in · Hearth" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <Page title="Sign in to Hearth">
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Hearth is invitation only. Enter the address your invitation was sent to.
      </p>
      <SignInForm />
    </Page>
  );
}
