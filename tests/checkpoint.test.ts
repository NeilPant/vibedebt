import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createCheckpoint } from '../src/healer/gitCheckpoint.js';
import { withRollback } from '../src/healer/rollbackGuard.js';

it('retains root-repository checkpoints when source verification rolls back', async () => {
  const dir=mkdtempSync(join(tmpdir(),'vibedebt-root-checkpoint-'));
  const git=(...args:string[]):string => execFileSync('git',args,{cwd:dir,encoding:'utf8',windowsHide:true}).trim();
  try {
    git('init','--quiet');writeFileSync(join(dir,'a.ts'),'original');git('add','.');
    git('-c','user.name=Test','-c','user.email=test@localhost','commit','--quiet','-m','baseline');
    let checkpoint:{ref:string;commit:string}|undefined;
    const result=await withRollback(dir,async()=>{checkpoint=createCheckpoint(dir);writeFileSync(join(dir,'a.ts'),'bad edit');},
      async()=>({success:false,passed:0,failed:1,output:'regression'}));
    expect(result.rolledBack).toBe(true);
    expect(readFileSync(join(dir,'a.ts'),'utf8')).toBe('original');
    expect(git('show',`${checkpoint!.ref}:a.ts`)).toBe('original');
  } finally {rmSync(dir,{recursive:true,force:true});}
});

it('checkpoints the target while preserving HEAD, the user index and unrelated staged changes', () => {
  const dir=mkdtempSync(join(tmpdir(),'vibedebt-git-'));
  const git=(...args:string[]):string => execFileSync('git',args,{cwd:dir,encoding:'utf8',windowsHide:true}).trim();
  try {
    git('init','--quiet');mkdirSync(join(dir,'target'));
    writeFileSync(join(dir,'target/a.ts'),'initial');writeFileSync(join(dir,'outside.txt'),'original');
    git('add','.');git('-c','user.name=Test','-c','user.email=test@localhost','commit','--quiet','-m','baseline');
    writeFileSync(join(dir,'outside.txt'),'unrelated staged edit');git('add','outside.txt');
    writeFileSync(join(dir,'target/a.ts'),'working copy');writeFileSync(join(dir,'target/new.ts'),'new file');
    const head=git('rev-parse','HEAD'),index=readFileSync(join(dir,'.git/index'));
    const checkpoint=createCheckpoint(join(dir,'target'));
    expect(git('rev-parse','HEAD')).toBe(head);
    expect(readFileSync(join(dir,'.git/index'))).toEqual(index);
    expect(git('show',`${checkpoint.ref}:target/a.ts`)).toBe('working copy');
    expect(git('show',`${checkpoint.ref}:target/new.ts`)).toBe('new file');
    expect(git('show',`${checkpoint.ref}:outside.txt`)).toBe('original');
    expect(git('rev-parse',checkpoint.ref)).toBe(checkpoint.commit);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
