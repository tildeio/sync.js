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
  var prev = canonical(reference);

  if (operation.test && !operation.test(prev)) {
    throw new Error("An operation you tried to apply (" + operation + ") had an unmet precondition");
  }

  operation.apply(reference.canonical);

  var transformed, remove;

  var inFlight = [];
  reference.inFlight.forEach(function(inFlightOp) {
    var result = inFlightOp.transform(operation),
        inFlightPrime = result[0];

    operation = result[1];

    if (!inFlightPrime.noop()) {
      inFlight.push(inFlightPrime);
    }
  });
  reference.inFlight = inFlight;

  if (!operation.noop()) {
    var buffer = [];
    reference.buffer.forEach(function(bufferedOp) {
      var result = bufferedOp.transform(operation),
          bufferedPrime = result[0];

      operation = result[1];

      if (!bufferedPrime.noop()) {
        buffer.push(bufferedPrime);
      }
    });
    reference.buffer = buffer;
  }

  reference.trigger('canonical:change');

  if (!operation.noop()) {
    reference.trigger('buffer:change');
  } else {
    reference.trigger('buffer:transformed');
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
  var prev = buffer(reference);

  if (operation.test && !operation.test(prev)) {
    throw new Error("An operation you tried to apply (" + operation + ") had an unmet precondition");
  }

  var composed, remove, replace;

  reference.buffer.some(function(bufferedOp, i) {
    composed = compose(bufferedOp, operation);
    if (composed === 'noop') {
      remove = i;
      return true;
    } else if (typeof composed === 'object') {
      remove = i;
      replace = composed;
      return true;
    }

    return !composed;
  });

  if (replace !== undefined) {
    reference.buffer.splice(remove, 1, replace);
  } else if (remove !== undefined) {
    reference.buffer.splice(remove, 1);
  } else if (!composed) {
    reference.buffer.push(operation);
  }

  reference.trigger('buffer:change');
}
