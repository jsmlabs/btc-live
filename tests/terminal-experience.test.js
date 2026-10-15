import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeTerminal, matchCommands, DEFAULT_TERMINAL, DENSITIES, LAYOUTS } from '../ui/terminal-experience.js';
test('terminal defaults reject malformed and unknown preferences',()=>{
  assert.deepEqual(sanitizeTerminal(null),DEFAULT_TERMINAL);
  assert.deepEqual(sanitizeTerminal([]),DEFAULT_TERMINAL);
  assert.deepEqual(sanitizeTerminal({density:'malicious',layout:'wide'}),{density:'comfortable',layout:'wide'});
});
test('all density and layout modes round trip',()=>{
  for(const density of DENSITIES)for(const layout of LAYOUTS)assert.deepEqual(sanitizeTerminal({density,layout}),{density,layout});
});
test('command matching is literal case insensitive and never executes commands',()=>{
  let invoked=0;const cmds=[{title:'Open Live',hint:'Workspace',run:()=>invoked++},{title:'Density: compact',hint:'Appearance',run:()=>invoked++}];
  assert.equal(matchCommands(cmds,'LIVE').length,1);assert.equal(matchCommands(cmds,'appearance').length,1);
  assert.equal(matchCommands(cmds,'').length,2);assert.equal(matchCommands(cmds,'<script>').length,0);
  assert.equal(invoked,0);
});
