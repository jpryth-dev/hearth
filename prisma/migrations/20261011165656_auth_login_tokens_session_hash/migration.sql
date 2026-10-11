-- Phase 2: in-house auth (docs/plans/phase-2-auth.md).

-- Sessions now store a SHA-256 hash of the cookie token instead of the raw
-- token. Existing rows hold raw tokens that can never match a hash lookup, so
-- clear them rather than leave unusable rows behind.
DELETE FROM "sessions";
ALTER TABLE "sessions" RENAME COLUMN "session_token" TO "token_hash";
ALTER INDEX "sessions_session_token_key" RENAME TO "sessions_token_hash_key";

-- Single-use sign-in links for returning users (design deviation).
CREATE TABLE "login_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "login_tokens_token_hash_key" ON "login_tokens"("token_hash");
CREATE INDEX "login_tokens_user_id_expires_at_idx" ON "login_tokens"("user_id", "expires_at");

ALTER TABLE "login_tokens" ADD CONSTRAINT "login_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
