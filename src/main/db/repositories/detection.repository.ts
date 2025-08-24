import { db } from '../client';
import { detections } from '../schema';
import { eq, desc, and, sql, gte, lte } from 'drizzle-orm';
import type { Detection, NewDetection } from '../schema/detections';

export class DetectionRepository {
  async create(detection: NewDetection): Promise<string> {
    await db
      .insert(detections)
      .values(detection)
      .onConflictDoUpdate({
        target: detections.id,
        set: {
          lastSeenAt: Math.floor(Date.now() / 1000),
        },
      });

    return detection.id;
  }

  async upsert(detection: NewDetection): Promise<void> {
    await db
      .insert(detections)
      .values(detection)
      .onConflictDoUpdate({
        target: detections.id,
        set: {
          ...detection,
          lastSeenAt: Math.floor(Date.now() / 1000),
        },
      });
  }

  async getById(id: string): Promise<Detection | null> {
    const result = await db.select().from(detections).where(eq(detections.id, id)).limit(1);

    return result[0] ?? null;
  }

  async getByUrl(url: string): Promise<Detection | null> {
    const result = await db.select().from(detections).where(eq(detections.url, url)).limit(1);

    return result[0] ?? null;
  }

  async listRecent(limit = 50): Promise<Detection[]> {
    return db
      .select()
      .from(detections)
      .where(eq(detections.autoDelete, 0))
      .orderBy(desc(detections.detectedAt))
      .limit(limit);
  }

  async listByPageUrl(pageUrl: string): Promise<Detection[]> {
    return db
      .select()
      .from(detections)
      .where(and(eq(detections.pageUrl, pageUrl), eq(detections.autoDelete, 0)))
      .orderBy(desc(detections.detectedAt));
  }

  async listSkipped(skipReason?: Detection['skipReason']): Promise<Detection[]> {
    const conditions = [sql`${detections.skipReason} IS NOT NULL`];

    if (skipReason) {
      conditions.push(eq(detections.skipReason, skipReason));
    }

    return db
      .select()
      .from(detections)
      .where(and(...conditions))
      .orderBy(desc(detections.detectedAt));
  }

  async incrementDownloadCount(id: string): Promise<void> {
    await db
      .update(detections)
      .set({
        downloadCount: sql`${detections.downloadCount} + 1`,
      })
      .where(eq(detections.id, id));
  }

  async markForDeletion(id: string): Promise<void> {
    await db
      .update(detections)
      .set({
        autoDelete: 1,
      })
      .where(eq(detections.id, id));
  }

  async cleanupOld(daysOld = 7): Promise<number> {
    const cutoff = Math.floor(Date.now() / 1000) - daysOld * 24 * 60 * 60;

    const result = await db
      .delete(detections)
      .where(and(eq(detections.autoDelete, 1), lte(detections.lastSeenAt, cutoff)));

    return result.changes;
  }

  async getStatsByDomain(days = 30): Promise<Array<{ domain: string; count: number }>> {
    const cutoff = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

    const results = await db
      .select({
        domain: sql<string>`substr(${detections.pageUrl}, 
        instr(${detections.pageUrl}, '://') + 3,
        case 
          when instr(substr(${detections.pageUrl}, instr(${detections.pageUrl}, '://') + 3), '/') > 0
          then instr(substr(${detections.pageUrl}, instr(${detections.pageUrl}, '://') + 3), '/') - 1
          else length(substr(${detections.pageUrl}, instr(${detections.pageUrl}, '://') + 3))
        end
      )`.as('domain'),
        count: sql<number>`count(*)`.as('count'),
      })
      .from(detections)
      .where(gte(detections.detectedAt, cutoff))
      .groupBy(sql`domain`)
      .orderBy(desc(sql`count`));

    return results;
  }
}
