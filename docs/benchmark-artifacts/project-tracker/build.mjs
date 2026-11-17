import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {FileBlob, SpreadsheetFile} from '@oai/artifact-tool';
const path = new URL('./VibeDebt-project-tracker.xlsx', import.meta.url);
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(path));
const s=wb.worksheets.getItem('Project Plan');
const before=JSON.stringify(s.getRange('B10:H15').values);
const formulas=JSON.stringify(s.getRange('I9:AD39').formulas);
s.getRange('B16:H19').values=[
 ['Visualizer','Interactive HTML topology and debt visualizer',null,'Complete',null,null,null],
 ['AI enrichment','Optional AI intent enrichment with deterministic fallback',null,'Complete',null,null,null],
 ['Checkpointing','Safe checkpointing and exact dry-run previews',null,'Complete',null,null,null],
 ['Documentation & CI','Flagship README, CI and final verification',null,'Complete',null,null,null]
];
wb.recalculate();
assert.equal(JSON.stringify(s.getRange('B10:H15').values),before);
assert.equal(JSON.stringify(s.getRange('I9:AD39').formulas),formulas);
assert.equal(s.getRange('K6').values[0][0],10);
assert.equal(s.getRange('O6').values[0][0],10);
console.log((await wb.inspect({kind:'table',range:'Project Plan!B10:H19',include:'values',tableMaxRows:10,tableMaxCols:7})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:20}})).ndjson);
const preview=await wb.render({sheetName:'Project Plan',range:'B2:AD21',scale:1.4});
await fs.writeFile(new URL('./preview.png', import.meta.url), new Uint8Array(await preview.arrayBuffer()));
await (await SpreadsheetFile.exportXlsx(wb)).save(path);
console.log('Updated existing tracker: 10 total, 10 complete; earlier rows and schedule formulas preserved.');
