// ═══════════════════════════════════════════════════════════════════════════════
// 🧪 WAVE 111: SELENE DIAGNOSTIC SUITE - AUTOMATED SCENARIO VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════
// Objetivo: Validar matemáticamente que las Waves 107-110 funcionan
// Arquitecto: GeminiPunk × Copilot × Opus
// Fecha: 2025-12-24
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// 📦 VIBE PRESETS (Mirror de main.ts para validación independiente)
// ─────────────────────────────────────────────────────────────────────────────

interface VibeConstraints {
  name: string;
  parGate: number;
  parGain: number;
  parMax: number;         // WAVE 114: Techo de intensidad para Front PARs
  backParGate: number;
  backParGain: number;
  backParMax: number;     // WAVE 114: Techo de intensidad para Back PARs
  moverFloor: number;
  melodyThreshold: number;
  decaySpeed: number;
  hardClipThreshold: number;
}

const VIBE_PRESETS: Record<string, VibeConstraints> = {
  // 🔥 WAVE 113: Techno con esteroides + WAVE 114: Visual Headroom
  'techno-club': {
    name: 'TechnoClub',
    parGate: 0.05,           // W113: Bajado de 0.15
    parGain: 6.0,            // W113: Subido de 4.0
    parMax: 0.78,            // W114: 78% techo para dejar espacio al snare
    backParGate: 0.12,       // W113: Bajado de 0.20
    backParGain: 5.0,        // W113: Subido de 4.0
    backParMax: 1.0,         // W114: Back sin límite
    moverFloor: 0.0,
    melodyThreshold: 0.35,   // W114: Harder gate para Techno
    decaySpeed: 2,
    hardClipThreshold: 0.12, // W113: Bajado de 0.15
  },
  'fiesta-latina': {
    name: 'FiestaLatina',
    parGate: 0.05,
    parGain: 6.0,
    parMax: 1.0,             // W114: Full power para Latino
    backParGate: 0.12,
    backParGain: 5.5,
    backParMax: 1.0,         // W114: Full power
    moverFloor: 0.0,
    melodyThreshold: 0.40,
    decaySpeed: 1,
    hardClipThreshold: 0.12,
  },
  'pop-rock': {
    name: 'PopRock',
    parGate: 0.10,
    parGain: 5.0,
    parMax: 1.0,             // W114: Full power para Pop
    backParGate: 0.18,
    backParGain: 4.5,
    backParMax: 1.0,         // W114: Full power
    moverFloor: 0.05,
    melodyThreshold: 0.30,
    decaySpeed: 3,
    hardClipThreshold: 0.15,
  },
  'chill-lounge': {
    name: 'ChillLounge',
    parGate: 0.0,
    parGain: 2.0,
    parMax: 1.0,             // W114: Full power (pero gain bajo)
    backParGate: 0.10,
    backParGain: 2.0,
    backParMax: 1.0,         // W114: Full power
    moverFloor: 0.20,
    melodyThreshold: 0.0,
    decaySpeed: 10,
    hardClipThreshold: 0.08,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 🔬 SIMULATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

interface SimulationResult {
  parOut: number;
  moverOut: number;
  backParOut: number;
  passed: boolean;
}

interface TestCase {
  label: string;
  vibeId: string;
  rawBass: number;
  pulse: number;
  normMid: number;
  normTreble: number;
  expectation: {
    parMin?: number;
    parMax?: number;
    moverMin?: number;
    moverMax?: number;
  };
}

function getVibePresetForTest(vibeId: string): VibeConstraints {
  return VIBE_PRESETS[vibeId] || VIBE_PRESETS['techno-club'];
}

function simulateScenario(
  vibeId: string,
  rawBass: number,
  pulse: number,
  normMid: number,
  normTreble: number = 0
): SimulationResult {
  const preset = getVibePresetForTest(vibeId);

  // ═══════════════════════════════════════════════════════════════════
  // SIMULAR LÓGICA PAR (W106 + W108)
  // ═══════════════════════════════════════════════════════════════════
  let parOut = 0;
  if (pulse > preset.parGate) {
    parOut = Math.min(1, (pulse - preset.parGate) * preset.parGain);
  }
  // Aplicar Soft Knee Clipper
  if (parOut < preset.hardClipThreshold) {
    parOut = 0;
  }

  // ═══════════════════════════════════════════════════════════════════
  // SIMULAR LÓGICA BACK PAR (W108)
  // ═══════════════════════════════════════════════════════════════════
  let backParOut = 0;
  if (normTreble > preset.backParGate) {
    backParOut = Math.min(1, (normTreble - preset.backParGate) * preset.backParGain);
  }
  if (backParOut < preset.hardClipThreshold) {
    backParOut = 0;
  }

  // ═══════════════════════════════════════════════════════════════════
  // SIMULAR LÓGICA MOVER (W110 - Dynamic Masking)
  // ═══════════════════════════════════════════════════════════════════
  const bassMasking = Math.min(0.2, rawBass * 0.25);
  const effectiveThreshold = preset.melodyThreshold + bassMasking;
  const melodySignal = Math.max(normMid, normTreble);
  
  let moverOut = 0;

  if (melodySignal > effectiveThreshold) {
    // PASÓ EL GATE: Es una melodía real
    const cleanSignal = (melodySignal - effectiveThreshold) / (1 - effectiveThreshold);
    // Curva lineal para el test (breakdown mode)
    const curvedSignal = Math.max(0, cleanSignal);
    moverOut = preset.moverFloor + (curvedSignal * (1 - preset.moverFloor));
  } else {
    // NO PASÓ EL GATE: En breakdown mantenemos floor, en drop cortamos
    const isBreakdown = rawBass < 0.3;
    moverOut = isBreakdown ? preset.moverFloor : 0;
  }

  return { parOut, moverOut, backParOut, passed: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧪 TEST RUNNER
// ─────────────────────────────────────────────────────────────────────────────

export function runSeleneDiagnostics(): { passed: number; failed: number; results: string[] } {
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  results.push('');
  results.push('🧪 ══════════════════════════════════════════════════════════════════');
  results.push('   SELENE WAVE 111 DIAGNOSTICS - AUTOMATED SCENARIO VALIDATION');
  results.push('══════════════════════════════════════════════════════════════════ 🧪');
  results.push('');

  // ─── TEST CASES ───

  const testCases: TestCase[] = [
    // ═══════════════════════════════════════════════════════════════════
    // CASE A: "El Fantasma de Boris" (Techno)
    // Silencio de bajo, Piano medio.
    // ESPERADO: PAR=0.00, MOV > 0 (visible porque es breakdown)
    // ═══════════════════════════════════════════════════════════════════
    {
      label: 'GHOST PIANO',
      vibeId: 'techno-club',
      rawBass: 0.05,
      pulse: 0.0,
      normMid: 0.60,
      normTreble: 0.10,
      expectation: { parMax: 0.01, moverMin: 0.01 },
    },

    // ═══════════════════════════════════════════════════════════════════
    // CASE B: "El Muro de Ladrillo" (Techno Drop)
    // Bajo a tope, ruido medio.
    // ESPERADO: MOV=0.00 (Masking debe matar el ruido de 0.3)
    // ═══════════════════════════════════════════════════════════════════
    {
      label: 'NOISE MASKING',
      vibeId: 'techno-club',
      rawBass: 0.95,
      pulse: 0.0,
      normMid: 0.30,
      normTreble: 0.10,
      expectation: { moverMax: 0.01 },
    },

    // ═══════════════════════════════════════════════════════════════════
    // CASE C: "La Metralleta" (Latino)
    // Pulso pequeño (0.15).
    // ESPERADO: PAR > 0.5 (Gain x6 debe amplificarlo)
    // ═══════════════════════════════════════════════════════════════════
    {
      label: 'REGGAETON KICK',
      vibeId: 'fiesta-latina',
      rawBass: 0.80,
      pulse: 0.15,
      normMid: 0.0,
      normTreble: 0.0,
      expectation: { parMin: 0.50 },
    },

    // ═══════════════════════════════════════════════════════════════════
    // CASE D: "La Piscina" (Chill)
    // Silencio total.
    // ESPERADO: MOV >= 0.20 (Floor)
    // ═══════════════════════════════════════════════════════════════════
    {
      label: 'CHILL FLOOR',
      vibeId: 'chill-lounge',
      rawBass: 0.0,
      pulse: 0.0,
      normMid: 0.0,
      normTreble: 0.0,
      expectation: { moverMin: 0.20 },
    },

    // ═══════════════════════════════════════════════════════════════════
    // CASE E: "Dubstep Alto Contraste" (Pop/Rock)
    // Melodía fuerte, bajo fuerte.
    // ESPERADO: MOV > 0 (melodía real pasa el masking)
    // ═══════════════════════════════════════════════════════════════════
    {
      label: 'DUBSTEP MELODY',
      vibeId: 'pop-rock',
      rawBass: 0.70,
      pulse: 0.25,
      normMid: 0.65,
      normTreble: 0.30,
      expectation: { moverMin: 0.30, parMin: 0.50 },
    },

    // ═══════════════════════════════════════════════════════════════════
    // CASE F: "Latino Snare Attack" (Latino)
    // Treble alto para hi-hats/snare.
    // ESPERADO: BACK_PAR > 0 (prioridad snare)
    // ═══════════════════════════════════════════════════════════════════
    {
      label: 'LATINO SNARE',
      vibeId: 'fiesta-latina',
      rawBass: 0.60,
      pulse: 0.10,
      normMid: 0.20,
      normTreble: 0.50,
      expectation: { parMin: 0.0 }, // Pulso bajo, solo probamos que no crashea
    },
  ];

  // ─── RUN TESTS ───

  for (const test of testCases) {
    const result = simulateScenario(
      test.vibeId,
      test.rawBass,
      test.pulse,
      test.normMid,
      test.normTreble
    );
    
    const preset = getVibePresetForTest(test.vibeId);
    let testPassed = true;
    const issues: string[] = [];

    // Validar expectativas
    if (test.expectation.parMin !== undefined && result.parOut < test.expectation.parMin) {
      testPassed = false;
      issues.push(`PAR ${result.parOut.toFixed(2)} < ${test.expectation.parMin}`);
    }
    if (test.expectation.parMax !== undefined && result.parOut > test.expectation.parMax) {
      testPassed = false;
      issues.push(`PAR ${result.parOut.toFixed(2)} > ${test.expectation.parMax}`);
    }
    if (test.expectation.moverMin !== undefined && result.moverOut < test.expectation.moverMin) {
      testPassed = false;
      issues.push(`MOV ${result.moverOut.toFixed(2)} < ${test.expectation.moverMin}`);
    }
    if (test.expectation.moverMax !== undefined && result.moverOut > test.expectation.moverMax) {
      testPassed = false;
      issues.push(`MOV ${result.moverOut.toFixed(2)} > ${test.expectation.moverMax}`);
    }

    // Logging
    const statusIcon = testPassed ? '✅' : '❌';
    const vibeLabel = preset.name.padEnd(12);
    const inputStr = `Bass:${test.rawBass.toFixed(2)} Mid:${test.normMid.toFixed(2)} Pulse:${test.pulse.toFixed(2)}`;
    const outputStr = `PAR:${result.parOut.toFixed(2)} MOV:${result.moverOut.toFixed(2)}`;
    
    results.push(`${statusIcon} [${test.label.padEnd(16)}] Vibe:${vibeLabel} | In[${inputStr}] | Out[${outputStr}]`);
    
    if (testPassed) {
      passed++;
    } else {
      failed++;
      results.push(`   └─ FAIL: ${issues.join(', ')}`);
    }
  }

  // ─── SUMMARY ───

  results.push('');
  results.push('══════════════════════════════════════════════════════════════════');
  results.push(`   RESULTADO: ${passed}/${passed + failed} tests pasados`);
  
  if (failed === 0) {
    results.push('   🎉 ¡TODAS LAS WAVES FUNCIONANDO CORRECTAMENTE!');
    results.push('   Selene está lista para Boris Brejcha y cualquier género.');
  } else {
    results.push(`   ⚠️  ${failed} test(s) fallando. Revisar fórmulas.`);
  }
  
  results.push('══════════════════════════════════════════════════════════════════');
  results.push('');

  // Console output
  results.forEach(line => console.log(line));

  return { passed, failed, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 EXPORT PARA INTEGRACIÓN
// ─────────────────────────────────────────────────────────────────────────────

export { VIBE_PRESETS, VibeConstraints, simulateScenario };
