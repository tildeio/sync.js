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
}

export function saved(ref) {
  ref.inFlight.forEach(function(op) {
    op.apply(ref.canonical);
  });

  ref.inFlight = [];
}