import { EventEmitter } from 'node:events';
import type { FleetEvent } from '../domain/types.js';

/**
 * Fleet event bus.
 *
 * The orchestrator emits every stage change, agent start, review verdict and
 * graph write here. HTTP subscribers replay the buffered history for a run so
 * a client that connects mid-run still sees the whole story, then follow live.
 */

const HISTORY_LIMIT = 400;

/**
 * How many runs keep their event history in memory.
 *
 * Each run's bucket was capped, but the map holding them was not, so a
 * long-lived process accumulated one bucket per run it had ever seen. `forget`
 * existed and nothing called it.
 *
 * Evicting on completion would be wrong — a client opening a run that finished
 * a minute ago still replays its history — so the eviction is by age instead.
 * A run older than this many runs is durable in the graph, which is where a
 * reader gets it from anyway.
 */
const RUN_LIMIT = 60;

class FleetBus {
  private emitter = new EventEmitter();
  private history = new Map<string, FleetEvent[]>();

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  emit(event: FleetEvent) {
    const bucket = this.history.get(event.runId) ?? [];
    bucket.push(event);
    if (bucket.length > HISTORY_LIMIT) bucket.splice(0, bucket.length - HISTORY_LIMIT);

    // Re-inserting moves this run to the end of the map's insertion order, so
    // the first key is always the least recently active run.
    this.history.delete(event.runId);
    this.history.set(event.runId, bucket);
    while (this.history.size > RUN_LIMIT) {
      const oldest = this.history.keys().next().value;
      if (oldest === undefined) break;
      this.history.delete(oldest);
    }
    this.emitter.emit('event', event);
    this.emitter.emit(`run:${event.runId}`, event);
  }

  replay(runId: string): FleetEvent[] {
    return [...(this.history.get(runId) ?? [])];
  }

  /** Subscribe to one run. Returns the unsubscribe function. */
  subscribe(runId: string, listener: (event: FleetEvent) => void): () => void {
    this.emitter.on(`run:${runId}`, listener);
    return () => this.emitter.off(`run:${runId}`, listener);
  }

  /** Subscribe to every run in the process — used by the operator console. */
  subscribeAll(listener: (event: FleetEvent) => void): () => void {
    this.emitter.on('event', listener);
    return () => this.emitter.off('event', listener);
  }

  forget(runId: string) {
    this.history.delete(runId);
  }
}

export const fleetBus = new FleetBus();
