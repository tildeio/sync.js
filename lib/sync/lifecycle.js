import { applyToCanonical } from 'sync/operation';

export function saving(ref) {
  if (ref.buffer.length === 0) {
    throw new Error("You can't save a reference's buffer if the buffer is empty");
  }

  if (ref.inFlight.length !== 0) {
    throw new Error("You can't save a reference's buffer if has un-acknowledged in-flight operations");
  }

  ref.inFlight = ref.buffer.slice();
  ref.buffer = [];

  ref.trigger('lifecycle:saving');
  // don't fire buffer:change because moving the buffer to in-flight
  // does not affect the buffer snapshot
}

export function saved(ref) {
  ref.inFlight.forEach(function(op) {
    op.apply(ref.canonical);
  });

  ref.inFlight = [];

  ref.trigger('lifecycle:saved');
  ref.trigger('canonical:change');
}