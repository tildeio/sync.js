define("sync",
  ["exports"],
  function(__exports__) {
    "use strict";
    function ohai() {}
    __exports__.ohai = ohai;
  });

define("sync/lifecycle",
  ["sync/operation","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var applyToCanonical = __dependency1__.applyToCanonical;

    function saving(ref) {
      if (ref.inFlight.length !== 0) {
        throw new Error("You can't save a reference's buffer if has un-acknowledged in-flight operations");
      }

      ref.inFlight = ref.buffer.slice();
      ref.buffer = [];
    }

    function saved(ref) {
      ref.inFlight.forEach(function(op) {
        op.apply(ref.canonical);
      });

      ref.inFlight = [];
    }
    __exports__.saving = saving;
    __exports__.saved = saved;
  });

define("sync/operation",
  ["exports"],
  function(__exports__) {
    "use strict";
    // operation
    // - isNoop
    // - test
    // - apply

    function applyToCanonical(reference, operation) {
      operation.apply(reference.canonical);

      reference.inFlight.forEach(function(inFlightOp) {
        transform(operation, inFlightOp);
      });
    }

    function transform(op1, op2) {
      if (op1.isCompatible(op2)) {
        op2.transform(op1);
      }
    }

    function applyToBuffer(reference, operation) {
      reference.buffer.push(operation);
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

      apply: function(hash) {
        hash[this.property] = this.newValue;
      },

      isCompatible: function(other) {
        return other instanceof SetProperty && this.property === other.property;
      },

      transform: function(prev) {
        this.oldValue = prev.newValue;
      }
    };
    __exports__.SetProperty = SetProperty;
  });

define("sync/reference",
  ["exports"],
  function(__exports__) {
    "use strict";
    function reference(type, id) {
    	return {
        type: type,
        id: id,

        canonical: {},
        inFlight: [],
        buffer: []
      }
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