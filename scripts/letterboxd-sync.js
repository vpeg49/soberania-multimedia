// scripts/letterboxd-sync.js
// Marks movies as played in Jellyfin based on:
//   1. Letterboxd diary.csv
//   2. manual-watched.json (manually confirmed)

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const JELLYFIN_URL = process.env.JELLYFIN_URL;
const JELLYFIN_API_KEY = process.env.JELLYFIN_API_KEY;
const JELLYFIN_USER_ID = process.env.JELLYFIN_USER_ID;
const DRY_RUN = process.env.DRY_RUN !== 'false';

const DIARY_PATH = process.argv[2];
const MANUAL_PATH = path.join(__dirname, 'manual-watched.json');

// ─── Validate config ───────────────────────────────────────────────
if (!JELLYFIN_URL || !JELLYFIN_API_KEY || !JELLYFIN_USER_ID) {
  console.error('❌ Missing JELLYFIN_URL, JELLYFIN_API_KEY or JELLYFIN_USER_ID in .env');
  process.exit(1);
}

if (!DIARY_PATH) {
  console.error('❌ Usage: node scripts/letterboxd-sync.js /path/to/diary.csv');
  process.exit(1);
}

if (!fs.existsSync(DIARY_PATH)) {
  console.error(`❌ File not found: ${DIARY_PATH}`);
  process.exit(1);
}

// ─── Helpers ───────────────────────────────────────────────────────
const headers = {
  'X-Emby-Token': JELLYFIN_API_KEY,
  'Content-Type': 'application/json',
};

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// ─── Load diary.csv ────────────────────────────────────────────────
function loadDiary(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const records = parse(content, { columns: true, skip_empty_lines: true });

  const diary = new Map();
  for (const row of records) {
    const key = `${normalize(row.Name)}-${row.Year}`;
    diary.set(key, { name: row.Name, year: row.Year, source: 'letterboxd' });
  }

  console.log(`📖 Diary loaded: ${diary.size} entries`);
  return diary;
}

// ─── Load manual-watched.json ──────────────────────────────────────
function loadManual(filePath) {
  const manual = new Map();

  if (!fs.existsSync(filePath)) {
    console.log('⚠️  manual-watched.json not found, skipping');
    return manual;
  }

  const records = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  for (const row of records) {
    const key = `${normalize(row.name)}-${row.year}`;
    manual.set(key, { name: row.name, year: row.year, source: 'manual' });
  }

  console.log(`📋 Manual list loaded: ${manual.size} entries`);
  return manual;
}

// ─── Merge both sources ────────────────────────────────────────────
function mergeWatched(diary, manual) {
  const merged = new Map([...diary, ...manual]);
  console.log(`🔀 Total watched (merged): ${merged.size} unique entries`);
  return merged;
}

// ─── Get all movies from Jellyfin ──────────────────────────────────
async function getJellyfinMovies() {
  const url = `${JELLYFIN_URL}/Users/${JELLYFIN_USER_ID}/Items` +
    `?IncludeItemTypes=Movie&Recursive=true&Fields=Name,ProductionYear`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Jellyfin API error: ${res.status}`);

  const data = await res.json();
  console.log(`🎬 Jellyfin library: ${data.TotalRecordCount} movies`);
  return data.Items;
}

// ─── Mark movie as played ──────────────────────────────────────────
async function markAsPlayed(itemId, movieName, source) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] ✅ Would mark [${source}]: ${movieName}`);
    return;
  }

  const url = `${JELLYFIN_URL}/Users/${JELLYFIN_USER_ID}/PlayedItems/${itemId}`;
  const res = await fetch(url, { method: 'POST', headers });

  if (res.ok) {
    console.log(`  ✅ Marked [${source}]: ${movieName}`);
  } else {
    console.log(`  ❌ Failed [${source}]: ${movieName} (${res.status})`);
  }
}

// ─── Main ──────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('🔄 Letterboxd + Manual → Jellyfin sync');
  console.log(`📋 Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  const diary = loadDiary(DIARY_PATH);
  const manual = loadManual(MANUAL_PATH);
  const watched = mergeWatched(diary, manual);
  const movies = await getJellyfinMovies();

  let matched = 0;
  let notFound = 0;

  console.log('');
  console.log('─── Matching ─────────────────────────────────────────');

  for (const movie of movies) {
    const year = String(movie.ProductionYear);
    const key = `${normalize(movie.Name)}-${year}`;

    if (watched.has(key)) {
      const entry = watched.get(key);
      matched++;
      await markAsPlayed(movie.Id, `${movie.Name} (${year})`, entry.source);
    } else {
      notFound++;
      console.log(`  ⬜ Not watched: ${movie.Name} (${year})`);
    }
  }

  console.log('');
  console.log('─── Summary ──────────────────────────────────────────');
  console.log(`  ✅ Will mark as played: ${matched}`);
  console.log(`  ⬜ Stays unwatched:     ${notFound}`);
  console.log(`  📋 Mode: ${DRY_RUN ? 'DRY RUN — no changes made' : 'LIVE — changes applied'}`);
  console.log('');
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});