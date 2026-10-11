import { Page } from "@/components/ui";
import { requireUser } from "@/server/auth";

export default async function Home() {
  const user = await requireUser();
  return (
    <Page title={`Welcome, ${user.displayName}`}>
      <p className="text-zinc-600 dark:text-zinc-400">Albums arrive in the next phase.</p>
    </Page>
  );
}
