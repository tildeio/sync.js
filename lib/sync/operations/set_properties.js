import { merge } from 'sync/modules/merge';

export function SetProperties(components) {
  this.components = components;
}

SetProperties.prototype = {
  constructor: SetProperties,

  compose: function(other) {
    var components = merge({}, this.components);

    for (var prop in other.components) {
      var existing = components[prop],
          update = other.components[prop];

      if (existing) {
        // If reverting a property back to its original value
        if (existing[0] === update[1]) {
          delete components[prop];
        } else {
          existing[1] = update[1];
        }
      } else {
        components[prop] = update;
      }
    }

    return new SetProperties(components);
  },

  transform: function(other) {
    var thisPrime = {},
        otherPrime = {},
        current = this.components,
        prev = other.components,
        component;

    for (var prop in prev) {
      otherPrime[prop] = prev[prop].slice();
    }

    for (var prop in current) {
      if (component = otherPrime[prop]) {
        thisPrime[prop] = component;
        component[0] = component[1];
        component[1] = current[prop][1];
        delete otherPrime[prop];
      } else {
        thisPrime[prop] = current[prop].slice();
      }
    }

    return [ new SetProperties(thisPrime), new SetProperties(otherPrime) ];
  },

  noop: function() {
    for (var prop in this.components) {
      return false;
    }

    return true;
  }
}
