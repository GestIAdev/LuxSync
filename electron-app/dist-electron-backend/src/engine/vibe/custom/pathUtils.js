/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛤️ pathUtils.ts — DEEP OBJECT MANIPULATION HELPERS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Helpers para leer, escribir y borrar valores en objetos anidados usando
 * rutas dot-notation (`'physics.envelopes.envelopeKick.boost'`).
 *
 * ── POR QUÉ EXISTE ESTE ARCHIVO ─────────────────────────────────────────────
 * El documento `.luxvibe` es SPARSE: sólo contiene lo que difiere del ADN
 * base. Los objetos intermedios (`physics`, `envelopes`, `envelopeKick`) pueden
 * no existir cuando el usuario muta un gen profundo. `setByPath` crea los
 * objetos intermedios bajo demanda; `deleteByPath` los poda si quedan vacíos.
 *
 * Immer (usado por el store) maneja esto parcialmente, pero necesitamos
 * versiones puras para:
 *   1. El resolver (fuera de Immer, sobre clones profundos).
 *   2. `countLeaves` (cálculo de `mutationCount`).
 *   3. `revertPanel` (borrado por prefijo).
 *
 * ── INVARIANTES ────────────────────────────────────────────────────────────
 * - Cero mutación de inputs. `setByPath` y `deleteByPath` devuelven nuevos
 *   objetos (shallow clone por nivel).
 * - Rutas con arrays no se soportan: el genoma es 100% objetos planos.
 * - `undefined` se trata como ausente (no como valor).
 *
 * @module engine/vibe/custom/pathUtils
 * @version FASE 1B — The Fusion Core
 */
/**
 * Lee un valor por ruta dot-notation.
 *
 * @param obj Raíz del objeto (puede ser `null`/`undefined`).
 * @param path Ruta como `'a.b.c'`.
 * @returns El valor, o `undefined` si la ruta no existe.
 */
export function getByPath(obj, path) {
    if (obj === null || obj === undefined)
        return undefined;
    const segments = path.split('.');
    let current = obj;
    for (let i = 0; i < segments.length; i++) {
        if (current === null || current === undefined)
            return undefined;
        if (typeof current !== 'object' || Array.isArray(current))
            return undefined;
        current = current[segments[i]];
    }
    return current;
}
/**
 * Escribe un valor por ruta dot-notation, creando los objetos intermedios
 * si no existen. NO muta el input: devuelve una shallow-copia del raíz.
 *
 * Si `value === undefined`, delega a `deleteByPath` (borra la hoja y poda).
 *
 * @param obj Raíz del objeto (puede ser `null`/`undefined` → se crea `{}`).
 * @param path Ruta como `'a.b.c'`.
 * @param value Valor a escribir. `undefined` → borra.
 * @returns Nuevo objeto raíz con la ruta escrita.
 */
export function setByPath(obj, path, value) {
    if (value === undefined)
        return deleteByPath(obj, path);
    const segments = path.split('.');
    if (segments.length === 0)
        return obj ?? {};
    const root = (obj ? { ...obj } : {});
    let cursor = root;
    for (let i = 0; i < segments.length - 1; i++) {
        const key = segments[i];
        const child = cursor[key];
        // Sólo descendemos si es un objeto plano; si no, lo reemplazamos.
        const next = child !== null && typeof child === 'object' && !Array.isArray(child)
            ? { ...child }
            : {};
        cursor[key] = next;
        cursor = next;
    }
    cursor[segments[segments.length - 1]] = value;
    return root;
}
/**
 * Borra una hoja por ruta dot-notation y poda los objetos intermedios
 * que queden vacíos (sin propiedades propias). NO muta el input.
 *
 * @param obj Raíz del objeto.
 * @param path Ruta como `'a.b.c'`.
 * @returns Nuevo objeto raíz sin la ruta, o el original si no existía.
 */
