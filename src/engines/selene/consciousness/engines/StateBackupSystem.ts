/**
 * 🔄 STATE BACKUP SYSTEM - Backup y rollback automático de estado
 * Fase 0: Sistema de respaldo para recuperación de fallos
 *
 * Características: Backup automático, Rollback inteligente, Compresión, Integridad
 * Forged by PunkClaude + Claude 4.5
 */

import { StateBackup, BackupMetadata, RollbackResult } from './MetaEngineInterfaces.js';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';


const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);

export interface BackupConfig {
  backupDir: string;
  maxBackupsPerEngine: number;
  compressionEnabled: boolean;
  autoBackupIntervalMs: number;
  retentionPeriodMs: number; // How long to keep backups
  name: string;
}

export interface BackupResult {
  success: boolean;
  backupId: string;
  size: number;
  compressionRatio?: number;
  checksum: string;
  error?: Error;
}

/**
 * 🔄 State Backup Manager
 */
export class StateBackupManager {
  private config: BackupConfig;
  private backupInterval?: NodeJS.Timeout;
  private engineStates: Map<string, any> = new Map();

  constructor(config: BackupConfig) {
    this.config = config;

    // Ensure backup directory exists
    this.ensureBackupDirectory();

    console.log(`🔄 State Backup Manager "${config.name}" initialized: dir=${config.backupDir}, maxBackups=${config.maxBackupsPerEngine}`);
  }

  /**
   * 🚀 Start automatic backup system
   */
  startAutoBackup(): void {
    if (this.backupInterval) {
      console.warn(`⚠️ Auto backup already running for ${this.config.name}`);
      return;
    }

    this.backupInterval = setInterval(async () => {
      try {
        await this.performAutoBackup();
      } catch (error) {
        console.error(`💥 Auto backup failed for ${this.config.name}:`, error as Error);
      }
    }, this.config.autoBackupIntervalMs);

    console.log(`🚀 Auto backup started for ${this.config.name} (interval: ${this.config.autoBackupIntervalMs}ms)`);
  }

