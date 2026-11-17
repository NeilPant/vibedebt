import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { canonicalPath } from '../verification/pathSafety.js';

/** Stores a target-scoped tree in a new ref, without modifying HEAD or the real index. */
export function createCheckpoint(targetDir: string): {ref:string; commit:string} {
  const target=canonicalPath(targetDir),temp=mkdtempSync(join(tmpdir(),'vibedebt-index-'));
  const env={...process.env,GIT_INDEX_FILE:join(temp,'index'),GIT_OPTIONAL_LOCKS:'0'};
  const git=(args:string[],required=true):string => {
    const result=spawnSync('git',args,{cwd:target,env,encoding:'utf8',timeout:15000,windowsHide:true});
    if(result.error || result.status!==0) {
      if(!required) return '';
      throw new Error(`Cannot create Git checkpoint: ${result.error?.message ?? result.stderr.trim()}`);
    }
    return result.stdout.trim();
  };
  try {
    const root=canonicalPath(git(['rev-parse','--show-toplevel'])),path=relative(root,target).replaceAll('\\','/');
    if(path.startsWith('..') || isAbsolute(path)) throw new Error('Checkpoint target must be inside the repository');
    const head=git(['rev-parse','--verify','HEAD'],false);
    git(head?['read-tree',head]:['read-tree','--empty']);
    git(['-C',root,'--literal-pathspecs','add','-A','--',path||'.']);
    const tree=git(['write-tree']);
    const commit=git(['-c','user.name=VibeDebt','-c','user.email=vibedebt@localhost','commit-tree',tree,
      ...(head?['-p',head]:[]),'-m','VibeDebt: checkpoint before healing']);
    const ref=`refs/vibedebt/checkpoints/${randomUUID()}`;
    git(['update-ref',ref,commit,'0'.repeat(commit.length)]);
    return {ref,commit};
  } finally {rmSync(temp,{recursive:true,force:true});}
}
