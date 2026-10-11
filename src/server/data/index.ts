/**
 * Authorization data-access layer: the only code allowed to read or write
 * Album, AlbumAccess, Photo and PhotoMetadata.
 *
 * Contract for every exported function:
 * - Takes the acting user as its first argument and enforces access itself;
 *   callers never pre-check and pass a flag.
 * - A user can reach an album only if they own it or hold an AlbumAccess row
 *   for it. There is no inherited or default visibility, and the ADMIN role
 *   grants no album access.
 * - Excludes soft-deleted rows (`deletedAt` set) unless the caller explicitly
 *   asks for them.
 * - Writes an AuditLog row for security-relevant events: access grants and
 *   revocations, denied access, and deletions.
 * - Signed storage URLs are issued only after the same check, are short-lived,
 *   and are never cached or logged.
 * - Documents in TSDoc what it checks and what it throws.
 *
 * Route handlers, server actions and components must not import
 * `@/server/db`; ESLint enforces this outside `src/server/`.
 *
 * @packageDocumentation
 */
import "server-only";

export { albumRole, requireAlbumRole, type AlbumRole } from "./access";
export { currentActor, type Actor } from "./actor";
export {
  createAlbum,
  deleteAlbum,
  getAlbum,
  listVisibleAlbums,
  updateAlbum,
  type AlbumSummary,
  type AlbumWriteResult,
} from "./albums";
export {
  deletePhoto,
  getPhoto,
  listPhotos,
  uploadPhoto,
  type PhotoDetail,
  type PhotoSummary,
  type UploadResult,
} from "./photos";
export {
  grantAlbumAccess,
  listAlbumAccess,
  revokeAlbumAccess,
  type AlbumMember,
  type GrantResult,
} from "./sharing";
