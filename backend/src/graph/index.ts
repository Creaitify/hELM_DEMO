import { env } from '../env.js';
import { MemoryGraphStore, type GraphStore } from './store.js';
import { Neo4jGraphStore } from './neo4j-store.js';
import { PostgresGraphStore } from './postgres-store.js';

export type GraphStatus = {
  kind: 'neon' | 'neo4j' | 'memory';
  ok: boolean;
  detail: string;
};

let store: GraphStore | null = null;
let status: GraphStatus = { kind: 'memory', ok: true, detail: 'not started' };

/**
 * Resolves the decision graph once at boot.
 *
 * Neon Postgres first, then Neo4j, then the in-process store. A configured
 * database that fails to answer is a startup warning rather than a crash: the
 * service falls back and reports the failure through /api/health, so an
 * operator sees the real reason instead of a dead process.
 */
export async function initGraph(log: (message: string) => void): Promise<GraphStore> {
  if (store) return store;

  /*
   * An explicit request to keep the data in this process.
   *
   * Leaving DATABASE_URL blank already lands here, but that is an absence
   * rather than a decision, and it is not one a deployment can state: a
   * platform that injects a database URL of its own would silently take a
   * demo somewhere it was never meant to write. GRAPH_STORE=memory says the
   * intent out loud and wins over anything else configured, so a self-contained
   * build stays self-contained wherever it is deployed.
   *
   * Nothing is removed by setting it. Both database drivers stay wired and
   * come back the moment it is unset.
   */
  if (env.graphStore === 'memory') {
    const detail = 'In-process graph store (GRAPH_STORE=memory)';
    log(detail);
    return fallback(detail, true);
  }

  if (env.database.enabled) {
    const neon = new PostgresGraphStore();
    try {
      await neon.connect();
      const verified = await neon.verify();
      store = neon;
      status = { kind: 'neon', ok: verified.ok, detail: verified.detail };
      log(`decision graph: ${verified.detail}`);
      return store;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log(`decision graph: Neon unavailable (${detail}) — falling back to the in-process store`);
      await neon.close().catch(() => undefined);
      return fallback(`Neon configured but unreachable: ${detail}`);
    }
  }

  if (env.neo4j.enabled) {
    const neo = new Neo4jGraphStore();
    try {
      await neo.connect();
      const verified = await neo.verify();
      store = neo;
      status = { kind: 'neo4j', ok: verified.ok, detail: verified.detail };
      log(`decision graph: ${verified.detail}`);
      return store;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log(`decision graph: Neo4j unavailable (${detail}) — falling back to the in-process store`);
      await neo.close().catch(() => undefined);
      return fallback(`Neo4j configured but unreachable: ${detail}`);
    }
  }

  const detail = 'In-process graph store (no DATABASE_URL or NEO4J_URI configured)';
  log(detail);
  return fallback(detail, true);
}

async function fallback(detail: string, ok = false): Promise<GraphStore> {
  const memory = new MemoryGraphStore();
  await memory.connect();
  store = memory;
  status = { kind: 'memory', ok, detail };
  return store;
}

export function graph(): GraphStore {
  if (!store) throw new Error('The decision graph has not been initialised');
  return store;
}

export function graphStatus(): GraphStatus {
  return status;
}

export async function closeGraph() {
  await store?.close();
  store = null;
}

export type { GraphStore } from './store.js';
