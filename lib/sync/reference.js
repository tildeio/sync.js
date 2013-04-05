import { EventTarget } from "rsvp/events";
import { copy } from "sync/modules/copy";

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
  var snapshot = copy(reference.canonical);

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

export function isDirty(reference) {
  return reference.inFlight.length !== 0 || reference.buffer.length !== 0;
}

export function isSaving(reference) {
  return reference.inFlight.length !== 0;
}