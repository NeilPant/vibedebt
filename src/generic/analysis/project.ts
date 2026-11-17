import { existsSync, readFileSync, readdirSync, lstatSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { Project, ts } from 'ts-morph';
import { safePath, slash } from './paths.js';
import { excludedPath } from '../boundary.js';
import type { EffectiveAnalysisOptions } from './settings.js';

export { defaults } from './settings.js';
export function inventory(root: string, options: EffectiveAnalysisOptions): string[] {
  const files: string[] = []; const visited = new Set<string>();
  function walk(dir: string): void {
    if (visited.has(dir)) return; visited.add(dir);
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (excludedPath(slash(relative(root, path)), options.excludedPaths) || entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name) && !/\.d\.[cm]?ts$/.test(entry.name)) {
        files.push(path);
      }
    }
  }
  for (const source of options.sourceRoots) walk(source === '.' ? root : safePath(root, source, options));
  const admitted = configuration(root, files, options).admitted; let bytes = 0;
  if (admitted.length > options.maxFiles) throw new Error('Application source budget limit exceeded');
  for (const file of admitted) {
    const size = lstatSync(file).size;
    if (size > options.maxFileBytes || bytes + size > options.maxTotalBytes) throw new Error('Application source budget limit exceeded');
    bytes += size;
  }
  return admitted;
}
function matches(path: string, glob: string): boolean {
  let pattern = slash(glob).replace(/^\.\//, '');
  if (!/[?*]/.test(pattern) && !/\.[a-z]+$/i.test(pattern)) pattern += '/**/*';
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '\u0000').replace(/\*\*/g, '\u0001').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/\u0000/g, '(?:.*/)?').replace(/\u0001/g, '.*');
  return new RegExp(`^${escaped}$`).test(slash(path));
}
function configuration(root: string, files: string[], settings: EffectiveAnalysisOptions): { admitted: string[]; options: ts.CompilerOptions; contextFiles: string[] } {
  const config = safePath(root, settings.tsconfig, settings); const contextFiles = new Set<string>();
  const readConfig = (path: string): string | undefined => {
    if (!existsSync(path)) return undefined;
    const local = slash(relative(root, path));
    if (!local.startsWith('../') && !excludedPath(local, settings.excludedPaths)) contextFiles.add(safePath(root, local, settings));
    return readFileSync(path, 'utf8');
  };
  let admitted = files; let options: ts.CompilerOptions = { strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext };
  if (existsSync(config)) {
    const parsed = ts.readConfigFile(config, readConfig);
    if (parsed.error) throw new Error(ts.flattenDiagnosticMessageText(parsed.error.messageText, '\n'));
    const result = ts.parseJsonConfigFileContent(parsed.config, {
      useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
      fileExists: ts.sys.fileExists, readFile: readConfig,
      readDirectory: (dir, extensions, excludes, includes) => files.filter(file => {
        const rel = slash(relative(dir, file));
        return (!extensions || extensions.some(ext => file.endsWith(ext))) && (includes ?? ['**/*']).some(pattern => matches(rel, pattern)) && !(excludes ?? []).some(pattern => matches(rel, pattern));
      }),
    }, dirname(config), undefined, config);
    const errors = result.errors.filter(error => error.code !== 18003);
    if (errors.length) throw new Error(errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
    options = result.options;
    const allowed = new Set(result.fileNames.map(file => resolve(file)));
    admitted = files.filter(file => allowed.has(resolve(file)));
  }
  return { admitted, options, contextFiles: [...contextFiles] };
}
export function configurationContext(root: string, files: string[], settings: EffectiveAnalysisOptions): string[] { return configuration(root, files, settings).contextFiles; }
export function scopedProject(root: string, files: string[], settings: EffectiveAnalysisOptions): Project {
  const { admitted, options } = configuration(root, files, settings);
  const project = new Project({ compilerOptions: options, skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });
  project.addSourceFilesAtPaths(admitted);
  return project;
}
