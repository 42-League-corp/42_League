-- Nouvelle action d'audit : suppression de tournoi par un admin.
ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'DELETE_TOURNAMENT';
