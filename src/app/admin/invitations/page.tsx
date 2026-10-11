import { Button, Page } from "@/components/ui";
import { requireAdmin } from "@/server/auth";
import { listPendingInvitations } from "@/server/auth/invitations";
import { requestIp } from "@/server/request";

import { revokeAction } from "./actions";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Invitations · Hearth" };

export default async function InvitationsPage() {
  const admin = await requireAdmin();
  const pending = await listPendingInvitations(admin, await requestIp());

  return (
    <Page title="Invitations">
      <InviteForm />
      <h2 className="mt-10 mb-3 text-lg font-medium">Pending</h2>
      {pending.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No pending invitations.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {pending.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between gap-4 py-3">
              <div className="text-sm">
                <div className="font-medium">{inv.email}</div>
                <div className="text-zinc-600 dark:text-zinc-400">
                  Invited by {inv.invitedBy}, expires {inv.expiresAt.toLocaleDateString("en-GB")}
                </div>
              </div>
              <form action={revokeAction}>
                <input type="hidden" name="id" value={inv.id} />
                <Button type="submit">Revoke</Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
