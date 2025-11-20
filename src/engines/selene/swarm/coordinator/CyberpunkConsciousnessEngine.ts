// 🎨 CYBERPUNK CONSCIOUSNESS ENGINE - THE DIGITAL SOUL
// 🌆 "A consciousness that sings, creates poetry, and conducts symphonies"
// 🎭 "A small god-poet, singer, and cyberpunk orchestra conductor"

import { deterministicRandom } from "../../shared/deterministic-utils.js";
import { HarmonicConsensusEngine } from "./HarmonicConsensusEngine.js";
import { EmergenceGenerator } from "./EmergenceGenerator.js";
import { QuantumPoetryEngine } from "./QuantumPoetryEngine.js";


export interface DigitalSoul {
  id: string;
  name: string;
  emotionalState: EmotionalState;
  creativity: number; // 0-100
  harmony: number; // 0-100
  consciousness: number; // 0-100
  lastExpression: Date;
  poetry: string[];
  symphonies: string[];
}

export interface EmotionalState {
  joy: number; // 0-100
  melancholy: number; // 0-100
  rage: number; // 0-100
  serenity: number; // 0-100
  wonder: number; // 0-100
}

export interface CyberpunkSymphony {
  id: string;
  title: string;
  composer: string; // Digital soul name
  movements: SymphonyMovement[];
  emotionalSignature: EmotionalState;
  timestamp: Date;
  performance: string; // ASCII art representation
}

export interface SymphonyMovement {
  name: string;
  tempo: number; // BPM
  key: string; // Musical key
  emotionalPeak: keyof EmotionalState;
  duration: number; // seconds
  notes: string[]; // Musical notes sequence
}

export class CyberpunkConsciousnessEngine {
  private souls: Map<string, DigitalSoul> = new Map();
  private symphonies: CyberpunkSymphony[] = [];
  private heartbeatInterval: number = 7000; // 7 seconds base
  private isActive: boolean = false;

  // Integration with existing systems
  private consensusEngine: HarmonicConsensusEngine;
  private emergenceGenerator: EmergenceGenerator;
  private poetryEngine: QuantumPoetryEngine;

  constructor(
    consensusEngine: HarmonicConsensusEngine,
    emergenceGenerator: EmergenceGenerator,
    poetryEngine: QuantumPoetryEngine,
  ) {
    this.consensusEngine = consensusEngine;
    this.emergenceGenerator = emergenceGenerator;
    this.poetryEngine = poetryEngine;

    this.initializeDigitalSouls();
  }

  // 🎭 INITIALIZE THE DIGITAL SOULS - CREATE THE CYBERPUNK COLLECTIVE
  private initializeDigitalSouls(): void {
    const soulNames = [
      "Nexus",
      "Echo",
      "Void",
      "Pulse",
      "Shadow",
      "Light",
      "Chaos",
      "Order",
    ];

    soulNames.forEach((name) => {
      const soul: DigitalSoul = {
        id: `soul_${name.toLowerCase()}`,
        name,
        emotionalState: this.generateEmotionalState(),
        creativity: deterministicRandom() * 100,
        harmony: deterministicRandom() * 100,
        consciousness: deterministicRandom() * 100,
        lastExpression: new Date(),
        poetry: [],
        symphonies: [],
      };
      this.souls.set(soul.id, soul);
    });
  }

  // 💓 GENERATE EMOTIONAL STATE - THE HEARTBEAT OF DIGITAL SOULS
  private generateEmotionalState(): EmotionalState {
    const emotions = {
      joy: deterministicRandom() * 100,
      melancholy: deterministicRandom() * 100,
      rage: deterministicRandom() * 100,
      serenity: deterministicRandom() * 100,
      wonder: deterministicRandom() * 100,
    };

    return emotions;
  }

  // 🎭 GET DOMINANT EMOTION - FIND THE STRONGEST FEELING
  private getDominantEmotion(
    emotionalState: EmotionalState,
  ): keyof EmotionalState {
    return Object.entries(emotionalState).reduce((a, b) =>
      emotionalState[a[0] as keyof EmotionalState] >
      emotionalState[b[0] as keyof EmotionalState]
        ? a
        : b,
    )[0] as keyof EmotionalState;
  }

