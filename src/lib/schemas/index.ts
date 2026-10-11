/**
 * Shared Zod schemas: the single definition of every external input's shape.
 *
 * Contract:
 * - Every external input (forms, route params, query strings, stored data read
 *   back for use) is parsed with a schema from this module before use.
 * - Each schema is defined once here and imported by both client and server,
 *   so client-side validation can never drift from what the server enforces.
 * - Schemas only describe shape. They never grant access; authorization is the
 *   data-access layer's job (`src/server/data/`).
 * - No server-only imports here: this module ships to the browser.
 *
 * @packageDocumentation
 */
export {
  accessLevelSchema,
  albumDescriptionSchema,
  albumInputSchema,
  albumTitleSchema,
  type AlbumInput,
} from "./albums";
export { displayNameSchema, emailSchema, tokenSchema } from "./auth";
export { serverEnvSchema, storageEnvSchema, type ServerEnv, type StorageEnv } from "./env";
export { uuidSchema, type Uuid } from "./ids";
export { photoFilenameSchema } from "./photos";