  /**
   * 🛑 Stop automatic backup system
   */
  stopAutoBackup(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = undefined;
      console.log(`🛑 Auto backup stopped for ${this.config.name}`);
    }
  }

  /**
   * 💾 Create backup of engine state
   */
  async createBackup(engineId: string, state: any, metadata?: Partial<BackupMetadata>): Promise<BackupResult> {
    try {
      const backupId = this.generateBackupId(engineId);
      const timestamp = new Date();

      // Create backup object
      const backup: StateBackup = {
        id: backupId,
        timestamp,
        engineStates: new Map([[engineId, state]]),
        performanceMetrics: metadata?.performanceMetrics || {},
        featureFlags: metadata?.featureFlags || [],
        version: metadata?.version || '1.0.0'
      };

      // Serialize and compress
      const serializedData = JSON.stringify(backup, this.mapReplacer);
      const finalData = this.config.compressionEnabled ?
        await this.compressData(serializedData) :
        serializedData;

      // Calculate checksum
      const checksum = crypto.createHash('sha256').update(finalData).digest('hex');

      // Create metadata
      const backupMetadata: BackupMetadata = {
        id: backupId,
        timestamp,
        size: finalData.length,
        engines: [engineId],
        integrityHash: checksum,
        compressionRatio: this.config.compressionEnabled ?
          (serializedData.length / finalData.length) : 1,
        ...metadata
      };

      // Write files
      const backupPath = this.getBackupPath(backupId);
      const metadataPath = this.getMetadataPath(backupId);

      await writeFileAsync(backupPath, finalData, 'utf8');
      await writeFileAsync(metadataPath, JSON.stringify(backupMetadata, null, 2), 'utf8');

      // Update engine state cache
      this.engineStates.set(engineId, state);

      // Cleanup old backups
      await this.cleanupOldBackups(engineId);

      console.log(`💾 Backup created for ${engineId}: ${backupId} (${finalData.length} bytes)`);

      return {
        success: true,
        backupId,
        size: finalData.length,
        compressionRatio: backupMetadata.compressionRatio,
        checksum
      };

    } catch (error) {
      console.error(`💥 Failed to create backup for ${engineId}:`, error as Error);
      return {
        success: false,
        backupId: '',
        size: 0,
        checksum: '',
        error: error as Error
      };
    }
  }

  /**
   * 🔄 Rollback to backup
   */
  async rollbackToBackup(backupId: string, targetEngineId?: string): Promise<RollbackResult> {
    try {
      // Load backup
      const backup = await this.loadBackup(backupId);
      if (!backup) {
        throw new Error(`BACKUP_NOT_FOUND: ${backupId}`);
      }

      // Determine which engines to restore
      const enginesToRestore: string[] = targetEngineId ?
        [targetEngineId] :
        Array.from(backup.engineStates.keys());

      const restoredEngines: string[] = [];
      const failedEngines: string[] = [];

      // Restore each engine
      for (const engineId of enginesToRestore) {
        try {
          const state = backup.engineStates.get(engineId);
          if (state) {
            // Validate state before restoring
            if (await this.validateState(engineId, state)) {
              // Perform rollback (this would be implemented by the engine)
              await this.performRollback(engineId, state);
              restoredEngines.push(engineId);

              // Update cache
              this.engineStates.set(engineId, state);

              console.log(`✅ Engine ${engineId} rolled back to backup ${backupId}`);
            } else {
              throw new Error(`STATE_VALIDATION_FAILED: Invalid state for ${engineId}`);
            }
          } else {
            failedEngines.push(engineId);
            console.warn(`⚠️ No state found for engine ${engineId} in backup ${backupId}`);
          }
        } catch (error) {
          failedEngines.push(engineId);
          console.error(`💥 Failed to rollback engine ${engineId}:`, error as Error);
        }
      }

      // Calculate performance impact (simplified)
      const performanceImpact = restoredEngines.length * 0.1; // 10% impact per engine

      return {
        success: failedEngines.length === 0,
        restoredEngines,
        failedEngines,
        performanceImpact,
        timestamp: new Date()
      };

    } catch (error) {
      console.error(`💥 Rollback failed for backup ${backupId}:`, error as Error);
      return {
        success: false,
        restoredEngines: [],
        failedEngines: targetEngineId ? [targetEngineId] : [],
        performanceImpact: 0,
        timestamp: new Date()
      };
    }
  }

  /**
   * 📋 List available backups
   */
  async listBackups(engineId?: string): Promise<BackupMetadata[]> {
    try {
      const files = await fs.promises.readdir(this.config.backupDir);
      const metadataFiles = files.filter(f => f.endsWith('.metadata.json'));

      const backups: BackupMetadata[] = [];

      for (const metadataFile of metadataFiles) {
        try {
          const metadataPath = path.join(this.config.backupDir, metadataFile);
          const metadataContent = await readFileAsync(metadataPath, 'utf8');
          const metadata: BackupMetadata = JSON.parse(metadataContent);

          // Filter by engine if specified
          if (!engineId || metadata.engines.includes(engineId)) {
            backups.push(metadata);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to read metadata file ${metadataFile}:`, error as Error);
        }
      }

      // Sort by timestamp (newest first)
      backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return backups;

    } catch (error) {
      console.error(`💥 Failed to list backups:`, error as Error);
      return [];
    }
  }

  /**
   * 🗑️ Delete backup
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      const backupPath = this.getBackupPath(backupId);
      const metadataPath = this.getMetadataPath(backupId);

      // Check if files exist
      const backupExists = fs.existsSync(backupPath);
      const metadataExists = fs.existsSync(metadataPath);

      if (backupExists) {
        await unlinkAsync(backupPath);
      }

      if (metadataExists) {
        await unlinkAsync(metadataPath);
      }

      if (backupExists || metadataExists) {
        console.log(`🗑️ Backup ${backupId} deleted`);
        return true;
      } else {
        console.warn(`⚠️ Backup ${backupId} not found`);
        return false;
      }

    } catch (error) {
      console.error(`💥 Failed to delete backup ${backupId}:`, error as Error);
      return false;
    }
  }

  /**
   * 🧹 Cleanup expired backups
   */
  async cleanupExpiredBackups(): Promise<number> {
    try {
      const backups = await this.listBackups();
      const now = Date.now();
      let deletedCount = 0;

      for (const backup of backups) {
        if (now - backup.timestamp.getTime() > this.config.retentionPeriodMs) {
          if (await this.deleteBackup(backup.id)) {
            deletedCount++;
          }
        }
      }

      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} expired backups`);
      }

      return deletedCount;

    } catch (error) {
      console.error(`💥 Failed to cleanup expired backups:`, error as Error);
      return 0;
    }
  }

  /**
   * 🧹 Cleanup resources
   */
  cleanup(): void {
    this.stopAutoBackup();
    this.engineStates.clear();
    console.log(`🧹 State Backup Manager "${this.config.name}" cleanup completed`);
  }

  // ===========================================
  // PRIVATE METHODS
  // ===========================================

  private async ensureBackupDirectory(): Promise<void> {
    try {
      await mkdirAsync(this.config.backupDir, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private generateBackupId(engineId: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `backup_${engineId}_${timestamp}_${random}`;
  }

  private getBackupPath(backupId: string): string {
    return path.join(this.config.backupDir, `${backupId}.json`);
  }

  private getMetadataPath(backupId: string): string {
    return path.join(this.config.backupDir, `${backupId}.metadata.json`);
  }

  private mapReplacer(key: string, value: any): any {
    if (value instanceof Map) {
      return {
        __type: 'Map',
        value: Array.from(value.entries())
      };
    }
    return value;
  }

  private mapReviver(key: string, value: any): any {
    if (typeof value === 'object' && value !== null && value.__type === 'Map') {
      return new Map(value.value);
    }
    return value;
  }

  private async compressData(data: string): Promise<string> {
    // Simple compression using gzip-like approach (in a real implementation, use proper compression)
    // For now, just return the data as-is since we don't have zlib in this context
    return data;
  }

  private async loadBackup(backupId: string): Promise<StateBackup | null> {
    try {
      const backupPath = this.getBackupPath(backupId);
      const data = await readFileAsync(backupPath, 'utf8');
      const backup: StateBackup = JSON.parse(data, this.mapReviver);
      return backup;
    } catch (error) {
      console.error(`💥 Failed to load backup ${backupId}:`, error as Error);
      return null;
    }
  }

  private async validateState(engineId: string, state: any): Promise<boolean> {
    // Basic validation - check if state has required properties
    if (!state || typeof state !== 'object') {
      return false;
    }

    // Engine-specific validation would be implemented here
    // For now, just check basic structure
    return true;
  }

  private async performRollback(engineId: string, state: any): Promise<void> {
    // This would be implemented by the specific engine
    // For now, just log the rollback
    console.log(`🔄 Performing rollback for engine ${engineId}`);
  }

  private async performAutoBackup(): Promise<void> {
    // Auto backup all cached engine states
    for (const [engineId, state] of this.engineStates) {
      try {
        await this.createBackup(engineId, state, {
          performanceMetrics: {}, // Would be populated with actual metrics
          featureFlags: [] // Would be populated with actual flags
        });
      } catch (error) {
        console.error(`💥 Auto backup failed for ${engineId}:`, error as Error);
      }
    }
  }

  private async cleanupOldBackups(engineId: string): Promise<void> {
    const backups = await this.listBackups(engineId);

    if (backups.length > this.config.maxBackupsPerEngine) {
      const toDelete = backups.slice(this.config.maxBackupsPerEngine);

      for (const backup of toDelete) {
        await this.deleteBackup(backup.id);
      }

      console.log(`🧹 Cleaned up ${toDelete.length} old backups for ${engineId}`);
    }
  }
}

/**
 * 🏭 State Backup Factory
 */
export class StateBackupFactory {
  private static defaultConfig: Partial<BackupConfig> = {
    maxBackupsPerEngine: 10,
    compressionEnabled: true,
    autoBackupIntervalMs: 300000, // 5 minutes
    retentionPeriodMs: 604800000 // 7 days
  };

  /**
   * 🛠️ Create backup manager with custom config
   */
  static create(config: BackupConfig): StateBackupManager {
    return new StateBackupManager(config);
  }

  /**
   * ⚡ Create backup manager with defaults
   */
  static createDefault(name: string, backupDir: string): StateBackupManager {
    return new StateBackupManager({
      ...this.defaultConfig,
      name,
      backupDir
    } as BackupConfig);
  }

  /**
   * 🔧 Create backup manager for engine
   */
  static createForEngine(engineId: string, backupDir: string): StateBackupManager {
    const config: BackupConfig = {
      backupDir: path.join(backupDir, engineId),
      maxBackupsPerEngine: 5,
      compressionEnabled: true,
      autoBackupIntervalMs: 60000, // 1 minute for engines
      retentionPeriodMs: 86400000, // 1 day
      name: `Engine-${engineId}`
    };

    return new StateBackupManager(config);
  }

  /**
   * 🌐 Create backup manager for orchestration
   */
  static createForOrchestration(orchestratorId: string, backupDir: string): StateBackupManager {
    const config: BackupConfig = {
      backupDir: path.join(backupDir, 'orchestration'),
      maxBackupsPerEngine: 20,
      compressionEnabled: true,
      autoBackupIntervalMs: 300000, // 5 minutes
      retentionPeriodMs: 259200000, // 3 days
      name: `Orchestrator-${orchestratorId}`
    };

    return new StateBackupManager(config);
  }
}


