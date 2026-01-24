-- Add missing columns to players table
ALTER TABLE players ADD COLUMN is_bot INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN bot_config TEXT;
