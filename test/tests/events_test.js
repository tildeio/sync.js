import { expectCall } from "test_helpers";
import { reference } from "sync/reference";
import { applyToCanonical, applyToBuffer } from "sync/operation";
import { saving, saved } from "sync/lifecycle";

var ref, canonicalChanged, bufferChanged, inFlightTransformed, bufferTransformed, referenceSaving, referenceSaved;

var events;

function resetEvents() {
  events = {
    'canonical:change': 0,
    'buffer:change': 0,
    'inflight:transformed': 0,
    'buffer:transformed': 0,
    'lifecycle:saving': 0,
    'lifecycle:saved': 0
  }
}

function firedEvents() {
  var expected = {};
  for (var i=0, l=arguments.length; i<l; i++) {
    expected[arguments[i]] = 1;
  }

  for (var event in events) {
    if (event in expected) {
      QUnit.push(events[event] === 1, events[event], 1, "Expected " + event + " to be fired once");
    } else {
      QUnit.push(events[event] === 0, events[event], 0, "Expected " + event + " not to be fired");
    }
  }
}

var firedEvent = firedEvents;

module("Triggered Events", {
  setup: function() {
    ref = reference(1);

    resetEvents();

    ref.on('canonical:change', function() {
      events['canonical:change']++;
    });

    ref.on('buffer:change', function() {
      events['buffer:change']++;
    });

    ref.on('inflight:transformed', function() {
      events['inflight:transformed']++;
    });

    ref.on('buffer:transformed', function() {
      events['buffer:transformed']++;
    });

    ref.on('lifecycle:saving', function() {
      events['lifecycle:saving']++;
    });

    ref.on('lifecycle:saved', function() {
      events['lifecycle:saved']++;
    });
  }
});

test("When an operation is added to canonical, the canonical:change and buffer:change events are fired", function() {
  var operation = {
    apply: expectCall(),
    noop: function() { return false; }
  };

  applyToCanonical(ref, operation);

  firedEvent('canonical:change', 'buffer:change');
});

test("When an operation is added to the buffer, the buffer:change event is fired", function() {
  applyToBuffer(ref, {
    test: expectCall(function() {
      return true;
    })
  });

  firedEvent('buffer:change');
});

test("When a reference is marked as saving, its lifecycle:saving event is fired", function() {
  applyToBuffer(ref, {
    test: expectCall(function() {
      return true;
    })
  });

  saving(ref);

  firedEvents('buffer:change', 'lifecycle:saving');
});

test("When a reference is marked as saved, its lifecycle:saved event is fired", function() {
  applyToBuffer(ref, {
    test: expectCall(function() {
      return true;
    }),

    apply: expectCall(function(snapshot) {
      deepEqual(snapshot, {}, "The initial state of the canonical is empty");
    })
  });

  saving(ref);

  firedEvents('buffer:change', 'lifecycle:saving');

  resetEvents();

  saved(ref);

  firedEvents('canonical:change', 'lifecycle:saved');
});

test("When a canonical is modified for a property with an operation in the buffer, its buffer:change event is not fired", function() {
  // This operation is going to accept a transformation that will convert it into a noop.
  // Converting an operation into a noop does not result in triggering buffer:change,
  // because the snapshot of the buffer hasn't changed.
  applyToBuffer(ref, {
    meta: 'op1',

    // Check to make sure that the operation passed into the transform function is
    // the operation applied to the canonical.
    transform: expectCall(function(op) {
      strictEqual(op.meta, 'op2', "The operation to transform against is op2");
      return [
        { noop: function() { return true; } },
        { noop: function() { return true; } }
      ]
    })
  });

  // Initially applying the operation to the buffer triggers a change.
  firedEvents('buffer:change');

  resetEvents();

  // Apply an operation to the reference. This operation will cancel out the operation
  // in the buffer, making it a noop.
  applyToCanonical(ref, {
    meta: 'op2',

    // Check to make sure that the canonical snapshot is empty, as expected.
    apply: expectCall(function(snapshot) {
      deepEqual(snapshot, {}, "The snapshot is empty so far");
    }),

    noop: expectCall()
  });

  firedEvents('canonical:change', 'buffer:transformed');
});

test("When a canonical is modified for a property without an operation in the buffer, its buffer:change event is fired", function() {
  applyToCanonical(ref, {
    apply: expectCall(),
    noop: function() { return false; }
  });

  firedEvents('canonical:change', 'buffer:change');
});

test("When a canonical's modification moots the last operation in the buffer, it is no longer dirty", function() {
  expect(0);
});

test("TODO: When a canonical's modification moots the last operation in the in-flight, it ...", function() {
  expect(0);
});
