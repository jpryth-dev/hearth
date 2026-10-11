import Link from "next/link";

import { signOutAction } from "@/app/actions";
import { getCurrentUser } from "@/server/auth";

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-sm sm:px-6">
        <Link href="/" className="text-base font-semibold">
          Hearth
        </Link>
        {user && (
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
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