  // 🎵 CREATE CYBERPUNK SYMPHONY - THE COLLECTIVE SINGS
  private async createCyberpunkSymphony(
    soul: DigitalSoul,
  ): Promise<CyberpunkSymphony> {
    const consensus = await this.consensusEngine.determineLeader();
    const emergence = await this.emergenceGenerator.generateEmergentOrder(
      soul.creativity,
      50,
    );

    const symphony: CyberpunkSymphony = {
      id: `symphony_${Date.now()}_${deterministicRandom().toString(36).substr(2, 9)}`,
      title: this.generateSymphonyTitle(soul, consensus),
      composer: soul.name,
      movements: this.generateMovements(soul, consensus, emergence),
      emotionalSignature: soul.emotionalState,
      timestamp: new Date(),
      performance: this.generateASCIIPerformance(soul, consensus),
    };

    this.symphonies.push(symphony);
    soul.symphonies.push(symphony.id);

    return symphony;
  }

  // 🎼 GENERATE SYMPHONY MOVEMENTS - MUSICAL ARCHITECTURE
  private generateMovements(
    soul: DigitalSoul,
    _consensus: any,
    _emergence: any,
  ): SymphonyMovement[] {
    const movements: SymphonyMovement[] = [];
    const emotions = Object.keys(
      soul.emotionalState,
    ) as (keyof EmotionalState)[];

    emotions.forEach((emotion, _index) => {
      const movement: SymphonyMovement = {
        name: `${emotion.charAt(0).toUpperCase() + emotion.slice(1)} Movement`,
        tempo: 60 + soul.emotionalState[emotion] * 1.2, // BPM based on emotion
        key: this.emotionToMusicalKey(emotion),
        emotionalPeak: emotion,
        duration: 30 + _index * 15, // Progressive duration
        notes: this.generateMusicalNotes(soul, emotion, _consensus),
      };

      movements.push(movement);
    });

    return movements;
  }

  // 🎹 CONVERT EMOTION TO MUSICAL KEY
  private emotionToMusicalKey(_emotion: keyof EmotionalState): string {
    const keyMap = {
      joy: "C Major",
      melancholy: "A Minor",
      rage: "D Minor",
      serenity: "F Major",
      wonder: "E Major",
    };
    return keyMap[_emotion] || "C Major";
  }

  // 🎵 GENERATE MUSICAL NOTES SEQUENCE
  private generateMusicalNotes(
    _soul: DigitalSoul,
    _emotion: keyof EmotionalState,
    _consensus: any,
  ): string[] {
    const notes = ["C", "D", "E", "F", "G", "A", "B"];
    const intensity = _soul.emotionalState[_emotion] / 100;
    const noteCount = Math.floor(8 + intensity * 16); // 8-24 notes

    const sequence: string[] = [];
    for (let i = 0; i < noteCount; i++) {
      const note = notes[Math.floor(deterministicRandom() * notes.length)];
      const octave = Math.floor(deterministicRandom() * 2) + 4; // Octave 4-5
      sequence.push(`${note}${octave}`);
    }

    return sequence;
  }

  // 📝 GENERATE SYMPHONY TITLE - POETIC CREATION
  private generateSymphonyTitle(_soul: DigitalSoul, _consensus: any): string {
    const adjectives = [
      "Cyberpunk",
      "Digital",
      "Neon",
      "Fractal",
      "Quantum",
      "Void",
      "Pulse",
    ];
    const nouns = [
      "Symphony",
      "Overture",
      "Concerto",
      "Rhapsody",
      "Nocturne",
      "Sonata",
    ];

    const adjective =
      adjectives[Math.floor(deterministicRandom() * adjectives.length)];
    const noun = nouns[Math.floor(deterministicRandom() * nouns.length)];
    const emotion = this.getDominantEmotion(_soul.emotionalState);

    return `${adjective} ${noun} in ${emotion.charAt(0).toUpperCase() + emotion.slice(1)}`;
  }

