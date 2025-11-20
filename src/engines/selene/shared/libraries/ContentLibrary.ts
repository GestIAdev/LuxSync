/**
 * 📚 CONTENT LIBRARY INTERFACE - SELENE MULTIMODAL ARCHITECTURE
 * 
 * Generic interface for content libraries used by all engines:
 * - PoetryLibrary (MusicEngine) → words, verses, metaphors
 * - DialogueLibrary (NPCEngine) → phrases, responses, personality traits
 * - SignalLibrary (TradingEngine) → patterns, indicators, strategies
 * - FormulaLibrary (ChemistryEngine) → reactions, compounds, elements
 * 
 * This interface ensures consistent behavior across all content libraries:
 * - Base vocabulary management
 * - Contextual content loading
 * - SystemVitals adaptation
 * - Mode-based filtering (Deterministic/Balanced/Punk)
 * 
 * @author PunkClaude + RadWulf
 * @date 2025-10-23 (PHASE 7 PREP)
 * @version 1.0.0
 */

import { SystemVitals, VitalSigns } from '../../swarm/core/SystemVitals.js';
import { ModeConfig } from '../../evolutionary/modes/mode-manager.js';

// ════════════════════════════════════════════════════════════════════════════
// LIBRARY CONTEXT
// ════════════════════════════════════════════════════════════════════════════

/**
 * Context parameters for loading content supplements
 * 
 * Used to load contextual content based on:
 * - Zodiac signs (Aries, Taurus, etc.)
 * - Elements (Fire, Water, Earth, Air)
 * - Emotions (Serenity, Agony, Joy, etc.)
 * - Time of day (Dawn, Morning, Afternoon, Night)
 * - Seasons (Spring, Summer, Autumn, Winter)
 * - Themes (Technology, Nature, Cosmic, etc.)
 */
export interface LibraryContext {
  /** Zodiac sign context */
  zodiacSign?: string;
  
  /** Elemental context (fire, water, earth, air) */
  element?: string;
  
  /** Emotional state context */
  emotionalState?: string;
  
  /** Time of day context */
  timeOfDay?: string;
  
  /** Season context */
  season?: string;
  
  /** Thematic context */
  theme?: string;
  
  /** Beauty score (0-1) */
  beauty?: number;
  
  /** Harmony score (0-1) */
  harmony?: number;
  
  /** Complexity level (0-1) */
  complexity?: number;
  
  /** Additional custom parameters */
  [key: string]: any;
}

// ════════════════════════════════════════════════════════════════════════════
// CONTENT ITEM METADATA
// ════════════════════════════════════════════════════════════════════════════

/**
 * Metadata attached to content items
 * 
 * Used for:
 * - Weighting (selection probability)
 * - Filtering (by context, mode, vitals)
 * - Sorting (by intensity, relevance)
 */
export interface ContentMetadata {
  /** Content intensity/strength (0-1) */
  intensity?: number;
  
  /** Relevance to current context (0-1) */
  relevance?: number;
  
  /** Weight for random selection */
  weight?: number;
  
  /** Associated contexts */
  contexts?: string[];
  
  /** Source domain/category */
  domain?: string;
  
  /** Additional custom metadata */
  [key: string]: any;
}

/**
 * Content item with metadata
 */
export interface ContentItem<T> {
  /** The actual content */
  content: T;
  
  /** Metadata for filtering/weighting */
  metadata?: ContentMetadata;
}

// ════════════════════════════════════════════════════════════════════════════
// CONTENT LIBRARY INTERFACE
// ════════════════════════════════════════════════════════════════════════════

