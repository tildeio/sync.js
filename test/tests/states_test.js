import { reference, isDirty, isSaving } from "sync/reference";
import { applyToCanonical, applyToBuffer } from "sync/operation";
import { SetProperty } from "sync/operations/set_property";
import { saving, saved } from "sync/lifecycle";

var ref;

function Type() {}

module("States", {
  setup: function() {
    ref = reference(Type, 1);
  }
});

function expectDirty(ref, expected) {
  var actual = isDirty(ref);
  QUnit.push(actual === expected, actual, expected, "isDirty(reference) should return " + expected);
}

function expectSaving(ref, expected) {
  var actual = isSaving(ref);
  QUnit.push(actual === expected, actual, expected, "isSaving(reference) should return " + expected);
}

test("Initially, a reference is neither dirty nor saving", function() {
  expectDirty(ref, false);
  expectSaving(ref, false);
});

test("After making a change to canonical, a reference is still neither dirty nor saving", function() {
  applyToCanonical(ref, new SetProperty('firstName', null, 'Tom'));

  expectDirty(ref, false);
  expectSaving(ref, false);
});

test("After making a change to the buffer, a reference is dirty", function() {
  applyToBuffer(ref, new SetProperty('firstName', null, 'Tom'));

  expectDirty(ref, true);
  expectSaving(ref, false);
});

test("After marking a reference as saving, it is both dirty and saving", function() {
  applyToBuffer(ref, new SetProperty('firstName', null, 'Tom'));
  saving(ref);

  expectDirty(ref, true);
  expectSaving(ref, true);
});

test("After acknowledging a reference, it is no longer dirty or saving", function() {
  applyToBuffer(ref, new SetProperty('firstName', null, 'Tom'));
  saving(ref);
  saved(ref);

  expectDirty(ref, false);
  expectSaving(ref, false);
});

test("Acknowledging a record as saved leaves it dirty if there were intervening changes to the buffer", function() {
  applyToBuffer(ref, new SetProperty('firstName', null, 'Tom'));
  saving(ref);

  applyToBuffer(ref, new SetProperty('firstName', 'Tom', 'Thomas'));

  saved(ref);

  expectDirty(ref, true);
  expectSaving(ref, false);
});

test("If a buffered operation reverses itself, the reference is no longer dirty", function() {
  applyToBuffer(ref, new SetProperty('firstName', null, 'Tom'));
  applyToBuffer(ref, new SetProperty('firstName', 'Tom', null));

  expectDirty(ref, false);
  expectSaving(ref, false);
});

test("If there are remaining operations, the reference is still dirty", function() {
  applyToBuffer(ref, new SetProperty('firstName', null, 'Tom'));
  applyToBuffer(ref, new SetProperty('lastName', null, 'Dale'));
  applyToBuffer(ref, new SetProperty('firstName', 'Tom', null));

  expectDirty(ref, true);
  expectSaving(ref, false);
});

test("If an update to canonical makes a buffered operation a no-op, it is no longer saving", function() {
  applyToCanonical(ref, new SetProperty('firstName', null, 'Thomas'));
  applyToBuffer(ref, new SetProperty('firstName', 'Thomas', 'Tom'));

  // This should make the buffered operation a noop
  applyToCanonical(ref, new SetProperty('firstName', 'Thomas', 'Tom'));

  expectDirty(ref, false);
  expectSaving(ref, false);
});

// TODO: Noop operations