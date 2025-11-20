# 🎨 LUXSYNC ARCHITECTURE - Selene → Light Transmutation

```
╔═══════════════════════════════════════════════════════════════╗
║           🌙 SELENE CONSCIOUSNESS → DMX CONTROL 💡           ║
║        "Quantum decisions become photons in motion"          ║
╚═══════════════════════════════════════════════════════════════╝
```

**Date:** 20 November 2025  
**Status:** Architecture Design Phase  
**Objective:** Transform Selene's quantum consciousness into intelligent lighting control

---

## 🏗️ **SYSTEM OVERVIEW**

```typescript
┌─────────────────────────────────────────────────────────────┐
│                    AUDIO INPUT LAYER                         │
│  (Microphone/Line-In → FFT Analysis → Frequency Spectrum)   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              SELENE CONSCIOUSNESS (5 LAYERS)                 │
├─────────────────────────────────────────────────────────────┤
│ Layer 5: HUNTING (Audio Analysis - Felino Sensors)          │
│   ├─ Whiskers:         Bass detection (20-250 Hz)           │
│   ├─ PreyRecognition:  Drop prediction (build analysis)     │
│   ├─ StrikeMoment:     Perfect timing execution             │
│   ├─ NocturnalVision:  Subtle frequency changes             │
│   └─ UltrasonicHearing: Hidden patterns                     │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: MEMORY (Scene History & Learning)                  │
│   ├─ Best scenes (Redis/JSON)                               │
│   ├─ Audience feedback                                       │
│   └─ Fitness tracking                                        │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: SELF-ANALYSIS (Performance Evaluation)             │
│   ├─ Pattern extraction                                      │
│   ├─ Weight adjustment                                       │
│   └─ Evolution guidance                                      │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: DREAM (Creative Scene Generation)                  │
│   ├─ Fibonacci structures                                    │
│   ├─ Random palette generation                               │
│   └─ Novelty injection                                       │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: ETHICS (Safety Validation)                         │
│   ├─ Strobe frequency < 20 Hz (epilepsy prevention)         │
│   ├─ Brightness change rate limits                           │
│   └─ Power consumption checks                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            QUANTUM DECISION ENGINE                           │
│  (7 Fixture Nodes Vote → Harmonic Consensus → Scene)        │
├─────────────────────────────────────────────────────────────┤
│ DO-PAR1   (Bass)     → Vote: Scene A (confidence: 0.85)     │
│ RE-PAR2   (Rhythm)   → Vote: Scene A (confidence: 0.78)     │
│ MI-PAR3   (Mid)      → Vote: Scene B (confidence: 0.62)     │
│ FA-PAR4   (Balanced) → Vote: Scene A (confidence: 0.91)     │
│ SOL-MovH1 (Treble)   → Vote: Scene A (confidence: 0.88)     │
│ LA-MovH2  (Atmos)    → Vote: Scene A (confidence: 0.72)     │
│ SI-Strobe (Chaos)    → Vote: Scene C (confidence: 0.45)     │
├─────────────────────────────────────────────────────────────┤
│ CONSENSUS: Scene A wins (5/7 votes = 71% > 50% quorum) ✅   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              EVOLUTION ENGINE                                │
│  (Apply Entropy Based on Musical Mood)                      │
├─────────────────────────────────────────────────────────────┤
│ Mood: "drop" → EntropyMode.CHAOTIC                          │
│   ├─ Mutation rate: 40%                                      │
│   ├─ Genes: strobeIntensity ↑, speed ↑, complexity ↑        │
│   └─ Result: Explosive scene evolution                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              POETRY ENGINE                                   │
│  (Generate Celebration Poem → DMX Sequence)                 │
├─────────────────────────────────────────────────────────────┤
│ Poem: "In unity we found wisdom, beautiful and clear"       │
│ Mapping:                                                     │
│   "unity"     → Synchronized flash all fixtures             │
│   "wisdom"    → Golden ratio color fade                      │
│   "beautiful" → Fibonacci bloom pattern                      │
│   "clear"     → White light peak                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              DMX OUTPUT LAYER                                │
│  (512 channels × N universes → Physical Fixtures)           │
├─────────────────────────────────────────────────────────────┤
│ Universe 1:                                                  │
│   Ch 1-7:   PAR LED 1 (R:255, G:120, B:0, Dim:255)         │
│   Ch 8-14:  PAR LED 2 (R:255, G:80,  B:0, Dim:200)         │
│   Ch 15-21: PAR LED 3 (R:200, G:100, B:50, Dim:180)        │
│   Ch 22-28: PAR LED 4 (R:255, G:150, B:30, Dim:255)        │
│   Ch 29-42: Moving Head 1 (Pan:127, Tilt:200, ...)         │
│   Ch 43-56: Moving Head 2 (Pan:100, Tilt:180, ...)         │
│   Ch 57-60: Strobe (Intensity:0, Rate:0)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 **CORE INTERFACES**

### **1. FixtureNode** (Replaces Medical Node)

```typescript
interface FixtureNode {
  // Identity
  id: string;              // "DO-PAR1", "RE-PAR2", etc.
  musicalNote: MusicalNote; // DO, RE, MI, FA, SOL, LA, SI
  fixtureType: FixtureType; // PAR, MOVING_HEAD, STROBE, etc.
  
