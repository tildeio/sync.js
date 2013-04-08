import { SetChange } from 'sync/operations/set_change';
import { Set } from 'sync/modules/set';

function equalSet(actual, expected, msg) {
  var expectedSize = 0, actualSize = 0;
  expected.forEach(function(item) {
    expectedSize++;
    QUnit.push(actual.has(item), actual.toString(), expected.toString(), msg + " " + expected + " should have " + item);
  });

  actual.forEach(function(item) {
    actualSize++;
  });

  QUnit.push(actualSize === expectedSize, actualSize, expectedSize, msg + " " + actual + " should be " + expected);
}

function equalSetChange(actual, expected) {
  equalSet(expected.add, actual.add, "add");
  equalSet(expected.remove, actual.remove, "remove");
}


module("The SetChange Operation");

test("SetChange#toString", function() {
  var set;

  set = new SetChange({
    add: new Set([ 1 ])
  });
  debugger;

  equal(set.toString(), "SetChange[add: { 1 }]");

  set = new SetChange({
    remove: new Set([ 1 ])
  });

  equal(set.toString(), "SetChange[remove: { 1 }]");

  set = new SetChange({
    add: new Set([ 1 ]),
    remove: new Set([ 2 ])
  });

  equal(set.toString(), "SetChange[add: { 1 }, remove: { 2 }]");
});

test("SetChange#compose will combine two orthogonal adds", function() {
  var set1 = new SetChange({
    add: new Set([ 1 ])
  });

  var set2 = new SetChange({
    add: new Set([ 2 ])
  });

  debugger;
  equalSetChange(set1.compose(set2), new SetChange({
    add: new Set([ 1, 2 ])
  }));
});

test("SetChange#compose will combine and orthogonal add and remove", function() {
  var set1 = new SetChange({
    add: new Set([ 1 ])
  });

  var set2 = new SetChange({
    remove: new Set([ 2 ])
  });

  equalSetChange(set1.compose(set2), new SetChange({
    add: new Set([ 1 ]),
    remove: new Set([ 2 ])
  }));
});

test("SetChange#compose will combine two compatible components", function() {
  var set1 = new SetChange({
    add: new Set([ 1 ])
  });

  var set2 = new SetChange({
    add: new Set([ 1 ])
  });

  equalSetChange(set1.compose(set2), new SetChange({
    add: new Set([ 1 ])
  }));
});

test("SetChange#compose will clear an add->remove", function() {
  var set1 = new SetChange({
    add: new Set([ 1, 2 ])
  });

  var set2 = new SetChange({
    remove: new Set([ 2 ])
  });

  equalSetChange(set1.compose(set2), new SetChange({
    add: new Set([ 1 ])
  }));
});

test("SetChange#compose will clear a remove->add", function() {
  var set1 = new SetChange({
    add: new Set([ 1, 2 ])
  });

  var set2 = new SetChange({
    remove: new Set([ 2 ])
  });

  equalSetChange(set1.compose(set2), new SetChange({
    add: new Set([ 1 ])
  }));
});

test("SetChange#transform with two orthogonal add components", function() {
  var change1 = new SetChange({
    add: new Set([ 1 ])
  });

  var change2 = new SetChange({
    add: new Set([ 2 ])
  });

  var transformed = change1.transform(change2),
      change1Prime = transformed[0],
      change2Prime = transformed[1];

  equalSetChange(change1Prime, new SetChange({
    add: new Set([ 1 ])
  }));

  equalSetChange(change2Prime, new SetChange({
    add: new Set([ 2 ])
  }));
});

test("SetChange#transform with two orthogonal remove components", function() {
  var change1 = new SetChange({
    remove: new Set([ 1 ])
  });

  var change2 = new SetChange({
    remove: new Set([ 2 ])
  });

  var transformed = change1.transform(change2),
      change1Prime = transformed[0],
      change2Prime = transformed[1];

  equalSetChange(change1Prime, new SetChange({
    remove: new Set([ 1 ])
  }));

  equalSetChange(change2Prime, new SetChange({
    remove: new Set([ 2 ])
  }));
});

test("SetChange#transform with two equivalent add components", function() {
  var change1 = new SetChange({
    add: new Set([ 1, 2 ])
  });

  var change2 = new SetChange({
    add: new Set([ 2, 3 ])
  });

  var transformed = change1.transform(change2),
      change1Prime = transformed[0],
      change2Prime = transformed[1];

  equalSetChange(change1Prime, new SetChange({
    add: new Set([ 1 ])
  }));

  equalSetChange(change2Prime, new SetChange({
    add: new Set([ 3 ])
  }));
});

test("SetChange#transform with two equivalent remove components", function() {
  var change1 = new SetChange({
    remove: new Set([ 1, 2 ])
  });

  var change2 = new SetChange({
    remove: new Set([ 2, 3 ])
  });

  var transformed = change1.transform(change2),
      change1Prime = transformed[0],
      change2Prime = transformed[1];

  equalSetChange(change1Prime, new SetChange({
    remove: new Set([ 1 ])
  }));

  equalSetChange(change2Prime, new SetChange({
    remove: new Set([ 3 ])
  }));
});

test("SetChange#noop when there are no adds or removes", function() {
  var change = new SetChange();
  strictEqual(change.noop(), true, "An empty change is a noop");
});

test("SetChange#noop when there are adds but no removes", function() {
  var change = new SetChange({
    add: new Set([ 1 ])
  });
  strictEqual(change.noop(), false, "A change with adds is not a noop");
});

test("SetChange#noop when there are removes but no add", function() {
  var change = new SetChange({
    remove: new Set([ 1 ])
  });
  strictEqual(change.noop(), false, "A change with removes is not a noop");
});

test("SetChange#noop when there are removes and adds", function() {
  var change = new SetChange({
    remove: new Set([ 1 ]),
    add: new Set([ 2 ])
  });
  strictEqual(change.noop(), false, "A change with removes and adds is not a noop");
});
