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
