-- Nouvelle action d'audit : un admin/superadmin a basculé sur le compte de test
-- générique `tester` (staging uniquement, cf. POST /admin/impersonate-tester).
ALTER TYPE "AdminAction" ADD VALUE 'IMPERSONATE_TESTER';
