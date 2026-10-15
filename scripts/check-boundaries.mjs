#!/usr/bin/env bun
/** Check source imports without executing application code or loading its database. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(repositoryRoot, "backend/package.json"));
const ts = require("typescript");
const sourcePattern = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const testPattern = /(?:^|\/)(?:__tests__|tests)(?:\/|$)|\.(?:test|spec)\.[^.]+$/;
const slash = (value) => value.split(path.sep).join("/");
const moduleName = (file) => file.match(/^backend\/src\/modules\/([^/]+)\//)?.[1];
const edgeKey = ({ rule, from, to }) => `${rule}: ${from} -> ${to}`;

function sourceFiles(directory) {
  if (!fs.existsSync(directory)) throw new Error(`Missing source directory: ${directory}`);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (testPattern.test(slash(file))) return [];
    if (entry.isDirectory()) return sourceFiles(file);
    return entry.isFile() && sourcePattern.test(file) ? [file] : [];
  }).sort();
}

function compilerOptions(root, side) {
  const configPath = path.join(root, side === "frontend" ? "frontend/tsconfig.app.json" : "backend/tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
  if (parsed.errors.length) throw new Error(parsed.errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n"));
  return parsed.options;
}

export function boundaryRule(from, to) {
  const side = from.split("/")[0];
  if ((side === "frontend" && to.startsWith("backend/")) || (side === "backend" && to.startsWith("frontend/"))) {
    return "separate-applications";
  }
  const composition = /^(?:backend\/src\/(?:app|server)\.ts|backend\/src\/modules\/index\.ts)$/;
  if (from.startsWith("backend/src/core/") && (to.startsWith("backend/src/modules/") || composition.test(to))) {
    return "core-must-not-depend-on-application";
  }
  const owner = moduleName(from);
  if (owner && composition.test(to)) return "module-must-not-depend-on-composition";
  const dependency = moduleName(to);
  if (from === "backend/src/modules/files/router.ts" &&
    (to === "backend/src/core/db.ts" || to.startsWith("backend/src/core/db/") || dependency === "tasks")) {
    return "files-router-application-boundary";
  }
  if (owner && dependency && owner !== dependency && to !== `backend/src/modules/${dependency}/index.ts`) {
    return "cross-module-public-api";
  }
  return null;
}

/** Static imports, exports, import types, import-equals, require and dynamic imports. */
function importsOf(source, report) {
  const imports = [];
  function add(node, value) {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    if (value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))) {
      imports.push({ specifier: value.text, line });
    } else {
      report({ rule: "non-literal-import", to: "<computed import>", line });
    }
  }
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) add(node, node.moduleSpecifier);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) add(node, node.moduleReference.expression);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) add(node, node.argument.literal);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) add(node, node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return imports;
}

// Keep this route on the two filesystem capabilities needed to stream downloads.
// This is a conservative capability boundary, not an arbitrary-JavaScript sandbox:
// unknown/computed members and escaped namespaces fail instead of needing a growing
// blacklist of write APIs. Types do not grant runtime filesystem capabilities.
// It does not prove the effects of arbitrary arguments or custom stream options.
const filesystemModules = new Map([
  ["fs", "fs"], ["node:fs", "fs"],
  ["fs/promises", "promises"], ["node:fs/promises", "promises"],
]);
const filesystemReads = {
  fs: new Set(["statSync", "createReadStream"]),
  promises: new Set(["stat"]),
};

