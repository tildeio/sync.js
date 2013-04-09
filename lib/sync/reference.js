import { EventTarget } from "rsvp/events";
import { copy } from "sync/modules/copy";

function Reference(type, id) {
  var canonical;

  if (id === undefined) {
    // TODO: type is metadata, not special
    id = type;
    type = null;
    canonical = {};
  } else if (typeof id !== 'string' && typeof id !== 'number') {
    canonical = id;
    id = type;
    type = null;
  } else {
    canonical = {};
  }

  this.type = type;
  this.id = id;

  // The starting representation of the document
  this.canonical = canonical;
  this.inFlight = null;
  this.buffer = null;
  this.awaitingAck = false;
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
  var snapshot = copy(reference.canonical),
      inFlight = reference.inFlight;

  if (inFlight) { inFlight.apply(snapshot); }

  return snapshot;
}

export function buffer(reference) {
  var snapshot = inFlight(reference),
      buffer = reference.buffer;

  if (buffer) { buffer.apply(snapshot); }

  return snapshot;
}

export function isDirty(reference) {
  return !!(reference.awaitingAck || reference.buffer);
}

export function isSaving(reference) {
  return !!reference.awaitingAck;
}
