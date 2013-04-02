export function SetProperty(property, oldValue, newValue) {
  this.property = property;
  this.oldValue = oldValue;
  this.newValue = newValue;
}

SetProperty.prototype = {
  constructor: SetProperty,

  toString: function() {
    return "Set[" + this.property + " " + this.oldValue + "->" + this.newValue + "]";
  },

  apply: function(hash) {
    hash[this.property] = this.newValue;
  },

  isCompatible: function(other) {
    return other instanceof SetProperty && this.property === other.property;
  },

  transform: function(prev) {
    this.oldValue = prev.newValue;
  },

  test: function(current) {
    // The null precondition is satisfied with either null or undefined
    if (this.oldValue === null) {
      return current[this.property] == this.oldValue;
    } else {
      return current[this.property] === this.oldValue;
    }
  }
};