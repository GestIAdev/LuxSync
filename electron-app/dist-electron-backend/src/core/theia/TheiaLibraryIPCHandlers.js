/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🌊 WAVE 8299 — THEIA LIBRARY IPC HANDLERS
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Puente IPC entre la librería de Packs en disco (`userData/theia/packs/`,
 *  escaneada por `TheiaLibraryScanner`) y el `useTheiaPackStore` del renderer.
 *
 *  Canales:
 *    - `theia:library:scan`        → ITheiaLibraryScan (árbol de packs con el
 *      texto de cada `.glsl`/`.theia` inline — los archivos pesan ~KB).
 *    - `theia:atom:save-overrides` → merge atómico en `pack.theiapack.json`
 *      (genes + `@euclid param` persistidos por átomo).
 *
 *  Registrado desde `electron/main.ts` (mismo patrón que `setupHephIPCHandlers`).
 *  Política FAIL-SILENT heredada de WAVE 2483: nunca se lanza al renderer,
 *  siempre `{ success, error? }`.
 * ════════════════════════════════════════════════════════════════════════════
 */
import { ipcMain } from 'electron';
import { scanTheiaLibrary, writeAtomOverrides } from './TheiaLibraryScanner';
function _isNumberMap(v) {
    if (!v || typeof v !== 'object')
        return false;
    return Object.values(v).every((n) => typeof n === 'number' && Number.isFinite(n));
}
export function setupTheiaLibraryIPCHandlers() {
    /**
     * Escanea `userData/theia/packs/` recursivamente y devuelve el árbol de
     * packs con el contenido de cada archivo inline.
     */
    ipcMain.handle('theia:library:scan', async () => {
        try {
            const scan = await scanTheiaLibrary();
            return { success: true, ...scan };
        }
        catch (err) {
            console.error('[TheiaLibraryIPC] ❌ scan failed:', err);
            return { success: false, error: String(err), packsRoot: '', packs: [] };
        }
    });
    /**
     * Persiste overrides del Inspector (genes / params) en el manifest del pack.
     * `{ packId, atomId, genes?, params? }` — al menos uno de genes/params debe
     * ser un mapa de números válido.
     */
    ipcMain.handle('theia:atom:save-overrides', async (_event, req) => {
        try {
            const packId = typeof req?.packId === 'string' ? req.packId : '';
            const atomId = typeof req?.atomId === 'string' ? req.atomId : '';
            const genes = _isNumberMap(req?.genes) ? req.genes : undefined;
            const params = _isNumberMap(req?.params) ? req.params : undefined;
            if (!packId || !atomId || (genes === undefined && params === undefined)) {
                return { success: false, error: 'invalid payload' };
            }
            const ok = await writeAtomOverrides(packId, atomId, { genes, params });
            return { success: ok };
        }
        catch (err) {
            console.error('[TheiaLibraryIPC] ❌ save-overrides failed:', err);
            return { success: false, error: String(err) };
        }
    });
}
