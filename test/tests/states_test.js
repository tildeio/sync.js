import { expectCall } from "test_helpers";
import { reference, isDirty, isSaving } from "sync/reference";
import { applyToCanonical, applyToBuffer } from "sync/operation";
import { saving, saved } from "sync/lifecycle";

var noop = function() {}, ref;

module("States", {
  setup: function() {
    ref = reference(1);
  }
});

function expectDirty(ref, expected) {
  var actual = isDirty(ref);
  QUnit.push(actual === expected, actual, expected, "isDirty(reference) should return " + expected);
}

function expectSaving(ref, expected) {
  var actual = isSaving(ref);
  QUnit.push(actual === expected, actual, expected, "isSaving(reference) should return " + expected);
}

test("Initially, a reference is neither dirty nor saving", function() {
  expectDirty(ref, false);
  expectSaving(ref, false);
});

test("After making a change to canonical, a reference is still neither dirty nor saving", function() {
  applyToCanonical(ref, {
    noop: noop,
    apply: expectCall(function(snapshot) {
      deepEqual(snapshot, {}, "The canonical is empty");
    })
  });

  expectDirty(ref, false);
  expectSaving(ref, false);
});

test("After making a change to the buffer, a reference is dirty", function() {
  // The operation's `apply` method is only called if the buffered snapshot is updated
  applyToBuffer(ref, {});

  expectDirty(ref, true);
  expectSaving(ref, false);
});

test("After marking a reference as saving, it is both dirty and saving", function() {
  applyToBuffer(ref, {});
  saving(ref);

  expectDirty(ref, true);
  expectSaving(ref, true);
});

test("After acknowledging a reference, it is no longer dirty or saving", function() {
  applyToBuffer(ref, {
    // apply is called in order to update the canonical once `saved` is called
    apply: function(snapshot) {
      deepEqual(snapshot, {}, "The snapshot is still empty");
    }
  });

  saving(ref);
  saved(ref);

  expectDirty(ref, false);
  expectSaving(ref, false);
});

test("Acknowledging a record as saved leaves it dirty if there were intervening changes to the buffer", function() {
  applyToBuffer(ref, {
    apply: function(snapshot) {
      snapshot.firstName = 'Tom';
    }
  });

  saving(ref);

  applyToBuffer(ref, {
    test: expectCall(function(snapshot) {
      deepEqual(snapshot, { firstName: 'Tom' }, "The operation is applied on top of the first operation");
      return true;
    })
  });

  saved(ref);

  expectDirty(ref, true);
  expectSaving(ref, false);
});

test("If a buffered operation reverses itself, the reference is no longer dirty", function() {
  applyToBuffer(ref, {
    meta: 'op1',

    // applying the operation will make the reference dirty
    apply: noop,

    // say we're compatible so we have an opportunity to compose with the second operation
    isCompatible: expectCall(function() {
      return true;
    }),

    // check to make sure we're composing with op2
    compose: expectCall(function(op) {
      strictEqual(op.meta, 'op2', "Composing op1 with op2");
    }),

    // once we've composed, report that the operation is now a noop
    noop: expectCall(function() {
      return true;
    })
  });

  applyToBuffer(ref, {
    meta: 'op2'
  });

  expectDirty(ref, false);
  expectSaving(ref, false);
});

test("If there are remaining operations, the reference is still dirty", function() {
  applyToBuffer(ref, {
    meta: 'op1',

    // applying the operation will make the reference dirty
    apply: noop,

    // say we're compatible so we have an opportunity to compose with the second operation
    isCompatible: expectCall(function(op) {
      return op.meta === 'op3';
    }, 2),

    // check to make sure we're composing with op2
    compose: expectCall(function(op) {
      strictEqual(op.meta, 'op3', "Composing op1 with op2");
    }),

    // once we've composed, report that the operation is now a noop
    noop: expectCall(function() {
      return true;
    })
  });

  applyToBuffer(ref, {
    meta: 'op2',

    apply: expectCall()
  });

  applyToBuffer(ref, {
    meta: 'op3'
  });

  expectDirty(ref, true);
  expectSaving(ref, false);
});

test("If an update to canonical makes a buffered operation a no-op, it is no longer dirty", function() {
  var isNoop = function() { return true; };

  applyToBuffer(ref, {
    meta: 'op1',
    apply: noop,

    // Ensure that we're transforming op2
    transform: expectCall(function(op) {
      strictEqual(op.meta, 'op2');
      return [ this, { noop: isNoop } ];
    }),

    // Once transformation is done, assert that the operation is now a noop
    noop: expectCall(function() {
      return true;
    })
  });

  // This should make the buffered operation a noop
  applyToCanonical(ref, {
    meta: 'op2',
    apply: noop,
    noop: noop
  });

  // Since op1, which was applied to the buffer, became a noop, the reference is no
  // longer dirty.
  expectDirty(ref, false);
  expectSaving(ref, false);
});

test("TODO: If an update to canonical makes an in-flightoperation a no-op, it ...", function() {
  expect(0);
});
