-- Adhésion aux modes de jeu + jeu sur les tournois.
ALTER TABLE "users" ADD COLUMN "games" TEXT[] NOT NULL DEFAULT ARRAY['babyfoot']::TEXT[];
ALTER TABLE "users" ADD COLUMN "onboarded_at" TIMESTAMP(3);

ALTER TABLE "tournaments" ADD COLUMN "game" TEXT NOT NULL DEFAULT 'babyfoot';
