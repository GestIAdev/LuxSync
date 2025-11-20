/**
 * 🔮 POETRY LIBRARY - SELENE MUSICAL ENGINE
 *
 * Expandable poetry and metaphor library for musical generation.
 * Implements ContentLibrary<string> interface.
 *
 * Features:
 * - Zodiacal metaphors (12 signs)
 * - Contextual vocabulary (temporal, seasonal, emotional)
 * - Symbol systems
 * - Poetry structures
 * - SystemVitals adaptation
 * - Mode-based filtering (Deterministic/Balanced/Punk)
 *
 * @author PunkClaude + RadWulf
 * @date 2025-10-23 (PHASE 7 PREP - Refactored from ExpandablePoetryLibrary)
 * @version 2.0.0
 */
import fs from 'fs';
import path from 'path';
import { AbstractContentLibrary } from './ContentLibrary.js';
// ════════════════════════════════════════════════════════════════════════════
// POETRY LIBRARY IMPLEMENTATION
// ════════════════════════════════════════════════════════════════════════════
/**
 * Poetry Library
 *
 * Content library for musical generation containing:
 * - Metaphors (zodiacal, cosmic, technological, natural)
 * - Symbols (astrological, elemental, numeric)
 * - Poetry structures (verse templates, rhyme schemes)
 * - Contextual vocabulary (temporal, seasonal, emotional)
 */
