import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";

import { activityFilterSchema } from "@/lib/schemas";
import { getCurrentUser } from "@/server/auth";
import { requestIp } from "@/server/request";
import { activityCsv } from "@/server/reports/activity";

/** CSV download of the filtered Security Activity Report. Admins only; others get a 404. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") notFound();

  const filter = activityFilterSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!filter.success) return new Response("Invalid filter", { status: 400 });

  const csv = await activityCsv({ actor: user, ipAddress: await requestIp() }, filter.data);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hearth-activity-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
