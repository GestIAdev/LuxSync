/**
 * 🎸 VOICE LEADING
 * Algoritmos para conducción de voces suave entre acordes
 */
/**
 * Algoritmo de conducción de voces
 */
export class VoiceLeading {
    /**
     * Minimizar movimiento de voces entre dos acordes
     * @param fromChord Acorde origen
     * @param toChord Acorde destino
     * @param strategy Estrategia de conducción
     * @returns Nuevo acorde con voces reordenadas
     */
    static minimizeVoiceMovement(fromChord, toChord, strategy = 'smooth') {
        if (fromChord.length === 0 || toChord.length === 0) {
            return toChord;
        }
        const fromPitches = fromChord.map(note => note.pitch % 12).sort((a, b) => a - b);
        const toPitches = toChord.map(note => note.pitch % 12).sort((a, b) => a - b);
        switch (strategy) {
            case 'smooth':
                return this.applySmoothVoiceLeading(fromChord, toChord);
            case 'contrary':
                return this.applyContraryVoiceLeading(fromChord, toChord);
            case 'parallel':
                return this.applyParallelVoiceLeading(fromChord, toChord);
            case 'oblique':
                return this.applyObliqueVoiceLeading(fromChord, toChord);
            case 'free':
            default:
                return toChord;
        }
    }
    /**
     * Conducción suave: minimizar movimiento total
     */
    static applySmoothVoiceLeading(fromChord, toChord) {
        const result = [];
        const usedIndices = new Set();
        // Para cada nota del acorde origen, encontrar la nota más cercana en el destino
        for (const fromNote of fromChord) {
            let minDistance = Infinity;
            let bestIndex = -1;
            for (let i = 0; i < toChord.length; i++) {
                if (usedIndices.has(i))
                    continue;
                const distance = Math.abs(fromNote.pitch - toChord[i].pitch);
                if (distance < minDistance) {
                    minDistance = distance;
                    bestIndex = i;
                }
            }
            if (bestIndex !== -1) {
                usedIndices.add(bestIndex);
                result.push({ ...toChord[bestIndex] });
            }
        }
        // Agregar notas restantes del destino que no se asignaron
        for (let i = 0; i < toChord.length; i++) {
            if (!usedIndices.has(i)) {
                result.push({ ...toChord[i] });
            }
        }
        return result;
    }
    /**
     * Conducción contraria: movimiento opuesto
     */
    static applyContraryVoiceLeading(fromChord, toChord) {
        // Invertir el orden de las notas para movimiento contrario
        const sortedFrom = [...fromChord].sort((a, b) => a.pitch - b.pitch);
        const sortedTo = [...toChord].sort((a, b) => b.pitch - a.pitch); // Orden inverso
        return sortedTo.map((note, index) => ({
            ...note,
            // Mantener timing del original pero con nueva pitch
            pitch: sortedTo[index]?.pitch ?? note.pitch
        }));
    }
    /**
     * Conducción paralela: mantener intervalos
     */
    static applyParallelVoiceLeading(fromChord, toChord) {
        if (fromChord.length !== toChord.length) {
            return toChord; // No se puede mantener paralelismo con diferentes números de voces
        }
        const sortedFrom = [...fromChord].sort((a, b) => a.pitch - b.pitch);
        const sortedTo = [...toChord].sort((a, b) => a.pitch - b.pitch);
        // Calcular el intervalo promedio
        const avgInterval = sortedFrom.reduce((sum, note, index) => {
            if (index === 0)
                return sum;
            return sum + (note.pitch - sortedFrom[index - 1].pitch);
        }, 0) / Math.max(1, sortedFrom.length - 1);
        // Aplicar el mismo intervalo al acorde destino
        return sortedTo.map((note, index) => ({
            ...note,
            pitch: sortedTo[0].pitch + (index * avgInterval)
        }));
    }
    /**
     * Conducción oblicua: algunas voces se mueven, otras permanecen
     */
    static applyObliqueVoiceLeading(fromChord, toChord) {
        const result = [];
        const minLength = Math.min(fromChord.length, toChord.length);
        // Mantener las primeras voces, mover las últimas
        for (let i = 0; i < minLength; i++) {
            if (i < minLength / 2) {
                // Mantener pitch similar (voz oblicua)
                result.push({ ...fromChord[i], ...toChord[i] });
            }
            else {
                // Mover a nueva pitch
                result.push({ ...toChord[i] });
            }
        }
        // Agregar voces adicionales
        for (let i = minLength; i < toChord.length; i++) {
            result.push({ ...toChord[i] });
        }
        return result;
    }
    /**
     * Calcular el costo total de movimiento entre acordes
     * @param fromChord Acorde origen
     * @param toChord Acorde destino
     * @returns Costo total (menor = mejor conducción)
     */
    static calculateMovementCost(fromChord, toChord) {
        let totalCost = 0;
        for (const fromNote of fromChord) {
            let minDistance = Infinity;
            for (const toNote of toChord) {
                const distance = Math.abs(fromNote.pitch - toNote.pitch);
                minDistance = Math.min(minDistance, distance);
            }
            totalCost += minDistance;
        }
        return totalCost;
    }
    /**
     * Optimizar secuencia de acordes usando conducción de voces
     * @param chords Secuencia de acordes
     * @param strategy Estrategia a aplicar
     * @returns Secuencia optimizada
     */
    static optimizeChordSequence(chords, strategy = 'smooth') {
        if (chords.length <= 1)
            return chords;
        const optimized = [chords[0]]; // Primer acorde sin cambios
        for (let i = 1; i < chords.length; i++) {
            const optimizedChord = this.minimizeVoiceMovement(optimized[i - 1], chords[i], strategy);
            optimized.push(optimizedChord);
        }
        return optimized;
    }
}
//# sourceMappingURL=VoiceLeading.js.map