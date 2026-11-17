import { it, expect, vi } from 'vitest';
import { analyzeCodebase } from '../src/cartographer/index.js';
import { enrichTopology } from '../src/llm/intentClient.js';
import { inferIntents } from '../src/llm/domainIntent.js';
import { Project } from 'ts-morph';

it('does not invent pricing rules for a simple subtotal', () => {
  const project=new Project({useInMemoryFileSystem:true});
  const source=project.createSourceFile('/repo/src/domain/total.ts',
    'export function total(quantity:number,price:number){ const subtotal=quantity*price; return subtotal; }');
  const intents=inferIntents([source],'/repo');
  expect(intents).toHaveLength(1);
  expect(intents[0].summary).not.toMatch(/tier|coupon|VIP|cap|rounds/i);
});
it('ignores domain declarations without an implementation body', () => {
  const project=new Project({useInMemoryFileSystem:true});
  const source=project.createSourceFile('/repo/src/domain/pending.ts','export declare function pending(): number;');
  expect(inferIntents([source],'/repo')).toEqual([]);
});

it('describes every prospective domain function deterministically with no network', async () => {
  const first = analyzeCodebase('fixtures/vibe-mart');
  const second = analyzeCodebase('fixtures/vibe-mart');
  expect(first.businessIntents).toHaveLength(7);
  expect(first.businessIntents).toEqual(second.businessIntents);
  const fetcher = vi.fn<typeof fetch>();
  expect(await enrichTopology(first, {env: {}, fetcher})).toEqual(first);
  expect(fetcher).not.toHaveBeenCalled();
  expect(first.businessIntents?.find(i => i.name === 'calculateStateTax')?.summary).toMatch(/tax/i);
  expect(first.businessIntents?.every(i => i.source === 'heuristic' && i.evidence.length)).toBe(true);
});
it.each(['OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY'])('supports %s with validated AI summaries', async key => {
  const report = analyzeCodebase('fixtures/vibe-mart');
  const summaries = report.businessIntents!.map(i => ({name:i.name,file:i.file,summary:`Business intent for ${i.name}.`}));
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(summaries)}}]})));
  const result = await enrichTopology(report, {env:{[key]:'test-key',VIBEDEBT_AI_MODEL:'test-model'},fetcher});
  expect(result.businessIntents?.every(i => i.source === 'ai')).toBe(true);
  expect(report.businessIntents?.every(i => i.source === 'heuristic')).toBe(true);
  expect(fetcher).toHaveBeenCalledOnce();
  const [endpoint, init] = fetcher.mock.calls[0];
  expect(String(endpoint)).toContain('/chat/completions');
  expect(init?.headers).toMatchObject({Authorization:'Bearer test-key'});
  expect(init?.body).not.toContain('test-key');
});
it.each(['error','malformed','partial','http','timeout'])('falls back on %s without losing domain coverage', async mode => {
  const report = analyzeCodebase('fixtures/vibe-mart');
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
    if(mode==='timeout') return new Promise<Response>(() => {});
    if(mode==='error') throw new Error('network unavailable');
    return new Response(mode==='partial' ? JSON.stringify({choices:[{message:{content:'[]'}}]}) : 'bad json', {status:mode==='http'?429:200});
  });
  const result = await enrichTopology(report, {env:{OPENROUTER_API_KEY:'test-key'},fetcher,timeoutMs:5});
  expect(result).toEqual(report);
});
