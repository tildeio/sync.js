export function SetProperty(property, oldValue, newValue) {
  this.property = property;
  this.oldValue = oldValue;
  this.newValue = newValue;
}

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

function debug() {
  console.debug.apply(console, arguments);
}

SetProperty.prototype = {
  constructor: SetProperty,

  toString: function() {
    return "Set[" + this.property + " " + this.oldValue + "->" + this.newValue + "]";
  },

  apply: function(hash) {
    debug('apply', this.toString(), 'to', hash);
    hash[this.property] = this.newValue;
  },

  isCompatible: function(other) {
    debug('checking compatibility of', this.toString(), 'with', other.toString());
    return other instanceof SetProperty && this.property === other.property;
  },

  transform: function(prev) {
    debug('transforming', this.toString(), 'against', prev.toString());

    if (this.property === prev.property) {
      return [
        new SetProperty(this.property, prev.newValue, this.newValue),
        new SetProperty(this.property, null, null)
      ];
    } else {
      return [
        new SetProperty(this.property, this.oldValue, this.newValue),
        new SetProperty(prev.property, prev.oldValue, prev.newValue)
      ];
    }
  },

  compose: function(next) {
    debug('composing', this.toString(), 'with', next.toString());
    this.newValue = next.newValue;
  },

  noop: function() {
    debug('checking', this.toString(), 'for noop');
    return this.oldValue === this.newValue;
  },

  test: function(current) {
    debug('testing precondition of', this.toString(), 'against snapshot', current);
    // The null precondition is satisfied with either null or undefined
    if (this.oldValue === null) {
      return current[this.property] == this.oldValue;
    } else {
      return current[this.property] === this.oldValue;
    }
  }
};
