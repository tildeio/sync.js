/**
  Note: This file is implemented in an extremely naïve way. At the moment,
  it simply iterates through operations to find transformable or composable
  operations, and sync/reference simply replays the operations every time
  a snapshot is requested.

  Once the semantics are clearly defined, this should be changed to use
  a more optimized path for each operation (e.g. we could implement
  the composition of all SetProperty operations as a dictionary of
  property->op).
*/

import { buffer, canonical } from 'sync/reference';

export function applyToCanonical(reference, operation) {
  operation.apply(reference.canonical);

  reference.trigger('canonical:change', { detail: operation });

  var transformed, remove, inFlightPrime, bufferPrime, changedBuffer;
  var inFlight = reference.inFlight, buffer = reference.buffer;

  if (inFlight) {
    var result = inFlight.transform(operation);

    inFlightPrime = result[0];
    operation = result[1];

    reference.inFlight = inFlightPrime;
  }

  if (!operation.noop()) {
    if (buffer) {
      var result = buffer.transform(operation);

      bufferPrime = result[0];
      operation = result[1];
      changedBuffer = !operation.noop();

      reference.buffer = bufferPrime.noop() ? null : bufferPrime;
    } else {
      changedBuffer = true;
    }
  }

  if (changedBuffer) {
    reference.trigger('buffer:change', { detail: operation });
  }
}

function compose(op1, op2) {
  if (op1.isCompatible(op2)) {
    var composed = op1.compose(op2);
    if (typeof composed === 'object') { return composed; }
    if (op1.noop()) { return 'noop'; }
    return true;
  }

  return false;
}

export function applyToBuffer(reference, operation) {
  var buffer = reference.buffer;

  if (buffer) {
    buffer = reference.buffer = buffer.compose(operation);
  } else {
    buffer = reference.buffer = operation;
  }

  if (buffer.noop()) { reference.buffer = null; }

  reference.trigger('buffer:change', { detail: operation });
}
