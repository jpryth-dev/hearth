// Development seed. The albums are arranged to cover each authorization case
// the data-access tests need: owned, shared (view and contribute), unshared,
// admin-owned, and soft-deleted. No photos: upload some through the app.
import type { PrismaClient } from "../src/generated/prisma/client";

export const SEED_USERS = {
  admin: { email: "admin@example.com", displayName: "Ada Admin", role: "ADMIN" },
  alice: { email: "alice@example.com", displayName: "Alice Owner", role: "MEMBER" },
  bob: { email: "bob@example.com", displayName: "Bob Viewer", role: "MEMBER" },
  carol: { email: "carol@example.com", displayName: "Carol Contributor", role: "MEMBER" },
} as const;

// Fixed ids make the seed idempotent: re-running upserts instead of duplicating.
export const SEED_ALBUMS = {
  shared: "5eed0000-0000-4000-8000-000000000001",
  alicePrivate: "5eed0000-0000-4000-8000-000000000002",
  adminPrivate: "5eed0000-0000-4000-8000-000000000003",
  deleted: "5eed0000-0000-4000-8000-000000000004",
} as const;

type SeedUserKey = keyof typeof SEED_USERS;

export async function seed(db: PrismaClient): Promise<void> {
  const ids = {} as Record<SeedUserKey, string>;
  for (const [key, user] of Object.entries(SEED_USERS) as [SeedUserKey, (typeof SEED_USERS)[SeedUserKey]][]) {
    const row = await db.user.upsert({
      where: { email: user.email },
      update: { displayName: user.displayName, role: user.role },
      create: user,
    });
    ids[key] = row.id;
  }

  const albums = [
    { id: SEED_ALBUMS.shared, ownerId: ids.alice, title: "Summer 2026", deletedAt: null },
    { id: SEED_ALBUMS.alicePrivate, ownerId: ids.alice, title: "Alice's drafts", deletedAt: null },
    // Admin owns this one but, like everyone, sees only albums they own or were granted.
    { id: SEED_ALBUMS.adminPrivate, ownerId: ids.admin, title: "Admin's album", deletedAt: null },
    // Soft-deleted but still shared with Bob, so queries must filter on deletedAt.
    // Dated now so it stays within retention and `npm run purge` keeps it.
    { id: SEED_ALBUMS.deleted, ownerId: ids.alice, title: "Deleted album", deletedAt: new Date() },
  ];
  for (const album of albums) {
    await db.album.upsert({ where: { id: album.id }, update: album, create: album });
  }

  const grants = [
    { albumId: SEED_ALBUMS.shared, userId: ids.bob, accessLevel: "VIEW" },
    { albumId: SEED_ALBUMS.shared, userId: ids.carol, accessLevel: "CONTRIBUTE" },
    { albumId: SEED_ALBUMS.deleted, userId: ids.bob, accessLevel: "VIEW" },
  ] as const;
  for (const grant of grants) {
    const data = { ...grant, grantedByUserId: ids.alice };
    await db.albumAccess.upsert({
      where: { albumId_userId: { albumId: grant.albumId, userId: grant.userId } },
      update: data,
      create: data,
    });
  }
}
