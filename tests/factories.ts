import type { SessionUser } from "@/server/auth";
import { db } from "@/server/db";

/** Creates a user and returns it in the shape the auth layer hands out. */
export async function makeUser(
  overrides: { email?: string; role?: "ADMIN" | "MEMBER"; status?: "ACTIVE" | "DISABLED" } = {},
): Promise<SessionUser> {
  const user = await db.user.create({
    data: {
      email: overrides.email ?? `user-${crypto.randomUUID()}@example.com`,
      displayName: overrides.role === "ADMIN" ? "Admin" : "Member",
      role: overrides.role ?? "MEMBER",
      status: overrides.status ?? "ACTIVE",
    },
  });
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
}

/** A user as the data-access layer receives them. */
export async function makeActor(
  overrides: Parameters<typeof makeUser>[0] = {},
): Promise<import("@/server/data/actor").Actor> {
  return { ...(await makeUser(overrides)), ipAddress: "198.51.100.1" };
}

export async function makeAlbum(ownerId: string, overrides: { title?: string; deletedAt?: Date } = {}) {
  return db.album.create({ data: { ownerId, title: overrides.title ?? "Album", deletedAt: overrides.deletedAt } });
}

export async function grant(albumId: string, userId: string, accessLevel: "VIEW" | "CONTRIBUTE", grantedByUserId: string) {
  return db.albumAccess.create({ data: { albumId, userId, accessLevel, grantedByUserId } });
}

/**
 * The cast for authorization tests: one shared album seen from every angle,
 * plus a private album and a deleted one.
 */
export async function albumWorld() {
  const owner = await makeActor();
  const viewer = await makeActor();
  const contributor = await makeActor();
  const stranger = await makeActor();
  const admin = await makeActor({ role: "ADMIN" });

  const shared = await makeAlbum(owner.id, { title: "Shared" });
  await grant(shared.id, viewer.id, "VIEW", owner.id);
  await grant(shared.id, contributor.id, "CONTRIBUTE", owner.id);
  const ownerPrivate = await makeAlbum(owner.id, { title: "Private" });
  const deleted = await makeAlbum(owner.id, { title: "Deleted", deletedAt: new Date() });
  await grant(deleted.id, viewer.id, "VIEW", owner.id);

  return { owner, viewer, contributor, stranger, admin, shared, ownerPrivate, deleted };
}