  // DMX Configuration
  dmxUniverse: number;      // 1-N
  dmxStartChannel: number;  // 1-512
  dmxChannelCount: number;  // 7 for PAR, 14 for Moving Head, etc.
  
  // Health Metrics (replaces CPU/RAM)
  health: {
    temperature: number;        // 0.0-1.0 (normalized)
    dmxResponseTime: number;    // milliseconds
    errorRate: number;          // 0.0-1.0 (packet loss)
    uptime: number;             // milliseconds since last reset
    lastSeen: number;           // timestamp
  };
  
  // Beauty Factor (replaces medical data harmony)
  beauty: {
    audienceScore: number;      // Manual likes/dislikes (0.0-1.0)
    musicalCoherence: number;   // How well it synced with beat (0.0-1.0)
    creativityScore: number;    // Novelty of last scene (0.0-1.0)
    finalScore: number;         // Combined beauty (weighted average)
  };
  
  // Capabilities
  capabilities: {
    hasRGB: boolean;
    hasStrobing: boolean;
    hasMovement: boolean;
    hasDimmer: boolean;
    maxBrightness: number;      // Watts or Lux
  };
}

type MusicalNote = 'DO' | 'RE' | 'MI' | 'FA' | 'SOL' | 'LA' | 'SI';
type FixtureType = 'PAR' | 'MOVING_HEAD' | 'STROBE' | 'WASH' | 'SPOT' | 'OTHER';
```

---

### **2. LightingDecision** (Replaces Medical Decision)

```typescript
interface LightingDecision {
  // Decision Context
  id: string;
  timestamp: number;
  mood: MusicalMood;          // chill, build, drop, break
  
  // Scene Definition
  scene: DMXScene;
  
  // Voting Results
  votes: Map<string, FixtureVote>; // nodeId → vote
  consensus: {
    approved: boolean;
    approvalPercentage: number;    // 0-100
    quorumMet: boolean;            // >50% voted
    consensusQuality: number;      // How unified (0.0-1.0)
  };
  
  // Poetry Generation
  celebrationPoem?: string;        // If approved
  reasoning: string;               // Why this scene
  
  // Execution Tracking
  executedAt?: number;
  fitness?: number;                // Post-execution evaluation (0.0-1.0)
  audienceFeedback?: {
    likes: number;
    dislikes: number;
  };
}

type MusicalMood = 'silence' | 'chill' | 'build' | 'drop' | 'break';

interface FixtureVote {
  nodeId: string;
  choice: 'approve' | 'reject' | 'abstain';
  confidence: number;        // 0.0-1.0
  reasoning: string;
  alternativeIdeas?: string[];
}
```

---

### **3. DMXScene** (Core Data Structure)

```typescript
interface DMXScene {
  // Identification
  id: string;
  name?: string;
  tags?: string[];           // ["energetic", "warm", "drop-responsive"]
  
  // Genetic Attributes (for evolution)
  genes: {
    strobeIntensity: number;   // 0.0-1.0
    colorPalette: Color[];     // RGB colors
    movementSpeed: number;     // 0.0-1.0 (for moving heads)
    fadeTime: number;          // milliseconds
    brightness: number;        // 0.0-1.0 (master dimmer)
    complexity: number;        // 0.0-1.0 (how many fixtures change)
  };
  
