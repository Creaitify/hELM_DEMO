/**
 * The decision graph.
 *
 * HELM's model is a graph: workspaces own connections, connections provide ad
 * accounts, accounts run campaigns, campaigns carry creative, runs produce
 * findings, findings are supported by evidence and suggest recommendations,
 * and a human decision closes the loop. Neo4j is the store of record.
 *
 * A process-local implementation with identical semantics is used when no
 * NEO4J_URI is configured, so the product is fully demonstrable before any
 * database exists. Both implementations satisfy the same interface, so
 * repository code never branches on which one is live.
 */

export type NodeProps = Record<string, unknown>;

export type GraphNode<T extends NodeProps = NodeProps> = T & { id: string };

export type RelationSpec = {
  fromLabel: string;
  fromId: string;
  type: string;
  toLabel: string;
  toId: string;
  props?: NodeProps;
};

export interface GraphStore {
  readonly kind: 'neo4j' | 'memory';
  connect(): Promise<void>;
  close(): Promise<void>;
  verify(): Promise<{ ok: boolean; detail: string }>;

  upsertNode<T extends NodeProps>(label: string, id: string, props: T): Promise<GraphNode<T>>;
  getNode<T extends NodeProps>(label: string, id: string): Promise<GraphNode<T> | null>;
  listNodes<T extends NodeProps>(label: string, where?: NodeProps): Promise<GraphNode<T>[]>;
  deleteNode(label: string, id: string): Promise<void>;

  relate(spec: RelationSpec): Promise<void>;
  unrelate(spec: Omit<RelationSpec, 'props'>): Promise<void>;
  /** Nodes reachable from (fromLabel,fromId) over :type to toLabel. */
  neighbours<T extends NodeProps>(
    fromLabel: string,
    fromId: string,
    type: string,
    toLabel: string,
  ): Promise<GraphNode<T>[]>;
  /** Nodes that point at (toLabel,toId) over :type from fromLabel. */
  inbound<T extends NodeProps>(
    toLabel: string,
    toId: string,
    type: string,
    fromLabel: string,
  ): Promise<GraphNode<T>[]>;
  relationProps(spec: Omit<RelationSpec, 'props'>): Promise<NodeProps | null>;

  counts(): Promise<{ nodes: number; relationships: number; labels: Record<string, number> }>;
}

/* ----------------------------------------------------------------------- */

type MemoryRelation = { key: string; spec: RelationSpec; props: NodeProps };

/**
 * In-process graph. Values are stored as plain JSON-cloneable objects so the
 * behaviour matches what a driver round trip would return.
 */
export class MemoryGraphStore implements GraphStore {
  readonly kind = 'memory' as const;

  private nodes = new Map<string, Map<string, NodeProps>>();
  private relations = new Map<string, MemoryRelation>();

  async connect(): Promise<void> {
    /* nothing to open */
  }

  async close(): Promise<void> {
    /* nothing to close */
  }

  async verify() {
    return { ok: true, detail: 'In-process graph store (no NEO4J_URI configured)' };
  }

  private bucket(label: string): Map<string, NodeProps> {
    let map = this.nodes.get(label);
    if (!map) {
      map = new Map();
      this.nodes.set(label, map);
    }
    return map;
  }

  private static relationKey(spec: Omit<RelationSpec, 'props'>): string {
    return `${spec.fromLabel}:${spec.fromId}|${spec.type}|${spec.toLabel}:${spec.toId}`;
  }

  async upsertNode<T extends NodeProps>(label: string, id: string, props: T) {
    const bucket = this.bucket(label);
    const merged = { ...(bucket.get(id) ?? {}), ...props, id };
    bucket.set(id, merged);
    return structuredClone(merged) as GraphNode<T>;
  }

  async getNode<T extends NodeProps>(label: string, id: string) {
    const found = this.bucket(label).get(id);
    return found ? (structuredClone(found) as GraphNode<T>) : null;
  }

  async listNodes<T extends NodeProps>(label: string, where?: NodeProps) {
    const all = [...this.bucket(label).values()];
    const filtered = where
      ? all.filter((node) => Object.entries(where).every(([key, value]) => node[key] === value))
      : all;
    return structuredClone(filtered) as GraphNode<T>[];
  }

  async deleteNode(label: string, id: string) {
    this.bucket(label).delete(id);
    for (const [key, relation] of this.relations) {
      const { spec } = relation;
      const touches =
        (spec.fromLabel === label && spec.fromId === id) || (spec.toLabel === label && spec.toId === id);
      if (touches) this.relations.delete(key);
    }
  }

  async relate(spec: RelationSpec) {
    const key = MemoryGraphStore.relationKey(spec);
    this.relations.set(key, { key, spec: { ...spec }, props: { ...(spec.props ?? {}) } });
  }

  async unrelate(spec: Omit<RelationSpec, 'props'>) {
    this.relations.delete(MemoryGraphStore.relationKey(spec));
  }

  async neighbours<T extends NodeProps>(fromLabel: string, fromId: string, type: string, toLabel: string) {
    const out: GraphNode<T>[] = [];
    for (const { spec } of this.relations.values()) {
      if (spec.fromLabel !== fromLabel || spec.fromId !== fromId) continue;
      if (spec.type !== type || spec.toLabel !== toLabel) continue;
      const node = await this.getNode<T>(toLabel, spec.toId);
      if (node) out.push(node);
    }
    return out;
  }

  async inbound<T extends NodeProps>(toLabel: string, toId: string, type: string, fromLabel: string) {
    const out: GraphNode<T>[] = [];
    for (const { spec } of this.relations.values()) {
      if (spec.toLabel !== toLabel || spec.toId !== toId) continue;
      if (spec.type !== type || spec.fromLabel !== fromLabel) continue;
      const node = await this.getNode<T>(fromLabel, spec.fromId);
      if (node) out.push(node);
    }
    return out;
  }

  async relationProps(spec: Omit<RelationSpec, 'props'>) {
    const found = this.relations.get(MemoryGraphStore.relationKey(spec));
    return found ? structuredClone(found.props) : null;
  }

  async counts() {
    const labels: Record<string, number> = {};
    let nodes = 0;
    for (const [label, bucket] of this.nodes) {
      labels[label] = bucket.size;
      nodes += bucket.size;
    }
    return { nodes, relationships: this.relations.size, labels };
  }
}
