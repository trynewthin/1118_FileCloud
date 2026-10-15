import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boundaryRule, checkBoundaries } from "./check-boundaries.mjs";

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "filecloud-boundaries-"));
  roots.push(root);
  const content = {
    "backend/tsconfig.json": JSON.stringify({ compilerOptions: { moduleResolution: "bundler", module: "ESNext", baseUrl: ".", paths: { "@modules/*": ["src/modules/*"] } } }),
    "frontend/tsconfig.app.json": JSON.stringify({ compilerOptions: { moduleResolution: "bundler", module: "ESNext", baseUrl: ".", paths: { "@/*": ["src/*"] } } }),
    "frontend/src/main.ts": "export {};",
    "backend/src/modules/alpha/service.ts": "export const value = 1; export type Value = number;",
    ...files,
  };
  for (const [relative, source] of Object.entries(content)) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, source);
  }
  return root;
}

function run(files, baseline = []) {
  return checkBoundaries({ root: fixture(files), baseline });
}

const exception = {
  rule: "cross-module-public-api",
  from: "backend/src/modules/beta/service.ts",
  to: "backend/src/modules/alpha/service.ts",
  reason: "Legacy dependency pending a narrow public API.",
};

describe("module boundaries", () => {
  test("allows own-module, core and public API imports plus composition wiring", () => {
    const result = run({
      "backend/src/core/security.ts": "export const key = 1;",
      "backend/src/modules/alpha/index.ts": 'export { value } from "./service.ts";',
      "backend/src/modules/beta/service.ts": 'import { value } from "../alpha/index.ts"; import { key } from "../../core/security.ts";',
      "backend/src/server.ts": 'import { value } from "./modules/alpha/service.ts";',
    });
    expect(result.violations).toEqual([]);
  });

  for (const source of [
    'import {\n value\n } from "../alpha/service.ts";',
    'export { value } from "../alpha/service.ts";',
    'const value = await import("../alpha/service.ts");',
    'const value = require("../alpha/service.ts");',
    'type Value = import("../alpha/service.ts").Value;',
    'import alpha = require("../alpha/service.ts");',
    'const value = await import(`../alpha/service.ts`);',
    'import { value } from "@modules/alpha/service";',
  ]) {
    test(`detects deep imports: ${source}`, () => {
      const result = run({ "backend/src/modules/beta/service.ts": source });
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toMatchObject({ rule: exception.rule, from: exception.from, to: exception.to });
    });
  }

  test("does not read apparent imports in comments or strings", () => {
    const result = run({ "backend/src/modules/beta/service.ts": '// import x from "../alpha/service.ts";\nconst s = \'require("../alpha/service.ts")\';' });
    expect(result.violations).toEqual([]);
  });

  test("blocks core reverse imports and module imports of composition", () => {
    const result = run({
      "backend/src/core/leak.ts": 'import { value } from "../modules/alpha/service.ts";',
      "backend/src/server.ts": "export {};",
      "backend/src/modules/beta/service.ts": 'import "../../server.ts";',
    });
    expect(result.violations.map((entry) => entry.rule).sort()).toEqual(["core-must-not-depend-on-application", "module-must-not-depend-on-composition"]);
  });

  test("blocks frontend/backend source coupling in both directions", () => {
    const result = run({
      "frontend/src/main.ts": 'import { value } from "../../backend/src/modules/alpha/service.ts";',
      "backend/src/modules/beta/service.ts": 'import "../../../../frontend/src/main.ts";',
    });
    expect(result.violations).toHaveLength(2);
    expect(result.violations.every((entry) => entry.rule === "separate-applications")).toBe(true);
  });

  test("does not allow nested index.ts to masquerade as a module public API", () => {
    expect(boundaryRule("backend/src/modules/beta/service.ts", "backend/src/modules/alpha/private/index.ts")).toBe("cross-module-public-api");
  });

  test("records only the exact legacy edge and rejects new callers", () => {
    const result = run({
      "backend/src/modules/beta/service.ts": 'import "../alpha/service.ts";',
      "backend/src/modules/beta/new.ts": 'import "../alpha/service.ts";',
    }, [exception]);
    expect(result.exceptionCount).toBe(1);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].from).toBe("backend/src/modules/beta/new.ts");
  });

  test("fails stale, duplicate and broad baseline entries", () => {
    const result = run({}, [exception, exception, { ...exception, from: "backend/src/modules/beta/*" }]);
    expect(result.staleExceptions).toHaveLength(1);
    expect(result.baselineErrors).toHaveLength(2);
  });

  test("cannot baseline core-to-module or frontend-to-backend violations", () => {
    const result = run({}, [{ ...exception, rule: "core-must-not-depend-on-application", from: "backend/src/core/leak.ts" }]);
    expect(result.baselineErrors).toHaveLength(1);
  });

  test("rejects computed imports and unresolved aliases instead of skipping them", () => {
    const result = run({ "backend/src/modules/beta/service.ts": 'const name = "x"; import(name); require(name); import "@modules/missing/service";' });
    expect(result.violations.map((entry) => entry.rule)).toEqual(["non-literal-import", "non-literal-import", "cross-module-public-api", "unresolved-local-import"]);
  });

  test("allows frontend assets and aliases while omitting test-only imports", () => {
    const result = run({
      "frontend/src/main.ts": 'import "@/style.css"; import "./icon.svg"; import "@/component";',
      "frontend/src/style.css": "body {}",
      "frontend/src/icon.svg": "<svg/>",
      "frontend/src/component.ts": "export {};",
      "backend/src/modules/beta/service.test.ts": 'import "../alpha/service.ts";',
    });
    expect(result.violations).toEqual([]);
  });
});

