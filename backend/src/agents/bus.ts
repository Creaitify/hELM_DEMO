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
    this.history.set(event.runId, bucket);
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
