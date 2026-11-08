import { Button, Notice, Page } from "@/components/ui";
import { requireAdminContext } from "@/server/auth";
import { listUsers } from "@/server/auth/users";

import { disableUserAction, enableUserAction } from "./actions";

export const metadata = { title: "People · Hearth" };

const NOTICES = {
  not_found: "That user no longer exists.",
  self: "You can't disable your own account.",
  last_admin: "Hearth needs at least one active admin.",
  unchanged: "Nothing to change.",
} as const;

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const ctx = await requireAdminContext();
  const users = await listUsers(ctx);
  const { notice } = await searchParams;
  const message = typeof notice === "string" && notice in NOTICES ? NOTICES[notice as keyof typeof NOTICES] : null;

  return (
    <Page title="People">
      {message && <Notice tone="error">{message}</Notice>}
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-4 py-3 text-sm">
            <div>
              <div className="font-medium">
                {u.displayName}
                {u.role === "ADMIN" && <span className="ml-2 text-xs text-zinc-500">admin</span>}
                {u.status === "DISABLED" && <span className="ml-2 text-xs text-red-700 dark:text-red-400">disabled</span>}
              </div>
              <div className="text-zinc-600 dark:text-zinc-400">{u.email}</div>
            </div>
            {u.id !== ctx.actor.id && (
              <form action={u.status === "ACTIVE" ? disableUserAction : enableUserAction}>
                <input type="hidden" name="userId" value={u.id} />
                <Button type="submit" aria-label={`${u.status === "ACTIVE" ? "Disable" : "Enable"} ${u.displayName}`}>
                  {u.status === "ACTIVE" ? "Disable" : "Enable"}
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </Page>
  );
}
