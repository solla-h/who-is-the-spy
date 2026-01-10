import wordPairsData from '../data/word-pairs.json';

interface WordPair {
  civilian: string;
  spy: string;
  category: string;
}

interface WordPairsFile {
  version: string;
  pairs: WordPair[];
}

// Track if sync has been done in this worker instance
let syncCompleted = false;

/**
 * Sync word pairs from JSON file to D1 database
 * Uses UPSERT logic to handle updates from GitHub deployments
 */
export async function syncWordPairs(db: D1Database): Promise<void> {
  // Only sync once per worker instance
  if (syncCompleted) {
    return;
  }

  try {
    const data = wordPairsData as WordPairsFile;
    
    // Use a batch operation for efficiency
    const statements: D1PreparedStatement[] = [];
    
    for (const pair of data.pairs) {
      // UPSERT: Insert or replace based on civilian_word + spy_word combination
      const stmt = db.prepare(`
        INSERT INTO word_pairs (civilian_word, spy_word, category)
        VALUES (?, ?, ?)
        ON CONFLICT(civilian_word, spy_word) DO UPDATE SET
          category = excluded.category
      `).bind(pair.civilian, pair.spy, pair.category);
      
      statements.push(stmt);
    }

    // Execute all statements in a batch
    if (statements.length > 0) {
      await db.batch(statements);
    }

    syncCompleted = true;
    console.log(`Synced ${data.pairs.length} word pairs to database`);
  } catch (error) {
    console.error('Failed to sync word pairs:', error);
    // Don't throw - allow the app to continue even if sync fails
  }
}

/**
 * Get all word pairs from database
 */
export async function getWordPairs(db: D1Database): Promise<WordPair[]> {
  const result = await db.prepare(`
    SELECT civilian_word as civilian, spy_word as spy, category
    FROM word_pairs
  `).all<{ civilian: string; spy: string; category: string }>();
  
  return result.results || [];
}

/**
 * Get a random word pair from database
 */
export async function getRandomWordPair(db: D1Database): Promise<WordPair | null> {
  const result = await db.prepare(`
    SELECT civilian_word as civilian, spy_word as spy, category
    FROM word_pairs
    ORDER BY RANDOM()
    LIMIT 1
  `).first<{ civilian: string; spy: string; category: string }>();
  
  return result || null;
}
