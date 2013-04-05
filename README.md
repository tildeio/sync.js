# sync.js

_sync.js_ is a lightweight library for synchronizing documents
between a JavaScript client and a backend.

It does not directly manage communication with your backend,
instead providing an operation-based primitive that you can
use to keep canonical and local snapshots that remain
consistent as the backend provides udpates.

It is explicitly designed to encapsulate transport-related
concerns behind a single, high-fidelity abstraction based
around granular operations.

As a result, it can be used in hybrid scenarios where documents
are transported both over REST and via an open web sockets. This
is achieved by converting document updates via REST into
individual operations that can be applied to the canonical
snapshot, and which the local operations can apply on top of.

This model also makes it straight-forward to use partial
updates using HTTP `PATCH`, because all of the information
about the original operations is preserved.

In short, _sync.js_ is based around preserving the highest
fidelity information about what the user is doing locally,
which you can then use directly (using web sockets) or
convert into a lower-fidelity transport like REST.

## Higher Level Abstractions

_sync.js_ is intended to be used with higher level
abstractions like models and identity maps.

However, we wanted to provide the smallest piece of
functionality that people could use to build those
abstractions, so we would have a rock-solid foundation
for the basic operation-based model that we (and we hope,
others) could use to build their own flavor of data
library on top of.

## Modules

_sync.js_ uses Square's ES6 module transpiler to generate builds
that use AMD, node, and browser globals.

You can use the transpiler in your own projects and use the ES6
syntax in this `README`. See the end of the `README` for more
information.

In the documentation, you will see examples that import variables
using ES6 modules syntax like this:

```javascript
import { reference } from "sync/reference";
```

If you are using the AMD build in an AMD project, you should do:

```javascript
define(
  ['sync/reference',
  function(syncReference) {
    var reference = syncReference.reference;
  });
```

If you are using node, you should do:

```javascript
var reference = require("sync/reference").reference;
```

If you are using the globals-based browser build, you should do:

```javascript
var reference = sync.reference.reference;
```

In the browser build, all modules will be converted into a
dot-separated path off of the main `sync` object.

## References

In _sync.js_, you will work against a local reference to a document
that is stored in a backend.

The local reference keeps track of several things:

* A snapshot of the document's known state on the backend, called
  the **canonical snapshot**
* A list of operations that have been sent to the backend but have
  not yet been acknowledged.
* A list of operations that have been applied locally, and have
  not yet been sent to the backend.

### Creating a New Reference

You make a new reference using the `reference` method, passing it
a unique identifier:

```javascript
import { reference } from "sync/reference";

reference(1) // returns a reference
```

### Getting the Canonical Snapshot

The canonical snapshot reflects the backend's representation of
the document pointed to by the reference.

```javascript
import { canonical } from "sync/reference";

canonical(reference) // the canonical snapshot
```

### Getting the Buffered Snapshot

The buffered snapshot represents the local state. This means
the canonical snapshot will any local operations applied on
top.

```javascript
import { buffer } from "sync/reference";

buffer(reference) // the buffered snapshot
```

### Determining Whether a Reference is Dirty

A reference is dirty if there are any outstanding operations
either in the buffer or in-flight.

```javascript
import { isDirty } from "sync/reference";

isDirty(reference);
```

### Determining Whether a Reference is Saving

A reference is saving if `saving(reference)` was called but
`saved(reference)` was not yet called.

```javascript
import { isSaving } from "sync/reference";

isSaving(reference);
```

## Canonical Snapshots

When you create a new reference using `reference(id)`, _sync.js_
will initialize a new empty object as the starting point for
your reference.

The `SetProperty` operation manipulates objects, and you will
use it when working with documents that represent dictionaries
on the backend.

You can optionally provide your own initial object as a starting
point for operations. For example, if you are working with
documents that represent sets, you will want to provide a new
`Set` object and use `Add` and `Remove` operations to work
with it.

### Starting Out With Dictionaries

When you fetch a JSON object from the server that represents
a dictionary in your backend, you will want to create a local
reference from that dictionary, and apply each property to
the canonical snapshot:

```javascript
import { reference } from "sync/reference";
import { applyToCanonical } from "sync/operation";
import { SetProperty } from "sync/operation/set_property";

// assume I have a JSON document that I loaded from the server
// that looks like this:
//   { "id": 12, "firstName": "Tom", "lastName": "Dale" }
var ref = reference(json.id);

for (var prop in json) {
  applyToCanonical(ref, new SetProperty(prop, null, json[prop]);
}
```

When you're done, you now have a canonical snapshot that
represents each of the properties in the original JSON.

#### Local Changes

If you want to make a local change to the reference, you
use `applyToBuffer`:

```javascript
import { applyToBuffer } from "sync/operation";
import { SetProperty } from "sync/operation/set_property";

applyToBuffer(ref, new SetProperty('firstName', 'Tom', 'Tim');
```

After `applyToBuffer` finishes, the `buffer:change` and
`lifecycle:dirty` events will fire.

