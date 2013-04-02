import { buffer } from 'sync/reference';

// operation
// - isNoop
// - test
// - apply

export function applyToCanonical(reference, operation) {
  operation.apply(reference.canonical);

  var transformed;

  reference.inFlight.forEach(function(inFlightOp) {
    transformed = transform(operation, inFlightOp);
  });

  if (!transformed) {
    reference.buffer.forEach(function(bufferedOp) {
      transformed = transform(operation, bufferedOp);
    });
  }

  reference.trigger('canonical:change');

  if (!transformed) {
    reference.trigger('buffer:change');
  } else {
    reference.trigger('buffer:transformed');
  }
}

function transform(op1, op2) {
  if (op1.isCompatible(op2)) {
    op2.transform(op1);
    return true;
  }

  return false;
}

export function applyToBuffer(reference, operation) {
  var prev = buffer(reference);

  if (operation.test && !operation.test(prev)) {
    throw new Error("An operation you tried to apply (" + operation + ") had an unmet precondition");
  }

  reference.buffer.push(operation);

  reference.trigger('buffer:change');
}