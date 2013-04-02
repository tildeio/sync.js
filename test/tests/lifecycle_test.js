import { reference, canonical, buffer, inFlight } from 'sync/reference';
import { applyToBuffer, applyToCanonical } from 'sync/operation';
import { SetProperty } from 'sync/operations/set_property';
import { saving, saved } from 'sync/lifecycle';

var ref;

function Type() {}

module("Lifecycle", {
  setup: function() {
    ref = reference(Type, 1);
  }
});

test("Buffered operations can be moved to in-flight", function() {
  var op1 = new SetProperty('lastName', null, 'Dale');

  applyToBuffer(ref, op1);

  deepEqual(canonical(ref), {}, "There's nothing in the canonical yet");
  deepEqual(buffer(ref), { lastName: 'Dale' }, "The buffer has the update");

  saving(ref);

  deepEqual(canonical(ref), {}, "There is still nothing in the canonical");
  deepEqual(inFlight(ref), { lastName: 'Dale' }, "The in-flight snapshot has the in-flight update");
  deepEqual(buffer(ref), { lastName: 'Dale' }, "The buffer still has the update");

  var op2 = new SetProperty('firstName', null, 'Tom');

  applyToBuffer(ref, op2);

  deepEqual(canonical(ref), {}, "There is still nothing in the canonical");
  deepEqual(inFlight(ref), { lastName: 'Dale' }, "The in-flight snapshot has just the in-flight update");
  deepEqual(buffer(ref), { firstName: 'Tom', lastName: 'Dale' }, "The buffer still has both of the updates");

  saved(ref);

  deepEqual(canonical(ref), { lastName: 'Dale' }, "The in-flight was moved to canonical");
  deepEqual(inFlight(ref), { lastName: 'Dale' }, "The in-flight snapshot reflects the saved data");
  deepEqual(buffer(ref), { firstName: 'Tom', lastName: 'Dale' }, "The buffer still has both of the updates");

  saving(ref);

  var op3 = new SetProperty('firstName', null, 'Thomas');

  applyToCanonical(ref, op3);

  deepEqual(canonical(ref), { firstName: 'Thomas', lastName: 'Dale' }, "The received operation is applied to the canonical");
  deepEqual(inFlight(ref), { firstName: 'Tom', lastName: 'Dale' }, "The in-flight snapshot reflects the change");
  deepEqual(buffer(ref), { firstName: 'Tom', lastName: 'Dale' }, "The buffer reflects the change");
});