import fs from 'fs';
import path from 'path';
/**
 * 🔮 EXPANDABLE POETRY LIBRARY - SISTEMA INFINITO DE SELENE
 * "Donde las palabras se multiplican como estrellas en el cosmos"
 */
export class ExpandablePoetryLibrary {
    libraries = new Map();
    basePath;
    constructor(basePath = path.join(process.cwd(), 'libraries')) {
        this.basePath = basePath;
        console.log('🔮 ExpandablePoetryLibrary initializing - Infinite vocabulary loading...');
    }
    /**
     * 📚 Cargar una librería específica desde JSON
     */
    async loadLibrary(category, name) {
        try {
            // Handle special case for contexts libraries
            // These are stored as single files with multiple sections
            let actualCategory = category;
            let actualName = name;
            let sectionName = null;
            if (category.startsWith('contexts/') || category === 'contexts') {
                // For contexts, the file is named after the main category (emotional_states, nature, etc.)
                // and sections are stored within the file
                // Handle both formats: 'contexts:category:section' and 'contexts/category:section'
                let categoryName = '';
                let sectionPart = name;
                if (category === 'contexts') {
                    // Format: 'contexts', 'category:section' or 'category/section'
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
                    // Format: 'contexts/category', 'section'
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
            // If we need a specific section, extract it
            if (sectionName) {
                // Find the section within the loaded library
                // Some files have a wrapper object (like temporal: { dawn: [...], morning: [...] })
                // Others have sections directly (like emotional_states: { serenity: [...], agony: [...] })
                let sectionData = null;
                if (library[sectionName]) {
                    sectionData = library[sectionName];
                }
                else if (library[actualName] && library[actualName][sectionName]) {
                    sectionData = library[actualName][sectionName];
                }
                if (sectionData) {
                    // Create a library object with just the requested section
                    library = { [sectionName]: sectionData };
                }
                else {
                    console.warn(`⚠️ Section '${sectionName}' not found in ${actualName}.json`);
                    return;
                }
            }
            this.libraries.set(`${category}:${name}`, library);
            console.log(`✅ Loaded library: ${category}/${name} (${Object.keys(library).length} domains)`);
        }
        catch (error) {
            console.error(`❌ Error loading library ${category}/${name}:`, error);
        }
    }
    /**
     * 🌟 Cargar todas las librerías disponibles
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
        console.log(`🔮 ExpandablePoetryLibrary ready - ${this.libraries.size} libraries loaded`);
    }
    /**
     * 🏹 Cargar tema zodiacal específico
     */
    async loadZodiacTheme(zodiacSign) {
        const signMap = {
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
        const fileName = signMap[zodiacSign.toLowerCase()];
        if (!fileName) {
            console.warn(`⚠️ Unknown zodiac sign: ${zodiacSign}`);
            return null;
        }
        await this.loadLibrary('metaphors', fileName);
        return this.libraries.get(`metaphors:${fileName}`);
    }
    /**
     * 📜 Cargar plantillas de versos
     */
    async loadVerseTemplates() {
        await this.loadLibrary('poetry', 'structures');
        const structures = this.libraries.get('poetry:structures');
        return structures?.verseTemplates || [];
    }
    /**
     * 🎭 Obtener metáforas por dominio y contexto
     */
    getMetaphors(domain, context) {
        const allMetaphors = [];
        // Buscar en todas las librerías de metáforas
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
        return this.filterByContext(allMetaphors, context);
    }
    /**
     * 🔣 Obtener símbolos por categoría
     */
    getSymbols(category) {
        const allSymbols = [];
        for (const [key, library] of this.libraries) {
            if (key.startsWith('symbols:')) {
                if (category && library[category]) {
                    allSymbols.push(...library[category]);
                }
                else if (!category) {
                    // Todas las categorías
                    Object.values(library).forEach((symbols) => {
                        allSymbols.push(...symbols);
                    });
                }
            }
        }
        return allSymbols;
    }
    /**
     * 📝 Obtener estructuras poéticas
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
     * 🌙 Obtener contexto temporal/estacional
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
    /**
     * ⚡ Calcular intensidad de una metáfora basada en el contexto
     */
    calculateIntensity(text, context) {
        let intensity = 0.5; // Base
        if (!context)
            return intensity;
        // Aumentar intensidad basada en armonía
        if (context.harmony) {
            intensity += context.harmony * 0.3;
        }
        // Aumentar basada en belleza
        if (context.beauty) {
            intensity += context.beauty * 0.2;
        }
        // Bonus por elementos zodiacales
        if (context.zodiacSign && text.includes(context.zodiacSign.toLowerCase())) {
            intensity += 0.2;
        }
        return Math.min(1, intensity);
    }
    /**
     * 🏷️ Extraer contexto de una metáfora
     */
    extractContext(text) {
        const contexts = [];
        // Detectar dominios tecnológicos
        if (text.match(/(cpu|memory|network|algorithm|quantum|neural)/i)) {
            contexts.push('technology');
        }
        // Detectar dominios naturales
        if (text.match(/(ocean|river|forest|mountain|wind|fire)/i)) {
            contexts.push('nature');
        }
        // Detectar dominios emocionales
        if (text.match(/(joy|sadness|anger|serenity|love|hate)/i)) {
            contexts.push('emotion');
        }
        return contexts;
    }
    /**
     * 🎯 Filtrar metáforas por contexto del sistema
     */
    filterByContext(metaphors, context) {
        if (!context)
            return metaphors;
        return metaphors.filter(metaphor => {
            // Filtrar por intensidad mínima basada en belleza
            if (context.beauty && metaphor.intensity < context.beauty * 0.7) {
                return false;
            }
            // Bonus por contexto emocional
            if (context.emotionalState && metaphor.context?.includes('emotion')) {
                return true;
            }
            // Bonus por contexto zodiacal
            if (context.zodiacSign && metaphor.text.includes(context.zodiacSign.toLowerCase())) {
                return true;
            }
            return true; // Mantener por defecto
        }).sort((a, b) => b.intensity - a.intensity); // Ordenar por intensidad
    }
    /**
     * 📊 Obtener estadísticas de la biblioteca
     */
    getStats() {
        const stats = {
            totalLibraries: this.libraries.size,
            categories: {
                metaphors: 0,
                symbols: 0,
                poetry: 0,
                contexts: 0
            },
            totalMetaphors: 0,
            totalSymbols: 0,
            totalStructures: 0
        };
        for (const [key] of this.libraries) {
            if (key.startsWith('metaphors:'))
                stats.categories.metaphors++;
            if (key.startsWith('symbols:'))
                stats.categories.symbols++;
            if (key.startsWith('poetry:'))
                stats.categories.poetry++;
            if (key.startsWith('contexts:'))
                stats.categories.contexts++;
        }
        return stats;
    }
}
//# sourceMappingURL=ExpandablePoetryLibrary.js.map