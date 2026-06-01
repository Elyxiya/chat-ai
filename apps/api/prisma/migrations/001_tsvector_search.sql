-- ============================================
-- Migration 001: PostgreSQL Full-Text Search (tsvector)
-- Adds tsvector column, GIN index, and auto-update trigger
-- ============================================

-- Step 1: Add search_vector column to messages table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Step 2: Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_messages_search_vector
  ON messages
  USING GIN(search_vector);

-- Step 3: Create function to auto-update search_vector on INSERT or UPDATE
CREATE OR REPLACE FUNCTION messages_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to call the function
DROP TRIGGER IF EXISTS trg_messages_search_vector ON messages;
CREATE TRIGGER trg_messages_search_vector
  BEFORE INSERT OR UPDATE OF content
  ON messages
  FOR EACH ROW
  EXECUTE FUNCTION messages_search_vector_update();

-- Step 5: Backfill existing messages (one-time operation)
UPDATE messages
SET search_vector = to_tsvector('simple', COALESCE(content, ''))
WHERE search_vector IS NULL;
