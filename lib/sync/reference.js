export function reference(type, id) {
	return {
    type: type,
    id: id,

    canonical: {},
    buffer: []
  }
}

export function canonical(reference) {
  return reference.canonical;
}

export function buffer(reference) {
  var buffer = Object.create(reference.canonical);

  reference.buffer.forEach(function(operation) {
    operation.apply(buffer);
  });

  return buffer;
}