function checkFilesRouterCapabilities(source, report) {
  // Bind only this source, without resolving or executing its application imports.
  // Symbol identity matters: a locally shadowed `fs` is not the imported namespace.
  const options = { noLib: true, noResolve: true };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (name) => name === source.fileName ? source : undefined;
  const checker = ts.createProgram([source.fileName], options, host).getTypeChecker();
  const namespaces = new Map();
  const declarations = new Set();
  const nodes = [];
  const collect = (node) => { nodes.push(node); ts.forEachChild(node, collect); };
  collect(source);
  const fail = (node, to) => report({
    rule: "files-router-read-only-filesystem", to,
    line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
  });
  const symbolOf = (node) => ts.isShorthandPropertyAssignment(node.parent)
    ? checker.getShorthandAssignmentValueSymbol(node.parent)
    : ts.isExportSpecifier(node.parent) && node === (node.parent.propertyName ?? node.parent.name)
      ? checker.getExportSpecifierLocalTargetSymbol(node.parent)
      : checker.getSymbolAtLocation(node);
  const literal = (node) => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;
  const property = (node) => ts.isComputedPropertyName(node) ? literal(node.expression)
    : ts.isIdentifier(node) ? node.text : literal(node);
  const member = (kind, name) => name === "default" ? kind
    : kind === "fs" && name === "promises" ? "promises"
    : filesystemReads[kind].has(name) ? "read" : undefined;
  const transparent = (node) => ts.isParenthesizedExpression(node) || ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node) ||
    ts.isSatisfiesExpression(node) || ts.isAwaitExpression(node);
  const capability = (node) => {
    if (transparent(node)) return capability(node.expression);
    if (ts.isIdentifier(node)) return namespaces.get(symbolOf(node));
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const kind = capability(node.expression);
      const selected = kind && member(kind, ts.isPropertyAccessExpression(node) ? node.name.text : literal(node.argumentExpression));
      return selected === "read" ? undefined : selected;
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
      return filesystemModules.get(literal(node.arguments[0]));
    }
    return undefined;
  };
  const bind = (name, kind, validate) => {
    if (ts.isIdentifier(name)) {
      const symbol = checker.getSymbolAtLocation(name);
      if (symbol) namespaces.set(symbol, kind);
      declarations.add(name);
    } else if (ts.isObjectBindingPattern(name)) {
      for (const element of name.elements) {
        const key = property(element.propertyName ?? element.name);
        const selected = !element.dotDotDotToken && member(kind, key);
        if (!selected || element.initializer) {
          if (validate) fail(element, `${kind}.${key ?? "<computed/rest binding>"}`);
        } else if (selected !== "read") bind(element.name, selected, validate);
      }
    } else if (validate) fail(name, `${kind}.<namespace escape>`);
  };

  for (const node of nodes) {
    if (ts.isImportDeclaration(node)) {
      const kind = filesystemModules.get(literal(node.moduleSpecifier));
      const clause = node.importClause;
      if (!kind || !clause || clause.isTypeOnly) continue;
      if (clause.name) bind(clause.name, kind, true);
      if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) bind(clause.namedBindings.name, kind, true);
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const imported of clause.namedBindings.elements) {
          if (imported.isTypeOnly) continue;
          const name = (imported.propertyName ?? imported.name).text;
          const selected = member(kind, name);
          if (!selected) fail(imported, `${kind}.${name}`);
          else if (selected !== "read") bind(imported.name, selected, true);
        }
      }
    } else if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly && ts.isExternalModuleReference(node.moduleReference)) {
      const kind = filesystemModules.get(literal(node.moduleReference.expression));
      if (kind) bind(node.name, kind, true);
    } else if (ts.isExportDeclaration(node) && !node.isTypeOnly && filesystemModules.has(literal(node.moduleSpecifier))) {
      fail(node, `${literal(node.moduleSpecifier)}.<re-export>`);
    }
  }
  // Follow declaration aliases and nested destructuring to a fixed point. Other
  // namespace transfers (assignment, arguments, returns, object spread) are rejected.
  let previousSize;
  do {
    previousSize = namespaces.size;
    for (const node of nodes) {
      if (!ts.isVariableDeclaration(node) || !node.initializer) continue;
      const kind = capability(node.initializer);
      if (kind) bind(node.name, kind, false);
    }
  } while (namespaces.size !== previousSize);

  for (const node of nodes) {
    if (declarations.has(node)) continue;
    let typeOnly = false;
    for (let ancestor = node; ancestor && !ts.isStatement(ancestor); ancestor = ancestor.parent) {
      if (ts.isTypeNode(ancestor)) { typeOnly = true; break; }
    }
    if (typeOnly) continue;
    // Bun.write is a global write capability, even when extracted into an alias.
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const name = ts.isPropertyAccessExpression(node) ? node.name.text : literal(node.argumentExpression);
      if (name === "write" && ts.isIdentifier(node.expression) && node.expression.text === "Bun" && !symbolOf(node.expression)) {
        fail(node, "Bun.write");
      }
    }
    const kind = capability(node);
    if (!kind) continue;
    const parent = node.parent;
    if (transparent(parent) && parent.expression === node) continue;
    if ((ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) && parent.expression === node) {
      const name = ts.isPropertyAccessExpression(parent) ? parent.name.text : literal(parent.argumentExpression);
      if (!member(kind, name)) fail(parent, `${kind}.${name ?? "<computed member>"}`);
    } else if (ts.isVariableDeclaration(parent) && parent.initializer === node) {
      bind(parent.name, kind, true);
    } else {
      fail(node, `${kind}.<namespace escape>`);
    }
  }
}

