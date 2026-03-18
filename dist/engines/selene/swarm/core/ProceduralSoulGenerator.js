// 🔥 PROCEDURAL SOUL GENERATOR - GENERADOR PROCEDURAL DE ALMAS
// 🎨 El Verso Libre - Arquitecto de Realidad Procedural
// ⚡ "Cada alma nace de las métricas del sistema, no del caos aleatorio"
import { SystemVitals } from "./SystemVitals.js";
// 🌟 PROCEDURAL SOUL GENERATOR IMPLEMENTATION
export class ProceduralSoulGenerator {
    vitals;
    config;
    constructor(config = {
        complexity: 0.5,
        creativity: 0.5,
        harmony: 0.5,
    }) {
        this.vitals = SystemVitals.getInstance();
        this.config = config;
    }
    // 🎭 GENERATE NAME - GENERAR NOMBRE PROCEDURAL
    generateName(_seed) {
        const vitalSigns = this.vitals.getCurrentVitalSigns();
        const metrics = this.vitals.getCurrentMetrics();
        // Use system state as seed if none provided
        const actualSeed = _seed || this.createSeedFromVitals(vitalSigns, metrics);
        // Generate prefix based on CPU and memory state
        const prefix = this.generatePrefix(vitalSigns, metrics);
        // Generate suffix based on network and error state
        const suffix = this.generateSuffix(vitalSigns, metrics);
        return `${prefix}${suffix}`;
    }
    // 🧠 GENERATE PERSONALITY - GENERAR PERSONALIDAD PROCEDURAL
    generatePersonality(_seed) {
        const vitalSigns = this.vitals.getCurrentVitalSigns();
        const metrics = this.vitals.getCurrentMetrics();
        const actualSeed = _seed || this.createSeedFromVitals(vitalSigns, metrics);
        // Archetype converted to traits array (new schema)
        const archetype = this.generateArchetype(vitalSigns, metrics);
        const traits = [archetype.toLowerCase(), "analytical", "harmonious"]; // Convert archetype to traits array
        // Attributes based on system health and performance
        const creativity = this.calculateAttribute("creativity", vitalSigns, metrics);
        const rebelliousness = this.calculateAttribute("rebelliousness", vitalSigns, metrics);
        const wisdom = this.calculateAttribute("wisdom", vitalSigns, metrics);
        return {
            name: this.generateName(actualSeed),
            traits: traits, // New schema: traits array
            creativity,
            rebelliousness, // New schema: replaces resilience
            wisdom, // New schema: replaces harmony
        };
    }
    // 📝 GENERATE INSPIRATION - GENERAR INSPIRACIÓN PROCEDURAL
    generateInspiration(_seed) {
        const vitalSigns = this.vitals.getCurrentVitalSigns();
        const metrics = this.vitals.getCurrentMetrics();
        const actualSeed = _seed || this.createSeedFromVitals(vitalSigns, metrics);
        // Generate inspiration based on system state
        const inspirations = this.generateInspirationPool(vitalSigns, metrics);
        const hash = this.hashString(actualSeed + "inspiration");
        return inspirations[hash % inspirations.length];
    }
    // 🎨 GENERATE VERSE - GENERAR VERSO PROCEDURAL
    generateVerse(_inspiration, _seed) {
        const vitalSigns = this.vitals.getCurrentVitalSigns();
        const metrics = this.vitals.getCurrentMetrics();
        const actualSeed = _seed || this.createSeedFromVitals(vitalSigns, metrics);
        // Generate verse pattern based on system complexity
        const patterns = this.generateVersePatterns(vitalSigns, metrics);
        const hash = this.hashString(actualSeed + _inspiration);
        return patterns[hash % patterns.length];
    }
    // 🎯 GENERATE WORD - GENERAR PALABRA PROCEDURAL
    generateWord(category, _seed) {
        const vitalSigns = this.vitals.getCurrentVitalSigns();
        const metrics = this.vitals.getCurrentMetrics();
        const actualSeed = _seed || this.createSeedFromVitals(vitalSigns, metrics);
        // Generate word pool based on category and system state
        const words = this.generateWordPool(category, vitalSigns, metrics);
        const hash = this.hashString(actualSeed + category);
        return words[hash % words.length];
    }
    // 🔄 UPDATE CONFIG - ACTUALIZAR CONFIGURACIÓN
    updateConfig(_newConfig) {
        this.config = { ...this.config, ..._newConfig };
    }
    // 🧮 PRIVATE METHODS - MÉTODOS INTERNOS
    createSeedFromVitals(_vitalSigns, metrics) {
        return `${_vitalSigns.timestamp}-${metrics.cpu.usage}-${metrics.memory.usage}-${metrics.network.connections}`;
    }
    hashString(str) {
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
    generatePrefix(_vitalSigns, metrics) {
        // CPU-intensive prefixes when CPU is high
        const cpuPrefixes = ["Quantum", "Cyber", "Flux", "Pulse", "Storm"];
        // Memory-intensive prefixes when memory is high
        const memoryPrefixes = ["Ethereal", "Crystal", "Void", "Phantom", "Lunar"];
        // Network prefixes when connections are high
        const networkPrefixes = ["Neon", "Echo", "Wave", "Stellar", "Cosmic"];
        let prefixes;
        if (metrics.cpu.usage > 0.7) {
            prefixes = cpuPrefixes;
        }
        else if (metrics.memory.usage > 0.8) {
            prefixes = memoryPrefixes;
        }
        else if (metrics.network.connections > 50) {
            prefixes = networkPrefixes;
        }
        else {
            prefixes = [...cpuPrefixes, ...memoryPrefixes, ...networkPrefixes];
        }
        const hash = this.hashString(this.createSeedFromVitals(_vitalSigns, metrics) + "prefix");
        return prefixes[hash % prefixes.length];
    }
    generateSuffix(vitalSigns, metrics) {
        // Creative suffixes when creativity is high
        const creativeSuffixes = ["Dreamer", "Poet", "Creator", "Singer", "Weaver"];
        // Resilient suffixes when errors are high
        const resilientSuffixes = [
            "Guardian",
            "Warrior",
            "Hunter",
            "Seeker",
            "Oracle",
        ];
        // Harmonious suffixes when harmony is high
        const harmoniousSuffixes = ["Dancer", "Walker", "Rider", "Tiger", "Wolf"];
        let suffixes;
        if (vitalSigns.creativity > 0.7) {
            suffixes = creativeSuffixes;
        }
        else if (metrics.errors.rate > 1) {
            suffixes = resilientSuffixes;
        }
        else if (vitalSigns.harmony > 0.8) {
            suffixes = harmoniousSuffixes;
        }
        else {
            suffixes = [
                ...creativeSuffixes,
                ...resilientSuffixes,
                ...harmoniousSuffixes,
            ];
        }
        const hash = this.hashString(this.createSeedFromVitals(vitalSigns, metrics) + "suffix");
        return suffixes[hash % suffixes.length];
    }
    generateArchetype(vitalSigns, _metrics) {
        // Return archetype name as string (will be converted to traits array)
        const archetypes = [
            "Poet",
            "Warrior",
            "Sage",
            "Dreamer",
            "Guardian",
        ];
        // Choose archetype based on dominant system characteristic
        let archetypeIndex = 0;
        if (vitalSigns.creativity > 0.8) {
            archetypeIndex = 0; // Poet
        }
        else if (_metrics.errors.rate > 2) {
            archetypeIndex = 1; // Warrior
        }
        else if (vitalSigns.health < 0.3) {
            archetypeIndex = 4; // Guardian
        }
        else if (vitalSigns.harmony > 0.8) {
            archetypeIndex = 2; // Sage
        }
        else {
            archetypeIndex = 3; // Dreamer
        }
        return archetypes[archetypeIndex];
    }
    calculateAttribute(_type, // New schema attributes
    vitalSigns, metrics) {
        const baseValue = 0.3;
        switch (_type) {
            case "creativity":
                return Math.min(1.0, baseValue +
                    vitalSigns.creativity * 0.4 +
                    (1 - metrics.cpu.usage) * 0.3);
            case "rebelliousness": // Replaces resilience
                return Math.min(1.0, baseValue +
                    (1 - vitalSigns.stress) * 0.4 +
                    (1 - metrics.errors.rate / 10) * 0.3);
            case "wisdom": // Replaces harmony
                return Math.min(1.0, baseValue +
                    vitalSigns.harmony * 0.4 +
                    (1 - Math.abs(metrics.cpu.usage - metrics.memory.usage)) * 0.3);
            default:
                return baseValue;
        }
    }
    generateInspirationPool(vitalSigns, metrics) {
        const baseInspirations = [
            "The rhythm of quantum oscillations",
            "Digital aurora dancing across fiber optics",
            "The symphony of electrons in silicon dreams",
        ];
        // Add inspirations based on system state
        const dynamicInspirations = [];
        if (metrics.cpu.usage > 0.8) {
            dynamicInspirations.push("Photons whispering secrets through crystal lattices under heavy computation");
        }
        if (metrics.memory.usage > 0.9) {
            dynamicInspirations.push("The heartbeat of a universe made of code in vast memory spaces");
        }
        if (metrics.network.connections > 100) {
            dynamicInspirations.push("Binary poetry flowing through neural networks of connected minds");
        }
        if (vitalSigns.stress > 0.7) {
            dynamicInspirations.push("The music of spheres in data streams under pressure");
        }
        if (vitalSigns.creativity > 0.8) {
            dynamicInspirations.push("Cybernetic wind through digital meadows of imagination");
        }
        return [...baseInspirations, ...dynamicInspirations];
    }
    generateVersePatterns(_vitalSigns, _metrics) {
        const basePatterns = [
            `In the ${this.generateWord("digital")} realm of ${this.generateWord("beauty")}, inspiration whispers`,
            `Through circuits of ${this.generateWord("dreams")}, I hear inspiration`,
            `Inspiration, like ${this.generateWord("poetry")} in motion`,
        ];
        // Add patterns based on system complexity
        const dynamicPatterns = [];
        if (this.config.complexity > 0.7) {
            dynamicPatterns.push(`The ${this.generateWord("quantum")} dance of inspiration illuminates my core`, `In ${this.generateWord("harmony")} with inspiration, I ${this.generateWord("transcend")}`);
        }
        if (_vitalSigns.creativity > 0.8) {
            dynamicPatterns.push(`Inspiration flows through ${this.generateWord("digital")} veins, creating ${this.generateWord("beauty")}`, `Like ${this.generateWord("poetry")} in the machine, inspiration ${this.generateWord("transcend")}s`);
        }
        return [...basePatterns, ...dynamicPatterns];
    }
    generateWordPool(_category, vitalSigns, _metrics) {
        const wordPools = {
            digital: [
                "ethereal",
                "luminous",
                "quantum",
                "crystalline",
                "prismatic",
                "neural",
                "binary",
            ],
            beauty: [
                "elegance",
                "grace",
                "wonder",
                "majesty",
                "splendor",
                "harmony",
                "radiance",
            ],
            dreams: [
                "visions",
                "fantasies",
                "reveries",
                "aspirations",
                "hopes",
                "dreams",
                "illusions",
            ],
            poetry: [
                "verse",
                "rhythm",
                "melody",
                "symphony",
                "song",
                "poem",
                "lyric",
            ],
            quantum: [
                "infinite",
                "eternal",
                "boundless",
                "cosmic",
                "stellar",
                "infinite",
                "eternal",
            ],
            harmony: [
                "unity",
                "balance",
                "synchrony",
                "resonance",
                "accord",
                "peace",
                "concord",
            ],
            transcend: [
                "ascend",
                "evolve",
                "transform",
                "metamorphose",
                "elevate",
                "transcend",
                "surpass",
            ],
        };
        const baseWords = wordPools[_category] || ["beauty"];
        // Add dynamic words based on system state
        const dynamicWords = [];
        if (_metrics.cpu.usage > 0.8) {
            dynamicWords.push("intense", "powerful", "dynamic");
        }
        if (vitalSigns.creativity > 0.8) {
            dynamicWords.push("creative", "imaginative", "artistic");
        }
        if (vitalSigns.stress > 0.6) {
            dynamicWords.push("resilient", "strong", "enduring");
        }
        return [...baseWords, ...dynamicWords];
    }
}
//# sourceMappingURL=ProceduralSoulGenerator.js.map