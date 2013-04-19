import { expectCall } from "test_helpers";
import { applyToCanonical, applyToBuffer } from "sync/operation";
import { reference, canonical, buffer, canonicalOp } from "sync/reference";

function Type() {}

var noop = function() { }, ref, operation, composedOp;

module("Operation", {
  setup: function() {
    ref = reference(Type, '1');

    composedOp = {
      noop: function() { return false; },
      compose: function() { return this; }
    };

    var noopOp = {
      noop: function() { return true; }
    };

    operation = {
      noop: function() { return false; },
      apply: function(hash) {
        hash.firstName = 'Tom';
      },

      compose: function(other) {
        if (other.meta === 'nooper') { return noopOp; }
        return composedOp;
      }
    }

    applyToCanonical(ref, operation);
  }
});

test("applyToCanonical(reference, operation) updates the canonical snapshot", function() {
  deepEqual(canonical(ref), { firstName: 'Tom' });
});

test("applyToCanonical(reference, operation) initializes the canonical operation", function() {
  deepEqual(canonicalOp(ref), operation, "The first operation becomes the canonical op");
});

test("applyToCanonical(reference, operation) updates an existing canonical operation", function() {
  applyToCanonical(ref, {
    meta: 'op2',
    noop: function() { return false; },
    apply: function() {}
  });
  deepEqual(canonicalOp(ref), composedOp, "The composed op becomes the canonical op");
});

test("applyToCanonical(reference, operation) nulls out the canonical operation when it's a noop", function() {
  applyToCanonical(ref, {
    meta: 'nooper',
    noop: function() { return false; },
    apply: function() {}
  });
  deepEqual(canonicalOp(ref), null, "The composed op becomes null");
});

test("applied operations apply to the buffered snaphot", function() {
  deepEqual(buffer(ref), { firstName: 'Tom' });
});

test("applying operations to canonical and then buffer accumulates the operations", function() {
  var operation = {
    noop: noop,

    apply: function(hash) {
      hash.lastName = 'Dale';
    }
  };

  applyToBuffer(ref, operation);

  deepEqual(canonical(ref), { firstName: 'Tom' });
  deepEqual(buffer(ref), { firstName: 'Tom', lastName: 'Dale' });
});

test("applying an operation to canonical after buffer reapplies the buffer on top", function() {
  var noop = function() { return false; };
  var isNoop = function() { return true; };

  var operation = {
    meta: 'op1',

    noop: noop,

    apply: function(hash) {
      hash.lastName = 'Dale';
    },

    compose: function(other) {
      return this;
    },

    transform: function(prev) {
      return [ this, { noop: isNoop } ];
    }
  };

  applyToBuffer(ref, operation);

  operation = {
    meta: 'op2',

    noop: noop,

    apply: function(hash) {
      hash.firstName = 'Thomas'
    },

    transform: function(prev) {
      return [ this, { noop: isNoop } ];
    }
  };

  applyToCanonical(ref, operation);

  operation = {
    meta: 'op3',

    noop: noop,

    apply: function(hash) {
      hash.lastName = 'Dayl'
    }
  };

  applyToCanonical(ref, operation);

  deepEqual(canonical(ref), { firstName: 'Thomas', lastName: 'Dayl' });
  deepEqual(buffer(ref), { firstName: 'Thomas', lastName: 'Dale' });
});

test("An operation can return an object from compose to replace itself with that object", function() {
  applyToBuffer(ref, {
    meta: 'op1',

    noop: noop,

    apply: function(snapshot) {
      snapshot.firstName = 'Tom'
    },

    compose: expectCall(function(op) {
      strictEqual(op.meta, 'op2', "Composing with op2");
      return op;
    })
  });

  deepEqual(buffer(ref), { firstName: 'Tom' }, "The operation is applied");

  applyToBuffer(ref, {
    meta: 'op2',

    noop: noop,

    apply: function(snapshot) {
      snapshot.firstName = 'Thomas';
    }
  });

  deepEqual(buffer(ref), { firstName: 'Thomas' }, "The composed operation was applied");
});
