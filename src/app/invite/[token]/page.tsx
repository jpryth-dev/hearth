import { Page } from "@/components/ui";
import { findAcceptableInvitation } from "@/server/auth/invitations";

import { AcceptForm } from "./accept-form";

export const metadata = { title: "Accept invitation · Hearth" };

// Opening the link only shows this form. The invitation is consumed by the
// POST action, so email link scanners can't use it up.
export default async function AcceptInvitationPage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const invitation = await findAcceptableInvitation(token);

  if (!invitation) {
    return (
      <Page title="Invitation not valid">
        <p>This invitation has expired, been used, or been withdrawn. Ask whoever invited you for a new one.</p>
      </Page>
    );
  }
  return (
    <Page title="Welcome to Hearth">
      <AcceptForm token={token} email={invitation.email} />
    </Page>
  );
}
