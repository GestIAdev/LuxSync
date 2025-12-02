/**
 * 🎯 DIRECTIVA V166 - CONSOLE SILENCE WRAPPER
 * 🔇 Silenciar logs de startup sin tocar código existente
 *
 * By PunkGrok - September 28, 2025
 */


export class ConsoleSilencer {
  private originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  private silencedLogs: string[] = [];
  private isActive = false;

  /**
   * 🔇 Activar modo silencioso
   */
  public activate(): void {
    this.isActive = true;
    this.silencedLogs = [];

    // Interceptar console.log
    console.log = (...args: any[]) => {
      const message = args.join(" ");

      // Solo permitir logs CRÍTICOS
      if (this.isCriticalLog(message)) {
        this.originalConsole.log(...args);
      } else {
        this.silencedLogs.push(message);
      }
    };

    // Mantener error y warn normales
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
  }

  /**
   * 🔊 Desactivar modo silencioso
   */
  public deactivate(): void {
    this.isActive = false;

    // Restaurar console original
    console.log = this.originalConsole.log;
    console.info = this.originalConsole.info;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
  }

  /**
   * 🎯 Determinar si un log es crítico
   */
  private isCriticalLog(_message: string): boolean {
    const criticalKeywords = [
      "SELENE SONG CORE REACTOR STARTUP",
      "Components Ready:",
      "Self-awareness initialized:",
      "SELENE SONG CORE REACTOR ACTIVE",
      "Server: http://localhost",
      "Ready to obliterate competition",
      "CRITICAL:",
      "EMERGENCY",
      "FAILED",
      "💥",
      "ERROR",
      "startup summary",
      "Designed by PunkGrok",
      "Mission: LuxSync Light Show Empire",
    ];

    return criticalKeywords.some((_keyword) =>
      _message.toLowerCase().includes(_keyword.toLowerCase()),
    );
  }

  /**
   * 📊 Mostrar resumen de logs silenciados
   */
  public showSummary(): void {
    if (
      this.silencedLogs.length > 0 &&
      process.env.NODE_ENV === "development"
    ) {
      console.log(
        `\n🔇 V166: Silenciados ${this.silencedLogs.length} logs de startup`,
      );
      console.log(
        "📋 Ver logs detallados: process.env.APOLLO_VERBOSE_STARTUP=true",
      );
    }
  }

  /**
   * 📄 Obtener logs silenciados
   */
  public getSilencedLogs(): string[] {
    return [...this.silencedLogs];
  }
}

// Export singleton
export const consoleSilencer = new ConsoleSilencer();


