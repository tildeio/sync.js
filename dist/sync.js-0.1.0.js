(function(globals) {
var define, requireModule;

(function() {
  var registry = {}, seen = {};

  define = function(name, deps, callback) {
    registry[name] = { deps: deps, callback: callback };
  };

  define.registry = registry;
  define.seend = seen;

  requireModule = function(name) {
    if (seen[name]) { return seen[name]; }
    seen[name] = {};

    if (!registry[name]) {
      throw new Error("Could not find module " + name);
    }

    var mod = registry[name],
        deps = mod.deps,
        callback = mod.callback,
        reified = [],
        exports;

    for (var i=0, l=deps.length; i<l; i++) {
      if (deps[i] === 'exports') {
        reified.push(exports = {});
      } else {
        reified.push(requireModule(deps[i]));
      }
    }

    var value = callback.apply(this, reified);
    return seen[name] = exports || value;
  };
})();

define("lib/sync/reference",
  ["rsvp/events","sync/modules/copy","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var EventTarget = __dependency1__.EventTarget;
    var copy = __dependency2__.copy;

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

    function reference(type, id) {
      return new Reference(type, id);
    }

    function canonical(reference) {
      return reference.canonical;
    }

    function canonicalOp(reference) {
      return reference.canonicalOp;
    }

    function inFlight(reference) {
      var snapshot = copy(reference.canonical),
          inFlight = reference.inFlight;

      if (inFlight) { inFlight.apply(snapshot); }

      return snapshot;
    }

    function buffer(reference) {
      var snapshot = inFlight(reference),
          buffer = reference.buffer;

      if (buffer) { buffer.apply(snapshot); }

      return snapshot;
    }

    function isDirty(reference) {
      return !!(reference.awaitingAck || reference.buffer);
    }

    function isSaving(reference) {
      return !!reference.awaitingAck;
    }

    __exports__.reference = reference;
    __exports__.canonical = canonical;
    __exports__.canonicalOp = canonicalOp;
    __exports__.inFlight = inFlight;
    __exports__.buffer = buffer;
    __exports__.isDirty = isDirty;
    __exports__.isSaving = isSaving;
  });
window.sync = requireModule("sync");
})(window);