import Link from "next/link";

import { Button, Page } from "@/components/ui";
import { AuditAction } from "@/generated/prisma/enums";
import { activityFilterSchema, type ActivityFilter } from "@/lib/schemas";
import { requireAdminContext } from "@/server/auth";
import { listUsers } from "@/server/auth/users";
import { activityReport, activitySummary } from "@/server/reports/activity";

export const metadata = { title: "Security activity · Hearth" };

function query(filter: ActivityFilter, overrides: Partial<ActivityFilter> = {}): string {
  const merged = { ...filter, ...overrides };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") params.set(k, String(v));
  return params.toString();
}

const select =
  "rounded-md border border-zinc-300 px-2 py-1.5 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900";

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  const ctx = await requireAdminContext();
  const parsed = activityFilterSchema.safeParse(await searchParams);
  const filter: ActivityFilter = parsed.success ? parsed.data : { page: 1 };
  const [report, summary, users] = await Promise.all([
    activityReport(ctx, filter),
    activitySummary(ctx),
    listUsers(ctx),
  ]);

  return (
    <Page title="Security activity">
      <table className="mb-8 w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-600 dark:text-zinc-400">
            <th className="py-1 font-normal">Event</th>
            <th className="py-1 text-right font-normal">7 days</th>
            <th className="py-1 text-right font-normal">30 days</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(summary).map(([category, n]) => (
            <tr key={category} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="py-1">{category}</td>
              <td className="py-1 text-right">{n.last7}</td>
              <td className="py-1 text-right">{n.last30}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 text-sm" aria-label="Filter activity">
        <label className="flex flex-col gap-1">
          Action
          <select name="action" defaultValue={filter.action ?? ""} className={select}>
            <option value="">Any</option>
            {Object.values(AuditAction).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Person
          <select name="actorId" defaultValue={filter.actorId ?? ""} className={select}>
            <option value="">Anyone</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          From
          <input type="date" name="from" defaultValue={filter.from} className={select} />
        </label>
        <label className="flex flex-col gap-1">
          To
          <input type="date" name="to" defaultValue={filter.to} className={select} />
        </label>
        <Button type="submit">Filter</Button>
        <a className="underline" href={`/admin/activity/export?${query(filter, { page: undefined })}`}>
          Download CSV
        </a>
      </form>
      {!parsed.success && <p className="mb-4 text-sm text-red-700">Some filters were invalid and were ignored.</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-xs" aria-label="Events">
          <thead>
            <tr className="text-left text-zinc-600 dark:text-zinc-400">
              <th className="py-1 pr-3 font-normal">Time (UTC)</th>
              <th className="py-1 pr-3 font-normal">Action</th>
              <th className="py-1 pr-3 font-normal">By</th>
              <th className="py-1 pr-3 font-normal">Concerning</th>
              <th className="py-1 pr-3 font-normal">Target</th>
              <th className="py-1 pr-3 font-normal">IP</th>
              <th className="py-1 font-normal">Details</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={r.id} className="border-t border-zinc-200 align-top dark:border-zinc-800">
                <td className="py-1 pr-3 whitespace-nowrap">{r.at.toISOString().replace("T", " ").slice(0, 19)}</td>
                <td className="py-1 pr-3">{r.action}</td>
                <td className="py-1 pr-3">{r.actor ?? "anonymous"}</td>
                <td className="py-1 pr-3">{r.subject ?? ""}</td>
                <td className="py-1 pr-3">{r.targetType ? `${r.targetType} ${r.targetId?.slice(0, 8) ?? ""}` : ""}</td>
                <td className="py-1 pr-3">{r.ipAddress ?? ""}</td>
                <td className="py-1">{r.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {report.rows.length === 0 && <p className="mt-4 text-sm">No matching events.</p>}

      <nav className="mt-4 flex gap-4 text-sm" aria-label="Pages">
        {report.page > 1 && (
          <Link className="underline" href={`/admin/activity?${query(filter, { page: report.page - 1 })}`}>
            Newer
          </Link>
        )}
        {report.hasNext && (
          <Link className="underline" href={`/admin/activity?${query(filter, { page: report.page + 1 })}`}>
            Older
          </Link>
        )}
      </nav>
    </Page>
  );
}