export function deleteByPath(obj, path) {
    if (!obj)
        return obj ?? {};
    const segments = path.split('.');
    if (segments.length === 0)
        return obj;
    // Verifica que la ruta existe antes de clonar (evita work innecesario).
    if (getByPath(obj, path) === undefined)
        return obj;
    const root = { ...obj };
    const chain = [root];
    let cursor = root;
    for (let i = 0; i < segments.length - 1; i++) {
        const key = segments[i];
        const child = cursor[key];
        if (child === null || typeof child !== 'object' || Array.isArray(child)) {
            return root; // La ruta no existe como objeto: nada que borrar.
        }
        const next = { ...child };
        cursor[key] = next;
        chain.push(next);
        cursor = next;
    }
    delete cursor[segments[segments.length - 1]];
    // Poda: recorre la cadena en reversa eliminando objetos vacíos.
    for (let i = chain.length - 1; i >= 1; i--) {
        const child = chain[i];
        if (Object.keys(child).length === 0) {
            const parent = chain[i - 1];
            delete parent[segments[i - 1]];
        }
        else {
            break; // Si un nivel no está vacío, los superiores tampoco.
        }
    }
    return root;
}
/**
 * Cuenta las hojas (valores primitivos no-`undefined`) de un objeto anidado.
 * Usado para calcular `mutationCount` del store.
 *
 * Arrays se cuentan como 1 hoja por elemento primitivo (no se recursa en
 * objetos dentro de arrays — el genoma no los usa, pero `patterns: string[]`
 * sí aparece y cada patrón cuenta como 1 mutación).
 *
 * @param obj Objeto a inspeccionar.
 * @returns Número de hojas.
 */
export function countLeaves(obj) {
    if (obj === null || obj === undefined)
        return 0;
    if (typeof obj !== 'object')
        return 1;
    if (Array.isArray(obj)) {
        let count = 0;
        for (const item of obj) {
            if (item === undefined)
                continue;
            count += typeof item === 'object' && item !== null ? countLeaves(item) : 1;
        }
        return count;
    }
    let count = 0;
    for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (val === undefined)
            continue;
        count += countLeaves(val);
    }
    return count;
}
/**
 * Borra todas las hojas bajo un prefijo de ruta.
 *
 * Usado por `revertPanel(pathPrefix)`: borra todos los genes que cuelgan de
 * un sub-árbol (p.ej. `'physics.envelopes'` revierte los 6 envelopes).
 *
 * @param obj Raíz del objeto.
 * @param prefix Prefijo de ruta (sin punto final).
 * @returns Nuevo objeto raíz sin el sub-árbol.
 */
export function deleteByPrefix(obj, prefix) {
    if (!obj)
        return obj ?? {};
    const segments = prefix.split('.');
    if (segments.length === 0)
        return obj;
    // Verifica que el sub-árbol existe.
    if (getByPath(obj, prefix) === undefined)
        return obj;
    // Misma mecánica que deleteByPath pero sin borrar la hoja final: borra
    // el sub-árbol entero.
    const root = { ...obj };
    let cursor = root;
    for (let i = 0; i < segments.length - 1; i++) {
        const key = segments[i];
        const child = cursor[key];
        if (child === null || typeof child !== 'object' || Array.isArray(child)) {
            return root;
        }
        const next = { ...child };
        cursor[key] = next;
        cursor = next;
    }
    delete cursor[segments[segments.length - 1]];
    // Poda niveles vacíos.
    const chain = [root];
    let cur = root;
    for (let i = 0; i < segments.length - 1; i++) {
        const child = cur[segments[i]];
        if (child === null || typeof child !== 'object')
            break;
        chain.push(child);
        cur = child;
    }
    for (let i = chain.length - 1; i >= 1; i--) {
        if (Object.keys(chain[i]).length === 0) {
            delete chain[i - 1][segments[i - 1]];
        }
        else {
            break;
        }
    }
    return root;
}
/**
 * Itera todas las rutas hoja de un objeto anidado, invocando `visitor` por cada
 * una. Usado por el resolver para validar/clamp cada gen del documento.
 *
 * @param obj Objeto a iterar.
 * @param prefix Prefijo de ruta para las hojas (p.ej. `'physics'`).
 * @param visitor Recibe `(ruta, valor)`. Si devuelve `false`, se reemplaza
 *                el valor por `undefined` (poda) — usado por el resolver para
 *                descartar genes sellados.
 * @returns Nuevo objeto con las sustituciones aplicadas (o el original si
 *          ningún visitor devolvió `false`).
 */
export function forEachLeaf(obj, prefix, visitor) {
    walk(obj, prefix, visitor);
}
function walk(obj, prefix, visitor) {
    if (obj === null || obj === undefined)
        return;
    if (typeof obj !== 'object') {
        visitor(prefix, obj);
        return;
    }
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            const path = prefix ? `${prefix}.${i}` : String(i);
            const val = obj[i];
            if (val === undefined)
                continue;
            if (typeof val === 'object' && val !== null) {
                walk(val, path, visitor);
            }
            else {
                visitor(path, val);
            }
        }
        return;
    }
    for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (val === undefined)
            continue;
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof val === 'object' && val !== null) {
            walk(val, path, visitor);
        }
        else {
            visitor(path, val);
        }
    }
}
