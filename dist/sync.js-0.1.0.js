(function(globals) {
var define, requireModule;

(function() {
  var registry = {}, seen = {};

  define = function(name, deps, callback) {
    registry[name] = { deps: deps, callback: callback };
  };

  requireModule = function(name) {
    if (seen[name]) { return seen[name]; }
    seen[name] = {};

    if (!registry[name]) {
      throw new Error("Could not find module " + name);
    }

    var mod = registry[name],
        deps = mod.deps,
        callback = mod.callback,
        reified = [],
        exports;

    for (var i=0, l=deps.length; i<l; i++) {
      if (deps[i] === 'exports') {
        reified.push(exports = {});
      } else {
        reified.push(requireModule(deps[i]));
      }
    }

    var value = callback.apply(this, reified);
    return seen[name] = exports || value;
  };
})();

define("sync",
  [],
  function() {
    "use strict";

  });

define("sync/lifecycle",
  ["sync/operation","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var applyToCanonical = __dependency1__.applyToCanonical;

    function saving(ref) {
      if (ref.buffer.length === 0) {
        throw new Error("You can't save a reference's buffer if the buffer is empty");
      }

      if (ref.awaitingAck) {
        throw new Error("You can't save a reference's buffer if its existing in-flight operation is unacknowledged");
      }

      ref.inFlight = ref.buffer;;
      ref.buffer = null;
      ref.awaitingAck = true;

      ref.trigger('lifecycle:saving');
      // don't fire buffer:change because moving the buffer to in-flight
      // does not affect the buffer snapshot
    }

    function saved(ref) {
      ref.inFlight.apply(ref.canonical);

      ref.inFlight = null;
      ref.awaitingAck = false;

      ref.trigger('lifecycle:saved');
      ref.trigger('canonical:change');
    }

    __exports__.saving = saving;
    __exports__.saved = saved;
  });

define("sync/modules/copy",
  ["exports"],
  function(__exports__) {
    "use strict";
    // TODO: Better copying strategy
    function copy(object) {
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

    __exports__.copy = copy;
  });

define("sync/modules/merge",
  ["exports"],
  function(__exports__) {
    "use strict";
    function merge(object, other) {
      for (var prop in other) {
        object[prop] = other[prop];
      }

      return object;
    }

    __exports__.merge = merge;
  });

define("sync/modules/set",
  ["exports"],
  function(__exports__) {
    "use strict";
    // TODO: Extract or use an existing library

    function Set(prev) {
      var list = [];

      if (prev) {
        prev.forEach(function(item) {
          list.push(item);
        });
      }

      this.size = list.length;

      this.toString = function() {
        return "{ " + list.join(", ") + " }";
      };

      this.add = function(object) {
        if (this.has(object)) { return; }
        list.push(object);
        this.size++;
      };

      this.remove = function(object) {
        var index = indexOf(list, object);
        if (index !== -1) {
          list.splice(index, 1);
          this.size--;
        }
      };

      this.has = function(object) {
        return indexOf(list, object) !== -1;
      };

      this.clear = function() {
        list = [];
        this.size = 0;
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

    __exports__.Set = Set;
  });

define("sync/operation",
  ["sync/reference","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var buffer = __dependency1__.buffer;
    var canonical = __dependency1__.canonical;
    /**
      Note: This file is implemented in an extremely naïve way. At the moment,
      it simply iterates through operations to find transformable or composable
      operations, and sync/reference simply replays the operations every time
      a snapshot is requested.

      Once the semantics are clearly defined, this should be changed to use
      a more optimized path for each operation (e.g. we could implement
      the composition of all SetProperty operations as a dictionary of
      property->op).
    */


    function applyToCanonical(reference, operation) {
      operation.apply(reference.canonical);

      reference.trigger('canonical:change', { detail: operation });

      var transformed, remove, inFlightPrime, bufferPrime, changedBuffer;
      var inFlight = reference.inFlight, buffer = reference.buffer;

      if (inFlight) {
        var result = inFlight.transform(operation);

        inFlightPrime = result[0];
        operation = result[1];

        reference.inFlight = inFlightPrime;
      }

      if (!operation.noop()) {
        if (buffer) {
          var result = buffer.transform(operation);

          bufferPrime = result[0];
          operation = result[1];
          changedBuffer = !operation.noop();

          reference.buffer = bufferPrime.noop() ? null : bufferPrime;
        } else {
          changedBuffer = true;
        }
      }

      if (changedBuffer) {
        reference.trigger('buffer:change', { detail: operation });
      }
    }

    function compose(op1, op2) {
      if (op1.isCompatible(op2)) {
        var composed = op1.compose(op2);
        if (typeof composed === 'object') { return composed; }
        if (op1.noop()) { return 'noop'; }
        return true;
      }

      return false;
    }

    function applyToBuffer(reference, operation) {
      var buffer = reference.buffer;

      if (buffer) {
        buffer = reference.buffer = buffer.compose(operation);
      } else {
        buffer = reference.buffer = operation;
      }

      if (buffer.noop()) { reference.buffer = null; }

      reference.trigger('buffer:change', { detail: operation });
    }

    __exports__.applyToCanonical = applyToCanonical;
    __exports__.applyToBuffer = applyToBuffer;
  });

define("sync/operations/set_change",
  ["sync/modules/set","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var Set = __dependency1__.Set;

    function SetChange(components) {
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

    __exports__.SetChange = SetChange;
  });

define("sync/operations/set_properties",
  ["sync/modules/merge","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var merge = __dependency1__.merge;

    function SetProperties(components) {
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

      apply: function(hash) {
        var components = this.components;

        for (var prop in components) {
          hash[prop] = components[prop][1];
        }
      },

      noop: function() {
        for (var prop in this.components) {
          return false;
        }

        return true;
      }
    }

    __exports__.SetProperties = SetProperties;
  });

define("sync/reference",
  ["rsvp/events","sync/modules/copy","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var EventTarget = __dependency1__.EventTarget;
    var copy = __dependency2__.copy;

    function Reference(type, id) {
      var canonical;

      if (id === undefined) {
        // TODO: type is metadata, not special
        id = type;
        type = null;
        canonical = {};
      } else if (typeof id !== 'string' && typeof id !== 'number') {
        canonical = id;
        id = type;
        type = null;
      } else {
        canonical = {};
      }

      this.type = type;
      this.id = id;

      // The starting representation of the document
      this.canonical = canonical;
      this.inFlight = null;
      this.buffer = null;
      this.awaitingAck = false;
    }

    Reference.prototype = {
      constructor: Reference
    };

    EventTarget.mixin(Reference.prototype);

    function reference(type, id) {
      return new Reference(type, id);
    }

    function canonical(reference) {
      return reference.canonical;
    }

    function inFlight(reference) {
      var snapshot = copy(reference.canonical),
          inFlight = reference.inFlight;

      if (inFlight) { inFlight.apply(snapshot); }

      return snapshot;
    }

    function buffer(reference) {
      var snapshot = inFlight(reference),
          buffer = reference.buffer;

      if (buffer) { buffer.apply(snapshot); }

      return snapshot;
    }

    function isDirty(reference) {
      return !!(reference.awaitingAck || reference.buffer);
    }

    function isSaving(reference) {
      return !!reference.awaitingAck;
    }

    __exports__.reference = reference;
    __exports__.canonical = canonical;
    __exports__.inFlight = inFlight;
    __exports__.buffer = buffer;
    __exports__.isDirty = isDirty;
    __exports__.isSaving = isSaving;
  });
window.sync = requireModule("sync");
})(window);