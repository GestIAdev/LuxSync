# AUDITORÍA DE FLUJO DE AUDIO: EL CASO DEL INPUT GAIN PERDIDO

## 1. El Problema Detectado
- **Sincopación 0:** El sistema reportaba 0 sincopación consistentemente.
- **Zodiaco Estático:** Siempre Leo/Fuego (Warm/Bright).
- **Causa Sospechosa:** Señal de entrada demasiado débil para los analizadores.

## 2. Hallazgos Forenses
### A. El "Input Gain" Fantasma
- La configuración `inputGain` existía en `audioStore` y `SeleneLux`.
- **CRÍTICO:** `inputGain` NO existía en la interfaz `TrinityConfig` que usa el worker `senses.ts`.
- **CRÍTICO:** La función `processAudioBuffer` en `senses.ts` procesaba el buffer "crudo" (raw) sin aplicar ninguna ganancia.

### B. Efecto en los Analizadores
1.  **BeatDetector:** Tenía su propio AGC (Auto-Gain Control), por lo que podía detectar beats incluso con señal débil. Esto enmascaraba el problema.
2.  **SpectrumAnalyzer:** Recibía valores minúsculos (ej. 0.001).
3.  **RhythmDetector:** Recibía métricas derivadas de un espectro casi plano/nulo. Resultado: Sincopación 0.
4.  **HarmonyDetector (Zodiaco):**
    - Fórmula: `bass / (treble + 0.01)`
    - Con señal débil (0.001): `0.001 / 0.011 ≈ 0.09`
    - Resultado: `< 0.5` → **WARM (Fuego/Leo)**.
    - El término `+ 0.01` dominaba la ecuación, forzando siempre el mismo resultado.

## 3. La Solución Aplicada (Wave 14.9)
1.  **Protocolo Actualizado:** Se añadió `inputGain` a `TrinityConfig` en `WorkerProtocol.ts`.
2.  **Inyección de Ganancia:** Se modificó `processAudioBuffer` en `senses.ts` para multiplicar el buffer por `inputGain` **ANTES** de cualquier análisis.

```typescript
// senses.ts
function processAudioBuffer(buffer: Float32Array): ExtendedAudioAnalysis {
  // ...
  // 🎯 WAVE 14: Apply Input Gain (CRITICAL FIX)
  const gain = config.inputGain ?? 1.0;
  if (gain !== 1.0) {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] *= gain;
    }
  }
  // ...
}
```

## 4. Resultado Esperado
- **Sincopación:** Ahora debería variar entre 0 y 1 según la música, ya que el `RhythmDetector` recibirá señales con amplitud normalizada.
- **Zodiaco:** Debería desbloquearse de "Fuego" y responder a los cambios reales de graves/agudos.
- **Espectro:** Debería verse vivo y dinámico.

## 5. Próximos Pasos
- Verificar en tiempo real con el Dashboard.
- Ajustar el slider de Input Gain si la señal satura (clipping).
