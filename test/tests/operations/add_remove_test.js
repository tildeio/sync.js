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

var ref1, ref2, set;

module("The Add Operation", {
  setup: function() {
    ref1 = reference(1);
    ref2 = reference(2, new Set());

    set = new Set();
  }
});

test("Add#toString prints out a representation of the operation", function() {
  var add = new Add({
    toString: function() { return '<item>'; }
  });

  strictEqual(add.toString(), 'Add[<item>]');
});

test("Add#apply adds to the set", function() {
  var add = new Add(ref1);
  add.apply(set);

  setContains(set, [ ref1 ]);
});

test("Add#isCompatible is compatible with other Add operations with the same item", function() {
  var add1 = new Add(ref1),
      add2 = new Add(ref1);

  strictEqual(add1.isCompatible(add2), true, "the two operations are compatible");
  strictEqual(add2.isCompatible(add1), true, "the two operations are compatible");
});

test("Add#isCompatible is incompatible with other Add operations with a different item", function() {
  var add1 = new Add(ref1),
      add2 = new Add(ref2);

  strictEqual(add1.isCompatible(add2), false, "the two operations are incompatible");
  strictEqual(add2.isCompatible(add1), false, "the two operations are incompatible");
});

test("Add#isCompatible is compatible with Remove operations with the same item", function() {
  var add = new Add(ref1),
      remove = new Remove(ref1);

  strictEqual(add.isCompatible(remove), true, "the two operations are compatible");
});

test("Add#isCompatible is incompatible with Remove operations with a different item", function() {
  var add = new Add(ref1),
      remove = new Remove(ref2);

  strictEqual(add.isCompatible(remove), false, "the two operations are incompatible");
});

test("Add#transform will make the item undefined when the previous operation has the same item", function() {
  var add1 = new Add(ref1),
      add2 = new Add(ref2);

  add1.transform(add2);
  strictEqual(add1.item, undefined, "The item is now undefined and the operation is ready for pruning via Add#noop");
});

test("Add#compose will make the item undefined if the operation to compose with is a remove with the same item", function() {
  var add = new Add(ref1),
      remove = new Remove(ref1);

  add.compose(remove);
  strictEqual(add.item, undefined, "The item is now undefined and the operation is ready for pruning via Add#noop");
});

test("Add#test will return true if the snapshot does not already has the item", function() {
  var add = new Add(ref1),
      set = new Set();

  strictEqual(add.test(set), true, "The precondition is met");
});

test("Add#test will return false if the snapshot does already has the item", function() {
  var add = new Add(ref1),
      set = new Set();

  set.add(ref1);

  strictEqual(add.test(set), false, "The precondition is not met");
});

module("The Remove Operation", {
  setup: function() {
    ref1 = reference(1);
    ref2 = reference(2, new Set());

    set = new Set();
  }
});

test("Remove#toString prints out a representation of the operation", function() {
  var remove = new Remove({
    toString: function() { return '<item>'; }
  });

  strictEqual(remove.toString(), 'Remove[<item>]');
});


test("Remove#apply removes from the set", function() {
  var remove = new Remove(ref1);
  set.add(ref1);

  remove.apply(set);

  setContains(set, []);
});

test("Remove#isCompatible is compatible with other Remove operations with the same item", function() {
  var remove1 = new Remove(ref1),
      remove2 = new Remove(ref1);

  strictEqual(remove1.isCompatible(remove2), true, "the two operations are compatible");
  strictEqual(remove2.isCompatible(remove1), true, "the two operations are compatible");
});

test("Remove#isCompatible is incompatible with other Remove operations with a different item", function() {
  var remove1 = new Remove(ref1),
      remove2 = new Remove(ref2);

  strictEqual(remove1.isCompatible(remove2), false, "the two operations are incompatible");
  strictEqual(remove2.isCompatible(remove1), false, "the two operations are incompatible");
});

test("Remove#isCompatible is compatible with Add operations with the same item", function() {
  var add = new Add(ref1),
      remove = new Remove(ref1);

  strictEqual(remove.isCompatible(add), true, "the two operations are compatible");
});

test("Remove#isCompatible is incompatible with Add operations with a different item", function() {
  var add = new Add(ref1),
      remove = new Remove(ref2);

  strictEqual(remove.isCompatible(add), false, "the two operations are incompatible");
});

test("Remove#transform will make the item undefined when the previous operation has the same item", function() {
  var remove1 = new Remove(ref1),
      remove2 = new Remove(ref2);

  remove1.transform(remove2);
  strictEqual(remove1.item, undefined, "The item is now undefined and the operation is ready for pruning via Add#noop");
});

test("Remove#compose will make the item undefined if the operation to compose with is an add with the same item", function() {
  var add = new Add(ref1),
      remove = new Remove(ref1);

  remove.compose(add);
  strictEqual(remove.item, undefined, "The item is now undefined and the operation is ready for pruning via Add#noop");
});

test("Remove#test will return true if the snapshot already has the item", function() {
  var remove = new Remove(ref1),
      set = new Set();

  set.add(ref1);

  strictEqual(remove.test(set), true, "The precondition is met");
});

test("Remove#test will return false if the snapshot does not already have the item", function() {
  var add = new Remove(ref1),
      set = new Set();

  strictEqual(add.test(set), false, "The precondition is not met");
});
