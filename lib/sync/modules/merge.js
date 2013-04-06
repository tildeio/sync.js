export function merge(object, other) {
  for (var prop in other) {
    object[prop] = other[prop];
  }

  return object;
}
