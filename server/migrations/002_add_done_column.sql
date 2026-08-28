-- Migration: Add done_column_id to boards
-- Run this if you have an existing database

-- Add the column (nullable for now)
ALTER TABLE boards ADD COLUMN IF NOT EXISTS done_column_id UUID;

-- Auto-set "Concluído" as done column for Projeto Principal
UPDATE boards SET done_column_id = (
  SELECT id FROM columns WHERE name = 'Concluído' AND board_id = boards.id
);

-- Auto-set "Publicado" as done column for Marketing
UPDATE boards SET done_column_id = (
  SELECT id FROM columns WHERE name = 'Publicado' AND board_id = boards.id
) WHERE name = 'Marketing';

-- For any other boards, try to find a column named 'Concluído' or 'Done'
UPDATE boards SET done_column_id = (
  SELECT id FROM columns
  WHERE board_id = boards.id
    AND (name ILIKE 'concluído' OR name ILIKE 'done' OR name ILIKE 'publicado')
  LIMIT 1
) WHERE done_column_id IS NULL;
