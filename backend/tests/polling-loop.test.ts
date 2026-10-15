import { expect, test } from "bun:test";
import { createPollingLoop } from "../src/modules/coreServices/pollingLoop.ts";
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test("polling is single-flight, idempotent, and stop invalidates pending work", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  let writes = 0;
  const loop = createPollingLoop(async current => {
    calls++;
    await gate;
    if (current()) writes++;
  }, () => {});
  loop.start(2);
  loop.start(2);
  await delay(20);
  expect(calls).toBe(1);
  let stopped = false;
  const stop = loop.stop().then(() => { stopped = true; });
  await delay(5);
  expect(stopped).toBe(false);
  expect(() => loop.start(2)).toThrow("stopping");
  release();
  await stop;
  await delay(10);
  expect(writes).toBe(0);
  expect(calls).toBe(1);
  loop.start(1000);
  await delay(5);
  await loop.stop();
  expect(writes).toBe(1);
});

test("probe rejection is contained and later polls still run", async () => {
  let calls = 0;
  let errors = 0;
  const loop = createPollingLoop(async () => {
    calls++;
    if (calls === 1) throw new Error("temporary database error");
  }, () => { errors++; });
  expect(() => loop.start(0)).toThrow();
  loop.start(2);
  try {
    const deadline = Date.now() + 1000;
    while (calls < 2 && Date.now() < deadline) await delay(5);
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(errors).toBe(1);
  } finally { await loop.stop(); }
});
