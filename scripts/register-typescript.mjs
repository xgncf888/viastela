import { readFileSync } from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';

let registered = false;

/** Load the TypeScript sources the preflight script checks. Expo's app.config.js uses the same hook. */
export function registerTypeScript() {
  if (registered) return;
  registered = true;
  if (!Module._extensions['.ts']) {
    Module._extensions['.ts'] = function loadTypeScript(module, filename) {
      const source = readFileSync(filename, 'utf8');
      const { outputText } = ts.transpileModule(source, {
        compilerOptions: {
          esModuleInterop: true,
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: filename,
      });
      module._compile(outputText, filename);
    };
  }

  const resolveFilename = Module._resolveFilename;
  Module._resolveFilename = function resolveTypeScript(request, parent, isMain, options) {
    if (parent?.filename?.endsWith('.ts') && request.startsWith('.')) {
      try {
        return resolveFilename.call(this, `${request}.ts`, parent, isMain, options);
      } catch {
        // A relative import can still be a directory or a .js file.
      }
    }
    return resolveFilename.call(this, request, parent, isMain, options);
  };
}
