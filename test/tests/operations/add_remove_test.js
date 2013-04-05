import { Add, Remove } from 'sync/operations/set';
import { applyToCanonical, applyToBuffer } from "sync/operation";
import { reference, canonical, buffer, isDirty } from "sync/reference";
import { Set } from "sync/modules/set";

function setContains(set, list) {
  var setSize = 0;

  set.forEach(function(item) {
    setSize++;
  });

  for (var i=0, l=list.length; i<l; i++) {
    var item = list[i];
    QUnit.push(set.has(item), 'Set does not contain ' + item, 'Set contains ' + item, 'Set should contain ' + item);
  }

  QUnit.push(list.length === setSize, setSize, list.length, "The set should contain " + list.length + " items");
}

var ref1, ref2;

module("Add and Remove on Sets", {
  setup: function() {
    ref1 = reference(1);
    ref2 = reference(2, new Set());
  }
});

test("Applying Add to a canonical updates the canonical", function() {
  var add = new Add(ref1);
  applyToCanonical(ref2, add);

  setContains(canonical(ref2), [ ref1 ]);
  setContains(buffer(ref2), [ ref1 ]);
});

test("Applying Remove to a canonical after applying add removes it from the list", function() {
  var add = new Add(ref1);
  applyToCanonical(ref2, add);

  var remove = new Remove(ref1);
  applyToCanonical(ref2, remove);

  setContains(canonical(ref2), []);
  setContains(buffer(ref2), []);
});

test("Applying Add to a buffer updates the buffer and makes it dirty", function() {
  var add = new Add(ref1);
  applyToBuffer(ref2, add);

  equal(isDirty(ref2), true, "The reference is dirty");
  setContains(buffer(ref2), [ ref1 ]);
});

test("Applying Remove to a buffer after applying Add removes the operation and makes it clean", function() {
  var add = new Add(ref1);
  applyToBuffer(ref2, add);

  var remove = new Remove(ref1);
  applyToBuffer(ref2, remove);

  equal(isDirty(ref2), false, "The reference is no longer dirty");
  setContains(buffer(ref2), []);
});

test("Applying an Add to canonical after it was added to the buffer makes the buffer clean", function() {
  var add = new Add(ref1);
  applyToBuffer(ref2, add);

  applyToCanonical(ref2, new Add(ref1));

  setContains(canonical(ref2), [ ref1 ]);
  setContains(buffer(ref2), [ ref1 ]);
  equal(isDirty(ref2), false, "The reference is no longer dirty");
});

test("Applying an Add to canonical that already has the item is an exception", function() {
  var add = new Add(ref1);
  applyToCanonical(ref2, add);

  throws(function() {
    applyToCanonical(ref2, new Add(ref1))
  });
});

test("Applying an Add to a buffer that already has the item is an exception", function() {
  var add = new Add(ref1);
  applyToCanonical(ref2, add);

  throws(function() {
    applyToBuffer(ref2, new Add(ref1))
  });
});
