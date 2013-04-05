// TODO: Better copying strategy
export function copy(object) {
  var constructor = object.constructor;
  if (constructor === Object) {
    return Object.create(object);
  } else {
    // this is assuming that new Constructor(obj) returns
    // a copy, which is true of Set.
    var clone = Object.create(constructor.prototype);
    constructor.call(clone, object);
    return clone;
  }
}