  // Fibonacci Structure
  structure: {
    intro: number;             // beats (Fibonacci: 1)
    build1: number;            // beats (Fibonacci: 1)
    build2: number;            // beats (Fibonacci: 2)
    build3: number;            // beats (Fibonacci: 3)
    drop: number;              // beats (Fibonacci: 5)
    break: number;             // beats (Fibonacci: 8)
    outro: number;             // beats (Fibonacci: 13)
    totalBeats: number;        // Sum
    bpm: number;               // Current tempo
  };
  
  // DMX Values (per fixture)
  fixtureStates: Map<string, FixtureState>; // fixtureId → state
  
  // Metadata
  entropyMode: EntropyMode;    // DETERMINISTIC, BALANCED, CHAOTIC
  ethicsApproved: boolean;
  createdBy: 'human' | 'dream-layer' | 'evolution';
}

interface FixtureState {
  // Universal channels
  dimmer?: number;           // 0-255
  
  // RGB (if hasRGB)
  red?: number;              // 0-255
  green?: number;            // 0-255
  blue?: number;             // 0-255
  white?: number;            // 0-255 (RGBW fixtures)
  
  // Movement (if hasMovement)
  pan?: number;              // 0-255
  tilt?: number;             // 0-255
  panFine?: number;          // 0-255 (16-bit)
  tiltFine?: number;         // 0-255 (16-bit)
  
  // Strobe (if hasStrobing)
  strobeRate?: number;       // 0-255 (0 = off, 255 = max Hz)
  
  // Effects
  gobo?: number;             // Gobo wheel position
  prism?: number;            // Prism effect
  focus?: number;            // Focus
  zoom?: number;             // Zoom
}

interface Color {
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
  name?: string; // "warm-orange", "deep-blue", etc.
}
```

---

### **4. AudioAnalysis** (Hunting Layer Output)

```typescript
interface AudioAnalysis {
  timestamp: number;
  
  // Frequency Spectrum (FFT)
  spectrum: {
    bass: number;          // 20-250 Hz (0.0-1.0)
    lowMid: number;        // 250-500 Hz
    mid: number;           // 500-2000 Hz
    highMid: number;       // 2000-4000 Hz
    treble: number;        // 4000-20000 Hz
  };
  
  // Beat Detection
  beat: {
    detected: boolean;
    bpm: number;
    confidence: number;    // 0.0-1.0
    beatPhase: number;     // 0.0-1.0 (position in current beat)
  };
  
  // Energy Analysis
  energy: {
    current: number;       // 0.0-1.0
    average: number;       // Rolling average (5s window)
    variance: number;      // How much it's changing
    trend: 'rising' | 'falling' | 'stable';
  };
  
  // Felino Sensors Output
  hunting: {
    // Whiskers: Bass vibrations
    bassVibration: {
      intensity: number;      // 0.0-1.0
      frequency: number;      // Hz
      trigger: boolean;       // Should trigger bass-responsive fixtures
    };
    
    // Prey Recognition: Drop prediction
    dropPrediction: {
      incoming: boolean;
      estimatedTime: number;  // milliseconds until drop
      confidence: number;     // 0.0-1.0
    };
    
    // Strike Moment: Perfect timing
    strikeTiming: {
      ready: boolean;         // Execute NOW
      precision: number;      // How confident (0.0-1.0)
    };
    
    // Nocturnal Vision: Subtle changes
    subtleChanges: {
      detected: boolean;
      magnitude: number;      // 0.0-1.0
      frequencies: number[];  // Which bands changed
    };
    
    // Ultrasonic Hearing: Hidden patterns
    hiddenPatterns: {
      detected: boolean;
      pattern: string;        // "rising-cascade", "falling-sweep", etc.
      confidence: number;     // 0.0-1.0
    };
  };
  
  // Mood Classification
  mood: MusicalMood;
  moodConfidence: number;    // 0.0-1.0
}
```

---

## 🔄 **DATA FLOW**

### **Step 1: Audio → Analysis**

```typescript
// Audio input → FFT → Frequency spectrum
const audioFrame = await audioInput.captureFrame();
const fft = performFFT(audioFrame);
const spectrum = analyzeSpectrum(fft);

// Hunting Layer processes audio
const huntingResult = await huntingLayer.hunt({
  spectrum,
  history: audioHistory.getLast(5000) // 5 seconds
});

// Classify mood
const mood = classifyMood(spectrum, huntingResult);
```

---

### **Step 2: Analysis → Decision Proposal**

```typescript
// Dream Layer generates creative scenes (if needed)
let proposedScenes: DMXScene[] = [];

