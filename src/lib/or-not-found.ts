import { notFound } from "next/navigation";

import { NotFoundError } from "@/server/errors";

/**
 * Awaits a data-access call and turns NotFoundError into Next's 404, in pages
 * and Server Actions alike. Every other error propagates unchanged.
 */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}
