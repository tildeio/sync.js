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

define("sync/operation",
  ["sync/reference","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var buffer = __dependency1__.buffer;

    // operation
    // - isNoop
    // - test
    // - apply

    function applyToCanonical(reference, operation) {
      operation.apply(reference.canonical);

      var transformed;

      reference.inFlight.forEach(function(inFlightOp) {
        transformed = transform(operation, inFlightOp);
      });

      if (!transformed) {
        reference.buffer.forEach(function(bufferedOp) {
          transformed = transform(operation, bufferedOp);
        });
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
        return true;
      }

      return false;
    }

    function applyToBuffer(reference, operation) {
      var prev = buffer(reference);

      if (operation.test && !operation.test(prev)) {
        throw new Error("An operation you tried to apply (" + operation + ") had an unmet precondition");
      }

      reference.buffer.push(operation);

      reference.trigger('buffer:change');
    }
    __exports__.applyToCanonical = applyToCanonical;
    __exports__.applyToBuffer = applyToBuffer;
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

    SetProperty.prototype = {
      constructor: SetProperty,

      toString: function() {
        return "Set[" + this.property + " " + this.oldValue + "->" + this.newValue + "]";
      },

      apply: function(hash) {
        hash[this.property] = this.newValue;
      },

      isCompatible: function(other) {
        return other instanceof SetProperty && this.property === other.property;
      },

      transform: function(prev) {
        this.oldValue = prev.newValue;
      },

      test: function(current) {
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
  ["rsvp/events","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var EventTarget = __dependency1__.EventTarget;

    function Reference(type, id) {
      this.type = type;
      this.id = id;

      this.canonical = {};
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
      var snapshot = Object.create(reference.canonical);

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
    __exports__.reference = reference;
    __exports__.canonical = canonical;
    __exports__.inFlight = inFlight;
    __exports__.buffer = buffer;
  });
window.sync = requireModule("sync");
})(window);