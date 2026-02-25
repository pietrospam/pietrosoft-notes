-- REQ-008.2: Add favorite_order field for ordering favorites
ALTER TABLE "notes" ADD COLUMN "favorite_order" INTEGER;

-- Initialize favorite_order for existing favorites (ordered by updated_at)
WITH ranked_favorites AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY updated_at DESC) as rn
  FROM notes
  WHERE is_favorite = true
)
UPDATE notes
SET favorite_order = ranked_favorites.rn
FROM ranked_favorites
WHERE notes.id = ranked_favorites.id;