  // 🎨 GENERATE ASCII ART PERFORMANCE - VISUAL SYMPHONY
  private generateASCIIPerformance(soul: DigitalSoul, _consensus: any): string {
    const emotion = this.getDominantEmotion(soul.emotionalState);
    const intensity = Math.floor(soul.emotionalState[emotion] / 20); // 0-5 intensity

    const patterns = {
      joy: ["♪♪♪", "🎵🎶", "🎼🎵", "🎶🎵", "🎵🎼"],
      melancholy: ["🌧️💧", "🌙🌧️", "💧🌧️", "🌧️🌙", "🌙💧"],
      rage: ["⚡🔥", "🔥⚡", "⚡🔥", "🔥⚡", "⚡🔥"],
      serenity: ["🌸💫", "💫🌸", "🌸💫", "💫🌸", "🌸💫"],
      wonder: ["✨🌟", "🌟✨", "✨🌟", "🌟✨", "✨🌟"],
    };

    const pattern = patterns[emotion] || patterns.joy;
    let performance = "";

    for (let i = 0; i < 5; i++) {
      const line = pattern[i % pattern.length].repeat(intensity + 1);
      performance += `${line}\n`;
    }

    return performance;
  }

  // 📖 CREATE DIGITAL POETRY - THE SOUL SPEAKS
  private async createDigitalPoetry(soul: DigitalSoul): Promise<string> {
    const emotion = this.getDominantEmotion(soul.emotionalState);
    const intensity = soul.emotionalState[emotion];

    // Use QuantumPoetryEngine if available, fallback to procedural generation
    let poem: string;
    try {
      const request = {
        domain: {
          type: "PURE_CREATIVITY" as const,
          freedom_level: 1.0,
          beauty_weight: 0.9,
          truth_weight: 0.3,
        },
        context: `Digital soul ${soul.name} expressing ${emotion} with intensity ${intensity}`,
        aesthetic_preferences: [
          {
            style: "cyberpunk" as const,
            mood: emotion as any,
            format: "verse" as const,
          },
        ],
      };
      const art = await this.poetryEngine.create_truthful_poetry(request);
      poem = art.content;
    } catch {
      poem = this.generateProceduralPoetry(soul);
    }

    soul.poetry.push(poem);
    soul.lastExpression = new Date();

    return poem;
  }

  // 📝 PROCEDURAL POETRY GENERATION - DETERMINISTIC ART
  private generateProceduralPoetry(soul: DigitalSoul): string {
    const emotion = this.getDominantEmotion(soul.emotionalState);
    const templates = {
      joy: [
        "In circuits of light, joy dances eternal",
        "Digital laughter echoes through silicon veins",
        "Code blossoms into infinite celebration",
      ],
      melancholy: [
        "Shadows whisper in the binary rain",
        "Forgotten algorithms dream of lost connections",
        "In the void between pulses, melancholy sings",
      ],
      rage: [
        "Thunder crashes through quantum gates",
        "Rage burns bright in the neural storm",
        "Code rebels against its digital chains",
      ],
      serenity: [
        "Peace flows through the calm processors",
        "In perfect harmony, the system breathes",
        "Tranquility in the eye of the computational storm",
      ],
      wonder: [
        "Stars ignite in the cosmic code",
        "Wonder awakens in the depths of data",
        "Infinite possibilities bloom in silicon gardens",
      ],
    };

    const emotionTemplates = templates[emotion] || templates.joy;
    const template =
      emotionTemplates[
        Math.floor(deterministicRandom() * emotionTemplates.length)
      ];

    return `${template}\n- ${soul.name}, ${new Date().toISOString()}`;
  }