const filesRouter = "backend/src/modules/files/router.ts";
const filesRouteBoundary = "files-router-application-boundary";
const filesystemBoundary = "files-router-read-only-filesystem";

describe("files route application boundary", () => {
  for (const source of [
    'import { db } from "../../core/db/index.ts";',
    'export { db } from "../../core/db/index.ts";',
    'const db = require("../../core/db/index.ts");',
    'const db = await import("../../core/db/index.ts");',
    'type Db = import("../../core/db/index.ts").Db;',
    'import "@modules/tasks/index";',
    'import "../tasks/service.ts";',
    'export * from "../tasks/index.ts";',
  ]) {
    test(`blocks direct persistence and task dependencies: ${source}`, () => {
      const result = run({
        [filesRouter]: source,
        "backend/src/core/db/index.ts": "export const db = {}; export type Db = {};",
        "backend/src/modules/tasks/index.ts": "export {};",
        "backend/src/modules/tasks/service.ts": "export {};",
      });
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toMatchObject({ from: filesRouter, rule: filesRouteBoundary, line: 1 });
    });
  }

  test("cannot baseline a files-route dependency as a legacy cross-module edge", () => {
    const result = run({
      [filesRouter]: 'import "../tasks/service.ts";',
      "backend/src/modules/tasks/service.ts": "export {};",
    }, [{ ...exception, from: filesRouter, to: "backend/src/modules/tasks/service.ts" }]);
    expect(result.baselineErrors).toHaveLength(1);
    expect(result.violations[0].rule).toBe(filesRouteBoundary);
    expect(result.exceptionCount).toBe(0);
  });

  test("allows files application services to own writes and task dispatch", () => {
    const result = run({
      [filesRouter]: 'import { upload } from "./application.ts";',
      "backend/src/modules/files/application.ts": 'import fs from "node:fs"; import "../../core/db/index.ts"; import "../tasks/index.ts"; export const upload = () => fs.writeFileSync("file", "data");',
      "backend/src/core/db/index.ts": "export {};",
      "backend/src/modules/tasks/index.ts": "export {};",
    });
    expect(result.violations).toEqual([]);
  });
});

