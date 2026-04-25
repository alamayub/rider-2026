import test from 'node:test';
import { closeDb, initDb, resetMemoryStore } from '../db/store.js';

export function registerDbHooks() {
  test.before(async () => {
    await initDb();
  });

  test.after(async () => {
    await closeDb();
  });

  test.beforeEach(async () => {
    await resetMemoryStore();
  });
}
