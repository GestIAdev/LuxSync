#!/usr/bin/env python3
"""WAVE 2180: Patch senses.ts — context-aware pocket bounds"""

path = r'c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\senses.ts'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# ─── STEP 1: Insert currentVibeId + getPocketBounds() after bpmTracker init ───
# Find the unique anchor: "const bpmTracker = new IntervalBPMTracker();"
# followed by whatever comment block (may have broken emojis)
# We insert our block right after that line.

ANCHOR = 'const bpmTracker = new IntervalBPMTracker();'

INJECT = '''
// 🔥 WAVE 2180: CONTEXT-AWARE POCKET BOUNDS
// Vibe is set by the DJ via VibeManager (GAMMA), propagated here via SET_VIBE.
// The Worker is FROZEN (no genre detection), but it CAN use the DJ's manual
// selection to tighten the dance pocket — ensuring BPM lock is genre-correct.
let currentVibeId: string = ''

/**
 * Returns [targetMin, targetMax] for getMusicalBpm() based on active Vibe.
 * Techno vibes need a strict [120, 135] pocket to reject 107 BPM folds.
 * Latin vibes need [85, 105] to capture reggaetón/dembow at 100 BPM.
 * Default [90, 135] for everything else (house, trance, DnB, generic).
 */
function getPocketBounds(): [number, number] {
  const v = currentVibeId.toLowerCase()
  if (v === 'techno-club' || v === 'techno' || v === 'minimal' || v === 'hard-techno') {
    return [120, 135]
  }
  if (v === 'fiesta-latina' || v === 'reggaeton' || v === 'latin') {
    return [85, 105]
  }
  // Generic default — covers house, trance, drum-n-bass fold targets
  return [90, 135]
}
'''

if ANCHOR in content:
    content = content.replace(ANCHOR, ANCHOR + INJECT, 1)
    print('[STEP1] currentVibeId + getPocketBounds() INJECTED ✓')
else:
    print('[STEP1] ERROR: anchor not found!')

# ─── STEP 2: Update SET_VIBE handler to also set currentVibeId ────────────────
# Current handler:
#   case MessageType.SET_VIBE:
#     const vibePayload = message.payload as { vibeId: string };
#     sectionTracker.setVibe(vibePayload.vibeId);
#     console.log(...)
#     break;

OLD_VIBE_HANDLER = "        const vibePayload = message.payload as { vibeId: string };\n        sectionTracker.setVibe(vibePayload.vibeId);\n        console.log(`[BETA] \U0001F3AF WAVE 289.5: Vibe set to \"${vibePayload.vibeId}\" for SectionTracker`);"

NEW_VIBE_HANDLER = "        const vibePayload = message.payload as { vibeId: string };\n        sectionTracker.setVibe(vibePayload.vibeId);\n        // \U0001F525 WAVE 2180: also update pocket bounds for BPM folding\n        currentVibeId = vibePayload.vibeId\n        console.log(`[BETA] \U0001F3AF WAVE 289.5: Vibe set to \"${vibePayload.vibeId}\" for SectionTracker | pocket=${getPocketBounds()}`);"

if OLD_VIBE_HANDLER in content:
    content = content.replace(OLD_VIBE_HANDLER, NEW_VIBE_HANDLER, 1)
    print('[STEP2] SET_VIBE handler UPDATED ✓')
else:
    # Try finding it with a broader search (emoji may be different encoding)
    import re
    pattern = r"(const vibePayload = message\.payload as \{ vibeId: string \};\s+sectionTracker\.setVibe\(vibePayload\.vibeId\);\s+console\.log\(`\[BETA\].*?SectionTracker`\);)"
    match = re.search(pattern, content, re.DOTALL)
    if match:
        old_block = match.group(1)
        # Preserve the exact console.log line but add currentVibeId before it
        new_block = old_block.replace(
            'sectionTracker.setVibe(vibePayload.vibeId);',
            'sectionTracker.setVibe(vibePayload.vibeId);\n        // \U0001F525 WAVE 2180: update pocket bounds for context-aware BPM folding\n        currentVibeId = vibePayload.vibeId'
        )
        # Update the console.log to show pocket info
        new_block = re.sub(
            r'(console\.log\(`\[BETA\].*?)(SectionTracker`\);)',
            r'\1SectionTracker | pocket=${JSON.stringify(getPocketBounds())}`);',
            new_block
        )
        content = content.replace(old_block, new_block, 1)
        print('[STEP2b] SET_VIBE handler UPDATED via regex ✓')
    else:
        print('[STEP2] ERROR: SET_VIBE handler not found!')

# ─── STEP 3: Update the two getMusicalBpm() calls to use getPocketBounds() ────
# Line ~786: diagnostic telemetry call
# Line ~808: state.currentBpm assignment

OLD_DIAG = "    const musicalBpm = bpmTracker.getMusicalBpm();"
NEW_DIAG = "    const [pocketMin, pocketMax] = getPocketBounds()\n    const musicalBpm = bpmTracker.getMusicalBpm(pocketMin, pocketMax);"

if OLD_DIAG in content:
    content = content.replace(OLD_DIAG, NEW_DIAG, 1)
    print('[STEP3a] Diagnostic telemetry getMusicalBpm() UPDATED ✓')
else:
    print('[STEP3a] ERROR: diagnostic getMusicalBpm() call not found!')

OLD_STATE = "    state.currentBpm = bpmTracker.getMusicalBpm();"
NEW_STATE = "    state.currentBpm = bpmTracker.getMusicalBpm(pocketMin, pocketMax);"

count = content.count(OLD_STATE)
if count > 0:
    content = content.replace(OLD_STATE, NEW_STATE)
    print(f'[STEP3b] state.currentBpm getMusicalBpm() UPDATED ({count} occurrences) ✓')
else:
    print('[STEP3b] ERROR: state.currentBpm getMusicalBpm() not found!')

# ─── WRITE ────────────────────────────────────────────────────────────────────
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('\n[DONE] senses.ts WAVE 2180 patched.')
