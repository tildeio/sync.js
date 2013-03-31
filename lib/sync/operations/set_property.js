export function SetProperty(property, oldValue, newValue) {
  this.property = property;
  this.oldValue = oldValue;
  this.newValue = newValue;
}

SetProperty.prototype = {
  apply: function(hash) {
    hash[this.property] = this.newValue;
  }
};