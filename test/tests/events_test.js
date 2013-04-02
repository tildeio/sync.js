import { reference } from "sync/reference";
import { applyToCanonical, applyToBuffer } from "sync/operation";
import { SetProperty } from "sync/operations/set_property";
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

function Type() {}

module("Triggered Events", {
  setup: function() {
    ref = reference(Type, 1);

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
  applyToCanonical(ref, new SetProperty('firstName', null, 'Tom'));

  firedEvent('canonical:change', 'buffer:change');
});

test("When an operation is added to the buffer, the buffer:change event is fired", function() {
  applyToBuffer(ref, new SetProperty('firstName', null, 'Tom'));

  firedEvent('buffer:change');
});

test("When a reference is marked as saving, its lifecycle:saving event is fired", function() {
  applyToBuffer(ref, new SetProperty('firstName', null, 'Tom'));
  saving(ref);

  firedEvents('buffer:change', 'lifecycle:saving');
});

test("When a reference is marked as saved, its lifecycle:saved event is fired", function() {
  applyToBuffer(ref, new SetProperty('firstName', null, 'Tom'));
  saving(ref);

  firedEvents('buffer:change', 'lifecycle:saving');

  resetEvents();

  saved(ref);

  firedEvents('canonical:change', 'lifecycle:saved');
});

test("When a canonical is modified for a property with an operation in the buffer, its buffer:change event is not fired", function() {
  applyToBuffer(ref, new SetProperty('firstName', null, 'Tom'));

  firedEvents('buffer:change');

  resetEvents();

  applyToCanonical(ref, new SetProperty('firstName', null, 'Thomas'));

  firedEvents('canonical:change', 'buffer:transformed');
});

test("When a canonical is modified for a property without an operation in the buffer, its buffer:change event is not fired", function() {
  applyToCanonical(ref, new SetProperty('firstName', null, 'Tom'));

  firedEvents('canonical:change', 'buffer:change');
});

// TODO: Noop operations