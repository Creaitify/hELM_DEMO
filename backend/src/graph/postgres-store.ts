import pg from 'pg';
import { env } from '../env.js';
import type { GraphNode, GraphStore, NodeProps, RelationSpec } from './store.js';

// pg ships CommonJS, so the pool comes off the default export under ESM.
const { Pool } = pg;
type PgPool = InstanceType<typeof Pool>;

/**
 * The decision graph on Neon Postgres.
 *
 * Two tables carry the whole model: nodes keyed by (label, id) with a JSONB
 * body, and directed edges keyed by (from, type, to) with their own JSONB
 * properties. A graph shape stored relationally, rather than a relational
 * schema pretending to be a graph — so adding a node type is a write, not a
 * migration, and the traversals the product needs stay one indexed join.
 *
 * Neon is serverless Postgres: the pool is small and idle connections are
 * expected to be reaped, so every call is written to survive a cold start.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS helm_nodes (
  label       text        NOT NULL,
  id          text        NOT NULL,
  body        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (label, id)
);

CREATE TABLE IF NOT EXISTS helm_edges (
  from_label text        NOT NULL,
  from_id    text        NOT NULL,
  type       text        NOT NULL,
  to_label   text        NOT NULL,
  to_id      text        NOT NULL,
  props      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (from_label, from_id, type, to_label, to_id)
);

CREATE INDEX IF NOT EXISTS helm_edges_out ON helm_edges (from_label, from_id, type, to_label);
CREATE INDEX IF NOT EXISTS helm_edges_in  ON helm_edges (to_label, to_id, type, from_label);
CREATE INDEX IF NOT EXISTS helm_nodes_body ON helm_nodes USING gin (body jsonb_path_ops);
`;

export class PostgresGraphStore implements GraphStore {
  readonly kind = 'postgres' as const;
  /** Reported separately so health can say Neon rather than a driver name. */
  readonly flavour = 'neon' as const;

  private pool: PgPool | null = null;

  async connect() {
    if (this.pool) return;
    this.pool = new Pool({
      connectionString: env.database.url,
      max: 8,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 15_000,
      ssl: env.database.url.includes('sslmode=disable') ? undefined : { rejectUnauthorized: false },
    });
    await this.pool.query('SELECT 1');
    await this.pool.query(SCHEMA);
  }

  async close() {
    await this.pool?.end();
    this.pool = null;
  }

  private async run<T = unknown>(text: string, values: unknown[] = []): Promise<T[]> {
    if (!this.pool) throw new Error('The Neon pool is not connected');
    const result = await this.pool.query(text, values);
    return result.rows as T[];
  }

  async verify() {
    try {
      const [row] = await this.run<{ version: string }>('SELECT version() AS version');
      return { ok: true, detail: `Neon Postgres — ${row?.version?.split(' ').slice(0, 2).join(' ')}` };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : 'Neon unreachable' };
    }
  }

  async upsertNode<T extends NodeProps>(label: string, id: string, props: T) {
    const body = { ...props, id };
    const [row] = await this.run<{ body: NodeProps }>(
      `INSERT INTO helm_nodes (label, id, body)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (label, id) DO UPDATE
         SET body = helm_nodes.body || EXCLUDED.body,
             updated_at = now()
       RETURNING body`,
      [label, id, JSON.stringify(body)],
    );
    return (row?.body ?? body) as GraphNode<T>;
  }

  /**
   * One multi-row statement per chunk, rather than one statement per row.
   *
   * Postgres caps a statement at 65535 bound parameters; at two per node and
   * six per edge, 500 rows a chunk stays far inside that while keeping the
   * number of round trips to a serverless database in the single digits.
   */
  async upsertMany<T extends NodeProps>(
    label: string,
    rows: (T & { id: string })[],
    edges: RelationSpec[] = [],
  ): Promise<number> {
    const CHUNK = 500;

    for (let start = 0; start < rows.length; start += CHUNK) {
      const chunk = rows.slice(start, start + CHUNK);
      const values: unknown[] = [];
      const tuples = chunk.map((row, index) => {
        values.push(row.id, JSON.stringify(row));
        return `($1, $${index * 2 + 2}, $${index * 2 + 3}::jsonb)`;
      });
      values.unshift(label);

      await this.run(
        `INSERT INTO helm_nodes (label, id, body)
         VALUES ${tuples.join(', ')}
         ON CONFLICT (label, id) DO UPDATE
           SET body = helm_nodes.body || EXCLUDED.body,
               updated_at = now()`,
        values,
      );
    }

    for (let start = 0; start < edges.length; start += CHUNK) {
      const chunk = edges.slice(start, start + CHUNK);
      const values: unknown[] = [];
      const tuples = chunk.map((edge, index) => {
        const base = index * 6;
        values.push(
          edge.fromLabel,
          edge.fromId,
          edge.type,
          edge.toLabel,
          edge.toId,
          JSON.stringify(edge.props ?? {}),
        );
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}::jsonb)`;
      });

      await this.run(
        `INSERT INTO helm_edges (from_label, from_id, type, to_label, to_id, props)
         VALUES ${tuples.join(', ')}
         ON CONFLICT (from_label, from_id, type, to_label, to_id) DO UPDATE
           SET props = helm_edges.props || EXCLUDED.props`,
        values,
      );
    }

    return rows.length;
  }

  async getNode<T extends NodeProps>(label: string, id: string) {
    const [row] = await this.run<{ body: NodeProps }>(
      'SELECT body FROM helm_nodes WHERE label = $1 AND id = $2',
      [label, id],
    );
    return row ? (row.body as GraphNode<T>) : null;
  }

  async listNodes<T extends NodeProps>(label: string, where?: NodeProps) {
    // The containment operator uses the GIN index rather than scanning.
    const rows = where && Object.keys(where).length
      ? await this.run<{ body: NodeProps }>(
          'SELECT body FROM helm_nodes WHERE label = $1 AND body @> $2::jsonb',
          [label, JSON.stringify(where)],
        )
      : await this.run<{ body: NodeProps }>('SELECT body FROM helm_nodes WHERE label = $1', [label]);
    return rows.map((row) => row.body as GraphNode<T>);
  }

  /**
   * The range is pushed into SQL rather than filtered after the fact.
   *
   * `body->>'date'` compares as text, which is exactly right for the ISO
   * YYYY-MM-DD the rows store: lexicographic and chronological order are the
   * same string for that format.
   */
  async listNodesInDateRange<T extends NodeProps>(
    label: string,
    where: NodeProps,
    range: { start: string; end: string },
  ) {
    const rows = await this.run<{ body: NodeProps }>(
      `SELECT body FROM helm_nodes
       WHERE label = $1 AND body @> $2::jsonb
         AND body->>'date' >= $3 AND body->>'date' <= $4`,
      [label, JSON.stringify(where), range.start, range.end],
    );
    return rows.map((row) => row.body as GraphNode<T>);
  }

  async deleteNode(label: string, id: string) {
    await this.run('DELETE FROM helm_nodes WHERE label = $1 AND id = $2', [label, id]);
    await this.run(
      `DELETE FROM helm_edges
       WHERE (from_label = $1 AND from_id = $2) OR (to_label = $1 AND to_id = $2)`,
      [label, id],
    );
  }

  async relate(spec: RelationSpec) {
    await this.run(
      `INSERT INTO helm_edges (from_label, from_id, type, to_label, to_id, props)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (from_label, from_id, type, to_label, to_id) DO UPDATE
         SET props = helm_edges.props || EXCLUDED.props`,
      [
        spec.fromLabel,
        spec.fromId,
        spec.type,
        spec.toLabel,
        spec.toId,
        JSON.stringify(spec.props ?? {}),
      ],
    );
  }

  async unrelate(spec: Omit<RelationSpec, 'props'>) {
    await this.run(
      `DELETE FROM helm_edges
       WHERE from_label = $1 AND from_id = $2 AND type = $3 AND to_label = $4 AND to_id = $5`,
      [spec.fromLabel, spec.fromId, spec.type, spec.toLabel, spec.toId],
    );
  }

  async neighbours<T extends NodeProps>(fromLabel: string, fromId: string, type: string, toLabel: string) {
    const rows = await this.run<{ body: NodeProps }>(
      `SELECT n.body
       FROM helm_edges e
       JOIN helm_nodes n ON n.label = e.to_label AND n.id = e.to_id
       WHERE e.from_label = $1 AND e.from_id = $2 AND e.type = $3 AND e.to_label = $4`,
      [fromLabel, fromId, type, toLabel],
    );
    return rows.map((row) => row.body as GraphNode<T>);
  }

  async inbound<T extends NodeProps>(toLabel: string, toId: string, type: string, fromLabel: string) {
    const rows = await this.run<{ body: NodeProps }>(
      `SELECT n.body
       FROM helm_edges e
       JOIN helm_nodes n ON n.label = e.from_label AND n.id = e.from_id
       WHERE e.to_label = $1 AND e.to_id = $2 AND e.type = $3 AND e.from_label = $4`,
      [toLabel, toId, type, fromLabel],
    );
    return rows.map((row) => row.body as GraphNode<T>);
  }

  async relationProps(spec: Omit<RelationSpec, 'props'>) {
    const [row] = await this.run<{ props: NodeProps }>(
      `SELECT props FROM helm_edges
       WHERE from_label = $1 AND from_id = $2 AND type = $3 AND to_label = $4 AND to_id = $5`,
      [spec.fromLabel, spec.fromId, spec.type, spec.toLabel, spec.toId],
    );
    return row ? row.props : null;
  }

  async counts() {
    const labelRows = await this.run<{ label: string; count: string }>(
      'SELECT label, count(*)::text AS count FROM helm_nodes GROUP BY label',
    );
    const [edgeRow] = await this.run<{ count: string }>('SELECT count(*)::text AS count FROM helm_edges');

    const labels: Record<string, number> = {};
    let nodes = 0;
    for (const row of labelRows) {
      const value = Number(row.count);
      labels[row.label] = value;
      nodes += value;
    }
    return { nodes, relationships: Number(edgeRow?.count ?? 0), labels };
  }
}