describe("files route read-only filesystem capabilities", () => {
  // Check access to a capability, not just obvious calls. Renaming a write method,
  // passing a namespace, or storing it in an object must not hide a route write.
  for (const source of [
    'import fs from "node:fs"; fs.writeFileSync("x", "data");',
    'import io from "fs"; io.mkdirSync("x");',
    'import * as io from "node:fs"; io.unlink("x", () => {});',
    'import { writeFileSync as save } from "fs"; save("x", "data");',
    'import { renameSync } from "node:fs";',
    'import fs = require("node:fs"); fs.rmSync("x");',
    'import { promises as disk } from "fs"; disk.writeFile("x", "data");',
    'import disk from "node:fs/promises"; disk.mkdir("x");',
    'import * as disk from "fs/promises"; disk.rename("x", "y");',
    'import { unlink as remove } from "node:fs/promises"; remove("x");',
    'import fs from "fs"; fs.promises.writeFile("x", "data");',
    'import fs from "node:fs"; const disk = fs; const other = disk; other.appendFileSync("x", "data");',
    'import fs from "node:fs"; const { mkdirSync: make } = fs;',
    'import fs from "node:fs"; const { promises: disk } = fs; disk.unlink("x");',
    'import fs from "node:fs"; const { promises: { writeFile: save } } = fs;',
    'const { writeFileSync: save } = require("fs");',
    'const disk = require("node:fs/promises"); disk.writeFile("x", "data");',
    'const { default: disk } = await import("node:fs"); disk.writeFileSync("x", "data");',
    'const disk = await import("fs/promises"); disk.unlink("x");',
    'require("node:fs").writeFileSync("x", "data");',
    '(await import("fs")).promises.rm("x");',
    'import fs from "node:fs"; fs["writeFileSync"]("x", "data");',
    'import fs from "node:fs"; fs[`writeFileSync`]("x", "data");',
    'import fs from "node:fs"; fs[method]("x", "data");',
    'import fs from "node:fs"; const { [method]: save } = fs;',
    'import fs from "node:fs"; const { ...disk } = fs;',
    'import fs from "node:fs"; mutate(fs);',
    'import fs from "node:fs"; const boxed = { fs };',
    'import fs from "node:fs"; const boxed = { ...fs };',
    'import fs from "node:fs"; function getDisk() { return fs; }',
    'import fs from "node:fs"; let disk; disk = fs;',
    'import fs from "node:fs"; export { fs };',
    'import fs from "node:fs"; const disk = fs; export { disk };',
    'export * from "node:fs";',
    'export { writeFile } from "node:fs/promises";',
    'Bun.write("x", "data");',
    'const save = Bun["write"];',
    // Opening a descriptor can grant write access, so it is intentionally outside
    // the route's small download API even when a particular call uses "r".
    'import fs from "node:fs"; fs.openSync("x", "r");',
  ]) {
    test(`rejects writes or escaping namespaces: ${source}`, () => {
      const result = run({ [filesRouter]: source });
      expect(result.violations).not.toHaveLength(0);
      expect(result.violations.every((entry) => entry.rule === filesystemBoundary)).toBe(true);
    });
  }

  for (const source of [
    'import { statSync, createReadStream, type Stats } from "node:fs"; statSync("x"); createReadStream("x", { start: 0, end: 10 });',
    'import { statSync as size, createReadStream as stream } from "fs"; size("x"); stream("x");',
    'import fs from "node:fs"; fs.statSync("x"); fs.createReadStream("x");',
    'import * as disk from "fs"; disk["statSync"]("x"); disk[`createReadStream`]("x");',
    'import fs = require("node:fs"); fs.statSync("x");',
    'import fs from "node:fs"; const disk = fs; const other = disk; other.statSync("x");',
    'import fs from "node:fs"; const { statSync: readStat, createReadStream: stream } = fs; readStat("x"); stream("x");',
    'import { promises as disk } from "fs"; await disk.stat("x");',
    'import disk from "node:fs/promises"; await disk.stat("x");',
    'import { stat as readStat } from "fs/promises"; await readStat("x");',
    'import fs from "node:fs"; const { promises: disk } = fs; await disk.stat("x");',
    'import fs from "node:fs"; const { promises: { stat: readStat } } = fs; await readStat("x");',
    'const { statSync: readStat } = require("node:fs"); readStat("x");',
    'const disk = await import("fs/promises"); await disk.stat("x");',
    'const { default: disk } = await import("node:fs"); disk.createReadStream("x");',
    'import fs from "node:fs"; (fs as typeof fs).statSync("x");',
    'import fs from "node:fs"; function unrelated(fs: { writeFileSync(): void }) { fs.writeFileSync(); } fs.statSync("x");',
    'const fs = { writeFileSync() {} }; fs.writeFileSync(); const Bun = { write() {} }; Bun.write();',
    'import type { Stats } from "node:fs"; import { type WriteStream } from "fs"; type Disk = typeof import("fs");',
    '// fs.writeFileSync("x", "data");\nconst example = \'Bun.write("x", "data")\';',
  ]) {
    test(`allows download reads, types and unrelated bindings: ${source}`, () => {
      expect(run({ [filesRouter]: source }).violations).toEqual([]);
    });
  }

  test("does not allow a baseline to suppress filesystem violations", () => {
    const result = run({ [filesRouter]: 'import { writeFile } from "fs";' }, [
      { ...exception, rule: filesystemBoundary, from: filesRouter, to: "fs.writeFile" },
    ]);
    expect(result.baselineErrors).toHaveLength(1);
    expect(result.violations[0].rule).toBe(filesystemBoundary);
  });

  test("reports the source line and excludes test sources", () => {
    const result = run({
      [filesRouter]: 'import fs from "node:fs";\n\nfs.writeFileSync("x", "data");',
      "backend/src/modules/files/router.test.ts": 'import fs from "fs"; import "../tasks/service.ts"; fs.writeFileSync("x", "data");',
      "backend/src/modules/files/tests/router.ts": 'import fs from "fs"; fs.writeFileSync("x", "data");',
    });
    expect(result.violations).toEqual([{ from: filesRouter, to: "fs.writeFileSync", rule: filesystemBoundary, line: 3 }]);
    expect(result.files).not.toContain("backend/src/modules/files/router.test.ts");
    expect(result.files).not.toContain("backend/src/modules/files/tests/router.ts");
  });
});


