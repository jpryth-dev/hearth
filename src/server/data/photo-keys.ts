import "server-only";

// Object keys derive only from the random Photo.storageKey.
export const fullKey = (storageKey: string) => `${storageKey}/full`;
export const thumbKey = (storageKey: string) => `${storageKey}/thumb`;

/** Photos that count as visible content: finished and not deleted. */
export const VISIBLE_PHOTO = { status: "READY", deletedAt: null } as const;
