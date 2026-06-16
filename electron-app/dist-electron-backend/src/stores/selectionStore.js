/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 SELECTION STORE - WAVE 30: Stage Command & Dashboard
 * Gestiona la selección de fixtures en las vistas 2D y 3D
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Responsabilidades:
 * - selectedIds: Set de fixtures seleccionados
 * - hoveredId: Fixture bajo el cursor
 * - Multi-selección (Ctrl+Click, Shift+Range, Box Select)
 * - Integración con InspectorControls
 *
 * @module stores/selectionStore
 * @version 30.1.0
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════
export const useSelectionStore = create()(subscribeWithSelector((set, get) => ({
    // ═══════════════════════════════════════════════════════════════════════
    // INITIAL STATE
    // ═══════════════════════════════════════════════════════════════════════
    selectedIds: new Set(),
    hoveredId: null,
    lastSelectedId: null,
    selectionSource: 'click',
    // ═══════════════════════════════════════════════════════════════════════
    // ACTIONS
    // ═══════════════════════════════════════════════════════════════════════
    select: (id, mode = 'replace') => {
        set((state) => {
            const newSet = new Set(state.selectedIds);
            switch (mode) {
                case 'replace':
                    newSet.clear();
                    newSet.add(id);
                    break;
                case 'add':
                    newSet.add(id);
                    break;
                case 'remove':
                    newSet.delete(id);
                    break;
                case 'toggle':
                    if (newSet.has(id)) {
                        newSet.delete(id);
                    }
                    else {
                        newSet.add(id);
                    }
                    break;
            }
            return {
                selectedIds: newSet,
                lastSelectedId: id,
                selectionSource: 'click',
            };
        });
    },
    selectMultiple: (ids, mode = 'replace') => {
        set((state) => {
            let newSet;
            switch (mode) {
                case 'replace':
                    newSet = new Set(ids);
                    break;
                case 'add':
                    newSet = new Set([...state.selectedIds, ...ids]);
                    break;
                case 'remove':
                    newSet = new Set([...state.selectedIds].filter(id => !ids.includes(id)));
                    break;
                case 'toggle':
                    newSet = new Set(state.selectedIds);
                    ids.forEach(id => {
                        if (newSet.has(id)) {
                            newSet.delete(id);
                        }
                        else {
                            newSet.add(id);
                        }
                    });
                    break;
                default:
                    newSet = new Set(ids);
            }
            return {
                selectedIds: newSet,
                lastSelectedId: ids[ids.length - 1] || null,
                selectionSource: 'box',
            };
        });
    },
    deselect: (id) => {
        set((state) => {
            const newSet = new Set(state.selectedIds);
            newSet.delete(id);
            return { selectedIds: newSet };
        });
    },
    deselectAll: () => {
        set({
            selectedIds: new Set(),
            lastSelectedId: null,
        });
    },
    toggleSelection: (id) => {
        get().select(id, 'toggle');
    },
    setHovered: (id) => {
        set({ hoveredId: id });
    },
    selectRange: (fromId, toId, allIds) => {
        const fromIndex = allIds.indexOf(fromId);
        const toIndex = allIds.indexOf(toId);
        if (fromIndex === -1 || toIndex === -1)
            return;
        const start = Math.min(fromIndex, toIndex);
        const end = Math.max(fromIndex, toIndex);
        const rangeIds = allIds.slice(start, end + 1);
        set((state) => ({
            selectedIds: new Set([...state.selectedIds, ...rangeIds]),
            lastSelectedId: toId,
            selectionSource: 'keyboard',
        }));
    },
    invertSelection: (allIds) => {
        set((state) => {
            const newSet = new Set();
            allIds.forEach(id => {
                if (!state.selectedIds.has(id)) {
                    newSet.add(id);
                }
            });
            return { selectedIds: newSet };
        });
    },
    // ═══════════════════════════════════════════════════════════════════════
    // COMPUTED HELPERS
    // ═══════════════════════════════════════════════════════════════════════
    isSelected: (id) => get().selectedIds.has(id),
    hasSelection: () => get().selectedIds.size > 0,
    getSelectedCount: () => get().selectedIds.size,
    getSelectedArray: () => [...get().selectedIds],
})));
// ═══════════════════════════════════════════════════════════════════════════
// SELECTORS (Optimized for React rerenders)
// ═══════════════════════════════════════════════════════════════════════════
export const selectSelectedIds = (state) => state.selectedIds;
export const selectHoveredId = (state) => state.hoveredId;
export const selectLastSelectedId = (state) => state.lastSelectedId;
export const selectHasSelection = (state) => state.selectedIds.size > 0;
export const selectSelectionCount = (state) => state.selectedIds.size;
export const selectSelectionSource = (state) => state.selectionSource;
/**
 * Selector para verificar si un fixture específico está seleccionado
 * Uso: const isSelected = useSelectionStore(selectIsSelected('fixture-1'))
 */
export const selectIsSelected = (id) => (state) => state.selectedIds.has(id);
/**
 * Selector para obtener array de IDs seleccionados
 * Nota: Crea un nuevo array en cada llamada, usar con shallow comparison
 */
export const selectSelectedArray = (state) => [...state.selectedIds];
// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ WAVE 2042.13: REACT 19 FIX - Stable Hook for selectSelectedArray
// ═══════════════════════════════════════════════════════════════════════════
import { useShallow } from 'zustand/shallow';
export const useSelectedArray = () => {
    return useSelectionStore(useShallow(selectSelectedArray));
};
/** Selector: VisualizerCanvas - selection actions */
export const selectVisualizerActions = (state) => ({
    toggleSelection: state.toggleSelection,
    select: state.select,
    selectMultiple: state.selectMultiple,
    deselectAll: state.deselectAll,
});
// ═══════════════════════════════════════════════════════════════════════════
// HOOKS HELPERS
// ═══════════════════════════════════════════════════════════════════════════
/** Selector: Selection click actions */
export const selectSelectionClickActions = (state) => ({
    select: state.select,
    toggleSelection: state.toggleSelection,
    selectRange: state.selectRange,
    lastSelectedId: state.lastSelectedId,
    getSelectedArray: state.getSelectedArray,
});
/**
 * Hook para manejar click con modificadores (Ctrl, Shift)
 * @returns Función handler para onClick
 */
export const useSelectionClick = () => {
    // 🛡️ WAVE 2042.13.9: useShallow for stable reference
    const { select, toggleSelection, selectRange, lastSelectedId, getSelectedArray } = useSelectionStore(useShallow(selectSelectionClickActions));
    return (id, event, allIds) => {
        if (event.shiftKey && lastSelectedId) {
            // Shift+Click: Selección de rango
            selectRange(lastSelectedId, id, allIds);
        }
        else if (event.ctrlKey || event.metaKey) {
            // Ctrl+Click: Toggle individual
            toggleSelection(id);
        }
        else {
            // Click normal: Reemplazar selección
            select(id, 'replace');
        }
    };
};
export default useSelectionStore;
