-- Nouveau rôle MODERATOR : entre USER et ADMIN, avec permissions fines configurables.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MODERATOR';

-- Accès staging : flag indépendant du rôle.
-- Corrige le bug où staging-access accordait SUPERADMIN au lieu d'un simple flag.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "staging_allowed" BOOLEAN NOT NULL DEFAULT false;

-- Permissions granulaires des modérateurs (JSON, null = aucune permission accordée).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "moderator_permissions" JSONB;

-- Nouvelle action d'audit pour tracer les modifications de permissions modérateur.
ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'SET_MODERATOR_PERMISSIONS';
