import { SetProperties } from 'sync/operations/set_properties';

module("The SetProperties Operation");

test("SetProperties#compose will combine two orthogonal components", function() {
  var set1 = new SetProperties({
    firstName: [ null, 'Tom' ]
  });

  var set2 = new SetProperties({
    lastName: [ null, 'Dale' ]
  });

  deepEqual(set1.compose(set2), new SetProperties({
    firstName: [ null, 'Tom' ],
    lastName: [ null, 'Dale' ]
  }));
});

test("SetProperties#compose will combine two compatible components", function() {
  var set1 = new SetProperties({
    firstName: [ null, 'Tom' ],
    lastName: [ null, 'Dale' ]
  });

  var set2 = new SetProperties({
    firstName: [ 'Tom', 'Thomas' ],
    lastName: [ 'Dale', 'Dall' ]
  });

  deepEqual(set1.compose(set2), new SetProperties({
    firstName: [ null, 'Thomas' ],
    lastName: [ null, 'Dall' ]
  }));
});

test("SetProperties#compose will remove properties that are reverted to their original value", function() {
  var set1 = new SetProperties({
    firstName: [ null, 'Tom' ],
    lastName: [ null, 'Dale' ]
  });

  var set2 = new SetProperties({
    firstName: [ 'Tom', null ],
    lastName: [ 'Dale', 'Dall' ]
  });

  deepEqual(set1.compose(set2), new SetProperties({
    lastName: [ null, 'Dall' ]
  }));
});

test("SetProperties#transform with incompatible components", function() {
  var set1 = new SetProperties({
    firstName: [ null, "Tom" ]
  });

  var set2 = new SetProperties({
    lastName: [ null, "Dale" ]
  });

  // Because set2 only deals with properties not found in set1, set1-prime
  // doesn't require any transformations, which makes set2-prime all of
  // set2
  deepEqual(set1.transform(set2), [
    new SetProperties({
      firstName: [ null, "Tom" ]
    }),
    new SetProperties({
      lastName: [ null, "Dale" ]
    })
  ]);
});

test("SetProperties#transform with compatible components", function() {
  var set1 = new SetProperties({
    firstName: [ null, "Tom" ]
  });

  var set2 = new SetProperties({
    firstName: [ null, "Timmy" ]
  });

  deepEqual(set1.transform(set2) , [
    new SetProperties({
      firstName: [ "Timmy", "Tom" ]
    }),
    new SetProperties({
    })
  ]);
});

test("SetProperties#transform with some compatible components and some incompatible components", function() {
  var set1 = new SetProperties({
    firstName: [ null, "Tom" ],
    lastName: [ null, "Dale" ]
  });

  var set2 = new SetProperties({
    firstName: [ null, "Timmy" ],
    age: [ null, 12 ]
  });

  deepEqual(set1.transform(set2) , [
    new SetProperties({
      firstName: [ "Timmy", "Tom" ],
      lastName: [ null, "Dale" ]
    }),
    new SetProperties({
      age: [ null, 12 ]
    })
  ]);
});

test("SetProperties#noop with a property", function() {
  var change = new SetProperties({
    firstName: [ null, "Tom" ]
  });
  strictEqual(change.noop(), false, "A change with a single property is not a noop");
});

test("SetProperties#noop with properties", function() {
  var change = new SetProperties({
    firstName: [ null, "Tom" ],
    lastName: [ null, "Dale" ]
  });
  strictEqual(change.noop(), false, "A change with a single property is not a noop");
});

test("SetProperties#noop with no properties", function() {
  var change = new SetProperties({});
  strictEqual(change.noop(), true, "A change with no properties is a noop");
});

test("SetProperties#apply with a single property", function() {
  var change = new SetProperties({
    firstName: [ null, "Tom" ]
  });

  var object = {};
  change.apply(object);

  deepEqual(object, { firstName: "Tom" });
});

test("SetProperties#apply with multiple properties", function() {
  var change = new SetProperties({
    firstName: [ null, "Tom" ],
    lastName: [ null, "Dale" ]
  });

  var object = {};
  change.apply(object);

  deepEqual(object, { firstName: "Tom", lastName: "Dale" });
});

test("SetProperties#apply on an object that already has properties", function() {
  var change = new SetProperties({
    firstName: [ "Tom", "Thomas" ],
    lastName: [ null, "Dale" ]
  });

  var object = { firstName: "Tom" };
  change.apply(object);

  deepEqual(object, { firstName: "Thomas", lastName: "Dale" });
});
