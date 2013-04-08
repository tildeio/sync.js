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
      var prev = canonical(reference);

      if (operation.test && !operation.test(prev)) {
        throw new Error("An operation you tried to apply (" + operation + ") had an unmet precondition");
      }

      operation.apply(reference.canonical);

      var transformed, remove;

      var inFlight = [];
      reference.inFlight.forEach(function(inFlightOp) {
        var result = inFlightOp.transform(operation),
            inFlightPrime = result[0];

        operation = result[1];

        if (!inFlightPrime.noop()) {
          inFlight.push(inFlightPrime);
        }
      });
      reference.inFlight = inFlight;

      if (!operation.noop()) {
        var buffer = [];
        reference.buffer.forEach(function(bufferedOp) {
          var result = bufferedOp.transform(operation),
              bufferedPrime = result[0];

          operation = result[1];

          if (!bufferedPrime.noop()) {
            buffer.push(bufferedPrime);
          }
        });
        reference.buffer = buffer;
      }

      reference.trigger('canonical:change');

      if (!operation.noop()) {
        reference.trigger('buffer:change');
      } else {
        reference.trigger('buffer:transformed');
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
      var prev = buffer(reference);

      if (operation.test && !operation.test(prev)) {
        throw new Error("An operation you tried to apply (" + operation + ") had an unmet precondition");
      }

      var composed, remove, replace;

      reference.buffer.some(function(bufferedOp, i) {
        composed = compose(bufferedOp, operation);
        if (composed === 'noop') {
          remove = i;
          return true;
        } else if (typeof composed === 'object') {
          remove = i;
          replace = composed;
          return true;
        }

        return !composed;
      });

      if (replace !== undefined) {
        reference.buffer.splice(remove, 1, replace);
      } else if (remove !== undefined) {
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

    var noop = {
      noop: function() { return true; }
    };

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
        if (prev instanceof Add && this.item === prev.item) {
          return [ noop, noop ];
        } else {
          return [ this, prev ];
        }
      },

      /**
        An add followed by a remove or a remove followed
        by an add in the buffer is a noop.
      */
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
        if (prev instanceof Remove && this.item === prev.item) {
          return [ noop, noop ];
        } else {
          return [ this, prev ];
        }
      },

      /**
        An add followed by a remove or a remove followed
        by an add in the buffer is a noop.
      */
      compose: function(next) {
        if (next instanceof Add) {
          this.item = undefined;
        }
      },

      noop: function() {
        return this.item === undefined;
      },

      test: function(snapshot) {
        return snapshot.has(this.item);
      }
    }

    __exports__.Add = Add;
    __exports__.noop = noop;
    __exports__.Remove = Remove;
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
      }
    }

    __exports__.SetProperties = SetProperties;
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

        if (this.property === prev.property) {
          return [
            new SetProperty(this.property, prev.newValue, this.newValue),
            new SetProperty(this.property, null, null)
          ];
        } else {
          return [
            new SetProperty(this.property, this.oldValue, this.newValue),
            new SetProperty(prev.property, prev.oldValue, prev.newValue)
          ];
        }
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