#### Updates from the Server

In the meantime, imagine that we have a web socket set up
and the backend wants to update the `lastName` to `Dayl`.
I would do the following:

```javascript
applyToCanonical(ref, new SetProperty('lastName', 'Dale', 'Dayl'));
```

This will update the canonical snapshot and trigger the
`canonical:change` event. Because there are no local
changes to `lastName` pending, it will also affect the
buffered snapshot, and trigger the `buffer:change` event.

If the server had wanted to change `firstName` instead,
its change would have updated the canonical snapshot,
but not the buffer (because our outstanding local change
would supersede it).

#### Saving

If I want to save the local operations to the server, I
need to notify _sync.js_ that I want to do so:

```javascript
import { saving } from "sync/lifecycle";

saving(ref);
```

This does two things:

* Moves all outstanding operations in the buffer into
  in-flight. This allows you to have accumulate new
  buffered operations while waiting for the server to
  respond.
* Triggers the `lifecycle:saving` event.

It is up to you to convert the operations into a format
that can be understood by your server.

When the server has acknowledged the operations, you
notify _sync.js_:

```javascript
import { saved } from "sync/lifecycle";

saved(ref);
```

This does three things:

* Applies all in-flight operations to the canonical
  snapshot
* Triggers the `canonical:change` event
* Triggers the `lifecycle:saved` event

At this point, you can save the next batch of operation
in the buffer.

#### Backend Updates With In-Flight Operations

You may have called `save` on a reference and are awaiting
the backend to acknowledge your change but receive an
update to the canonical snapshot before the acknowledgment
occurs.

For example, you may have an open web socket streaming
changes, and get a change from the backend before it has
a chance to get to your change.

If this occurs, you can simply apply the change to the
canonical snapshot, and _sync.js_ will transform any
in-flight operations so they apply cleanly on top:

```javascript
import { applyToCanonical } from "sync/operation";
import { SetProperty } from "sync/operations/set_property";

applyToCanonical(ref, new SetProperty('firstName', 'Tom', 'Tim'));
```

By default, _sync.js_ assumes that your server will use a
last-write-wins strategy for resolving conflicts, and
applies the same strategy locally.

If you want a different strategy, you can create your
own version of _SetProperty_ that has a different
implementation of its _transform_ method. See below
for more information.

### Starting Out With Sets

Working with sets of values is mostly the same as working
with dictionaries.

The primary difference is that you will instantiate the
reference using a `Set` as its initial snapshot and make
changes to the reference using the `Add` and `Remove`
operations instead of the `SetProperty` operation.

```javascript
import { Set } from "sync/modules/set";
import { reference } from "sync/reference";
import { applyToBuffer, applyToCanonical } from "sync/operation";
import { Add, Remove } from "sync/operations/set";

// Assume I have a JSON document that has an ID and an array
// of numbers that represent a set
var set = new Set();
var ref = reference(json.id, set);

json.list.forEach(function(item) {
  applyToCanonical(ref, new Add(item));
});
```

If the backend provides updates, you apply them to the
canonical as described above for dictionaries. Because
`Add` and `Remove` implement the interface for operations,
_sync.js_ knows how to deal with:

* keeping the local buffer up to date with backend
  updates
* dealing with server changes that occur while operations
  are in-flight
* eliminating operations that become redundant with
  changes supplied by the backend

#### Conflict Resolution Strategy

If there is a local `Add` to a set, that means that the
backend does not have the item in its set. If the
backend presents an `Add` operation while the same
`Add` operation is in the buffer or in-flight, the
local operation can be safely discarded.

The same is true for `Remove` operations.

#### Usage for Relationship

Sets can be used to represent relationships between
references on the backend.

For example, if you have a post that has many comments,
the relationship could be represented by a set of
comment ids.

Adding a comment to a post adds its ID to the set,
and removing a comment from a post removes its ID
from the set.

If your backend requires you to make changes to both
attributes and relationships in the same request,
you will want a model or record abstraction that
allows you to keep track of the various _sync.js_
references in a single place and update them together.

The benefit of using a separate reference for these
relationships is twofold:

* It keeps the truth of the relationship in a single
  place, instead of needing to keep it in sync
  in all of the records it touches. You can always
  determine the state for each record based on a
  single source of truth.
* It provides flexibility in how you want to save
  the relationships to the backend in a relatively
  simple way without making too many assumptions
  about how that will work.

## Operations

sync.js is built around the concept of operations that can be applied
locally to a reference and then persisted to a backend.

Each operation is required to implement a number of methods. In
general, you will use one of the built-in operations, but it may
be useful to know how an operation works.

### toString()

A useful representation of the operation that can be used for
debugging.

### apply(snapshot)

This method takes a local snapshot and applies the change to it.
The snapshot may represent the canonical state on the server or
the local, not-yet-saved state.

The `SetProperty` operation works with an `Object` snapshot, while
the `Add` and `Remove` operations work with a `Set` snapshot.

### isCompatible(Operation)

