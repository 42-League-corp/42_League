-- Apôtre de Sheldon : titre spécial — crédite +300 coins à l'achat, s'affiche
-- obligatoirement sur le profil et ne peut jamais être retiré.
INSERT INTO "shop_items" ("id", "name", "description", "category", "price", "payload", "active", "sort_order")
VALUES (
  gen_random_uuid()::text,
  'Apôtre de Sheldon',
  'Titre légendaire. Vous rejoignez le culte. +300 League Coins à l''acquisition — et vous ne pouvez plus revenir en arrière.',
  'title',
  0,
  '{"title": "Apôtre de Sheldon"}'::jsonb,
  true,
  999
)
ON CONFLICT DO NOTHING;
