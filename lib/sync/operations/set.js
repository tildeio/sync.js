/**
  Operations have:

  * toString
  * apply(snapshot)
  * isCompatible(Operation)
  * transform(Operation)
  * compose(Operation)
  * noop()
  * test(snapshot)
*/

export function Add(item) {
  if (item === undefined) {
    throw new Error("Cannot add undefined to a Set");
  }

  this.item = item;
}

Add.prototype = {
  constructor: Add,

  toString: function() {
    return 'Add[' + this.item.toString() + ']';
  },

  apply: function(snapshot) {
    snapshot.add(this.item);
  },

  isCompatible: function(operation) {
    if (operation instanceof Add || operation instanceof Remove) {
      return this.item === operation.item;
    }
  },

  transform: function(prev) {
    if (prev instanceof Add) {
      // noop
      this.item = undefined;
    } else {
      // Is this possible? If I am adding, that must
      // mean that the current canonical does not contain
      // the item, so other actors cannot remove it.
    }
  },

  /**
    An add followed by a remove or a remove followed
    by an add in the buffer is a noop.
  */
  compose: function(next) {
    if (next instanceof Remove) {
      this.item = undefined;
    }
  },

  noop: function() {
    return this.item === undefined;
  },

  test: function(snapshot) {
    return !snapshot.has(this.item);
  }
};

export function Remove(item) {
  if (item === undefined) {
    throw new Error("Cannot add undefined to a Set");
  }

  this.item = item;
}

Remove.prototype = {
  toString: function() {
    return 'Remove[' + this.item.toString() + ']';
  },

  apply: function(snapshot) {
    snapshot.remove(this.item);
  },

  isCompatible: function(operation) {
    if (operation instanceof Add || operation instanceof Remove) {
      return this.item === operation.item;
    }
  },

  transform: function(prev) {
    if (prev instanceof Remove) {
      // noop
      this.item = undefined;
    } else {
      // Is this possible? If I am removing, that must
      // mean that the current canonical does contain
      // the item, so other actors cannot add it again.
    }
  },

  /**
    An add followed by a remove or a remove followed
    by an add in the buffer is a noop.
  */
  compose: function(next) {
    if (next instanceof Add) {
      this.item = undefined;
    }
  },

  noop: function() {
    return this.item === undefined;
  },

  test: function(snapshot) {
    return snapshot.has(this.item);
  }
}