This method takes another operation and returns whether it is
"compatible" with the other operation.

An operation should return true from this method if it is
capable of transforming against the other operation or composing
with the other operation.

### transform(Operation)

This method is called when a local operation has been pre-empted
by a change supplied by the backend.

It will only be called if the `isCompatible` method has already
returned true, and it is responsible for updating itself to
reflect the changes to the canonical state.

For example:

* The canonical, backend state for a record is
  `{ firstName: 'Tom', lastName: 'Dale' }`
* I create a local `SetProperty` operation to update the
  `firstName` to `Thomas` (`SetProperty[firstName Tom->Thomas`)
* In the meantime, the backend provides an operation:
  `SetProperty[firstName Tom->Tim]`
* The local operation is responsible for transforming itself
  to reflect the new canonical state to
  `SetProperty[firstName Tim->Thomas]`

An operation's `transform` method should update itself without 
requiring any input from the user.

The reason that this transformation is required even in a
destructive operation like `SetProperty` is shown in the
following example:

* The canonical, backend state for a reference is
  `{ firstName: 'Tom', lastName: 'Dale' }`
* I create a local `SetProperty` operation to update the
  `firstName` to `Thomas` (`SetProperty[firstName Tom->Thomas`)
* In the meantime, the backend provides an operation:
  `SetProperty[firstName Tom->Thomas]`
* The local operation is responsible for transforming itself
  to reflect the new canonical state to
  `SetProperty[firstName Thomas->Thomas]`

Because the operation is now a noop, _sync.js_ can safely
discard it. This means that the reference will trigger a
`lifecycle:clean` event and no longer return true when
passed to `isDirty` (if this was the last operation left
in the buffer).

### compose(Operation)

The `compose` method combines two compatible operations
that have not yet been sent to the backend into a single
operation.

For example:

* The canonical state for a reference is
  `{ firstName: 'Tom', lastName: 'Dale' }`
* I create a local `SetProperty` operation to update the
  `firstName` to `Thomas` (`SetProperty[firstName Tom->Thomas]`)
* Before saving the reference, I create a new `SetProperty`
  operation to update the `firstName` to `Tim`
  (`SetProperty[firstName Thomas->Tim]`).
* The `compose` method will update the first `SetProperty`
  operation to combine them into a single operation
  (`SetProperty[firstName Tom->Tim]`)

If the operation becomes a noop (if the user makes a
change and then undoes it before saving), _sync.js_ will
discard the operation.

### noop()

The `noop` method returns true if applying the operation
has no effect. A no-op operation can be safely discarded.

_sync.js_ will invoke this method after composing or
transforming to see whether the system can discard the
operation.

## Lifecycle Events

As you apply operations to a reference, _sync.js_ will
trigger events on the reference when certain important
changes occur.

### canonical:change

This event is triggered whenever the backend updates
the canonical representation.

### buffer:change

This event is triggered whenever the buffered snapshot
is changed.

This happens when:

* a local operation is applied
* the backend updates the canonical representation,
  and that affects the buffered snapshot.

Note that this event is only triggered if the buffered
snapshot actually changes. In the following example,
this `buffer:change` would not fire.

* The initial canonical state is
  `{ firstName: 'Tom', lastName: 'Dale' }`
* A local operation (`SetProperty[firstName Tom->Tim]`)
  is applied. The buffered snapshot is now
  `{ firstName: 'Tim', lastName: 'Dale' }`
* The backend sends this update:
  `SetProperty[firstName Tom->Thomas]`.

After applying the local operation on top of the new
canonical state, the buffered snapshot is still
`{ firstName: 'Tim', lastName: 'Dale' }`. As a result,
`buffer:change` is not fired.

### lifecycle:saving

This event is triggered when you call `save(reference)`.

Saving a reference moves all of its buffered operations
into an in-flight bucket, allowing the user to continue
making local changes.

Users of _sync.js_ are expected to persist those changes
to their backend and call `saved(reference)` when their
backend has acknowledged the change.

### lifecycle:saved

This event is triggered when you call `saved(reference)`.

This applies all of the operations in the in-flight
bucket to the canonical snapshot.

If the server has provided other updates in its
response, they should be applied directly to the
canonical snapshot using `applyToCanonical`.

### lifecycle:clean

This event is triggered when there are no longer any
local operations in the buffer.

This could happen because they were moved to the
in-flight bucket, or because the last operation in
the buffer got converted into a noop.

### lifecycle:dirty

This event is triggered when the first operation is
added to the buffer.

## Extracted from Ember Data

The idea for _sync.js_ came from our work on Ember
Data, where we spent a lot of time trying to
reverse engineer what exactly some particular
response from the server actually meant in terms
of the local models.

We ended up making decisions for how to apply the
changes on a mostly ad-hoc basis, which led to
inconsistencies and an overly complex model.

Our goal with _sync.js_ is to define a clear,
comprehensible model for all stages of the lifecycle
of a local reference, making it clear how to deal
with server changes that happen at any point
