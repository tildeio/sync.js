import { Set } from "sync/modules/set";

export function SetChange(components) {
  components = components || {};
  this.add = components.add || new Set();
  this.remove = components.remove || new Set();
}

SetChange.prototype = {
  constructor: SetChange,

  toString: function() {
    var out = [];

    if (this.add.size > 0) {
      out.push("add: " + this.add.toString());
    }

    if (this.remove.size > 0) {
      out.push("remove: " + this.remove.toString());
    }

    return "SetChange[" + out.join(", ") + "]";
  },

  compose: function(other) {
    var change = new SetChange({
      add: this.add,
      remove: this.remove
    });

    other.add.forEach(function(item) {
      if (change.remove.has(item)) {
        change.remove.remove(item);
      } else {
        change.add.add(item);
      }
    });

    other.remove.forEach(function(item) {
      if (change.add.has(item)) {
        change.add.remove(item);
      } else {
        change.remove.add(item);
      }
    });

    return change;
  },

  transform: function(other) {
    var thisPrime = new SetChange({}),
        otherPrime = new SetChange({});

    var thisPrimeAdd = thisPrime.add,
        thisPrimeRemove = thisPrime.remove,
        otherPrimeAdd = otherPrime.add,
        otherPrimeRemove = otherPrime.remove;

    this.add.forEach(function(item) {
      if (!other.add.has(item)) {
        thisPrimeAdd.add(item);
      }
    });

    this.remove.forEach(function(item) {
      if (!other.remove.has(item)) {
        thisPrimeRemove.add(item);
      }
    });

    other.add.forEach(function(item) {
      if (!this.add.has(item)) {
        otherPrimeAdd.add(item);
      }
    }, this);

    other.remove.forEach(function(item) {
      if (!this.remove.has(item)) {
        otherPrimeRemove.add(item);
      }
    }, this);

    return [ thisPrime, otherPrime ];
  },

  apply: function(set) {
    this.add.forEach(function(item) {
      set.add(item);
    });

    this.remove.forEach(function(item) {
      set.remove(item);
    });
  },

  noop: function() {
    return this.add.size === 0 && this.remove.size === 0;
  }
};
