-- 谁是卧底 (Who is the Spy) Database Schema

-- 房间表
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'waiting',
  host_id TEXT NOT NULL,
  settings TEXT NOT NULL DEFAULT '{"spyCount":1,"minPlayers":3,"maxPlayers":20}',
  game_state TEXT DEFAULT NULL,
  civilian_word TEXT DEFAULT NULL,
  spy_word TEXT DEFAULT NULL,
  current_turn INTEGER DEFAULT 0,
  round INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 玩家表
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT NULL,
  is_alive INTEGER DEFAULT 1,
  is_online INTEGER DEFAULT 1,
  word_confirmed INTEGER DEFAULT 0,
  last_seen INTEGER NOT NULL,
  join_order INTEGER NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- 描述记录表
CREATE TABLE IF NOT EXISTS descriptions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE(room_id, player_id, round)
);

-- 投票记录表
CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  voter_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  UNIQUE(room_id, voter_id, round)
);

-- 词语对表
CREATE TABLE IF NOT EXISTS word_pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  civilian_word TEXT NOT NULL,
  spy_word TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  UNIQUE(civilian_word, spy_word)
);

-- 索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_updated ON rooms(updated_at);
CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_players_token ON players(token);
CREATE INDEX IF NOT EXISTS idx_descriptions_room_round ON descriptions(room_id, round);
CREATE INDEX IF NOT EXISTS idx_votes_room_round ON votes(room_id, round);
