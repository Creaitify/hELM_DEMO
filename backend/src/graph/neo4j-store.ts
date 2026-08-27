import neo4j, { type Driver, type Session } from 'neo4j-driver';
import { env } from '../env.js';
import type { GraphNode, GraphStore, NodeProps, RelationSpec } from './store.js';

/**
 * Neo4j implementation of the decision graph.
 *
 * Labels and relationship types are validated against an allow-list before
 * they reach Cypher, because neither can be parameterised. Every other value
 * crosses as a bound parameter.
 *
 * Nested objects are stored as JSON strings under a `__json` prefix, since
 * Neo4j properties are scalars or arrays of scalars. Reads reverse the
 * encoding, so callers see the same object shape the memory store returns.
 */

export const NODE_LABELS = [
  'User',
  'Workspace',
  'Membership',
  'Connection',
  'AdAccount',
  'AccountGroup',
  'Scope',
  'Campaign',
  'Creative',
  'MetricDay',
  'Run',
  'Invocation',
  'Finding',
  'Evidence',
  'Recommendation',
  'Decision',
  'Artifact',
  'AuditEntry',
  'TimelineEvent',
  'OAuthGrant',
] as const;

export const RELATION_TYPES = [
  'MEMBER_OF',
  'HAS_CONNECTION',
  'PROVIDES',
  'IN_SCOPE',
  'GROUPS',
  'RUNS_CAMPAIGN',
  'HAS_CREATIVE',
  'MEASURED_ON',
  'REQUESTED_BY',
  'IN_WORKSPACE',
  'INVOKED',
  'PRODUCED',
  'SUPPORTED_BY',
  'SUGGESTS',
  'DECIDED',
  'ABOUT_CAMPAIGN',
  'ABOUT_ACCOUNT',
  'BUILT',
  'DERIVED_FROM',
  'GRANTED',
  'RECORDED',
] as const;

const LABEL_SET = new Set<string>(NODE_LABELS);
const RELATION_SET = new Set<string>(RELATION_TYPES);

function label(value: string): string {
  if (!LABEL_SET.has(value)) throw new Error(`Unknown graph label: ${value}`);
  return value;
}

function relation(value: string): string {
  if (!RELATION_SET.has(value)) throw new Error(`Unknown relationship type: ${value}`);
  return value;
}

const JSON_PREFIX = '__json_';

function encode(props: NodeProps): NodeProps {
  const out: NodeProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (value === null) {
      out[key] = null;
      continue;
    }
    const isScalar =
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
    const isScalarArray =
      Array.isArray(value) &&
      value.every((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean');
    if (isScalar || isScalarArray) {
      out[key] = value;
    } else {
      out[`${JSON_PREFIX}${key}`] = JSON.stringify(value);
    }
  }
  return out;
}

function decode(props: NodeProps): NodeProps {
  const out: NodeProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith(JSON_PREFIX)) {
      try {
        out[key.slice(JSON_PREFIX.length)] = JSON.parse(String(value));
      } catch {
        out[key.slice(JSON_PREFIX.length)] = null;
      }
    } else if (neo4j.isInt(value)) {
      out[key] = (value as { toNumber(): number }).toNumber();
    } else {
      out[key] = value;
    }
  }
  return out;
}

export class Neo4jGraphStore implements GraphStore {
  readonly kind = 'neo4j' as const;
  private driver: Driver | null = null;

  async connect() {
    if (this.driver) return;
    this.driver = neo4j.driver(
      env.neo4j.uri,
      neo4j.auth.basic(env.neo4j.username, env.neo4j.password),
      { disableLosslessIntegers: true, maxConnectionPoolSize: 32 },
    );
    await this.driver.getServerInfo();
    await this.ensureConstraints();
  }

  async close() {
    await this.driver?.close();
    this.driver = null;
  }

  private session(): Session {
    if (!this.driver) throw new Error('Neo4j driver is not connected');
    return this.driver.session({ database: env.neo4j.database });
  }

  private async run<T = unknown>(cypher: string, params: NodeProps = {}): Promise<T[]> {
    const session = this.session();
    try {
      const result = await session.run(cypher, params);
      return result.records.map((record) => record.toObject() as T);
    } finally {
      await session.close();
    }
  }

  /** One uniqueness constraint per label keeps upserts idempotent. */
  private async ensureConstraints() {
    for (const name of NODE_LABELS) {
      await this.run(
        `CREATE CONSTRAINT ${name.toLowerCase()}_id IF NOT EXISTS FOR (n:${name}) REQUIRE n.id IS UNIQUE`,
      );
    }
  }

