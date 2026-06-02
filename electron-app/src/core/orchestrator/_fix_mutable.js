const fs = require('fs');
const f = 'c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/TitanOrchestrator.ts';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// Find the tickCtx block and fix mutable fields to use getters/setters
let inTickCtx = false;
let tickCtxStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("const tickCtx: TickEngineContext = {")) {
    inTickCtx = true;
    tickCtxStart = i;
    continue;
  }
  if (inTickCtx && lines[i].trim() === '}') {
    // Replace the mutable field lines with getter/setter versions
    // Find and replace specific lines
    for (let j = tickCtxStart; j <= i; j++) {
      if (lines[j].includes('frameCount: this.frameCount,')) {
        lines[j] = '      get frameCount() { return self.frameCount },';
      }
      if (lines[j].includes('warlogHeartbeatFrame: this.warlogHeartbeatFrame,')) {
        lines[j] = '      get warlogHeartbeatFrame() { return self.warlogHeartbeatFrame },';
      }
      if (lines[j].includes('_lastLoggedEngine: this._lastLoggedEngine,')) {
        lines[j] = '      get _lastLoggedEngine() { return self._lastLoggedEngine },';
      }
      if (lines[j].includes('fixtures: this.fixtures,')) {
        lines[j] = '      get fixtures() { return self.fixtures },';
      }
      if (lines[j].includes('_outputEnabled: this._outputEnabled,')) {
        lines[j] = '      get _outputEnabled() { return self._outputEnabled },';
      }
      if (lines[j].includes('useBrain: this.useBrain,')) {
        lines[j] = '      get useBrain() { return self.useBrain },';
      }
      if (lines[j].includes('mode: this.mode,')) {
        lines[j] = '      get mode() { return self.mode },';
      }
      if (lines[j].includes('inputGain: this.inputGain,')) {
        lines[j] = '      get inputGain() { return self.inputGain },';
      }
      if (lines[j].includes('_licenseTier: this._licenseTier,')) {
        lines[j] = '      get _licenseTier() { return self._licenseTier },';
      }
    }
    console.log('Fixed mutable fields to use getters');
    break;
  }
}

// Also need to add 'const self = this' before the tickCtx if not already there
// Check if there's already a 'const self = this' in the constructor
let hasSelf = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const self = this')) {
    hasSelf = true;
    break;
  }
}
if (!hasSelf) {
  // Add it before the hydrationCtx
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("const hydrationCtx: HydrationContext = {")) {
      lines.splice(i, 0, '    const self = this');
      console.log('Added const self = this');
      break;
    }
  }
}

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('Done');
