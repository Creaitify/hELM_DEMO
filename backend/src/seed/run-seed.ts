import { closeGraph, initGraph } from '../graph/index.js';
import { seedGraph } from './seed.js';

/** Standalone seed: `npm run seed`. Idempotent against a live Neo4j. */
async function main() {
  await initGraph((message) => console.log(message));
  await seedGraph((message) => console.log(message));
  await closeGraph();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
