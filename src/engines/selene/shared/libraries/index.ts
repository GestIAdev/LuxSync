/**
 * 📚 SELENE SHARED LIBRARIES - UNIFIED EXPORT
 * 
 * Exporta todas las librerías de contenido compartidas:
 * - ContentLibrary (interfaz genérica)
 * - PoetryLibrary (implementación para música)
 * - Tipos y helpers
 * 
 * @author PunkClaude + RadWulf
 * @date 2025-10-23 (PHASE 7 PREP)
 */

// ════════════════════════════════════════════════════════════════════════════
// GENERIC CONTENT LIBRARY
// ════════════════════════════════════════════════════════════════════════════

export {
  // Interfaces
  ContentLibrary,
  LibraryContext,
  ContentMetadata,
  ContentItem,
  LibraryStats,
  
  // Abstract base class
  AbstractContentLibrary
} from './ContentLibrary.js';

// ════════════════════════════════════════════════════════════════════════════
// POETRY LIBRARY (Music Engine)
// ════════════════════════════════════════════════════════════════════════════

export {
  // Main class
  PoetryLibrary,
  
  // Poetry-specific types
  Metaphor,
  Symbol,
  PoetryStructure,
  SystemContext
} from './PoetryLibrary.js';

// ════════════════════════════════════════════════════════════════════════════
// FUTURE LIBRARIES
// ════════════════════════════════════════════════════════════════════════════

// Commented out - will be uncommented as libraries are implemented:

// export { DialogueLibrary, DialogueLine, PersonalityTrait } from './DialogueLibrary.js';
// export { SignalLibrary, TradingSignal, StrategyPattern } from './SignalLibrary.js';
// export { FormulaLibrary, ChemicalFormula, Reaction } from './FormulaLibrary.js';

