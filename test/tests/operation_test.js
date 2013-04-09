import { expectCall } from "test_helpers";
import { applyToCanonical, applyToBuffer } from "sync/operation";
import { reference, canonical, buffer } from "sync/reference";

function Type() {}

var noop = function() { }, ref;

module("Operation", {
  setup: function() {
    ref = reference(Type, '1');

    var operation = {
      noop: function() { return false; },
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
