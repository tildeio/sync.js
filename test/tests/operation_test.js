import { applyToCanonical, applyToBuffer } from "sync/operation";
import { reference, canonical, buffer } from "sync/reference";

function Type() {}

var ref;

module("Operation", {
  setup: function() {
    ref = reference(Type, '1');

    var operation = {
      apply: function(hash) {
        hash.firstName = 'Tom';
      }
    }

    applyToCanonical(ref, operation);
  }
});

test("applyToCanonical(reference, operation) updates the canonical snapshot", function() {
  deepEqual(canonical(ref), { firstName: 'Tom' });
});

test("applied operations apply to the buffered snaphot", function() {
  deepEqual(buffer(ref), { firstName: 'Tom' });
});

test("applying operations to canonical and then buffer accumulates the operations", function() {
  var operation = {
    apply: function(hash) {
      hash.lastName = 'Dale';
    }
  };

  applyToBuffer(ref, operation);

  deepEqual(canonical(ref), { firstName: 'Tom' });
  deepEqual(buffer(ref), { firstName: 'Tom', lastName: 'Dale' });
});

test("applying an operation to canonical after buffer reapplies the buffer on top", function() {
  var operation = {
    apply: function(hash) {
      hash.lastName = 'Dale';
    }
  };

  applyToBuffer(ref, operation);

  operation = {
    apply: function(hash) {
      hash.firstName = 'Thomas'
    },

    // don't try to transform the existing operation
    isCompatible: function(op2) {
      return false;
    }
  };

  applyToCanonical(ref, operation);

  operation = {
    apply: function(hash) {
      hash.lastName = 'Dayl'
    },

    // don't try to transform the existing operation
    isCompatible: function() {
      return false;
    }
  };

  applyToCanonical(ref, operation);

  deepEqual(canonical(ref), { firstName: 'Thomas', lastName: 'Dayl' });
  deepEqual(buffer(ref), { firstName: 'Thomas', lastName: 'Dale' });
});

test("applyToBuffer throws if the operation does not pass its test", function() {
  var operation = {
    apply: function(hash) {
      hash.lastName = 'Dale';
    },

    test: function(prev) {
      return prev.lastName === 'Dayl';
    }
  };

  throws(function() {
    applyToBuffer(ref, operation);
  });
});