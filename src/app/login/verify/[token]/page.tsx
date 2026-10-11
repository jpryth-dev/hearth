import Link from "next/link";

import { Page } from "@/components/ui";
import { isUsableSignInToken } from "@/server/auth/sign-in";

import { VerifyForm } from "./verify-form";

export const metadata = { title: "Sign in · Hearth" };

// Opening the link only shows a button. The token is spent by the POST action,
// so email link scanners can't use it up.
export default async function VerifySignInPage({ params }: PageProps<"/login/verify/[token]">) {
  const { token } = await params;

  if (!(await isUsableSignInToken(token))) {
    return (
      <Page title="Link not valid">
        <p>
          This sign-in link has expired or already been used.{" "}
          <Link className="underline" href="/login">Request a new one</Link>.
        </p>
      </Page>
    );
  }
  return (
    <Page title="Sign in to Hearth">
      <VerifyForm token={token} />
    </Page>
  );
}
