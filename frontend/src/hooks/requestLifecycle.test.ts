import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { createRequestLifecycle } from "./requestLifecycle";

describe("request lifecycle", () => {
  it("ignores calls before mounting and after unmounting", () => {
    const lifecycle = createRequestLifecycle<string>();
    assert.equal(lifecycle.begin("a"), null);
    lifecycle.activate("a");
    const request = lifecycle.begin("a")!;
    assert.equal(lifecycle.isCurrent(request), true);
    lifecycle.deactivate();
    assert.equal(lifecycle.isCurrent(request), false);
    assert.equal(lifecycle.begin("a"), null);
  });

  it("only publishes the newest overlapping request", () => {
    const lifecycle = createRequestLifecycle<string>();
    lifecycle.activate("a");
    const older = lifecycle.begin("a")!;
    const newer = lifecycle.begin("a")!;
    assert.equal(lifecycle.isCurrent(older), false);
    assert.equal(lifecycle.isCurrent(newer), true);
  });

  it("rejects old task callbacks after navigating to a different resource", () => {
    const lifecycle = createRequestLifecycle<string>();
    lifecycle.activate("directory-a");
    const oldRequest = lifecycle.begin("directory-a")!;
    lifecycle.activate("directory-b");
    assert.equal(lifecycle.accepts("directory-a"), false);
    assert.equal(lifecycle.begin("directory-a"), null);
    assert.equal(lifecycle.isCurrent(oldRequest), false);
    const newRequest = lifecycle.begin("directory-b")!;
    assert.equal(lifecycle.isCurrent(newRequest), true);
  });

  it("does not revive a response across Strict Mode cleanup and remount", () => {
    const lifecycle = createRequestLifecycle<string>();
    lifecycle.activate("same-resource");
    const abandoned = lifecycle.begin("same-resource")!;
    lifecycle.deactivate();
    lifecycle.activate("same-resource");
    const current = lifecycle.begin("same-resource")!;
    assert.equal(lifecycle.isCurrent(abandoned), false);
    assert.equal(lifecycle.isCurrent(current), true);
  });
});