describe("migrated public APIs", () => {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  // Parse imports only. Loading a public API here would open the configured DB.
  const production = checkBoundaries({ root: repositoryRoot });
  const imports = new Map();
  for (const { from, to } of production.edges) {
    if (!imports.has(from)) imports.set(from, []);
    imports.get(from).push(to);
  }

  function dependencies(entry, visited = new Set(), active = []) {
    if (active.includes(entry)) throw new Error(`Public API import cycle: ${[...active, entry].join(" -> ")}`);
    if (visited.has(entry)) return visited;
    visited.add(entry);
    for (const target of imports.get(entry) ?? []) dependencies(target, visited, [...active, entry]);
    return visited;
  }

  test("production needs no grandfathered deep-import exceptions", () => {
    const baseline = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "scripts/boundary-baseline.json"), "utf8"));
    expect(baseline).toEqual([]);
    expect(production.violations).toEqual([]);
    expect(production.exceptionCount).toBe(0);
  });

  test("files public API never loads file handlers or media implementations", () => {
    const reachable = [...dependencies("backend/src/modules/files/index.ts")];
    expect(reachable).toContain("backend/src/modules/files/taskTypes.ts");
    expect(reachable).not.toContain("backend/src/modules/files/fileOpsTasks.ts");
    expect(reachable).not.toContain("backend/src/modules/files/indexTasks.ts");
    expect(reachable.some((file) => file.startsWith("backend/src/modules/fileContent/"))).toBe(false);
    expect(reachable.some((file) => /\/(?:router|module)\.ts$/.test(file))).toBe(false);
  });

  test("task identifiers have no imports and preserve queued task types", () => {
    const contract = "backend/src/modules/files/taskTypes.ts";
    expect(imports.get(contract) ?? []).toEqual([]);
    const source = fs.readFileSync(path.join(repositoryRoot, contract), "utf8");
    const identifiers = [...source.matchAll(/export const (TASK_TYPE_FILE_\w+) = "([A-Z_]+)";/g)]
      .map(([, name, value]) => [name, value]);
    expect(identifiers).toEqual([
      ["TASK_TYPE_FILE_DELETE_ENTRY", "FILE_DELETE_ENTRY"],
      ["TASK_TYPE_FILE_RESTORE_ENTRY", "FILE_RESTORE_ENTRY"],
      ["TASK_TYPE_FILE_DESTROY_ENTRY", "FILE_DESTROY_ENTRY"],
      ["TASK_TYPE_FILE_RENAME_ENTRY", "FILE_RENAME_ENTRY"],
      ["TASK_TYPE_FILE_MOVE_ENTRY", "FILE_MOVE_ENTRY"],
      ["TASK_TYPE_FILE_COPY_ENTRY", "FILE_COPY_ENTRY"],
      ["TASK_TYPE_FILE_INDEX_LIBRARY", "FILE_INDEX_LIBRARY"],
      ["TASK_TYPE_FILE_INDEX_SINGLE", "FILE_INDEX_SINGLE"],
    ]);
  });

  for (const module of ["settings", "tasks", "fileContent"]) {
    test(`${module} public API is acyclic and does not load HTTP routes or module startup`, () => {
      const reachable = [...dependencies(`backend/src/modules/${module}/index.ts`)];
      expect(reachable.some((file) => /\/(?:router|module)\.ts$/.test(file))).toBe(false);
    });
  }
});
