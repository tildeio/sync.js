import { reference, canonical, buffer, inFlight } from 'sync/reference';
import { applyToBuffer, applyToCanonical } from 'sync/operation';
import { SetProperty } from 'sync/operations/set_property';
import { SetProperties } from 'sync/operations/set_properties';
import { saving, saved } from 'sync/lifecycle';

var ref;

function Type() {}

module("Lifecycle - Integration", {
  setup: function() {
    ref = reference(Type, 1);
  }
});

/**
  Scenario:

  Setup:
    Create a fresh reference

  Step 1:
    Apply Set[lastName, null->Dale] to the buffer
  Test:
    The canonical snapshot is still empty
    The buffered snapshot is `{ lastName: 'Dale' }`

  Step 2:
    Mark the reference as saving
  Test:
    The canonical snapshot is still empty
    The in-flight snapshot is `{ lastName: 'Dale' }`
    The buffered snapshot is `{ lastName: 'Dale' }`

  Step 3:
    Apply Set[firstName, null->Tom] to the buffer
  Test:
    The canonical snapshot is still empty
    The in-flight snapshot is `{ lastName: 'Dale' }`
    The buffered snapshot is `{ firstName: 'Tom', lastName: 'Dale' }`

  Step 4:
    Mark the reference as saved (in-flight is acknowledged by the server)
  Test:
    The canonical snapshot is `{ lastName: 'Dale' }`
    The in-flight snapshot is `{ lastName: 'Dale' }`
    The buffered snapshot is `{ firstName: 'Tom', lastName: 'Dale' }`

  Step 5:
    Mark the reference as saving
    Apply Set[firstName, null->Thomas] to the canonical
  Test:
    The canonical snapshot is `{ firstName: 'Thomas', lastName: 'Dale' }`
    The in-flight snapshot is `{ firstName: 'Tom' lastName: 'Dale' }`
    The buffered snapshot is `{ firstName: 'Tom', lastName: 'Dale' }`
*/
test("Scenario 1 (See Comment)", function() {
  var op1 = new SetProperties({ lastName: [ null, 'Dale' ] });

  applyToBuffer(ref, op1);

  deepEqual(canonical(ref), {}, "There's nothing in the canonical yet");
  deepEqual(buffer(ref), { lastName: 'Dale' }, "The buffer has the update");

  saving(ref);

  deepEqual(canonical(ref), {}, "There is still nothing in the canonical");
  deepEqual(inFlight(ref), { lastName: 'Dale' }, "The in-flight snapshot has the in-flight update");
  deepEqual(buffer(ref), { lastName: 'Dale' }, "The buffer still has the update");

  var op2 = new SetProperties({ firstName: [ null, 'Tom' ] });

  applyToBuffer(ref, op2);

  deepEqual(canonical(ref), {}, "There is still nothing in the canonical");
  deepEqual(inFlight(ref), { lastName: 'Dale' }, "The in-flight snapshot has just the in-flight update");
  deepEqual(buffer(ref), { firstName: 'Tom', lastName: 'Dale' }, "The buffer still has both of the updates");

  saved(ref);

  deepEqual(canonical(ref), { lastName: 'Dale' }, "The in-flight was moved to canonical");
  deepEqual(inFlight(ref), { lastName: 'Dale' }, "The in-flight snapshot reflects the saved data");
  deepEqual(buffer(ref), { firstName: 'Tom', lastName: 'Dale' }, "The buffer still has both of the updates");

  saving(ref);

  var op3 = new SetProperties({ firstName: [ null, 'Thomas' ] });

  applyToCanonical(ref, op3);

  deepEqual(canonical(ref), { firstName: 'Thomas', lastName: 'Dale' }, "The received operation is applied to the canonical");
  deepEqual(inFlight(ref), { firstName: 'Tom', lastName: 'Dale' }, "The in-flight snapshot reflects the change");
  deepEqual(buffer(ref), { firstName: 'Tom', lastName: 'Dale' }, "The buffer reflects the change");
});

/**
  Scenario:

  Setup:
    Create a fresh reference

  Step 1:
    Apply Set[firstName, null->Tom] to the buffer
    Apply Set[firstName, null->Thomas] to the canonical
  Test:
    The canonical snapshot is `{ firstName: 'Thomas' }`
    The buffered snapshot is `{ firstName: 'Tom' }`
*/
test("Scenario 2 (See Comment)", function() {
  applyToBuffer(ref, new SetProperties({ firstName: [ null, 'Tom' ] }));
  applyToCanonical(ref, new SetProperties({ firstName: [ null, 'Thomas' ] }));

  // Note that this works, because the buffered operation was transformed
  // to have the canonical value as its oldValue, which allows its
  // precondition to pass.

  deepEqual(canonical(ref), { firstName: 'Thomas' });
  deepEqual(buffer(ref), { firstName: 'Tom' });
});

test("The saving() function throws if the reference has no operations", function() {
  throws(function() {
    saving(ref);
  });
});

test("The saving() function throws if the reference is already saving and unacknowledged", function() {
  applyToBuffer(ref, new SetProperty('firstName', null, 'Thomas'));
  saving(ref);

  throws(function() {
    saving(ref);
  });
});
