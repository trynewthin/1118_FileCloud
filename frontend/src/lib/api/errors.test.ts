import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { getErrorMessage, getErrorStatus, isAbortError } from "./errors";

describe("API error details", () => {
  it("preserves messages from Error instances and structured API errors", () => {
    assert.equal(getErrorMessage(new Error("network"), "fallback"), "network");
    assert.equal(getErrorMessage({ message: "API failure" }, "fallback"), "API failure");
  });

  it("safely falls back for missing or malformed messages", () => {
    for (const error of [undefined, null, 42, "error", {}, { message: 42 }, { message: "" }]) {
      assert.equal(getErrorMessage(error, "fallback"), "fallback");
    }
  });

  it("only accepts numeric status codes", () => {
    assert.equal(getErrorStatus({ status: 404 }), 404);
    for (const error of [null, undefined, {}, { status: "404" }]) {
      assert.equal(getErrorStatus(error), undefined);
    }
  });

  it("identifies abort exceptions without treating arbitrary values as errors", () => {
    assert.equal(isAbortError({ name: "AbortError" }), true);
    assert.equal(isAbortError(new Error("request aborted")), true);
    assert.equal(isAbortError(new Error("network error")), false);
    assert.equal(isAbortError(null), false);
  });
});
