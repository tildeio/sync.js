// operation
// - isNoop
// - test
// - apply

export function applyToCanonical(reference, operation) {
  operation.apply(reference.canonical);
}

export function applyToBuffer(reference, operation) {
  reference.buffer.push(operation);
}