-- Nouvelle action d'audit pour la synchro ELO/stats prod → staging (GOD, staging only).
ALTER TYPE "AdminAction" ADD VALUE 'SYNC_ELO_FROM_PROD';
