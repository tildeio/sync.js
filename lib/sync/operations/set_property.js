export function SetProperty(property, oldValue, newValue) {
  this.property = property;
  this.oldValue = oldValue;
  this.newValue = newValue;
}

SetProperty.prototype = {
  constructor: SetProperty,

  apply: function(hash) {
    hash[this.property] = this.newValue;
  },

  isCompatible: function(other) {
    return other instanceof SetProperty && this.property === other.property;
  },

  transform: function(prev) {
    this.oldValue = prev.newValue;
  }
};