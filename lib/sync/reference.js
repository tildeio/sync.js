import { EventTarget } from "rsvp/events";

function Reference(type, id) {
  this.type = type;
  this.id = id;

  this.canonical = {};
  this.inFlight = [];
  this.buffer = [];
}

Reference.prototype = {
  constructor: Reference
};

EventTarget.mixin(Reference.prototype);

export function reference(type, id) {
  return new Reference(type, id);
}

export function canonical(reference) {
  return reference.canonical;
}

export function inFlight(reference) {
  var snapshot = Object.create(reference.canonical);

  reference.inFlight.forEach(function(operation) {
    operation.apply(snapshot);
  });

  return snapshot;
}

export function buffer(reference) {
  var snapshot = inFlight(reference);

  reference.buffer.forEach(function(operation) {
    operation.apply(snapshot);
  });

  return snapshot;
}