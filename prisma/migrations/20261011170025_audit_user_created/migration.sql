-- Audit action for users created outside the invitation flow (bootstrap admin).
ALTER TYPE "audit_action" ADD VALUE 'USER_CREATED';
