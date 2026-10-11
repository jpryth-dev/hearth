import Link from "next/link";

import { signOutAction } from "@/app/actions";
import { getCurrentUser } from "@/server/auth";

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-4 px-6 py-3 text-sm">
        <Link href="/" className="font-semibold">
          Hearth
        </Link>
        {user && (
          <nav className="flex items-center gap-4">
            {user.role === "ADMIN" && (
              <>
                <Link href="/admin/invitations">Invitations</Link>
                <Link href="/admin/users">People</Link>
                <Link href="/admin/activity">Activity</Link>
              </>
            )}
            <span className="text-zinc-600 dark:text-zinc-400">{user.displayName}</span>
            <form action={signOutAction}>
              <button type="submit" className="underline">
                Sign out
              </button>
            </form>
          </nav>
        )}
      </div>
    </header>
  );
}
