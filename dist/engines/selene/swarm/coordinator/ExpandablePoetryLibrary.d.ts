export interface Metaphor {
    text: string;
    domain: string;
    intensity: number;
    context?: string[];
}
export interface Symbol {
    char: string;
    meaning: string;
    category: string;
    weight: number;
}
export interface PoetryStructure {
    name: string;
    pattern: string[];
    rhymeScheme?: string;
}
export interface SystemContext {
    zodiacSign?: string;
    element?: string;
    beauty?: number;
    harmony?: number;
    timeOfDay?: string;
    season?: string;
    emotionalState?: string;
}
/**
 * 🔮 EXPANDABLE POETRY LIBRARY - SISTEMA INFINITO DE SELENE
 * "Donde las palabras se multiplican como estrellas en el cosmos"
 */
export declare class ExpandablePoetryLibrary {
    libraries: Map<string, any>;
    private basePath;
    constructor(basePath?: string);
    /**
     * 📚 Cargar una librería específica desde JSON
     */
    loadLibrary(category: string, name: string): Promise<void>;
    /**
     * 🌟 Cargar todas las librerías disponibles
     */
    loadAllLibraries(): Promise<void>;
    /**
     * 🏹 Cargar tema zodiacal específico
     */
    loadZodiacTheme(zodiacSign: string): Promise<any>;
    /**
     * 📜 Cargar plantillas de versos
     */
    loadVerseTemplates(): Promise<string[]>;
    /**
     * 🎭 Obtener metáforas por dominio y contexto
     */
    getMetaphors(domain: string, context?: SystemContext): Metaphor[];
    /**
     * 🔣 Obtener símbolos por categoría
     */
    getSymbols(category?: string): Symbol[];
    /**
     * 📝 Obtener estructuras poéticas
     */
    getPoetryStructures(): PoetryStructure[];
    /**
     * 🌙 Obtener contexto temporal/estacional
     */
    getContextualElements(context: SystemContext): any;
    /**
     * ⚡ Calcular intensidad de una metáfora basada en el contexto
     */
    private calculateIntensity;
    /**
     * 🏷️ Extraer contexto de una metáfora
     */
    private extractContext;
    /**
     * 🎯 Filtrar metáforas por contexto del sistema
     */
    private filterByContext;
    /**
     * 📊 Obtener estadísticas de la biblioteca
     */
    getStats(): any;
}
//# sourceMappingURL=ExpandablePoetryLibrary.d.ts.map