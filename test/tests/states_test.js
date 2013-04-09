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
  applyToBuffer(ref, { noop: noop });

  expectDirty(ref, true);
  expectSaving(ref, false);
});

test("After marking a reference as saving, it is both dirty and saving", function() {
  applyToBuffer(ref, { noop: noop });
  saving(ref);

  expectDirty(ref, true);
  expectSaving(ref, true);
});

test("After acknowledging a reference, it is no longer dirty or saving", function() {
  applyToBuffer(ref, {
    noop: noop,

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
    noop: noop,

    apply: function(snapshot) {
      snapshot.firstName = 'Tom';
    },

    compose: function(other) {
      return this;
    }
  });

  saving(ref);

  applyToBuffer(ref, { noop: noop });

  saved(ref);

  expectDirty(ref, true);
  expectSaving(ref, false);
});

test("If a buffered operation reverses itself, the reference is no longer dirty", function() {
  applyToBuffer(ref, {
    meta: 'op1',

    // applying the operation will make the reference dirty
    apply: noop,

    // check to make sure we're composing with op2
    compose: expectCall(function(op) {
      strictEqual(op.meta, 'op2', "Composing op1 with op2");
      this.nooped = true;
      return this;
    }),

    // once we've composed, report that the operation is now a noop
    noop: expectCall(function() {
      return this.nooped;
    }, 2)
  });

  applyToBuffer(ref, {
    meta: 'op2'
  });

  expectDirty(ref, false);
  expectSaving(ref, false);
});

test("If there are remaining operations, the reference is still dirty", function() {
  var count = 0;

  applyToBuffer(ref, {
    meta: 'op1',

    // applying the operation will make the reference dirty
    apply: noop,

    // check to make sure we're composing with op2
    compose: expectCall(function(op) {
      if (count === 0) {
        strictEqual(op.meta, 'op2', "Composing op1 with op2");
      } else if (count === 1) {
        strictEqual(op.meta, 'op3', "Composing op1 with op3");
      } else {
        ok(false, "Should not get here");
      }
      count++;

      return this;
    }, 2),

    // once we've composed twice, report that the operation is now a noop
    noop: expectCall(function() {
      return false;
    }, 3)
  });

  applyToBuffer(ref, {
    meta: 'op2',
    noop: noop
  });

  applyToBuffer(ref, {
    meta: 'op3',
    noop: noop
  });

  expectDirty(ref, true);
  expectSaving(ref, false);
});

test("If an update to canonical makes a buffered operation a no-op, it is no longer dirty", function() {
  var isNoop = function() { return true; };

  applyToBuffer(ref, {
    meta: 'op1',
    apply: noop,

    compose: function(op) {
      return this;
    },

    // Ensure that we're transforming op2
    transform: expectCall(function(op) {
      strictEqual(op.meta, 'op2');
      this.nooped = true;
      return [ { noop: isNoop }, this ];
    }),

    // Once transformation is done, assert that the operation is now a noop
    noop: expectCall(function() {
      debugger;
      return this.nooped;
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