export class PoetryLibrary extends AbstractContentLibrary {
    /**
     * 🔓 LEGACY COMPATIBILITY GETTER
     * Provides read-only access to libraries Map for existing MusicalConsensusRecorder code
     */
    get librariesMap() {
        return this.libraries;
    }
    constructor(basePath = path.join(process.cwd(), 'libraries')) {
        super();
        this.libraries = new Map();
        // Zodiac sign mapping
        this.ZODIAC_SIGNS = {
            'aries': 'aries',
            'tauro': 'tauro',
            'geminis': 'geminis',
            'cancer': 'cancer',
            'leo': 'leo',
            'virgo': 'virgo',
            'libra': 'libra',
            'escorpio': 'escorpio',
            'sagitario': 'sagitario',
            'capricornio': 'capricornio',
            'acuario': 'acuario',
            'piscis': 'piscis'
        };
        this.basePath = basePath;
    }
    // ════════════════════════════════════════════════════════════════════════════
    // CONTENTLIBRARY INTERFACE IMPLEMENTATION
    // ════════════════════════════════════════════════════════════════════════════
    /**
     * Initialize library
     * Load all base metaphors, symbols, poetry structures, and contexts
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        console.log('🔮 PoetryLibrary initializing - Loading infinite vocabulary...');
        await this.loadAllLibraries();
        this.initialized = true;
        console.log(`🔮 PoetryLibrary ready - ${this.libraries.size} libraries loaded`);
    }
    /**
     * Load contextual supplement
     * Load additional content based on context (zodiac, element, emotion, etc.)
     */
    async loadContextualSupplement(context) {
        const items = [];
        // Load zodiac-specific metaphors
        if (context.zodiacSign) {
            const zodiacItems = await this.loadZodiacThemeContent(context.zodiacSign);
            items.push(...zodiacItems);
        }
        // Load elemental context
        if (context.element) {
            const elementItems = await this.loadElementalContext(context.element);
            items.push(...elementItems);
        }
        // Load emotional state
        if (context.emotionalState) {
            const emotionalItems = await this.loadEmotionalContext(context.emotionalState);
            items.push(...emotionalItems);
        }
        // Load temporal context
        if (context.timeOfDay) {
            const temporalItems = await this.loadTemporalContext(context.timeOfDay);
            items.push(...temporalItems);
        }
        // Load seasonal context
        if (context.season) {
            const seasonalItems = await this.loadSeasonalContext(context.season);
            items.push(...seasonalItems);
        }
        return items;
    }
    /**
     * Adapt to system vitals
     * Load content based on current system state
     */
    async adaptToVitals(vitals) {
        const vitalSigns = vitals.getCurrentVitalSigns();
        const items = [];
        // High creativity → load cosmic/experimental metaphors
        if (vitalSigns.creativity > 0.7) {
            const cosmicItems = await this.loadThematicContent('cosmic');
            items.push(...cosmicItems);
        }
        // High stress → load calming metaphors
        if (vitalSigns.stress > 0.7) {
            const calmingItems = await this.loadThematicContent('serene');
            items.push(...calmingItems);
        }
        // Low harmony → load harmonizing metaphors
        if (vitalSigns.harmony < 0.3) {
            const harmonizingItems = await this.loadThematicContent('harmonic');
            items.push(...harmonizingItems);
        }
        // High health → load complex metaphors
        if (vitalSigns.health > 0.8) {
            const complexItems = await this.loadThematicContent('complex');
            items.push(...complexItems);
        }
        return items;
    }
    // ════════════════════════════════════════════════════════════════════════════
    // LEGACY METHODS (Backwards Compatibility)
    // ════════════════════════════════════════════════════════════════════════════
    /**
     * Load library (legacy method)
     */
    async loadLibrary(category, name) {
        try {
            let actualCategory = category;
            let actualName = name;
            let sectionName = null;
            // Handle contexts/* pattern
            if (category.startsWith('contexts/') || category === 'contexts') {
                let categoryName = '';
                let sectionPart = name;
                if (category === 'contexts') {
                    if (name.includes(':')) {
                        const parts = name.split(':');
                        categoryName = parts[0];
                        sectionPart = parts[1];
                    }
                    else if (name.includes('/')) {
                        const parts = name.split('/');
                        categoryName = parts[0];
                        sectionPart = parts[1];
                    }
                    else {
                        categoryName = name;
                        sectionPart = null;
                    }
                }
                else if (category.startsWith('contexts/')) {
                    categoryName = category.split('/')[1];
                    sectionPart = name;
                }
                if (categoryName && sectionPart) {
                    actualCategory = 'contexts';
                    actualName = categoryName;
                    sectionName = sectionPart;
                }
                else {
                    actualCategory = 'contexts';
                    actualName = categoryName || name;
                }
            }
            const libraryPath = path.join(this.basePath, actualCategory, `${actualName}.json`);
            if (!fs.existsSync(libraryPath)) {
                console.warn(`⚠️ Library not found: ${libraryPath}`);
                return;
            }
            const libraryContent = fs.readFileSync(libraryPath, 'utf8');
            let library = JSON.parse(libraryContent);
            // Extract section if needed
            if (sectionName) {
                let sectionData = null;
                if (library[sectionName]) {
                    sectionData = library[sectionName];
                }
                else if (library[actualName] && library[actualName][sectionName]) {
                    sectionData = library[actualName][sectionName];
                }
                if (sectionData) {
                    library = { [sectionName]: sectionData };
                }
                else {
                    console.warn(`⚠️ Section '${sectionName}' not found in ${actualName}.json`);
                    return;
                }
            }
            this.libraries.set(`${category}:${name}`, library);
            // Also add to baseVocabulary
            this.addLibraryToVocabulary(category, name, library);
            console.log(`✅ Loaded library: ${category}/${name} (${Object.keys(library).length} domains)`);
        }
        catch (error) {
            console.error(`❌ Error loading library ${category}/${name}:`, error);
        }
    }
    /**
     * Load all libraries (legacy method)
     */
    async loadAllLibraries() {
        const categories = ['metaphors', 'symbols', 'poetry', 'contexts'];
        for (const category of categories) {
            const categoryPath = path.join(this.basePath, category);
            if (!fs.existsSync(categoryPath))
                continue;
            const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith('.json'));
            for (const file of files) {
                const name = file.replace('.json', '');
                await this.loadLibrary(category, name);
            }
        }
    }
    /**
     * Load zodiac theme (legacy method)
     */
    async loadZodiacTheme(zodiacSign) {
        const fileName = this.ZODIAC_SIGNS[zodiacSign.toLowerCase()];
        if (!fileName) {
            console.warn(`⚠️ Unknown zodiac sign: ${zodiacSign}`);
            return null;
        }
        await this.loadLibrary('metaphors', fileName);
        return this.libraries.get(`metaphors:${fileName}`);
    }
    /**
     * Load verse templates (legacy method)
     */
    async loadVerseTemplates() {
        await this.loadLibrary('poetry', 'structures');
        const structures = this.libraries.get('poetry:structures');
        return structures?.verseTemplates || [];
    }
    /**
     * Get metaphors by domain (legacy method)
     */
    getMetaphors(domain, context) {
        const allMetaphors = [];
        for (const [key, library] of this.libraries) {
            if (key.startsWith('metaphors:') && library[domain]) {
                const domainMetaphors = library[domain].map((text) => ({
                    text,
                    domain,
                    intensity: this.calculateIntensity(text, context),
                    context: this.extractContext(text)
                }));
                allMetaphors.push(...domainMetaphors);
            }
        }
        return this.filterBySystemContext(allMetaphors, context);
    }
    /**
     * Get symbols by category (legacy method)
     */
    getSymbols(category) {
        const allSymbols = [];
        for (const [key, library] of this.libraries) {
            if (key.startsWith('symbols:')) {
                if (category && library[category]) {
                    allSymbols.push(...library[category]);
                }
                else if (!category) {
                    Object.values(library).forEach((symbols) => {
                        allSymbols.push(...symbols);
                    });
                }
            }
        }
        return allSymbols;
    }
    /**
     * Get poetry structures (legacy method)
     */
    getPoetryStructures() {
        const structures = [];
        for (const [key, library] of this.libraries) {
            if (key.startsWith('poetry:') && library.structures) {
                structures.push(...library.structures);
            }
        }
        return structures;
    }
    /**
     * Get contextual elements (legacy method)
     */
    getContextualElements(context) {
        const contextualData = {};
        for (const [key, library] of this.libraries) {
            if (key.startsWith('contexts:')) {
                if (context.timeOfDay && library.temporal?.[context.timeOfDay]) {
                    contextualData.temporal = library.temporal[context.timeOfDay];
                }
                if (context.season && library.seasonal?.[context.season]) {
                    contextualData.seasonal = library.seasonal[context.season];
                }
                if (context.zodiacSign && library.astrological?.[context.zodiacSign]) {
                    contextualData.astrological = library.astrological[context.zodiacSign];
                }
            }
        }
        return contextualData;
    }
    // ════════════════════════════════════════════════════════════════════════════
    // HELPER METHODS
    // ════════════════════════════════════════════════════════════════════════════
    /**
     * Add library to base vocabulary
     */
    addLibraryToVocabulary(category, name, library) {
        for (const [domain, items] of Object.entries(library)) {
            const categoryKey = `${category}:${name}:${domain}`;
            if (Array.isArray(items)) {
                const contentItems = items.map((item) => {
                    if (typeof item === 'string') {
                        return {
                            content: item,
                            metadata: {
                                domain,
                                weight: 0.5,
                                intensity: 0.5
                            }
                        };
                    }
                    else {
                        return {
                            content: item.text || item.char || String(item),
                            metadata: {
                                domain,
                                weight: item.weight || 0.5,
                                intensity: item.intensity || 0.5
                            }
                        };
                    }
                });
                this.baseVocabulary.set(categoryKey, contentItems);
            }
        }
    }
    /**
     * Load zodiac theme content
     */
    async loadZodiacThemeContent(zodiacSign) {
        const theme = await this.loadZodiacTheme(zodiacSign);
        if (!theme)
            return [];
        const items = [];
        for (const [domain, metaphors] of Object.entries(theme)) {
            if (Array.isArray(metaphors)) {
                for (const text of metaphors) {
                    items.push({
                        content: String(text),
                        metadata: {
                            domain,
                            weight: 0.7,
                            intensity: 0.7,
                            contexts: ['zodiac', zodiacSign]
                        }
                    });
                }
            }
        }
        return items;
    }
    /**
     * Load elemental context
     */
    async loadElementalContext(element) {
        // Load element-specific metaphors
        await this.loadLibrary('contexts', `elemental:${element}`);
        return this.extractItemsFromLibrary(`contexts:elemental:${element}`);
    }
    /**
     * Load emotional context
     */
    async loadEmotionalContext(emotionalState) {
        await this.loadLibrary('contexts', `emotional_states:${emotionalState}`);
        return this.extractItemsFromLibrary(`contexts:emotional_states:${emotionalState}`);
    }
    /**
     * Load temporal context
     */
    async loadTemporalContext(timeOfDay) {
        await this.loadLibrary('contexts', `temporal:${timeOfDay}`);
        return this.extractItemsFromLibrary(`contexts:temporal:${timeOfDay}`);
    }
    /**
     * Load seasonal context
     */
    async loadSeasonalContext(season) {
        await this.loadLibrary('contexts', `seasonal:${season}`);
        return this.extractItemsFromLibrary(`contexts:seasonal:${season}`);
    }
    /**
     * Load thematic content
     */
    async loadThematicContent(theme) {
        await this.loadLibrary('metaphors', theme);
        return this.extractItemsFromLibrary(`metaphors:${theme}`);
    }
    /**
     * Extract items from library
     */
    extractItemsFromLibrary(libraryKey) {
        const library = this.libraries.get(libraryKey);
        if (!library)
            return [];
        const items = [];
        for (const [domain, content] of Object.entries(library)) {
            if (Array.isArray(content)) {
                for (const item of content) {
                    items.push({
                        content: String(item),
                        metadata: {
                            domain,
                            weight: 0.6,
                            intensity: 0.6
                        }
                    });
                }
            }
        }
        return items;
    }
    /**
     * Calculate intensity (legacy)
     */
    calculateIntensity(text, context) {
        let intensity = 0.5;
        if (!context)
            return intensity;
        if (context.harmony) {
            intensity += context.harmony * 0.3;
        }
        if (context.beauty) {
            intensity += context.beauty * 0.2;
        }
        if (context.zodiacSign && text.includes(context.zodiacSign.toLowerCase())) {
            intensity += 0.2;
        }
        return Math.min(1, intensity);
    }
    /**
     * Extract context (legacy)
     */
    extractContext(text) {
        const contexts = [];
        if (text.match(/(cpu|memory|network|algorithm|quantum|neural)/i)) {
            contexts.push('technology');
        }
        if (text.match(/(ocean|river|forest|mountain|wind|fire)/i)) {
            contexts.push('nature');
        }
        if (text.match(/(joy|sadness|anger|serenity|love|hate)/i)) {
            contexts.push('emotion');
        }
        return contexts;
    }
    /**
     * Filter by system context (legacy)
     */
    filterBySystemContext(metaphors, context) {
        if (!context)
            return metaphors;
        return metaphors.filter(metaphor => {
            if (context.beauty && metaphor.intensity < context.beauty * 0.7) {
                return false;
            }
            if (context.emotionalState && metaphor.context?.includes('emotion')) {
                return true;
            }
            if (context.zodiacSign && metaphor.text.includes(context.zodiacSign.toLowerCase())) {
                return true;
            }
            return true;
        }).sort((a, b) => b.intensity - a.intensity);
    }
}
