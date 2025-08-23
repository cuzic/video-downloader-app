import { db } from '../client';
import { statistics, statisticsDomains, statisticsMediaTypes } from '../schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import type { Statistics } from '../schema/statistics';

export class StatisticsRepository {
  private getDateKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  async recordDownload(
    domain: string,
    mediaType: 'hls' | 'dash' | 'file',
    bytes: number,
    timeMs: number,
    speedBps: number,
    isCompleted: boolean,
    isError: boolean,
    isCanceled: boolean
  ): Promise<void> {
    const date = this.getDateKey();
    
    // Update main statistics
    await db.insert(statistics)
      .values({
        date,
        totalDownloads: 1,
        completedCount: isCompleted ? 1 : 0,
        errorCount: isError ? 1 : 0,
        canceledCount: isCanceled ? 1 : 0,
        totalBytes: bytes,
        totalTimeMs: timeMs,
        averageSpeedBps: speedBps,
      })
      .onConflictDoUpdate({
        target: statistics.date,
        set: {
          totalDownloads: sql`${statistics.totalDownloads} + 1`,
          completedCount: isCompleted ? sql`${statistics.completedCount} + 1` as any : statistics.completedCount as any,
          errorCount: isError ? sql`${statistics.errorCount} + 1` as any : statistics.errorCount as any,
          canceledCount: isCanceled ? sql`${statistics.canceledCount} + 1` as any : statistics.canceledCount as any,
          totalBytes: sql`${statistics.totalBytes} + ${bytes}`,
          totalTimeMs: sql`${statistics.totalTimeMs} + ${timeMs}`,
          averageSpeedBps: sql`((${statistics.averageSpeedBps} * ${statistics.totalDownloads}) + ${speedBps}) / (${statistics.totalDownloads} + 1)`,
        },
      });
    
    // Update domain statistics
    await db.insert(statisticsDomains)
      .values({
        date,
        domain,
        count: 1,
        bytes,
      })
      .onConflictDoUpdate({
        target: [statisticsDomains.date, statisticsDomains.domain],
        set: {
          count: sql`${statisticsDomains.count} + 1`,
          bytes: sql`${statisticsDomains.bytes} + ${bytes}`,
        },
      });
    
    // Update media type statistics
    await db.insert(statisticsMediaTypes)
      .values({
        date,
        mediaType,
        count: 1,
        bytes,
      })
      .onConflictDoUpdate({
        target: [statisticsMediaTypes.date, statisticsMediaTypes.mediaType],
        set: {
          count: sql`${statisticsMediaTypes.count} + 1`,
          bytes: sql`${statisticsMediaTypes.bytes} + ${bytes}`,
        },
      });
  }

  async getDaily(date?: string): Promise<Statistics | null> {
    const targetDate = date || this.getDateKey();
    
    const result = await db.select()
      .from(statistics)
      .where(eq(statistics.date, targetDate))
      .limit(1);
    
    return result[0] ?? null;
  }

  async getRange(startDate: string, endDate: string): Promise<Statistics[]> {
    return db.select()
      .from(statistics)
      .where(and(
        gte(statistics.date, startDate),
        lte(statistics.date, endDate)
      ))
      .orderBy(statistics.date);
  }

  async getTopDomains(days = 30): Promise<Array<{ domain: string; count: number; bytes: number }>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoff = this.formatDate(cutoffDate);
    
    const results = await db.select({
      domain: statisticsDomains.domain,
      count: sql<number>`sum(${statisticsDomains.count})`.as('count'),
      bytes: sql<number>`sum(${statisticsDomains.bytes})`.as('bytes'),
    })
    .from(statisticsDomains)
    .where(gte(statisticsDomains.date, cutoff))
    .groupBy(statisticsDomains.domain)
    .orderBy(desc(sql`count`));
    
    return results;
  }

  async getMediaTypeStats(days = 30): Promise<Array<{ mediaType: string; count: number; bytes: number }>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoff = this.formatDate(cutoffDate);
    
    const results = await db.select({
      mediaType: statisticsMediaTypes.mediaType,
      count: sql<number>`sum(${statisticsMediaTypes.count})`.as('count'),
      bytes: sql<number>`sum(${statisticsMediaTypes.bytes})`.as('bytes'),
    })
    .from(statisticsMediaTypes)
    .where(gte(statisticsMediaTypes.date, cutoff))
    .groupBy(statisticsMediaTypes.mediaType)
    .orderBy(desc(sql`count`));
    
    return results;
  }

  async getSummary(days = 30): Promise<{
    totalDownloads: number;
    completedCount: number;
    errorCount: number;
    canceledCount: number;
    totalBytes: number;
    averageSpeedBps: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoff = this.formatDate(cutoffDate);
    
    const result = await db.select({
      totalDownloads: sql<number>`sum(${statistics.totalDownloads})`,
      completedCount: sql<number>`sum(${statistics.completedCount})`,
      errorCount: sql<number>`sum(${statistics.errorCount})`,
      canceledCount: sql<number>`sum(${statistics.canceledCount})`,
      totalBytes: sql<number>`sum(${statistics.totalBytes})`,
      averageSpeedBps: sql<number>`avg(${statistics.averageSpeedBps})`,
    })
    .from(statistics)
    .where(gte(statistics.date, cutoff));
    
    return result[0] ?? {
      totalDownloads: 0,
      completedCount: 0,
      errorCount: 0,
      canceledCount: 0,
      totalBytes: 0,
      averageSpeedBps: 0,
    };
  }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  async cleanup(daysOld = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoff = this.formatDate(cutoffDate);
    
    // Domain and media type stats will be cascade deleted
    const result = await db.delete(statistics)
      .where(lte(statistics.date, cutoff));
    
    return result.changes;
  }
}