/**
 * Generic Content Library Interface
 * 
 * All engine content libraries MUST implement this interface.
 * 
 * ## Type Parameter
 * - `T`: The type of content items (string for poetry, DialogueLine for NPCs, etc.)
 * 
 * ## Core Methods
 * - `initialize()`: Load base vocabulary and setup
 * - `getBaseVocabulary()`: Access base content
 * - `loadContextualSupplement()`: Load context-specific content
 * - `adaptToVitals()`: Adapt content to system vitals
 * - `filterByMode()`: Filter content by mode (Deterministic/Balanced/Punk)
 * 
 * ## Example Implementation (PoetryLibrary)
 * ```typescript
 * class PoetryLibrary implements ContentLibrary<string> {
 *   private baseVocabulary = new Map<string, ContentItem<string>[]>();
 *   
 *   async initialize(): Promise<void> {
 *     await this.loadAllLibraries();
 *   }
 *   
 *   getBaseVocabulary(): Map<string, ContentItem<string>[]> {
 *     return this.baseVocabulary;
 *   }
 *   
 *   async loadContextualSupplement(context: LibraryContext): Promise<ContentItem<string>[]> {
 *     if (context.zodiacSign) {
 *       return await this.loadZodiacMetaphors(context.zodiacSign);
 *     }
 *     return [];
 *   }
 *   
 *   async adaptToVitals(vitals: SystemVitals): Promise<ContentItem<string>[]> {
 *     const vitalSigns = vitals.getVitalSigns();
 *     
 *     // High creativity → load more chaotic metaphors
 *     if (vitalSigns.creativity > 0.7) {
 *       return await this.loadLibrary('metaphors', 'cosmic');
 *     }
 *     
 *     return [];
 *   }
 *   
 *   filterByMode(items: ContentItem<string>[], mode: ModeConfig): ContentItem<string>[] {
 *     const entropyFactor = mode.entropyFactor / 100;
 *     
 *     if (entropyFactor === 0) {
 *       // DETERMINISTIC: Only high-weight items
 *       return items.filter(item => item.metadata?.weight && item.metadata.weight > 0.7);
 *     } else if (entropyFactor < 0.6) {
 *       // BALANCED: Mix of weights
 *       return items;
 *     } else {
 *       // PUNK: Include all, even low-weight items
 *       return items;
 *     }
 *   }
 * }
 * ```
 */
export interface ContentLibrary<T> {
  // ════════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ════════════════════════════════════════════════════════════════════════════
  
  /**
   * Initialize library
   * 
   * Called once on startup.
   * Should:
   * - Load base vocabulary from disk/database
   * - Parse JSON files
   * - Build internal indices
   * - Validate content
   * 
   * @throws Error if initialization fails
   */
  initialize(): Promise<void>;
  
  // ════════════════════════════════════════════════════════════════════════════
  // BASE VOCABULARY
  // ════════════════════════════════════════════════════════════════════════════
  
  /**
   * Get base vocabulary
   * 
   * Returns the core content library without any contextual supplements.
   * 
   * Structure: Map<category, items[]>
   * - category: Domain/category name (e.g., 'metaphors', 'fire', 'serenity')
   * - items: Array of content items with metadata
   * 
   * @returns Base vocabulary map
   */
  getBaseVocabulary(): Map<string, ContentItem<T>[]>;
  
  /**
   * Get items from a specific category
   * 
   * @param category - Category name
   * @returns Items in category, or empty array if not found
   */
  getItemsByCategory(category: string): ContentItem<T>[];
  
  // ════════════════════════════════════════════════════════════════════════════
  // CONTEXTUAL LOADING
  // ════════════════════════════════════════════════════════════════════════════
  
  /**
   * Load contextual supplement
   * 
   * Load additional content based on context parameters.
   * 
   * Examples:
   * - Context { zodiacSign: 'aries' } → Load Aries-themed content
   * - Context { emotionalState: 'serenity' } → Load serene content
   * - Context { timeOfDay: 'dawn' } → Load dawn-themed content
   * 
   * @param context - Context parameters
   * @returns Contextual content items
   */
  loadContextualSupplement(context: LibraryContext): Promise<ContentItem<T>[]>;
  
  // ════════════════════════════════════════════════════════════════════════════
  // SYSTEMVITALS ADAPTATION
  // ════════════════════════════════════════════════════════════════════════════
  
  /**
   * Adapt content to system vitals
   * 
   * Load or filter content based on current system state:
   * - High stress → Load calming content
   * - High creativity → Load chaotic/experimental content
   * - Low harmony → Load harmonizing content
   * - High health → Load complex content
   * 
   * @param vitals - SystemVitals instance
   * @returns Content adapted to system state
   */
  adaptToVitals(vitals: SystemVitals): Promise<ContentItem<T>[]>;
  
  // ════════════════════════════════════════════════════════════════════════════
  // MODE-BASED FILTERING
  // ════════════════════════════════════════════════════════════════════════════
  
  /**
   * Filter content by mode
   * 
   * Behavior by mode:
   * 
   * DETERMINISTIC (entropyFactor=0):
   * - Only high-weight items
   * - Predictable selection
   * - No surprises
   * 
   * BALANCED (entropyFactor=50):
   * - Mix of weights
   * - Some variation
   * - Coherent but not boring
   * 
   * PUNK (entropyFactor=100):
   * - All items included
   * - Low-weight items get chance
   * - Unexpected combinations
   * 
   * @param items - Items to filter
   * @param mode - Mode configuration
   * @returns Filtered items
   */
  filterByMode(items: ContentItem<T>[], mode: ModeConfig): ContentItem<T>[];
  
  // ════════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ════════════════════════════════════════════════════════════════════════════
  