export function checkBoundaries({ root = repositoryRoot, baseline = [] } = {}) {
  root = path.resolve(root);
  const violations = [];
  const files = [];
  const edges = [];
  const baselineErrors = [];
  const exceptions = new Map();
  if (!Array.isArray(baseline)) throw new Error("Boundary baseline must be an array");
  for (const exception of baseline) {
    if (!exception || exception.rule !== "cross-module-public-api" ||
      typeof exception.from !== "string" || typeof exception.to !== "string" ||
      typeof exception.reason !== "string" || exception.reason.trim().length < 10 ||
      /[?*\\]/.test(exception.from + exception.to) ||
      boundaryRule(exception.from, exception.to) !== exception.rule) {
      baselineErrors.push(`Invalid exception: ${JSON.stringify(exception)}`);
      continue;
    }
    const key = edgeKey(exception);
    if (exceptions.has(key)) baselineErrors.push(`Duplicate exception: ${key}`);
    exceptions.set(key, exception);
  }
  const usedExceptions = new Set();
  for (const side of ["backend", "frontend"]) {
    const options = compilerOptions(root, side);
    const cache = ts.createModuleResolutionCache(root, (name) => name, options);
    for (const file of sourceFiles(path.join(root, side, "src"))) {
      const from = slash(path.relative(root, file));
      files.push(from);
      const report = (problem) => {
        const violation = { from, ...problem };
        const key = edgeKey(violation);
        if (exceptions.has(key)) usedExceptions.add(key);
        else violations.push(violation);
      };
      const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      for (const diagnostic of source.parseDiagnostics) {
        report({ rule: "invalid-source", to: ts.flattenDiagnosticMessageText(diagnostic.messageText, " "), line: source.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1 });
      }
      if (from === "backend/src/modules/files/router.ts") checkFilesRouterCapabilities(source, report);
      for (const { specifier, line } of importsOf(source, report)) {
        const resolved = ts.resolveModuleName(specifier, file, options, ts.sys, cache).resolvedModule;
        let target = resolved?.resolvedFileName;
        if (!target && (specifier.startsWith(".") || path.isAbsolute(specifier))) target = path.resolve(path.dirname(file), specifier);
        if (!target) {
          // Resolve aliases for non-code assets too. Unresolved aliases are local,
          // never silently treated as external packages.
          for (const [alias, replacements] of Object.entries(options.paths ?? {})) {
            const star = alias.indexOf("*");
            const prefix = star < 0 ? alias : alias.slice(0, star);
            const suffix = star < 0 ? "" : alias.slice(star + 1);
            if (star < 0 ? specifier !== alias : !specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;
            const match = star < 0 ? "" : specifier.slice(prefix.length, specifier.length - suffix.length);
            const candidates = replacements.map((replacement) => path.resolve(options.baseUrl ?? options.pathsBasePath ?? path.join(root, side), replacement.replace("*", match)));
            target = candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
            if (!target) report({ rule: "unresolved-local-import", to: specifier, line });
            break;
          }
        }
        if (!target) continue; // External package/builtin resolution remains the typecheck's job.
        if (target.includes(`${path.sep}node_modules${path.sep}`)) continue;
        const to = slash(path.relative(root, target));
        edges.push({ from, to, line });
        const rule = boundaryRule(from, to);
        if (rule) report({ rule, to, line });
        if (!resolved && !fs.existsSync(target)) report({ rule: "unresolved-local-import", to, line });
      }
    }
  }
  const staleExceptions = [...exceptions.keys()].filter((key) => !usedExceptions.has(key));
  return { files, edges, violations, baselineErrors, staleExceptions, exceptionCount: usedExceptions.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 2) throw new Error("This check has no baseline-update or ignore mode. Review boundary changes explicitly.");
    const baseline = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "scripts/boundary-baseline.json"), "utf8"));
    const result = checkBoundaries({ baseline });
    for (const violation of result.violations) console.error(`${violation.from}:${violation.line} [${violation.rule}] -> ${violation.to}`);
    for (const error of result.baselineErrors) console.error(error);
    for (const stale of result.staleExceptions) console.error(`Remove stale exception: ${stale}`);
    if (result.violations.length || result.baselineErrors.length || result.staleExceptions.length) {
      console.error("Module boundaries failed. See docs/architecture.md; do not regenerate the baseline.");
      process.exitCode = 1;
    } else {
      console.log(`Module boundaries passed: ${result.files.length} source files, ${result.exceptionCount} explicitly recorded legacy edges.`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
