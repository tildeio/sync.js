QUnit.config.testTimeout = 200;

export function async(callback, binding) {
  stop();

  return function() {
    start();
    if (callback) {
      return callback.apply(binding, arguments);
    }
  };
}

export function expectCall(callback, binding) {
  return async(callback, binding);
}
