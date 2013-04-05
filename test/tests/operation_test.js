import { expectCall } from "test_helpers";
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
    },

    // don't try to transform the existing operation
    isCompatible: function(op2) {
      return false;
    }
  };

  applyToBuffer(ref, operation);

  operation = {
    apply: function(hash) {
      hash.firstName = 'Thomas'
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

test("An operation can return an object from compose to replace itself with that object", function() {
  applyToBuffer(ref, {
    meta: 'op1',

    apply: function(snapshot) {
      snapshot.firstName = 'Tom'
    },

    isCompatible: expectCall(function(op) {
      return op.meta === 'op2';
    }),

    compose: expectCall(function(op) {
      return op;
    }),

    noop: function() {
      return false;
    }
  });

  deepEqual(buffer(ref), { firstName: 'Tom' }, "The operation is applied");

  applyToBuffer(ref, {
    meta: 'op2',

    apply: function(snapshot) {
      snapshot.firstName = 'Thomas';
    }
  });

  deepEqual(buffer(ref), { firstName: 'Thomas' }, "The composed operation was applied");
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
