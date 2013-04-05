// TODO: Extract or use an existing library

export function Set(prev) {
  var list = [];

  if (prev) {
    prev.forEach(function(item) {
      list.push(item);
    });
  }

  this.add = function(object) {
    if (this.has(list, object)) { return; }
    list.push(object);
  };

  this.remove = function(object) {
    var index = indexOf(list, object);
    if (index !== -1) { list.splice(index, 1); }
  };

  this.has = function(object) {
    return indexOf(list, object) !== -1;
  };

  this.clear = function() {
    list = [];
  };

  // if we didn't need support for iteration, we could
  // get away with using the native Set if available
  this.forEach = function(callback, binding) {
    for (var i=0, l=list.length; i<l; i++) {
      if (binding) { callback.call(binding, list[i]); }
      else { callback(list[i]); }
    }
  };
}

function indexOf(list, object) {
  for (var i=0, l=list.length; i<l; i++) {
    if (list[i] === object) { return i; }
  }

  return -1;
}
