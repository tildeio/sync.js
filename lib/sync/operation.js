// operation
// - isNoop
// - test
// - apply

export function applyToCanonical(reference, operation) {
  operation.apply(reference.canonical);

  reference.inFlight.forEach(function(inFlightOp) {
    transform(operation, inFlightOp);
  });
}

function transform(op1, op2) {
  if (op1.isCompatible(op2)) {
    op2.transform(op1);
  }
}

export function applyToBuffer(reference, operation) {
  reference.buffer.push(operation);
}