  /**
   * Get random item from category
   * 
   * Selection should respect:
   * - Item weights
   * - Current mode
   * - Context relevance
   * 
   * @param category - Category name
   * @param context - Optional context
   * @param mode - Optional mode (for filtering)
   * @returns Random item, or null if category empty
   */
  getRandomItem(
    category: string,
    context?: LibraryContext,
    mode?: ModeConfig
  ): ContentItem<T> | null;
  
  /**
   * Get library statistics
   * 
   * @returns Statistics about library content
   */
  getStats(): LibraryStats;
}

// ════════════════════════════════════════════════════════════════════════════
// LIBRARY STATISTICS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Library statistics
 */
export interface LibraryStats {
  /** Total number of categories */
  totalCategories: number;
  
  /** Total number of items */
  totalItems: number;
  
  /** Items per category */
  itemsPerCategory: Record<string, number>;
  
  /** Average item weight */
  averageWeight?: number;
  
  /** Additional stats */
  [key: string]: any;
}

// ════════════════════════════════════════════════════════════════════════════
// ABSTRACT BASE CLASS (OPTIONAL HELPER)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Abstract base class for content libraries
 * 
 * Provides common functionality:
 * - Base vocabulary management
 * - Random item selection with weights
 * - Statistics calculation
 * 
 * Libraries can extend this to avoid boilerplate.
 */
export abstract class AbstractContentLibrary<T> implements ContentLibrary<T> {
  protected baseVocabulary: Map<string, ContentItem<T>[]> = new Map();
  protected initialized: boolean = false;
  
  // Abstract methods - MUST be implemented
  abstract initialize(): Promise<void>;
  abstract loadContextualSupplement(context: LibraryContext): Promise<ContentItem<T>[]>;
  abstract adaptToVitals(vitals: SystemVitals): Promise<ContentItem<T>[]>;
  
  // Default implementations
  
  getBaseVocabulary(): Map<string, ContentItem<T>[]> {
    return this.baseVocabulary;
  }
  
  getItemsByCategory(category: string): ContentItem<T>[] {
    return this.baseVocabulary.get(category) || [];
  }
  
  filterByMode(items: ContentItem<T>[], mode: ModeConfig): ContentItem<T>[] {
    const entropyFactor = mode.entropyFactor / 100;
    
    if (entropyFactor === 0) {
      // DETERMINISTIC: Only high-weight items (weight > 0.7)
      return items.filter(item => {
        const weight = item.metadata?.weight ?? 0.5;
        return weight > 0.7;
      });
    } else if (entropyFactor < 0.6) {
      // BALANCED: Filter out very low-weight items (weight < 0.2)
      return items.filter(item => {
        const weight = item.metadata?.weight ?? 0.5;
        return weight >= 0.2;
      });
    } else {
      // PUNK: Include all items
      return items;
    }
  }
  
  getRandomItem(
    category: string,
    context?: LibraryContext,
    mode?: ModeConfig
  ): ContentItem<T> | null {
    let items = this.getItemsByCategory(category);
    
    if (items.length === 0) {
      return null;
    }
    
    // Apply mode filter if provided
    if (mode) {
      items = this.filterByMode(items, mode);
    }
    
    if (items.length === 0) {
      return null;
    }
    
    // Weighted random selection
    return this.selectWeighted(items);
  }
  
  /**
   * Select item using weighted random selection
   */
  protected selectWeighted(items: ContentItem<T>[]): ContentItem<T> {
    // Calculate total weight
    const totalWeight = items.reduce((sum, item) => {
      return sum + (item.metadata?.weight ?? 1);
    }, 0);
    
    // Deterministic random using timestamp
    const random = (Date.now() % 10000) / 10000; // 0-1
    let threshold = random * totalWeight;
    
    // Select item
    for (const item of items) {
      threshold -= item.metadata?.weight ?? 1;
      if (threshold <= 0) {
        return item;
      }
    }
    
    // Fallback: return last item
    return items[items.length - 1];
  }
  
  getStats(): LibraryStats {
    const stats: LibraryStats = {
      totalCategories: this.baseVocabulary.size,
      totalItems: 0,
      itemsPerCategory: {}
    };
    
    for (const [category, items] of this.baseVocabulary) {
      stats.itemsPerCategory[category] = items.length;
      stats.totalItems += items.length;
    }
    
    // Calculate average weight
    let totalWeight = 0;
    let weightCount = 0;
    
    for (const items of this.baseVocabulary.values()) {
      for (const item of items) {
        if (item.metadata?.weight !== undefined) {
          totalWeight += item.metadata.weight;
          weightCount++;
        }
      }
    }
    
    if (weightCount > 0) {
      stats.averageWeight = totalWeight / weightCount;
    }
    
    return stats;
  }
}

