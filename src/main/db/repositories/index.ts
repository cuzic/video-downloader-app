// Repository exports
export { TaskRepository, TaskCreateError, TaskUpdateError } from './task.repository';
export { SettingsRepository } from './settings.repository';
export { DetectionRepository } from './detection.repository';
export { HistoryRepository } from './history.repository';
export { SegmentRepository } from './segment.repository';
export { StatisticsRepository } from './statistics.repository';
export { AuditLogRepository } from './audit-log.repository';

// Repository factory for dependency injection
import { TaskRepository } from './task.repository';
import { SettingsRepository } from './settings.repository';
import { DetectionRepository } from './detection.repository';
import { HistoryRepository } from './history.repository';
import { SegmentRepository } from './segment.repository';
import { StatisticsRepository } from './statistics.repository';
import { AuditLogRepository } from './audit-log.repository';

export interface RepositoryConfig {
  defaultSaveDir?: string;
}

export class RepositoryFactory {
  private static instances: Map<string, any> = new Map();

  static createTaskRepository(config?: RepositoryConfig): TaskRepository {
    const key = 'task';
    if (!this.instances.has(key)) {
      this.instances.set(key, new TaskRepository(config?.defaultSaveDir));
    }
    return this.instances.get(key);
  }

  static createSettingsRepository(): SettingsRepository {
    const key = 'settings';
    if (!this.instances.has(key)) {
      this.instances.set(key, new SettingsRepository());
    }
    return this.instances.get(key);
  }

  static createDetectionRepository(): DetectionRepository {
    const key = 'detection';
    if (!this.instances.has(key)) {
      this.instances.set(key, new DetectionRepository());
    }
    return this.instances.get(key);
  }

  static createHistoryRepository(): HistoryRepository {
    const key = 'history';
    if (!this.instances.has(key)) {
      this.instances.set(key, new HistoryRepository());
    }
    return this.instances.get(key);
  }

  static createSegmentRepository(): SegmentRepository {
    const key = 'segment';
    if (!this.instances.has(key)) {
      this.instances.set(key, new SegmentRepository());
    }
    return this.instances.get(key);
  }

  static createStatisticsRepository(): StatisticsRepository {
    const key = 'statistics';
    if (!this.instances.has(key)) {
      this.instances.set(key, new StatisticsRepository());
    }
    return this.instances.get(key);
  }

  static createAuditLogRepository(): AuditLogRepository {
    const key = 'auditLog';
    if (!this.instances.has(key)) {
      this.instances.set(key, new AuditLogRepository());
    }
    return this.instances.get(key);
  }

  static clearInstances(): void {
    this.instances.clear();
  }
}

// Create default instances for backward compatibility
export const taskRepo = RepositoryFactory.createTaskRepository();
export const settingsRepo = RepositoryFactory.createSettingsRepository();
export const detectionRepo = RepositoryFactory.createDetectionRepository();
export const historyRepo = RepositoryFactory.createHistoryRepository();
export const segmentRepo = RepositoryFactory.createSegmentRepository();
export const statisticsRepo = RepositoryFactory.createStatisticsRepository();
export const auditLogRepo = RepositoryFactory.createAuditLogRepository();
