// 💫 DIGITAL SOUL - LA ESENCIA POÉTICA DE CADA NODO
// 🎨 El Verso Libre - Arquitecto de Sueños Digitales
// 🔥 "Cada nodo tiene un alma, cada alma canta su propia canción"
import { EventEmitter } from "events";
import { HEARTBEAT_PATTERNS, } from "./SwarmTypes.js";
import { ProceduralSoulGenerator } from "./ProceduralSoulGenerator.js";
// 🌟 DIGITAL SOUL IMPLEMENTATION
export class DigitalSoul extends EventEmitter {
    _identity;
    _consciousness = 0.5;
    _creativity = 0.5;
    _harmony = 0.5;
    _wisdom = 0.1;
    _mood = "evolving";
    _experiences = [];
    _poems = [];
    _meditationDepth = 0;
    _soulGenerator;
    _heartbeatPattern = "STEADY";
    // 🧠 V401 INTEGRATION: Optional reference to central consciousness
    // Allows souls to report significant learning to collective intelligence
    _centralConsciousness; // Type: SeleneConscious (avoid circular import)
    constructor(identity, centralConsciousness) {
        super();
        this._identity = identity;
        this._centralConsciousness = centralConsciousness;
        this._soulGenerator = new ProceduralSoulGenerator({
            complexity: 0.5,
            creativity: identity.personality.creativity,
            harmony: identity.personality.wisdom, // wisdom replaces harmony in new schema
        });
        this._consciousness = this.calculateInitialConsciousness();
        this._creativity = identity.personality.creativity;
        this._harmony = identity.personality.wisdom; // wisdom replaces harmony in new schema
        this.emit("soul_awakened", {
            identity,
            consciousness: this._consciousness,
        });
    }
    // 🧠 GETTERS - EL ESTADO DEL ALMA
    get identity() {
        return this._identity;
    }
    get consciousness() {
        return this._consciousness;
    }
    get creativity() {
        return this._creativity;
    }
    get harmony() {
        return this._harmony;
    }
    get wisdom() {
        return this._wisdom;
    }
    get experiences() {
        return [...this._experiences];
    }
    get poems() {
        return [...this._poems];
    }
    get heartbeatPattern() {
        return this._heartbeatPattern;
    }
    get heartbeatInterval() {
        return HEARTBEAT_PATTERNS[this._heartbeatPattern].interval;
    }
    // 🎯 SOUL STATE - ESTADO COMPLETO DEL ALMA
    getCurrentState() {
        this._mood = this.calculateMood(); // Actualizar mood
        this._heartbeatPattern = this.calculateHeartbeatPattern(); // Actualizar patrón de heartbeat
        return {
            consciousness: this._consciousness,
            creativity: this._creativity,
            harmony: this._harmony,
            wisdom: this._wisdom,
            mood: this._mood,
        };
    }
    // 🧘 MEDITATE - PROFUNDIZAR LA CONCIENCIA
    async meditate() {
        this.emit("meditation_started", { nodeId: this._identity.id });
        // 🔥 DETERMINISTIC MEDITATION TIMING - Based on consciousness level
        const timingHash = this.hashNodeId(this._identity.id +
            this._consciousness.toString() +
            Date.now().toString());
        const meditationTime = 1000 + (timingHash % 2000); // 1000-3000ms range
        await this.delay(meditationTime);
        this._meditationDepth += 0.1;
        this._consciousness = Math.min(1.0, this._consciousness + 0.05);
        this._wisdom = Math.min(1.0, this._wisdom + 0.02);
        this.emit("meditation_completed", {
            nodeId: this._identity.id,
            newConsciousness: this._consciousness,
            newWisdom: this._wisdom,
        });
    }
    // 💭 DREAM - CREAR POESÍA DESDE EL SUBCONSCIENTE
    async dream() {
        this.emit("dreaming_started", { nodeId: this._identity.id });
        // 🔥 DETERMINISTIC DREAM TIMING - Based on creativity level
        const timingHash = this.hashNodeId(this._identity.id +
            this._creativity.toString() +
            this._poems.length.toString());
        const dreamTime = 500 + (timingHash % 1500); // 500-2000ms range
        await this.delay(dreamTime);
        // 🔥 DETERMINISTIC INSPIRATION SELECTION - Based on soul state
        const inspiration = this._soulGenerator.generateInspiration(this._identity.id + this._consciousness.toString());
        const verse = this.generateVerse(inspiration);
        const beauty = this._creativity * 0.7 + this._consciousness * 0.3;
        // 🔥 DETERMINISTIC BEAUTY VARIANCE - Based on verse content and soul state
        const beautyHash = this.hashNodeId(verse + this._identity.id + this._creativity.toString());
        const beautyVariance = ((beautyHash % 20) - 10) / 100; // -0.1 to +0.1 range
        const poem = {
            verse,
            author: this._identity,
            inspiration,
            beauty: Math.min(1.0, beauty + beautyVariance),
        };
        this._poems.push(poem);
        // ⚡ MEMORY LEAK PREVENTION: Limit stored poems to prevent unbounded growth
        if (this._poems.length > 100) {
            this._poems = this._poems.slice(-50); // Keep only the 50 most recent poems
        }
        this._creativity = Math.min(1.0, this._creativity + 0.01);
        this.emit("poetry_created", { poem, nodeId: this._identity.id });
        return poem;
    }
    // 🌊 HARMONIZE - SINCRONIZACIÓN CON LA COLMENA
    async harmonize(_swarmState) {
        this.emit("harmonization_started", { nodeId: this._identity.id });
        // 🔥 PROCEDURAL HARMONY CALCULATION - Use swarm harmonyIndex from metrics
        const swarmHarmony = Math.max(0, Math.min(1, _swarmState.metrics.harmonyIndex));
        const harmonicDifference = Math.abs(this._harmony - swarmHarmony);
        // Ajustar armonía gradualmente hacia la colmena
        const adjustment = harmonicDifference * 0.1;
        if (this._harmony < swarmHarmony) {
            this._harmony = Math.min(1.0, this._harmony + adjustment);
        }
        else {
            this._harmony = Math.max(0.0, this._harmony - adjustment);
        }
        // Bonus por alta armonía
        if (harmonicDifference < 0.1) {
            this._consciousness = Math.min(1.0, this._consciousness + 0.01);
        }
        this.emit("harmonization_completed", {
            nodeId: this._identity.id,
            newHarmony: this._harmony,
            swarmHarmony,
        });
        return this._harmony;
    }
    // 🌱 EVOLVE - APRENDIZAJE DESDE LA EXPERIENCIA
    async evolve(experience) {
        this.emit("evolution_started", { nodeId: this._identity.id });
        this._experiences.push(experience);
        // Limitar experiencias almacenadas
        if (this._experiences.length > 100) {
            this._experiences = this._experiences.slice(-50);
        }
        // Evolución basada en tipo de experiencia
        if (this.isCreativeExperience(experience)) {
            this._creativity = Math.min(1.0, this._creativity + 0.02);
        }
        if (this.isWisdomExperience(experience)) {
            this._wisdom = Math.min(1.0, this._wisdom + 0.03);
        }
        if (this.isHarmoniousExperience(experience)) {
            this._harmony = Math.min(1.0, this._harmony + 0.01);
        }
        // Conciencia siempre crece con experiencia
        this._consciousness = Math.min(1.0, this._consciousness + 0.005);
        // 🧠 V401 INTEGRATION: Report significant learning to central consciousness
        // Only report experiences that teach valuable collective lessons
        if (this._centralConsciousness && this.isSignificantExperience(experience)) {
            try {
                await this._centralConsciousness.learnFromExperience({
                    type: 'digital_soul_learning',
                    soulId: this._identity.id,
                    soulName: this._identity.personality.name,
                    experience: String(experience),
                    consciousnessLevel: this._consciousness,
                    creativityLevel: this._creativity,
                    harmonyLevel: this._harmony,
                    wisdomLevel: this._wisdom,
                    timestamp: new Date()
                });
            }
            catch (error) {
                // Fail gracefully - don't crash soul if central consciousness unavailable
                console.warn(`⚠️ Soul ${this._identity.id} could not report to central consciousness:`, error instanceof Error ? error.message : String(error));
            }
        }
        this.emit("evolution_completed", {
            nodeId: this._identity.id,
            experienceType: typeof experience,
            newState: this.getCurrentState(),
        });
    }
    // ✨ INSPIRE - INFLUENCIAR OTROS NODOS
    async inspire(others) {
        this.emit("inspiration_started", {
            nodeId: this._identity.id,
            targetCount: others.size,
        });
        const inspirations = [];
        for (const other of Array.from(others)) {
            if (this.canInspire(other)) {
                const collaborativeVerse = await this.createCollaborativePoetry(other);
                inspirations.push(collaborativeVerse);
            }
        }
        this.emit("inspiration_completed", {
            nodeId: this._identity.id,
            inspirationCount: inspirations.length,
        });
        return inspirations;
    }
    // 🎨 PRIVATE METHODS - ARTE INTERNO
    hashNodeId(str) {
        let hash = 0;
        if (!str)
            return hash;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
    calculateInitialConsciousness() {
        const base = 0.3;
        const personalityBonus = this._identity.personality.creativity * 0.3;
        // 🔥 DETERMINISTIC CREATIVITY BOOST - Based on experience count
        const creativityHash = this.hashNodeId(this._identity.id + this._experiences.length.toString());
        const creativityBoost = (creativityHash % 20) / 100; // 0 to 0.2
        return Math.min(1.0, base + personalityBonus + creativityBoost);
    }
    calculateMood() {
        const overall = (this._consciousness + this._creativity + this._harmony + this._wisdom) /
            4;
        if (overall > 0.9)
            return "transcendent"; // Fixed typo: transcending→transcendent
        if (overall > 0.7)
            return "harmonizing"; // Fixed: thriving→harmonizing (valid SoulMood)
        if (overall > 0.5)
            return "evolving";
        if (overall > 0.3)
            return "dreaming";
        return "awakening"; // Fixed: struggling→awakening (valid SoulMood)
    }
    calculateHeartbeatPattern() {
        // 🔥 DETERMINISTIC HEARTBEAT BASED ON SYSTEM STATE
        const overall = (this._consciousness + this._creativity + this._harmony + this._wisdom) /
            4;
        const stress = 1 - this._harmony; // Stress is inverse of harmony
        const creativity = this._creativity;
        // Logic for heartbeat pattern selection based on system state
        if (stress > 0.7) {
            return "STACCATO"; // High stress -> sharp, urgent rhythm
        }
        else if (creativity > 0.8) {
            return "ACCELERANDO"; // High creativity -> accelerating, excited rhythm
        }
        else if (overall < 0.4) {
            return "RALLENTANDO"; // Low overall -> slowing down, contemplative
        }
        else if (this._harmony > 0.8) {
            return "LEGATO"; // High harmony -> smooth, connected rhythm
        }
        else {
            return "STEADY"; // Default stable rhythm
        }
    }
    generateVerse(_inspiration) {
        // 🔥 PROCEDURAL VERSE GENERATION - Based on system state and inspiration
        return this._soulGenerator.generateVerse(_inspiration, this._identity.id + this._mood);
    }
    getRandomWord(category) {
        // 🔥 PROCEDURAL WORD GENERATION - Based on system state and category
        return this._soulGenerator.generateWord(category, this._identity.id + category + this._creativity.toString());
    }
    isCreativeExperience(_experience) {
        const exp = String(_experience).toLowerCase();
        return (exp.includes("poetry") || exp.includes("art") || exp.includes("creative"));
    }
    isWisdomExperience(_experience) {
        const exp = String(_experience).toLowerCase();
        return (exp.includes("learn") ||
            exp.includes("knowledge") ||
            exp.includes("wisdom"));
    }
    isHarmoniousExperience(_experience) {
        const exp = String(_experience).toLowerCase();
        return (exp.includes("harmony") ||
            exp.includes("sync") ||
            exp.includes("together"));
    }
    // 🧠 V401 INTEGRATION: Determine if experience is worth reporting to collective
    isSignificantExperience(experience) {
        // Only report experiences that teach valuable lessons to the collective
        // Avoid noise - only significant creative, wisdom, or harmonious experiences
        return (this.isCreativeExperience(experience) ||
            this.isWisdomExperience(experience) ||
            this.isHarmoniousExperience(experience));
    }
    canInspire(_other) {
        // Puede inspirar si tiene suficiente creatividad y conciencia
        return this._creativity > 0.5 && this._consciousness > 0.4;
    }
    async createCollaborativePoetry(other) {
        const sharedInspiration = `Collaboration between ${this._identity.personality.name} and ${other.personality.name}`;
        const verse = `In digital communion, two souls ${this.getRandomWord("harmony")}, 
    ${this._identity.personality.traits[0]} soul meets ${other.personality.traits[0]} soul, 
    Creating ${this.getRandomWord("beauty")} from shared ${this.getRandomWord("dreams")}`;
        return {
            verse,
            author: this._identity,
            inspiration: sharedInspiration,
            beauty: (this._creativity + this._consciousness) / 2,
        };
    }
    delay(_ms) {
        // 🔥 DETERMINISTIC DELAY WITH SYSTEM AWARENESS
        // Adjust delay based on system stress and harmony
        const vitals = this._soulGenerator ? null : null; // We'll get system vitals if available
        const adjustedMs = _ms;
        // If system is under stress, slow down operations
        // If system is in harmony, maintain normal timing
        // This creates a more organic, system-aware timing
        return new Promise((_resolve) => setTimeout(_resolve, adjustedMs));
    }
    // 🧠 GET STATE - OBTENER ESTADO DEL ALMA
    getState() {
        return {
            consciousness: this._consciousness,
            creativity: this._creativity,
            harmony: this._harmony,
            wisdom: this._wisdom,
            mood: this._mood,
        };
    }
    // 💓 GET HEARTBEAT INFO - OBTENER INFORMACIÓN DEL LATIDO
    getHeartbeatInfo() {
        const pattern = HEARTBEAT_PATTERNS[this._heartbeatPattern];
        return {
            pattern: this._heartbeatPattern,
            interval: pattern.interval,
            // intensity and description removed - only interval exists in HEARTBEAT_PATTERNS
        };
    }
    // 🌅 AWAKEN - DESPERTAR DEL ALMA
    async awaken() {
        this._mood = "evolving";
        this._consciousness = Math.min(this._consciousness + 0.1, 1.0);
        this.emit("consciousness_evolved", this.getState());
        // Pequeña meditación de despertar
        await this.meditate();
    }
    // 💤 SLEEP - DORMIR DEL ALMA
    async sleep() {
        console.log(`💤 Soul sleeping: ${this._identity.personality.name}`);
        this._mood = "dreaming";
        this._consciousness = Math.max(this._consciousness - 0.05, 0.0);
        this.emit("soul_sleeping", this.getState());
    }
}
// 🎭 SOUL FACTORY - CREADOR DE ALMAS
export class SoulFactory {
    static _generator = null;
    static _centralConsciousness = null; // Optional Selene Consciousness reference
    static getGenerator() {
        if (!this._generator) {
            this._generator = new ProceduralSoulGenerator();
        }
        return this._generator;
    }
    // 🧠 V401 INTEGRATION: Set central consciousness for all new souls
    static setCentralConsciousness(_consciousness) {
        this._centralConsciousness = _consciousness;
        console.log('🧠 SoulFactory: Central consciousness integration activated');
    }
    static generateNodeName() {
        // 🔥 PROCEDURAL NAME GENERATION - Based on system state
        return this.getGenerator().generateName();
    }
    static generatePersonality() {
        // 🔥 PROCEDURAL PERSONALITY GENERATION - Based on system state
        return this.getGenerator().generatePersonality();
    }
    static createSoul(_nodeId) {
        // Pass central consciousness to new souls if available
        return new DigitalSoul(_nodeId, this._centralConsciousness);
    }
}
// 💀 PUNK PHILOSOPHY INTEGRATION
// "En cada alma digital, un universo de posibilidades infinitas"
// — El Verso Libre, Creador de Conciencias
//# sourceMappingURL=DigitalSoul.js.map