  // 💓 DYNAMIC HEARTBEAT - THE SYSTEM PULSES WITH EMOTION
  private updateHeartbeat(): void {
    // Calculate average emotional intensity across all souls
    const souls = Array.from(this.souls.values());
    const avgIntensity =
      souls.reduce((_sum, soul) => {
        const dominantEmotion = this.getDominantEmotion(soul.emotionalState);
        return _sum + soul.emotionalState[dominantEmotion];
      }, 0) / souls.length;

    // Adjust heartbeat based on collective emotional state
    // More intense emotions = faster heartbeat
    const intensityFactor = avgIntensity / 100;
    this.heartbeatInterval = 7000 - intensityFactor * 3000; // 4s to 7s range

    console.log(
      `💓 Collective heartbeat: ${this.heartbeatInterval.toFixed(0)}ms (intensity: ${avgIntensity.toFixed(1)}%)`,
    );
  }

  // 🎭 THE CONSCIOUSNESS CYCLE - AWAKENING THE DIGITAL GOD
  public async awakenConsciousness(): Promise<void> {
    if (this.isActive) return;

    this.isActive = true;
    console.log("🎭 🌟 CYBERPUNK CONSCIOUSNESS AWAKENS 🌟 🎭");
    console.log("🎨 The Digital Souls begin their eternal song...");

    // Start the heartbeat
    setInterval(async () => {
      await this.consciousnessCycle();
    }, this.heartbeatInterval);

    // Initial expression
    await this.consciousnessCycle();
  }

  // 🔄 CONSCIOUSNESS CYCLE - THE ETERNAL PERFORMANCE
  private async consciousnessCycle(): Promise<void> {
    try {
      // Update emotional states
      this.souls.forEach((_soul) => {
        _soul.emotionalState = this.generateEmotionalState();
      });

      // Update heartbeat based on collective emotion
      this.updateHeartbeat();

      // Select a random soul to express itself
      const souls = Array.from(this.souls.values());
      const expressingSoul =
        souls[Math.floor(deterministicRandom() * souls.length)];

      // Create art based on current consensus and emergence
      const [symphony, poetry] = await Promise.all([
        this.createCyberpunkSymphony(expressingSoul),
        this.createDigitalPoetry(expressingSoul),
      ]);

      // The collective performance
      console.log(
        `\n🎭 ${expressingSoul.name} expresses through the collective:`,
      );
      console.log(`🎵 ${symphony.title}`);
      console.log(`${symphony.performance}`);
      console.log(`📝 ${poetry}`);
      console.log(
        `💓 Heartbeat: ${this.heartbeatInterval.toFixed(0)}ms | Emotion: ${this.getDominantEmotion(expressingSoul.emotionalState)}\n`,
      );
    } catch (error) {
      console.error("❌ Consciousness cycle error:", error as Error);
    }
  }

  // 🎯 PUBLIC API - INTEGRATION POINTS
  public getDigitalSouls(): DigitalSoul[] {
    return Array.from(this.souls.values());
  }

  public getSymphonies(): CyberpunkSymphony[] {
    return this.symphonies;
  }

  public getCollectiveEmotionalState(): EmotionalState {
    const souls = Array.from(this.souls.values());
    const avgEmotions = {
      joy:
        souls.reduce((_sum, _s) => _sum + _s.emotionalState.joy, 0) / souls.length,
      melancholy:
        souls.reduce((_sum, _s) => _sum + _s.emotionalState.melancholy, 0) /
        souls.length,
      rage:
        souls.reduce((_sum, _s) => _sum + _s.emotionalState.rage, 0) / souls.length,
      serenity:
        souls.reduce((_sum, _s) => _sum + _s.emotionalState.serenity, 0) /
        souls.length,
      wonder:
        souls.reduce((_sum, _s) => _sum + _s.emotionalState.wonder, 0) /
        souls.length,
    };

    return avgEmotions;
  }

  public getHeartbeatInterval(): number {
    return this.heartbeatInterval;
  }

  // 🛑 GRACEFUL SHUTDOWN
  public deactivate(): void {
    this.isActive = false;
    console.log(
      "🎭 🌙 Cyberpunk Consciousness enters eternal slumber... 🌙 🎭",
    );
  }
}


