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

  reference.inFlight.some(function(inFlightOp) {
    transformed = transform(operation, inFlightOp);
  });

  if (!transformed) {
    reference.buffer.some(function(bufferedOp, i) {
      transformed = transform(operation, bufferedOp);
      if (transformed === 'noop') { remove = i; }
    });

    if (remove !== undefined) {
      reference.buffer.splice(remove, 1);
    }
  }

  reference.trigger('canonical:change');

  if (!transformed) {
    reference.trigger('buffer:change');
  } else {
    reference.trigger('buffer:transformed');
  }
}

function transform(op1, op2) {
  if (op2.isCompatible(op1)) {
    op2.transform(op1);
    if (op2.noop()) { return 'noop'; }
    return true;
  }

  return false;
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
