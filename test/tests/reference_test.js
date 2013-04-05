import { reference } from "sync/reference";

module("Reference");

test("reference(id) returns a new reference", function() {
  var ref = reference('1');
  equal(ref.id, '1');
});