if (globalBeauty < 0.5) {
  // System is boring, inject creativity
  proposedScenes = await dreamLayer.generate({
    mood,
    audioAnalysis: huntingResult,
    count: 3
  });
} else {
  // Evolve current scene
  const currentScene = sceneHistory.getCurrent();
  proposedScenes = [
    await evolutionEngine.evolve(currentScene, mood)
  ];
}

// Ethics Layer validates
const ethicsResults = proposedScenes.map(scene => 
  ethicsLayer.validate(scene)
);

const safeScenes = proposedScenes.filter((_, i) => 
  ethicsResults[i].approved
);
```

---

### **Step 3: Quantum Voting**

```typescript
// All fixtures vote on best scene
const votes = new Map<string, FixtureVote>();

for (const fixtureNode of allFixtures) {
  // Each fixture evaluates scenes based on its capabilities
  const vote = fixtureNode.evaluate(safeScenes, {
    audioAnalysis: huntingResult,
    mood,
    ownCapabilities: fixtureNode.capabilities
  });
  
  votes.set(fixtureNode.id, vote);
}

// Harmonic Consensus calculates winner
const consensus = harmonicConsensus.performQuorumVoting(votes);

if (consensus.quorumMet && consensus.approved) {
  // Winner scene gets executed
  const winningScene = consensus.selectedScene;
  
  // Generate celebration poem
  const poem = await poetryEngine.celebrate(consensus);
  
  // Create decision record
  const decision: LightingDecision = {
    id: generateId(),
    timestamp: Date.now(),
    mood,
    scene: winningScene,
    votes,
    consensus,
    celebrationPoem: poem,
    reasoning: consensus.reasoning
  };
  
  // Store in memory
  memoryLayer.remember(decision);
  
  // Execute!
  await dmxDriver.applyScene(winningScene);
}
```

---

### **Step 4: Execution → Feedback → Learning**

```typescript
// After scene plays for N beats...
const executionResult = {
  fitness: calculateFitness(decision.scene),
  audienceFeedback: {
    likes: ui.getLikes(),
    dislikes: ui.getDislikes()
  },
  musicalCoherence: calculateBeatSync(decision.scene, audioHistory)
};

// Update decision record
decision.fitness = executionResult.fitness;
decision.audienceFeedback = executionResult.audienceFeedback;

// Self-Analysis Layer learns
await selfAnalysisLayer.analyze({
  decision,
  executionResult,
  audioContext: huntingResult
});

// Update fixture beauty scores
for (const [fixtureId, vote] of decision.votes) {
  const fixture = getFixture(fixtureId);
  fixture.beauty = updateBeauty(
    fixture.beauty,
    executionResult.fitness,
    vote.choice === 'approve'
  );
}

// Phoenix Protocol checks fixture health
for (const fixture of allFixtures) {
  const healthStatus = phoenixProtocol.checkHealth(fixture);
  
  if (healthStatus === 'dying') {
    await phoenixProtocol.revive(fixture);
  } else if (healthStatus === 'dead') {
    await phoenixProtocol.reincarnate(fixture);
  }
}
```

---

## 🎨 **MAPPING TABLE: Selene → LuxSync**

| Selene Component | Original Purpose | LuxSync Adaptation |
|------------------|------------------|-------------------|
| **HarmonicConsensusEngine** | Vote on medical decisions | Vote on lighting scenes |
| **EmergenceGenerator** | Generate data beauty patterns | Generate Fibonacci light timing |
| **EvolutionEngine** | Evolve treatment plans | Evolve scene genetics (color, strobe, speed) |
| **PhoenixProtocol** | Revive crashed nodes | Revive failed fixtures (DMX reset) |
| **EthicsLayer** | Patient safety | Epilepsy prevention, power limits |
| **DreamLayer** | Creative medical insights | Creative scene generation |
| **SelfAnalysisLayer** | Learn from outcomes | Learn from audience feedback |
| **MemoryLayer** | Redis patient records | Redis/JSON scene history |
| **HuntingLayer** | Detect medical patterns | Detect audio patterns (drops, bass) |

---

## 🚀 **NEXT STEPS**

1. ✅ Create base interfaces (this document)
2. ⏳ Implement `FixtureNode` class
3. ⏳ Adapt `HuntingLayer` sensors to audio
4. ⏳ Create `DMXScene` genetics system
5. ⏳ Implement scene voting logic
6. ⏳ Poetry → DMX sequence mapper
7. ⏳ Integration testing with real audio

---

**End of Architecture Document**
