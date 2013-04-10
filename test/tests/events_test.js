import { expectCall } from "test_helpers";
import { reference } from "sync/reference";
import { applyToCanonical, applyToBuffer } from "sync/operation";
import { saving, saved } from "sync/lifecycle";

var ref, canonicalChanged, bufferChanged, inFlightTransformed, bufferTransformed, referenceSaving, referenceSaved;
var noop = function() {};

var events;

function resetEvents() {
  events = {
    'buffer:change': [],
    'inflight:transformed': [],
    'buffer:transformed': [],
    'lifecycle:saving': [],
    'lifecycle:saved': []
  }
}

function firedEvents() {
  var expected = {};
  for (var i=0, l=arguments.length; i<l; i++) {
    expected[arguments[i]] = 1;
  }

  for (var event in events) {
    if (event in expected) {
      QUnit.push(events[event].length === 1, events[event].length, 1, "Expected " + event + " to be fired once");
    } else {
      QUnit.push(events[event].length === 0, events[event].length, 0, "Expected " + event + " not to be fired");
    }
  }
}

function firedEvent(event, data) {
  QUnit.push(events[event].length === 1 && events[event][0] === data, [ data ], events[event], "Expected event " + event + " with specified data");
}

var noop = function() {}

module("Triggered Events", {
  setup: function() {
    ref = reference(1);

    resetEvents();

    ref.on('buffer:change', function(e) {
      events['buffer:change'].push(e.detail);
    });

    ref.on('inflight:transformed', function(e) {
      events['inflight:transformed'].push(e.detail);
    });

    ref.on('buffer:transformed', function(e) {
      events['buffer:transformed'].push(e.detail);
    });

    ref.on('lifecycle:saving', function(e) {
      events['lifecycle:saving'].push(e.detail);
    });

    ref.on('lifecycle:saved', function(e) {
      events['lifecycle:saved'].push(e.detail);
    });
  }
});

test("When an operation is added to canonical, the buffer:change events is fired if there is no in-flight or buffer", function() {
  var operation = {
    meta: 'op',
    apply: expectCall(),
    noop: expectCall()
  };

  applyToCanonical(ref, operation);

  firedEvent('buffer:change', operation);
  firedEvents('buffer:change');
});

test("When an operation is added to the buffer, the buffer:change event is fired", function() {
  var operation = { noop: noop };
  applyToBuffer(ref, operation);

  firedEvent('buffer:change', operation);
  firedEvents('buffer:change');
});

test("When a reference is marked as saving, its lifecycle:saving event is fired", function() {
  var operation = { noop: noop, apply: noop };
  applyToBuffer(ref, operation);
  saving(ref);

  firedEvent('buffer:change', operation);
  firedEvents('buffer:change', 'lifecycle:saving');
});

test("When a reference is marked as saved, its lifecycle:saved event is fired", function() {
  var operation = {
    noop: noop,
    apply: expectCall(function(snapshot) {
      deepEqual(snapshot, {}, "The initial state of the canonical is empty");
    })
  };
  applyToBuffer(ref, operation);

  saving(ref);

  firedEvent('buffer:change', operation);
  firedEvents('buffer:change', 'lifecycle:saving');

  resetEvents();

  var op

  saved(ref);

  firedEvents('lifecycle:saved');
});

test("When an in-flight operation exists, but no buffer, the leftover part of the in-flight transform is passed to buffer:change", function() {
  var op3 = { meta: 'op3', noop: noop }, op4 = { meta: 'op4', noop: noop };

  var op1 = {
    meta: 'op1',
    noop: noop,

    transform: function(op) {
      return [ op3, op4 ];
    }
  };

  applyToBuffer(ref, op1);

  saving(ref);

  resetEvents();

  var op2 = {
    meta: 'op2',
    noop: noop,
    apply: noop
  };

  applyToCanonical(ref, op2);

  firedEvent('buffer:change', op4);
});

test("When an in-flight and buffer operations exist, the leftover part of the buffer transform is passed to buffer:change", function() {
  var op4 = { meta: 'op4', noop: noop }, op5 = { meta: 'op5', noop: noop };
  var op6 = { meta: 'op6', noop: noop }, op7 = { meta: 'op7', noop: noop };

  var op1 = {
    meta: 'op1',
    noop: noop,

    transform: function(op) {
      return [ op4, op5 ];
    }
  };

  applyToBuffer(ref, op1);

  saving(ref);

  var op2 = {
    meta: 'op2',
    noop: noop,

    transform: function(op) {
      return [ op6, op7 ];
    }
  };

  applyToBuffer(ref, op2);

  resetEvents();

  var op3 = {
    meta: 'op2',
    noop: noop,
    apply: noop
  };

  applyToCanonical(ref, op3);

  firedEvent('buffer:change', op7);
});

test("When an in-flight and buffer operations exist, and the buffered transform returns a noop, no buffer:change is called", function() {
  var op4 = { meta: 'op4', noop: noop }, op5 = { meta: 'op5', noop: noop };
  var op6 = { meta: 'op6', noop: noop }, op7 = { meta: 'op7', noop: function() { return true; } };

  var op1 = {
    meta: 'op1',
    noop: noop,

    transform: function(op) {
      return [ op4, op5 ];
    }
  };

  applyToBuffer(ref, op1);

  saving(ref);

  var op2 = {
    meta: 'op2',
    noop: noop,

    transform: function(op) {
      return [ op6, op7 ];
    }
  };

  applyToBuffer(ref, op2);

  resetEvents();

  var op3 = {
    meta: 'op2',
    noop: noop,
    apply: noop
  };

  applyToCanonical(ref, op3);

  firedEvents(/* none */);
});

test("When a canonical is modified for a property with an operation in the buffer, its buffer:change event is not fired", function() {
  // This operation is going to accept a transformation that will convert it into a noop.
  // Converting an operation into a noop does not result in triggering buffer:change,
  // because the snapshot of the buffer hasn't changed.
  var operation = {
    meta: 'op1',

    noop: noop,

    // the later applyToCanonical will need to compose this operation with the result
    // of transforming.
    compose: function(other) {
      return this;
    },

    // Check to make sure that the operation passed into the transform function is
    // the operation applied to the canonical.
    transform: expectCall(function(op) {
      strictEqual(op.meta, 'op2', "The operation to transform against is op2");
      return [
        { noop: function() { return true; } },
        { noop: function() { return true; } }
      ]
    })
  };
  applyToBuffer(ref, operation);

  // Initially applying the operation to the buffer triggers a change.
  firedEvents('buffer:change', operation);

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
});

test("When a canonical is modified for a property without an operation in the buffer, its buffer:change event is fired", function() {
  var operation = {
    apply: expectCall(),
    noop: function() { return false; }
  };
  applyToCanonical(ref, operation);

  firedEvent('buffer:change', operation);
  firedEvents('buffer:change');
});
