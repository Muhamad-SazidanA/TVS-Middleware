import assert from "node:assert/strict";
import test from "node:test";
import { getNextMismatchTarget } from "../src/utils/mismatchCycle";

test("cycles 1 -> 2 -> 3 -> 1 cleanly across mismatches", () => {
  const targets = [
    { fieldId: "f1", docCode: "Invoice" },
    { fieldId: "f2", docCode: "Invoice" },
    { fieldId: "f3", docCode: "BL" },
  ];

  // No active field yet -> jumps to first mismatch
  const first = getNextMismatchTarget(targets, null);
  assert.equal(first?.fieldId, "f1");

  // Active on 1 -> 2
  const second = getNextMismatchTarget(targets, first!.fieldId);
  assert.equal(second?.fieldId, "f2");

  // Active on 2 -> 3
  const third = getNextMismatchTarget(targets, second!.fieldId);
  assert.equal(third?.fieldId, "f3");

  // Active on 3 -> wraps back to 1
  const wrapped = getNextMismatchTarget(targets, third!.fieldId);
  assert.equal(wrapped?.fieldId, "f1");
});

test("starts at first mismatch of clicked group when activeFieldId belongs to another group", () => {
  const blTargets = [
    { fieldId: "bl-1", docCode: "BL" },
    { fieldId: "bl-2", docCode: "BL" },
  ];

  const jumped = getNextMismatchTarget(blTargets, "inv-1");
  assert.equal(jumped?.fieldId, "bl-1");
});

test("returns same single mismatch when only one mismatch exists and handles empty list", () => {
  assert.equal(getNextMismatchTarget([], "f1"), null);

  const single = [{ fieldId: "only-1", docCode: "Invoice" }];
  assert.equal(getNextMismatchTarget(single, "only-1")?.fieldId, "only-1");
});
