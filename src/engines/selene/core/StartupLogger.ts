/**
 * 🎯 DIRECTIVA V165 - APOLLO STARTUP LOG MANAGER
 * 🔥 Clean, Professional, Informative Startup Logging
 *
 * By PunkGrok - September 28, 2025
 */


export class SeleneStartupLogger {
  private static instance: SeleneStartupLogger;
  private components: Map<string, ComponentStatus> = new Map();
  private startTime: Date = new Date();
  private isVerbose: boolean = process.env.NODE_ENV === "development";

  private constructor() {}

  public static getInstance(): SeleneStartupLogger {
    if (!SeleneStartupLogger.instance) {
      SeleneStartupLogger.instance = new SeleneStartupLogger();
    }
    return SeleneStartupLogger.instance;
  }

  /**
   * 🎯 Register component initialization
   */
  public registerComponent(
    name: string,
    status: "starting" | "ready" | "failed",
    details?: string,
  ): void {
    this.components.set(name, {
      name,
      status,
      details,
      timestamp: new Date(),
    });

    if (!this.isVerbose) {
      // Only show critical components in production
      if (this.isCriticalComponent(name)) {
        this.logComponent(name, status, details);
      }
    } else {
      this.logComponent(name, status, details);
    }
  }

  /**
   * 🔥 Show startup banner
   */
  public showStartupBanner(): void {
    console.log("\n🚀 SELENE SONG CORE REACTOR STARTUP");
    console.log("=".repeat(45));
    console.log("⚡ Designed by PunkGrok & RaulVisionario");
    console.log("🎯 Mission: Dental AI Empire Construction");
    console.log("=".repeat(45));
  }

  /**
   * ✅ Show completion summary
   */
  public showStartupSummary(port: number): void {
    const duration = Date.now() - this.startTime.getTime();
    const ready = Array.from(this.components.values()).filter(
      (_c) => _c.status === "ready",
    ).length;
    const failed = Array.from(this.components.values()).filter(
      (_c) => _c.status === "failed",
    ).length;
    const total = this.components.size;

    console.log("\n🎯 SELENE REACTOR STATUS:");
    console.log("=".repeat(45));
    console.log(`✅ Components Ready: ${ready}/${total}`);
    if (failed > 0) {
      console.log(`❌ Components Failed: ${failed}`);
    }
    console.log(`⏱️ Startup Time: ${Math.round(duration / 1000)}s`);
    console.log("=".repeat(45));

    console.log(`🌟 SELENE SONG CORE REACTOR ACTIVE`);
    console.log(`📡 Server: http://localhost:${port}`);
    console.log(`📊 Monitoring: http://localhost:${port}/nuclear/status`);
    console.log(`💀 Ready to obliterate competition!`);
    console.log("=".repeat(45));

    if (this.isVerbose) {
      this.showDetailedStatus();
    }
  }

  /**
   * 🔧 Show detailed component status (verbose mode)
   */
  private showDetailedStatus(): void {
    console.log("\n📋 DETAILED COMPONENT STATUS:");
    console.log("-".repeat(50));

    for (const [name, status] of this.components.entries()) {
      const icon =
        status.status === "ready"
          ? "✅"
          : status.status === "failed"
            ? "❌"
            : "🔄";
      const time = status.timestamp.toISOString().substring(11, 19);
      console.log(
        `${icon} ${name.padEnd(20)} | ${status.status.toUpperCase().padEnd(8)} | ${time}`,
      );
    }
    console.log("-".repeat(50));
  }

  /**
   * 🎯 Log individual component
   */
  private logComponent(
    name: string,
    status: "starting" | "ready" | "failed",
    details?: string,
  ): void {
    const icon = status === "ready" ? "✅" : status === "failed" ? "❌" : "🔄";
    const message =
      status === "ready"
        ? "READY"
        : status === "failed"
          ? "FAILED"
          : "STARTING";

    if (details) {
      console.log(`${icon} ${name}: ${message} - ${details}`);
    } else {
      console.log(`${icon} ${name}: ${message}`);
    }
  }

  /**
   * 🔍 Check if component is critical for summary
   */
  private isCriticalComponent(_name: string): boolean {
    const criticalComponents = [
      "Database",
      "Cache",
      "GraphQL",
      "SeleneHeal",
      "Veritas",
      "Consciousness",
    ];
    return criticalComponents.some((_critical) =>
      _name.toLowerCase().includes(_critical.toLowerCase()),
    );
  }

  /**
   * ⚠️ Show error summary
   */
  public showErrors(): void {
    const failures = Array.from(this.components.values()).filter(
      (_c) => _c.status === "failed",
    );

    if (failures.length > 0) {
      console.log("\n⚠️ COMPONENT FAILURES:");
      console.log("-".repeat(30));
      failures.forEach((failure) => {
        console.log(
          `❌ ${failure.name}: ${failure.details || "Unknown error"}`,
        );
      });
      console.log("-".repeat(30));
    }
  }
}

interface ComponentStatus {
  name: string;
  status: "starting" | "ready" | "failed";
  details?: string;
  timestamp: Date;
}

// Export singleton instance
export const startupLogger = SeleneStartupLogger.getInstance();


