export function reference(type, id) {
	return {
    type: type,
    id: id,

    canonical: {},
    inFlight: [],
    buffer: []
  }
}

export function canonical(reference) {
  return reference.canonical;
}

export function inFlight(reference) {
  var snapshot = Object.create(reference.canonical);

  reference.inFlight.forEach(function(operation) {
    operation.apply(snapshot);
  });

  return snapshot;
}

export function buffer(reference) {
  var snapshot = inFlight(reference);

  reference.buffer.forEach(function(operation) {
    operation.apply(snapshot);
  });

  return snapshot;
}

