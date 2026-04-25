import { initDb, closeDb } from '../src/db/store.js';

async function main() {
  await initDb();
  await closeDb();
  console.log('Database migration complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
