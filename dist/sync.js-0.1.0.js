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

      if (ref.inFlight.length !== 0) {
        throw new Error("You can't save a reference's buffer if has un-acknowledged in-flight operations");
      }

      ref.inFlight = ref.buffer.slice();
      ref.buffer = [];

      ref.trigger('lifecycle:saving');
      // don't fire buffer:change because moving the buffer to in-flight
      // does not affect the buffer snapshot
    }

    function saved(ref) {
      ref.inFlight.forEach(function(op) {
        op.apply(ref.canonical);
      });

      ref.inFlight = [];

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
      var prev = canonical(reference);

      if (operation.test && !operation.test(prev)) {
        throw new Error("An operation you tried to apply (" + operation + ") had an unmet precondition");
      }

      operation.apply(reference.canonical);

      var transformed, remove;

      reference.inFlight.some(function(inFlightOp) {
        transformed = transform(operation, inFlightOp);
      });

      if (!transformed) {
        reference.buffer.some(function(bufferedOp, i) {
          transformed = transform(operation, bufferedOp);
          if (transformed === 'noop') { remove = i; }
        });

        if (remove !== undefined) {
          reference.buffer.splice(remove, 1);
        }
      }

      reference.trigger('canonical:change');

      if (!transformed) {
        reference.trigger('buffer:change');
      } else {
        reference.trigger('buffer:transformed');
      }
    }

    function transform(op1, op2) {
      if (op1.isCompatible(op2)) {
        op2.transform(op1);
        if (op2.noop()) { return 'noop'; }
        return true;
      }

      return false;
    }

    function compose(op1, op2) {
      if (op1.isCompatible(op2)) {
        var composed = op1.compose(op2);
        if (op1.noop()) { return 'noop'; }
        return true;
      }

      return false;
    }

    function applyToBuffer(reference, operation) {
      var prev = buffer(reference);

      if (operation.test && !operation.test(prev)) {
        throw new Error("An operation you tried to apply (" + operation + ") had an unmet precondition");
      }

      var composed, remove;

      reference.buffer.some(function(bufferedOp, i) {
        composed = compose(bufferedOp, operation);
        if (composed === 'noop') {
          remove = i;
          return true;
        }

        return !composed;
      });

      if (remove !== undefined) {
        reference.buffer.splice(remove, 1);
      } else if (!composed) {
        reference.buffer.push(operation);
      }

      reference.trigger('buffer:change');
    }

    __exports__.applyToCanonical = applyToCanonical;
    __exports__.applyToBuffer = applyToBuffer;
  });

define("sync/operations/set",
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      Operations have:

      * toString
      * apply(snapshot)
      * isCompatible(Operation)
      * transform(Operation)
      * compose(Operation)
      * noop()
      * test(snapshot)
    */

    function Add(item) {
      if (item === undefined) {
        throw new Error("Cannot add undefined to a Set");
      }

      this.item = item;
    }

    Add.prototype = {
      constructor: Add,

      toString: function() {
        return 'Add[' + this.item.toString() + ']';
      },

      apply: function(snapshot) {
        snapshot.add(this.item);
      },

      isCompatible: function(operation) {
        if (operation instanceof Add || operation instanceof Remove) {
          return this.item === operation.item;
        }
      },

      transform: function(prev) {
        if (prev instanceof Add) {
          // noop
          this.item = undefined;
        } else {
          // Is this possible? If I am adding, that must
          // mean that the current canonical does not contain
          // the item, so other actors cannot remove it.
        }
      },

      compose: function(next) {
        if (next instanceof Remove) {
          this.item = undefined;
        }
      },

      noop: function() {
        return this.item === undefined;
      },

      test: function(snapshot) {
        return !snapshot.has(this.item);
      }
    };

    function Remove(item) {
      if (item === undefined) {
        throw new Error("Cannot add undefined to a Set");
      }

      this.item = item;
    }

    Remove.prototype = {
      toString: function() {
        return 'Remove[' + this.item.toString() + ']';
      },

      apply: function(snapshot) {
        snapshot.remove(this.item);
      },

      isCompatible: function(operation) {
        if (operation instanceof Add || operation instanceof Remove) {
          return this.item === operation.item;
        }
      },

      transform: function(prev) {
        if (prev instanceof Remove) {
          // noop
          this.item = undefined;
        } else {
          // Is this possible? If I am removing, that must
          // mean that the current canonical does contain
          // the item, so other actors cannot add it again.
        }
      },

      compose: function(next) {
        if (next instanceof Remove) {
          this.item = undefined;
        }
      },

      noop: function() {
        return this.item === undefined;
      }
    }

    __exports__.Add = Add;
    __exports__.Remove = Remove;
  });

define("sync/operations/set_property",
  ["exports"],
  function(__exports__) {
    "use strict";
    function SetProperty(property, oldValue, newValue) {
      this.property = property;
      this.oldValue = oldValue;
      this.newValue = newValue;
    }

    /**
      Operations have:

      * toString
      * apply(snapshot)
      * isCompatible(Operation)
      * transform(Operation)
      * compose(Operation)
      * noop()
      * test(snapshot)
    */

    function debug() {
      console.debug.apply(console, arguments);
    }

    SetProperty.prototype = {
      constructor: SetProperty,

      toString: function() {
        return "Set[" + this.property + " " + this.oldValue + "->" + this.newValue + "]";
      },

      apply: function(hash) {
        debug('apply', this.toString(), 'to', hash);
        hash[this.property] = this.newValue;
      },

      isCompatible: function(other) {
        debug('checking compatibility of', this.toString(), 'with', other.toString());
        return other instanceof SetProperty && this.property === other.property;
      },

      transform: function(prev) {
        debug('transforming', this.toString(), 'against', prev.toString());
        this.oldValue = prev.newValue;
      },

      compose: function(next) {
        debug('composing', this.toString(), 'with', next.toString());
        this.newValue = next.newValue;
      },

      noop: function() {
        debug('checking', this.toString(), 'for noop');
        return this.oldValue === this.newValue;
      },

      test: function(current) {
        debug('testing precondition of', this.toString(), 'against snapshot', current);
        // The null precondition is satisfied with either null or undefined
        if (this.oldValue === null) {
          return current[this.property] == this.oldValue;
        } else {
          return current[this.property] === this.oldValue;
        }
      }
    };

    __exports__.SetProperty = SetProperty;
  });

define("sync/reference",
  ["rsvp/events","sync/modules/copy","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var EventTarget = __dependency1__.EventTarget;
    var copy = __dependency2__.copy;

    function Reference(type, id) {
      var canonical;

      if (arguments.length === 1) {
        // TODO: type is metadata, not special
        id = type;
        type = null;
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
      this.inFlight = [];
      this.buffer = [];
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
      var snapshot = copy(reference.canonical);

      reference.inFlight.forEach(function(operation) {
        operation.apply(snapshot);
      });

      return snapshot;
    }

    function buffer(reference) {
      var snapshot = inFlight(reference);

      reference.buffer.forEach(function(operation) {
        operation.apply(snapshot);
      });

      return snapshot;
    }

    function isDirty(reference) {
      return reference.inFlight.length !== 0 || reference.buffer.length !== 0;
    }

    function isSaving(reference) {
      return reference.inFlight.length !== 0;
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