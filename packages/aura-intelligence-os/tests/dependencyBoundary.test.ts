import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const packageRoot = resolve(__dirname, '..');
const repositoryRoot = resolve(packageRoot, '..', '..');
const sourceRoot = resolve(repositoryRoot, 'src/modules/intelligence');
const entrypointPath = resolve(sourceRoot, 'server.ts');

const ALLOWED_EXTERNAL_MODULES = new Set(['node:crypto']);
const FORBIDDEN_BROWSER_GLOBALS = new Set([
  'document',
  'localStorage',
  'sessionStorage',
  'window',
]);
const FORBIDDEN_ASSET_EXTENSIONS = new Set([
  '.css',
  '.gif',
  '.jpeg',
  '.jpg',
  '.less',
  '.png',
  '.sass',
  '.scss',
  '.svg',
  '.webp',
]);
const FORBIDDEN_PACKAGE_PATTERN =
  /^(?:@vitejs\/|firebase(?:\/|$)|firebase-admin(?:\/|$)|firebase-functions(?:\/|$)|firestore(?:\/|$)|react(?:\/|$)|react-dom(?:\/|$)|vite(?:\/|$))/i;

type DependencyGraph = {
  readonly files: ReadonlySet<string>;
  readonly externalModules: ReadonlySet<string>;
  readonly violations: readonly string[];
};

function resolveRelativeModule(
  importerPath: string,
  specifier: string
): string | undefined {
  const basePath = resolve(dirname(importerPath), specifier);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    resolve(basePath, 'index.ts'),
  ];

  return candidates.find(
    (candidate) =>
      existsSync(candidate) && extname(candidate).toLowerCase() === '.ts'
  );
}

function inspectDependencyGraph(entrypoint: string): DependencyGraph {
  const pending = [entrypoint];
  const files = new Set<string>();
  const externalModules = new Set<string>();
  const violations: string[] = [];

  while (pending.length > 0) {
    const currentPath = pending.pop();
    if (!currentPath || files.has(currentPath)) {
      continue;
    }

    files.add(currentPath);
    const sourceText = readFileSync(currentPath, 'utf8');
    const sourceFile = ts.createSourceFile(
      currentPath,
      sourceText,
      ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.TS
    );

    const visit = (node: ts.Node): void => {
      if (
        ts.isIdentifier(node) &&
        FORBIDDEN_BROWSER_GLOBALS.has(node.text)
      ) {
        violations.push(
          `${relative(sourceRoot, currentPath)} uses browser global ${node.text}`
        );
      }

      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isMetaProperty(node.expression) &&
        node.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
        node.expression.name.text === 'meta' &&
        node.name.text === 'env'
      ) {
        violations.push(
          `${relative(sourceRoot, currentPath)} uses import.meta.env`
        );
      }

      let moduleSpecifier: string | undefined;
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        moduleSpecifier = node.moduleSpecifier.text;
      } else if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression &&
        ts.isStringLiteral(node.moduleReference.expression)
      ) {
        moduleSpecifier = node.moduleReference.expression.text;
      } else if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        moduleSpecifier = node.arguments[0].text;
      } else if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        moduleSpecifier = node.arguments[0].text;
      }

      if (moduleSpecifier) {
        const extension = extname(moduleSpecifier).toLowerCase();
        if (FORBIDDEN_ASSET_EXTENSIONS.has(extension)) {
          violations.push(
            `${relative(sourceRoot, currentPath)} imports asset ${moduleSpecifier}`
          );
        } else if (moduleSpecifier.startsWith('.')) {
          const resolvedModule = resolveRelativeModule(
            currentPath,
            moduleSpecifier
          );
          if (!resolvedModule) {
            violations.push(
              `${relative(sourceRoot, currentPath)} has unresolved import ${moduleSpecifier}`
            );
          } else {
            const relativePath = relative(sourceRoot, resolvedModule);
            if (
              relativePath === '..' ||
              relativePath.startsWith(`..${sep}`)
            ) {
              violations.push(
                `${relative(sourceRoot, currentPath)} escapes source boundary`
              );
            } else {
              pending.push(resolvedModule);
            }
          }
        } else {
          externalModules.add(moduleSpecifier);
          if (
            moduleSpecifier.startsWith('@/') ||
            moduleSpecifier.startsWith('src/') ||
            FORBIDDEN_PACKAGE_PATTERN.test(moduleSpecifier) ||
            !ALLOWED_EXTERNAL_MODULES.has(moduleSpecifier)
          ) {
            violations.push(
              `${relative(sourceRoot, currentPath)} imports forbidden module ${moduleSpecifier}`
            );
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return { files, externalModules, violations };
}

describe('Aura Intelligence OS Node-safe dependency boundary', () => {
  const graph = inspectDependencyGraph(entrypointPath);

  it('contains no forbidden browser, frontend, Firebase, or asset dependency', () => {
    expect(graph.violations).toEqual([]);
  });

  it('uses only the canonical Node crypto builtin outside the source graph', () => {
    expect([...graph.externalModules].sort()).toEqual(['node:crypto']);
  });

  it('includes the required enterprise-model implementation transitively', () => {
    const relativeFiles = [...graph.files].map((path) =>
      relative(sourceRoot, path).replaceAll('\\', '/')
    );

    expect(relativeFiles).toContain(
      'enterprise-model/extraction/domain/utils.ts'
    );
    expect(relativeFiles).toContain(
      'enterprise-model/graph/domain/identity.ts'
    );
    expect(relativeFiles).toContain(
      'enterprise-model/seeds/industrySeeder.ts'
    );
  });

  it('does not include frontend, Discovery, Orchestrator, checkpoint runtime, or shadow code', () => {
    const graphFiles = [...graph.files].map((path) =>
      relative(sourceRoot, path).replaceAll('\\', '/')
    );
    const relativeFiles = graphFiles.join('\n');
    const checkpointFiles = graphFiles.filter((path) =>
      path.startsWith('os/checkpoint/')
    );

    expect(relativeFiles).not.toMatch(/(?:^|\n)(?:core|engine)\//);
    expect(relativeFiles).not.toMatch(/discovery/i);
    expect(relativeFiles).not.toContain('AuraIntelligenceOrchestrator.ts');
    expect(relativeFiles).not.toContain('PipelineContextBuilder.ts');
    expect(checkpointFiles).toEqual(['os/checkpoint/types.ts']);
    expect(relativeFiles).not.toContain('PipelineBootstrapCheckpointMapper.ts');
    expect(relativeFiles).not.toMatch(/os\/shadow\//);
  });
});
