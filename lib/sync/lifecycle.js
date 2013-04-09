import { applyToCanonical } from 'sync/operation';

export function saving(ref) {
  if (ref.buffer.length === 0) {
    throw new Error("You can't save a reference's buffer if the buffer is empty");
  }

  if (ref.awaitingAck) {
    throw new Error("You can't save a reference's buffer if its existing in-flight operation is unacknowledged");
  }

  ref.inFlight = ref.buffer;;
  ref.buffer = null;
  ref.awaitingAck = true;

  ref.trigger('lifecycle:saving');
  // don't fire buffer:change because moving the buffer to in-flight
  // does not affect the buffer snapshot
}

export function saved(ref) {
  ref.inFlight.apply(ref.canonical);

  ref.inFlight = null;
  ref.awaitingAck = false;

  ref.trigger('lifecycle:saved');
  ref.trigger('canonical:change');
}
