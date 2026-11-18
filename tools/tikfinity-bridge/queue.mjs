import { randomUUID } from 'node:crypto';
export const MAX_EVENT_AGE_MS = 120000;
export const MAX_CONTEXT_AGE_MS = 15000;
export const QUEUE_CAPACITY = 500;
export const BATCH_SIZE = 25;
export class QueueOverflowError extends Error {
  constructor() { super('QUEUE_FULL_STOPPING_INTAKE_NO_SILENT_LOSS'); this.name = 'QueueOverflowError'; }
}
export class ReceiptQueue {
  constructor({ capacity = QUEUE_CAPACITY, log = () => {} } = {}) { this.capacity = capacity; this.log = log; this.items = []; }
  get size() { return this.items.length; }
  add(event, context, receivedAtMs = Date.now(), receiptId = randomUUID()) {
    if (this.items.length >= this.capacity) throw new QueueOverflowError();
    const item = Object.freeze({ streamId: context.streamId, receipt: Object.freeze({ receiptId, receivedAtMs, event: Object.freeze({ ...event, occurrenceId: context.occurrenceId }) }) });
    this.items.push(item);
    return item.receipt;
  }
  prune(current, now = Date.now()) {
    let stale = 0, advanced = 0;
    this.items = this.items.filter(item => {
      if (now - item.receipt.receivedAtMs > MAX_EVENT_AGE_MS) { stale++; return false; }
      if (current && (item.streamId !== current.streamId || item.receipt.event.roomId !== current.roomId || item.receipt.event.occurrenceId !== current.occurrenceId)) { advanced++; return false; }
      return true;
    });
    if (stale) this.log('ERROR', 'STALE_EVENTS_DROPPED_OVER_TWO_MINUTES', { count: stale });
    if (advanced) this.log('WARN', 'OLD_STREAM_OR_OCCURRENCE_EVENTS_DROPPED', { count: advanced });
    return { stale, advanced };
  }
  batch(current, testMode, now = Date.now()) {
    this.prune(current, now);
    const selected = this.items.slice(0, BATCH_SIZE);
    return selected.length ? { streamId: selected[0].streamId, events: selected.map(item => item.receipt), testMode } : null;
  }
  acknowledge(batch) {
    const ids = new Set(batch.events.map(receipt => receipt.receiptId));
    this.items = this.items.filter(item => !ids.has(item.receipt.receiptId));
  }
  clear(code) {
    if (this.items.length) this.log('ERROR', code, { count: this.items.length });
    this.items = [];
  }
}
