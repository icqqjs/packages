import type { DatabaseSync } from "node:sqlite";
import { ALTERATIONS, MIGRATIONS } from "./schema.js";

export function migrate(db: DatabaseSync): void {
  db.exec(MIGRATIONS.join(";\n"));

  // 幂等增量列迁移：node:sqlite 没有 IF NOT EXISTS 的 ADD COLUMN，
  // 重复执行会抛 "duplicate column name"，直接吞掉即可。
  for (const sql of ALTERATIONS) {
    try {
      db.exec(sql);
    } catch (err) {
      if (!/duplicate column name/i.test(String(err))) throw err;
    }
  }

  const row = db
    .prepare("SELECT MAX(version) as v FROM schema_migrations")
    .get() as { v: number | null };
  const current = row?.v ?? 0;
  if (current < 1) {
    db.prepare(
      "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
    ).run(1, new Date().toISOString());
  }
}
