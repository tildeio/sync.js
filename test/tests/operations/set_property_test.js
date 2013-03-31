import { SetProperty } from "sync/operations/set_property";
import { applyToCanonical, applyToBuffer } from "sync/operation";
import { reference, canonical, buffer } from "sync/reference";

function Type() {}

module("SetProperty");

test("Applying SetProperty to a canonical updates the canonical", function() {
  var ref = reference(Type, 1),
      set = new SetProperty('firstName', undefined, "Tom");

  applyToCanonical(ref, set);
  deepEqual(canonical(ref), { firstName: "Tom" });
});

test("Applying SetProperty to a buffer updates the buffer", function() {
  var ref = reference(Type, 1),
      set = new SetProperty('firstName', undefined, "Tom");

  applyToBuffer(ref, set);
  deepEqual(buffer(ref), { firstName: "Tom" });
});