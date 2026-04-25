import test from 'node:test';
import { closeDb, initDb, resetMemoryStore } from '../db/store.js';

export function registerDbHooks() {
  test.before(async () => {
    process.env.SEED_DEV_USERS = '0';
    await initDb();
  });

  test.after(async () => {
    await closeDb();
  });

  test.beforeEach(async () => {
    await resetMemoryStore();
  });
}
