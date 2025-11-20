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
export class AbstractContentLibrary {
    constructor() {
        this.baseVocabulary = new Map();
        this.initialized = false;
    }
    // Default implementations
    getBaseVocabulary() {
        return this.baseVocabulary;
    }
    getItemsByCategory(category) {
        return this.baseVocabulary.get(category) || [];
    }
    filterByMode(items, mode) {
        const entropyFactor = mode.entropyFactor / 100;
        if (entropyFactor === 0) {
            // DETERMINISTIC: Only high-weight items (weight > 0.7)
            return items.filter(item => {
                const weight = item.metadata?.weight ?? 0.5;
                return weight > 0.7;
            });
        }
        else if (entropyFactor < 0.6) {
            // BALANCED: Filter out very low-weight items (weight < 0.2)
            return items.filter(item => {
                const weight = item.metadata?.weight ?? 0.5;
                return weight >= 0.2;
            });
        }
        else {
            // PUNK: Include all items
            return items;
        }
    }
    getRandomItem(category, context, mode) {
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
    selectWeighted(items) {
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
    getStats() {
        const stats = {
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
