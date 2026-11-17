import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import type { TargetManifest } from '../generic/context.js';
import { realworldBrowserPlan } from './realworld-browser.js';

export const realworldRevision = '28e1e43fdfcaa8d10baad6212d34f815dcbb1bba';
export function realworldManifest(root: string, artifacts: string): TargetManifest {
  const npmCli = process.env.npm_execpath?.endsWith('.js') ? process.env.npm_execpath :
    join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  if (!existsSync(npmCli)) throw new Error('Cannot locate npm CLI; launch through npm or specify a target manifest');
  const command = (label: string, script: string) => ({
    label, command: process.execPath, args: [npmCli, 'run', script], timeoutMs: 120000,
  });
  return {
    version: 1, id: realworldBrowserPlan.logicalId, revision: realworldRevision, root, artifacts,
    boundary: { sourceRoots: ['src'], tsconfig: 'tsconfig.json', excludedPaths: [] },
    selection: {
      sources: [
        { file: 'src/api/user.service.ts', className: 'UserService', memberName: 'authorization' },
        { file: 'src/api/article.service.ts', className: 'ArticleService', memberName: 'authorization' },
      ], destination: 'src/api/authorization-options.ts', helperName: 'authorizationOptions',
    },
    browser: realworldBrowserPlan, checks: [command('typecheck', 'tscheck'), command('build', 'build'), command('tests', 'test:r')],
    admission: {
      patches: [{ path: 'benchmarks/patches/register-import-case.patch', sha256: 'cdfa4bec26fc18a92da10127f7377002df750f87bed6ad866b3fd7b2e9cd649e' }],
      compatibility: { typescript: '4.5.4', 'react-hook-form': '7.22.5', '@types/node': '16.11.26', '@types/babel__traverse': '7.17.1' },
    },
    server: { ...command('server', 'dev'), args: [npmCli, 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '{{PORT}}', '--strictPort'], timeoutMs: 60000 },
  };
}
