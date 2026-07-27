1. Superando el "Muro de Sonido" (Prydz Drops y Compresión Masiva)
En los drops de progressive house o trance épico, el nivel de energía global de la mezcla se dispara y se mantiene plano debido al limitador del máster. Los detectores basados en ratios de energía (ENERGY_RATIO_THRESHOLD) sufren porque el umbral de silencio ya no existe; todo suena fuerte.

Implementación de Espectro de Flujo (Spectral Flux) o Novedad de Fase: En lugar de mirar solo cuánta energía sube en una banda, mediremos el cambio en la tasa de cambio (derivada de la magnitud y fase entre frames consecutivos).

Por qué funciona en el muro de sonido: Incluso cuando un muro de sintetizadores y sub-graves comprime el RMS al 100%, el inicio de un golpe de bombo o un cambio de acordes introduce una discontinuidad de fase y un pico de alta frecuencia abrupto que el Spectral Flux detecta de inmediato, ignorando la saturación de fondo.

2. Resolución de Pop/Rock y Ghost Notes (Baterías Acústicas)
El pop/rock no es una onda cuadrada predecible; tiene dinámicas muy sutiles, notas fantasmas en la caja, y acentos de platillos que interfieren con el bombo.

Separación Multi-Banda con Envolventes Asimétricas (Attack/Release adaptativo): Aprovechando los filtros LR4 ya existentes, podemos aislar el canal sub-bass (<80Hz) y la zona de ataque de la caja (2kHz - 5kHz). Al aplicar un seguidor de envolvente con un ataque ultrarrápido (1-3ms) y un release moderado (40-80ms) en lugar de un buffer circular simple, evitamos que los rebotes del bombo o los ecos de la sala creen falsos positivos en los tempos de rock clásico o baladas.

Supresión de Fuga de Platillos: Filtrar armónicos altos en el canal de graves para evitar que un crash de batería dispare un falso beat en el canal de luces del escenario.

3. Cosecha de Ciclos de CPU: Liquidando la Deuda Técnica de GodEarFFT.ts
Para poder inyectar algoritmos avanzados de Spectral Flux o envolventes complejas en el Worker sin sobrepasar el presupuesto de 2ms, necesitamos liberar los ciclos de CPU que el re-audit confirmó siguen pendientes:

Tablas de Búsqueda (LUT) para Twiddle Factors: Pre-calcular los senos y cosenos en el constructor para evitar llamadas repetitivas a Math.cos/Math.sin en cada mariposa del Radix-2. Esto reducirá el coste computacional del FFT bruto en un 25-30%.

Eliminación definitiva del Math.sqrt por Bin: Sustituir el cálculo de magnitud en bucle caliente por el espectro de potencia (re² + im²) en la fase de análisis interno, reservando la raíz cuadrada estrictamente para el cálculo final de energía donde visualmente se requiera, eliminando 2049 llamadas innecesarias por frame.

4. Co-procesamiento Predictivo para Mapeo de Escenario (Aether/WAVE)
Fusión con el 1D Kalman y el Autocorrelacionador: Ya que IntervalBPMTracker cuenta con un filtro de Kalman y validación por autocorrelación, podemos alimentar de forma predictiva los motores de iluminación volumétrica (Moving Heads). Cuando un tema sufre un breakdown donde la percusión desaparece por completo (típico puente en canciones de pop o intros largas de Prydz), el sistema no debe congelarse ni volverse errático: el Kalman debe mantener la interpolación de fase ("freewheel") de forma totalmente transparente para que los haces de luz sigan latiendo al tempo interno hasta que entra el drop.