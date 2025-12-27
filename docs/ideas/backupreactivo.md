// -----------------------------------------------------------------------
      // ??? WAVE 91: DYNAMIC NOISE GATE - Blackout real en cortes dram�ticos
      // -----------------------------------------------------------------------
      // PROBLEMA: En cumbia/reggaeton, los silencios dram�ticos (breaks) manten�an
      // luz tenue (15-20%), destruyendo el impacto visual del corte.
      // 
      // SOLUCI�N: Gate agresivo + expansi�n exponencial
      // - <15% energ�a ? 0% luz (BLACKOUT TOTAL)
      // - >15% energ�a ? Re-mapeo 0.15-1.0 a 0.0-1.0 + pow(2) para punch
      // 
      // Resultado: "Mentirosa" de Reik ahora tiene blacks REALES en los cortes.
      // -----------------------------------------------------------------------
      
      let processedIntensity: number;
      
      if (rawIntensity < 0.15) {
        // GATE: Silencio dram�tico ? Oscuridad total
        processedIntensity = 0;
      } else {
        // EXPANSI�N: Re-mapear 0.15-1.0 ? 0.0-1.0
        const normalized = (rawIntensity - 0.15) / 0.85;
        
        // PUNCH: Elevar al cuadrado (golpes fuertes brillan M�S)
        // 0.5 ? 0.25, 1.0 ? 1.0
        processedIntensity = Math.pow(normalized, 2);
      }
      
      // ??? WAVE 83: Asignar colores PUROS del Worker (sin multiplicar por intensity)
      // La intensity se guarda por separado para uso del dimmer
      // ?? WAVE 84.5: Usar palette.ambient en lugar de clonar secondary
      this.lastColors = {
        primary: { ...palette.primary },
        secondary: { ...palette.secondary },
        accent: { ...palette.accent },
        ambient: palette.ambient ? { ...palette.ambient } : { ...palette.secondary },  // ?? WAVE 84.5: STEREO REAL
        intensity: processedIntensity,  // ??? WAVE 91: Usar intensity procesada con noise gate
        saturation: this.globalSaturation
      }
      
      // -----------------------------------------------------------------------
      // ?? WAVE 127: TECHNO PRISM INTEGRATION (SSOT)
      // ?? WAVE 128: ACID INJECTION & STROBE TAMING
      // -----------------------------------------------------------------------
      // Referencia: TECHNO-COLOR-PIPELINE-AUDIT.md (Opci�n A)
      // La l�gica del "Cold Prism" ahora vive AQU�, en la Fuente �nica de Verdad.
      // WAVE 128: Liberamos el Verde �cido (80�-120�) y calmamos el strobe.
      // -----------------------------------------------------------------------
      
      const activeVibe = this.lastTrinityData?.activeVibe ?? 
                         this.lastTrinityData?.debugInfo?.activeVibe ?? 
                         'idle'
      
      const isTechnoVibe = activeVibe.toLowerCase().includes('techno')
      
      if (isTechnoVibe) {
        // 1. CAPTURAR LA INTENCI�N ORIGINAL DEL BRAIN
        // Convertir RGB ? HSL para obtener baseHue
        const primaryRgb = this.lastColors.primary
        const primaryHsl = rgbToHsl(primaryRgb)  // Funci�n importada de SeleneColorEngine
        let baseHue = primaryHsl.h
        
        // 2. ?? THE COLD DICTATOR (Filtro Anti-C�lido)
        // -------------------------------------------------------------------
        // ?? WAVE 128: ACID INJECTION - Bajamos l�mite de 90� a 75�
        // -------------------------------------------------------------------
        // Antes: (normalizedHue > 330 || normalizedHue < 90) ? Mataba el verde (80-90)
        // Ahora: Rango Prohibido Real: 330� (Rosa palo) hasta 75� (Amarillo Lim�n)
        // Esto PERMITE el paso del Verde �cido (80�-120�) pero BLOQUEA el amarillo
        // -------------------------------------------------------------------
        const normalizedHue = (baseHue + 360) % 360
        const isWarm = (normalizedHue > 330 || normalizedHue < 75)  // ?? WAVE 128: 90?75
        
        if (isWarm) {
          // Invertir fase hacia el espectro fr�o (+180�)
          baseHue = (normalizedHue + 180) % 360
        }
        
        // 3. ?? THE PRISM (Derivaci�n Geom�trica Estricta)
        // Generamos las 4 zonas matem�ticamente para garantizar separaci�n.
        
        // FRONT (Base)
        const primaryHue = baseHue
        
        // MOVER L (Melod�a - An�logo Fr�o +60�)
        let secondaryHue = (baseHue + 60) % 360
        
        // MOVER R (Atm�sfera - Triada +120�)
        let ambientHue = (baseHue + 120) % 360
        
        // BACK PARS (Acento - Complementario +180�)
        let accentHue = (baseHue + 180) % 360
        
        // 4. ??? SANITIZADOR CROM�TICO (Guardias de Seguridad)
        // -------------------------------------------------------------------
        // ?? WAVE 128: Refinamos el rango de 30-100 a 30-75
        // -------------------------------------------------------------------
        // Antes: (h > 30 && h < 100) ? Mataba el verde �cido secundario
        // Ahora: Solo matamos el amarillo puro/naranja (30� a 75�)
        // Verde �cido (75�-120�) ? PASA ?
        // Amarillo Pollo (30�-75�) ? MAGENTA ??
        // -------------------------------------------------------------------
        const sanitize = (h: number) => (h > 30 && h < 75) ? 320 : h  // ?? WAVE 128: 100?75
        
        secondaryHue = sanitize(secondaryHue)
        ambientHue = sanitize(ambientHue)
        accentHue = sanitize(accentHue)
        
        // 5. ? INDUSTRIAL STROBE LOGIC
        // -------------------------------------------------------------------
        // ?? WAVE 129: THE WHITE-HOT THRESHOLD (Calibraci�n basada en datos reales)
        // -------------------------------------------------------------------
        // Diagn�stico del log logacentodrops.md:
        //   - TreblePulse real en drops: 0.10-0.15 (NUNCA llega a 0.85)
        //   - El umbral anterior (0.85) era inalcanzable ? 0% strobes
        //
        // Nueva estrategia DUAL:
        //   1. Bajamos umbral de treble a 0.10 (dato real del log)
        //   2. A�adimos condici�n de Bass > 0.80 (contexto energ�tico)
        //
        // Resultado: Flash SOLO en drops calientes, NO en breaks suaves
        // -------------------------------------------------------------------
        const agc = this._agcData
        
        // -------------------------------------------------------------------
        // ? WAVE 132: THE DYNAMIC NOISE FLOOR
        // DIAGN�STICO: En Cyberpunk, RawTreble se mantiene en 0.85-1.00 CONSTANTEMENTE
        //   (ruido blanco, risers, sintetizadores agudos). El piso fijo de 0.15 no limpia
        //   ese ruido, resultando en Pulse = 0.85 todo el tiempo ? Strobe constante.
        // SOLUCI�N: Piso din�mico vinculado a la energ�a del bajo.
        //   F�rmula: DynamicFloor = 0.15 + (BassEnergy * 0.5)
        //   - En silencio (Bass 0): Floor = 0.15 ? Detecta cualquier chasquido
        //   - En drop brutal (Bass 1.0): Floor = 0.65 ? Solo picos REALES disparan
        // MATEM�TICA (datos del log):
        //   - Ruido: RawT:0.85, Bass:1.00 ? Floor:0.65 ? Pulse:0.20 < 0.25 ? COLOR ?
        //   - Golpe: RawT:1.00, Bass:1.00 ? Floor:0.65 ? Pulse:0.35 > 0.25 ? FLASH ?
        // -------------------------------------------------------------------
        
        const rawTreble = agc?.normalizedTreble ?? 0.0
        const bassEnergy = agc?.normalizedBass ?? 0
        
        // ??? PISO DIN�MICO (Factor 0.6)
        // Si Bass = 1.0 ? Floor = 0.75 ? Ignoramos 75% de la se�al aguda como "ruido"
        // Esto hace IMPOSIBLE disparar strobe en saturaci�n total
        // ?? WAVE 133: THE SATURATION BREAKER - Subido de 0.5 ? 0.6
        const DYNAMIC_FLOOR_FACTOR = 0.6
        const dynamicTrebleFloor = 0.15 + (bassEnergy * DYNAMIC_FLOOR_FACTOR)
        
        // Calculamos el pulso REAL por encima de ese piso elevado
        const treblePulse = Math.max(0, rawTreble - dynamicTrebleFloor)
        
        // ?? UMBRAL DE DISPARO
        // Ahora que el pulso est� limpio, usamos umbral est�ndar de 0.25
        const TRIGGER_THRESHOLD = 0.25
        
        // ?? GATILLO: Pulso limpio supera umbral + contexto de energ�a
        // Bajamos exigencia de Bass a 0.80 porque el DynamicFloor ya hace la limpieza
        const isSnareExplosion = (treblePulse > TRIGGER_THRESHOLD) && (bassEnergy > 0.80)
        
        // 6. ?? COMMIT AL SSOT (Sobrescribir lastColors con HSL?RGB)
        // Helper inline para HSL ? RGB
        const hslToRgb = (h: number, s: number, l: number) => {
          s /= 100
          l /= 100
          const c = (1 - Math.abs(2 * l - 1)) * s
          const x = c * (1 - Math.abs((h / 60) % 2 - 1))
          const m = l - c / 2
          let r = 0, g = 0, b = 0
          if (h < 60) { r = c; g = x; b = 0 }
          else if (h < 120) { r = x; g = c; b = 0 }
          else if (h < 180) { r = 0; g = c; b = x }
          else if (h < 240) { r = 0; g = x; b = c }
          else if (h < 300) { r = x; g = 0; b = c }
          else { r = c; g = 0; b = x }
          return {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255)
          }
        }
        
        this.lastColors.primary = hslToRgb(primaryHue, 100, 50)
        this.lastColors.secondary = hslToRgb(secondaryHue, 100, 50)
        this.lastColors.ambient = hslToRgb(ambientHue, 100, 50)
        