import { reference } from "sync/reference";

function Type() {}

module("Reference");

test("reference(id) returns a new reference", function() {
  var ref = reference(Type, '1');
  equal(ref.type, Type);
  equal(ref.id, '1');
});