  async verify() {
    try {
      const info = await this.driver?.getServerInfo();
      return { ok: true, detail: `Neo4j ${info?.protocolVersion ?? ''} at ${env.neo4j.uri}` };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : 'Neo4j unreachable' };
    }
  }

  /** No round trips to save here, so the loop is the honest implementation. */
  async upsertMany<T extends NodeProps>(
    label: string,
    rows: (T & { id: string })[],
    edges: RelationSpec[] = [],
  ): Promise<number> {
    for (const row of rows) await this.upsertNode(label, row.id, row);
    for (const edge of edges) await this.relate(edge);
    return rows.length;
  }

  async upsertNode<T extends NodeProps>(nodeLabel: string, id: string, props: T) {
    const rows = await this.run<{ n: { properties: NodeProps } }>(
      `MERGE (n:${label(nodeLabel)} { id: $id })
       SET n += $props
       RETURN n`,
      { id, props: encode({ ...props, id }) },
    );
    return decode(rows[0]?.n?.properties ?? { id }) as GraphNode<T>;
  }

  async getNode<T extends NodeProps>(nodeLabel: string, id: string) {
    const rows = await this.run<{ n: { properties: NodeProps } }>(
      `MATCH (n:${label(nodeLabel)} { id: $id }) RETURN n`,
      { id },
    );
    return rows.length ? (decode(rows[0].n.properties) as GraphNode<T>) : null;
  }

  async listNodes<T extends NodeProps>(nodeLabel: string, where?: NodeProps) {
    const rows = await this.run<{ n: { properties: NodeProps } }>(
      `MATCH (n:${label(nodeLabel)}) WHERE $where = {} OR all(k IN keys($where) WHERE n[k] = $where[k])
       RETURN n`,
      { where: encode(where ?? {}) },
    );
    return rows.map((row) => decode(row.n.properties) as GraphNode<T>);
  }

  async deleteNode(nodeLabel: string, id: string) {
    await this.run(`MATCH (n:${label(nodeLabel)} { id: $id }) DETACH DELETE n`, { id });
  }

  async relate(spec: RelationSpec) {
    await this.run(
      `MATCH (a:${label(spec.fromLabel)} { id: $fromId })
       MATCH (b:${label(spec.toLabel)} { id: $toId })
       MERGE (a)-[r:${relation(spec.type)}]->(b)
       SET r += $props`,
      { fromId: spec.fromId, toId: spec.toId, props: encode(spec.props ?? {}) },
    );
  }

  async unrelate(spec: Omit<RelationSpec, 'props'>) {
    await this.run(
      `MATCH (a:${label(spec.fromLabel)} { id: $fromId })-[r:${relation(spec.type)}]->(b:${label(spec.toLabel)} { id: $toId })
       DELETE r`,
      { fromId: spec.fromId, toId: spec.toId },
    );
  }

  async neighbours<T extends NodeProps>(fromLabel: string, fromId: string, type: string, toLabel: string) {
    const rows = await this.run<{ b: { properties: NodeProps } }>(
      `MATCH (a:${label(fromLabel)} { id: $fromId })-[:${relation(type)}]->(b:${label(toLabel)})
       RETURN b`,
      { fromId },
    );
    return rows.map((row) => decode(row.b.properties) as GraphNode<T>);
  }

  async inbound<T extends NodeProps>(toLabel: string, toId: string, type: string, fromLabel: string) {
    const rows = await this.run<{ a: { properties: NodeProps } }>(
      `MATCH (a:${label(fromLabel)})-[:${relation(type)}]->(b:${label(toLabel)} { id: $toId })
       RETURN a`,
      { toId },
    );
    return rows.map((row) => decode(row.a.properties) as GraphNode<T>);
  }

  async relationProps(spec: Omit<RelationSpec, 'props'>) {
    const rows = await this.run<{ r: { properties: NodeProps } }>(
      `MATCH (a:${label(spec.fromLabel)} { id: $fromId })-[r:${relation(spec.type)}]->(b:${label(spec.toLabel)} { id: $toId })
       RETURN r`,
      { fromId: spec.fromId, toId: spec.toId },
    );
    return rows.length ? decode(rows[0].r.properties) : null;
  }

  async counts() {
    const [nodeRow] = await this.run<{ c: number }>('MATCH (n) RETURN count(n) AS c');
    const [relRow] = await this.run<{ c: number }>('MATCH ()-[r]->() RETURN count(r) AS c');
    const labelRows = await this.run<{ label: string; c: number }>(
      'MATCH (n) UNWIND labels(n) AS label RETURN label, count(*) AS c',
    );
    const labels: Record<string, number> = {};
    for (const row of labelRows) labels[row.label] = Number(row.c);
    return { nodes: Number(nodeRow?.c ?? 0), relationships: Number(relRow?.c ?? 0), labels };
  }
}
