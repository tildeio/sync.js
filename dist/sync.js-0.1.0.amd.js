define("sync",
  ["exports"],
  function(__exports__) {
    "use strict";
    function ohai() {}
    __exports__.ohai = ohai;
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
    }

    function applyToBuffer(reference, operation) {
      reference.buffer.push(operation);
    }
    __exports__.applyToCanonical = applyToCanonical;
    __exports__.applyToBuffer = applyToBuffer;
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
        buffer: []
      }
    }

    function canonical(reference) {
      return reference.canonical;
    }

    function buffer(reference) {
      var buffer = Object.create(reference.canonical);

      reference.buffer.forEach(function(operation) {
        operation.apply(buffer);
      });

      return buffer;
    }
    __exports__.reference = reference;
    __exports__.canonical = canonical;
    __exports__.buffer = buffer;
  });