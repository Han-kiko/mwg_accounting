import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';

// 两级分类初始数据（一级大类 → 二级小类），与 claude.md 第 5 章一致
const CATEGORY_SEED: Array<{ name: string; subs: string[] }> = [
  { name: '餐饮饮食', subs: ['早餐', '午餐', '晚餐', '外卖', '零食饮料', '买菜食材', '聚餐'] },
  { name: '交通出行', subs: ['公交地铁', '打车', '火车高铁', '飞机', '加油充电', '停车费', '共享单车'] },
  { name: '购物消费', subs: ['服饰鞋包', '数码电器', '日用百货', '美妆个护', '书籍文具'] },
  { name: '居住生活', subs: ['房租', '水电燃气', '物业费', '话费网费', '家居维修'] },
  { name: '休闲娱乐', subs: ['电影演出', '游戏', '视频音乐会员', '旅游出行', '运动健身', '宠物'] },
  { name: '医疗健康', subs: ['看病买药', '体检', '保健养生'] },
  { name: '教育学习', subs: ['学费培训', '图书课程', '考试报名'] },
  { name: '人情往来', subs: ['红包礼金', '请客送礼', '孝敬父母'] },
  { name: '其他', subs: ['其他', '未分类'] },
];

let db: Database.Database;

/** 数据库文件位置（用户数据目录下，可复制备份） */
export function getDbPath(): string {
  return path.join(app.getPath('userData'), 'mwg-accounting.db');
}

/** 打开数据库、建表、首次运行写入分类数据。必须在 app ready 之后调用。 */
export function initDatabase(): void {
  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER REFERENCES categories(id),
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_preset INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount_cents INTEGER NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      note TEXT NOT NULL DEFAULT '',
      expense_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 老数据库升级：补上 is_preset 列（老库里只有预置分类，全部标记为预置）
  const cols = db.pragma('table_info(categories)') as Array<{ name: string }>;
  if (!cols.some((col) => col.name === 'is_preset')) {
    db.exec(`
      ALTER TABLE categories ADD COLUMN is_preset INTEGER NOT NULL DEFAULT 0;
      UPDATE categories SET is_preset = 1;
    `);
  }

  seedCategories();
}

/** 首次运行时写入两级分类数据 */
function seedCategories(): void {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM categories').get() as { c: number };
  if (c > 0) return;

  const insertTop = db.prepare(
    'INSERT INTO categories (name, parent_id, sort_order, is_preset) VALUES (?, NULL, ?, 1)',
  );
  const insertSub = db.prepare(
    'INSERT INTO categories (name, parent_id, sort_order, is_preset) VALUES (?, ?, ?, 1)',
  );

  const seed = db.transaction(() => {
    CATEGORY_SEED.forEach((group, topIndex) => {
      const topId = insertTop.run(group.name, topIndex).lastInsertRowid as number;
      group.subs.forEach((subName, subIndex) => {
        insertSub.run(subName, topId, subIndex);
      });
    });
  });
  seed();
}

/** 关闭数据库连接（测试收尾时用：Windows 下不关闭会锁住数据库文件，临时目录就删不掉） */
export function closeDatabase(): void {
  db.close();
}

/** 分类总数（用于验证数据库可用） */
export function countCategories(): number {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM categories').get() as { c: number };
  return c;
}

/** 两级分类树（界面下拉框用） */
export function getCategoryTree(): Array<{
  id: number;
  name: string;
  isPreset: boolean;
  children: Array<{ id: number; name: string; isPreset: boolean }>;
}> {
  const rows = db
    .prepare(
      `SELECT id, name, parent_id AS parentId, sort_order AS sortOrder, is_preset AS isPreset
       FROM categories ORDER BY sort_order`,
    )
    .all() as Array<{
    id: number;
    name: string;
    parentId: number | null;
    sortOrder: number;
    isPreset: number;
  }>;

  return rows
    .filter((r) => r.parentId === null)
    .map((top) => ({
      id: top.id,
      name: top.name,
      isPreset: top.isPreset === 1,
      children: rows
        .filter((r) => r.parentId === top.id)
        .map((r) => ({ id: r.id, name: r.name, isPreset: r.isPreset === 1 })),
    }));
}

/** 判断一个分类 id 是否是二级小类 */
export function isSubCategory(id: number): boolean {
  const row = db.prepare('SELECT parent_id AS parentId FROM categories WHERE id = ?').get(id) as
    | { parentId: number | null }
    | undefined;
  return !!row && row.parentId !== null;
}

/** 规范化分类名（去首尾空格、限 1~10 字） */
function normalizeCategoryName(rawName: unknown): string {
  if (typeof rawName !== 'string') {
    throw new Error('分类名无效');
  }
  const name = rawName.trim();
  if (name.length < 1 || name.length > 10) {
    throw new Error('分类名无效：请输入 1~10 个字符');
  }
  return name;
}

/** 同一层级下是否已有同名分类（parentId 为 null 表示一级大类层） */
function findSameName(parentId: number | null, name: string, excludeId?: number): boolean {
  const cond = parentId === null ? 'parent_id IS NULL' : 'parent_id = ?';
  const params: Array<string | number> = parentId === null ? [name] : [parentId, name];
  const sql = `SELECT 1 AS f FROM categories WHERE ${cond} AND name = ?${
    excludeId !== undefined ? ' AND id != ?' : ''
  }`;
  if (excludeId !== undefined) params.push(excludeId);
  return !!db.prepare(sql).get(...params);
}

/** 新增一级大类（用户自建，显示在最后）。返回新分类 id。 */
export function addTopCategory(rawName: string): number {
  const name = normalizeCategoryName(rawName);
  if (findSameName(null, name)) {
    throw new Error(`已存在同名分类「${name}」，请换一个名字`);
  }
  const { max } = db
    .prepare('SELECT MAX(sort_order) AS max FROM categories WHERE parent_id IS NULL')
    .get() as { max: number | null };
  const r = db
    .prepare(
      'INSERT INTO categories (name, parent_id, sort_order, is_preset) VALUES (?, NULL, ?, 0)',
    )
    .run(name, (max ?? -1) + 1);
  return r.lastInsertRowid as number;
}

/** 新增二级小类（可挂在预置或自建的一级大类下）。返回新分类 id。 */
export function addSubCategory(parentId: number, rawName: string): number {
  const parent = db
    .prepare('SELECT parent_id AS parentId FROM categories WHERE id = ?')
    .get(parentId) as { parentId: number | null } | undefined;
  if (!parent || parent.parentId !== null) {
    throw new Error('只能在一级大类下新增二级小类');
  }
  const name = normalizeCategoryName(rawName);
  if (findSameName(parentId, name)) {
    throw new Error(`已存在同名分类「${name}」，请换一个名字`);
  }
  const { max } = db
    .prepare('SELECT MAX(sort_order) AS max FROM categories WHERE parent_id = ?')
    .get(parentId) as { max: number | null };
  const r = db
    .prepare(
      'INSERT INTO categories (name, parent_id, sort_order, is_preset) VALUES (?, ?, ?, 0)',
    )
    .run(name, parentId, (max ?? -1) + 1);
  return r.lastInsertRowid as number;
}

/** 修改分类名称。预置分类禁止修改。返回受影响行数（0 表示分类不存在）。 */
export function renameCategory(id: number, rawName: string): number {
  const row = db
    .prepare('SELECT parent_id AS parentId, is_preset AS isPreset FROM categories WHERE id = ?')
    .get(id) as { parentId: number | null; isPreset: number } | undefined;
  if (!row) return 0;
  if (row.isPreset) {
    throw new Error('预置分类不能修改');
  }
  const name = normalizeCategoryName(rawName);
  if (findSameName(row.parentId, name, id)) {
    throw new Error(`已存在同名分类「${name}」，请换一个名字`);
  }
  return db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id).changes;
}

/** 某分类下关联的账单数（一级大类会连同其下小类一起统计） */
export function countCategoryExpenses(id: number): number {
  const row = db.prepare('SELECT parent_id AS parentId FROM categories WHERE id = ?').get(id) as
    | { parentId: number | null }
    | undefined;
  if (!row) return 0;
  const { c } =
    row.parentId === null
      ? (db
          .prepare(
            `SELECT COUNT(*) AS c FROM expenses e
             JOIN categories sub ON sub.id = e.category_id
             WHERE sub.parent_id = ?`,
          )
          .get(id) as { c: number })
      : (db.prepare('SELECT COUNT(*) AS c FROM expenses WHERE category_id = ?').get(id) as {
          c: number;
        });
  return c;
}

/**
 * 删除分类。预置分类禁止删除。
 * 若该分类下还有账单，必须提供 targetCategoryId，账单会先全部搬到目标二级小类再删除；
 * 删除一级大类时，其下的小类一并删除（小类的账单同样先搬走）。
 * 返回受影响行数（0 表示分类不存在）。
 */
export function deleteCategory(id: number, targetCategoryId?: number): number {
  const row = db
    .prepare('SELECT parent_id AS parentId, is_preset AS isPreset FROM categories WHERE id = ?')
    .get(id) as { parentId: number | null; isPreset: number } | undefined;
  if (!row) return 0;
  if (row.isPreset) {
    throw new Error('预置分类不能删除');
  }

  const del = db.transaction(() => {
    // 要删的分类集合：一级大类带上其下所有小类
    const ids: number[] = [id];
    if (row.parentId === null) {
      const subs = db
        .prepare('SELECT id FROM categories WHERE parent_id = ?')
        .all(id) as Array<{ id: number }>;
      ids.push(...subs.map((s) => s.id));
    }
    const placeholders = ids.map(() => '?').join(',');
    const { c } = db
      .prepare(`SELECT COUNT(*) AS c FROM expenses WHERE category_id IN (${placeholders})`)
      .get(...ids) as { c: number };
    if (c > 0) {
      if (!targetCategoryId || !isSubCategory(targetCategoryId) || ids.includes(targetCategoryId)) {
        throw new Error('该分类下还有账单：请先选择要归入的二级小类');
      }
      db.prepare(`UPDATE expenses SET category_id = ? WHERE category_id IN (${placeholders})`).run(
        targetCategoryId,
        ...ids,
      );
    }
    return db.prepare(`DELETE FROM categories WHERE id IN (${placeholders})`).run(...ids).changes;
  });
  return del();
}

/**
 * 新增一笔账单。金额以"分"为单位的整数存储（避免小数精度问题）。
 * 输入需在主进程校验通过后再调用。
 */
export function addExpense(input: {
  amountCents: number;
  categoryId: number;
  note: string;
  expenseDate: string;
}): number {
  const result = db
    .prepare(
      `INSERT INTO expenses (amount_cents, category_id, note, expense_date)
       VALUES (?, ?, ?, ?)`,
    )
    .run(input.amountCents, input.categoryId, input.note, input.expenseDate);
  return result.lastInsertRowid as number;
}

/** 修改一笔账单。返回受影响行数（0 表示账单不存在）。 */
export function updateExpense(
  id: number,
  input: { amountCents: number; categoryId: number; note: string; expenseDate: string },
): number {
  const result = db
    .prepare(
      `UPDATE expenses SET amount_cents = ?, category_id = ?, note = ?, expense_date = ? WHERE id = ?`,
    )
    .run(input.amountCents, input.categoryId, input.note, input.expenseDate, id);
  return result.changes;
}

/** 删除一笔账单。返回受影响行数（0 表示账单不存在）。 */
export function deleteExpense(id: number): number {
  const result = db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  return result.changes;
}

/** 某月（YYYY-MM）按一级分类汇总的支出统计 */
export function getMonthlyStats(month: string): {
  topCategoryId: number;
  topCategoryName: string;
  totalCents: number;
}[] {
  return db
    .prepare(
      `SELECT
         top.id AS topCategoryId,
         top.name AS topCategoryName,
         COALESCE(SUM(e.amount_cents), 0) AS totalCents
       FROM categories top
       LEFT JOIN categories sub ON sub.parent_id = top.id
       LEFT JOIN expenses e
         ON e.category_id = sub.id AND substr(e.expense_date, 1, 7) = ?
       WHERE top.parent_id IS NULL
       GROUP BY top.id
       ORDER BY totalCents DESC, top.sort_order`,
    )
    .all(month) as Array<{
    topCategoryId: number;
    topCategoryName: string;
    totalCents: number;
  }>;
}

/** 某月（YYYY-MM）账单笔数 */
export function countExpensesInMonth(month: string): number {
  const { c } = db
    .prepare(`SELECT COUNT(*) AS c FROM expenses WHERE substr(expense_date, 1, 7) = ?`)
    .get(month) as { c: number };
  return c;
}

/** 查询账单列表（按消费日期倒序，最新在前），可按一级分类筛选 */
export function listExpenses(filter?: { topCategoryId?: number }): Array<{
  id: number;
  amountCents: number;
  categoryId: number;
  categoryName: string;
  topCategoryId: number;
  topCategoryName: string;
  note: string;
  expenseDate: string;
}> {
  const rows = db
    .prepare(
      `SELECT
         e.id,
         e.amount_cents AS amountCents,
         e.note,
         e.expense_date AS expenseDate,
         sub.id AS categoryId,
         sub.name AS categoryName,
         top.id AS topCategoryId,
         top.name AS topCategoryName
       FROM expenses e
       JOIN categories sub ON sub.id = e.category_id
       JOIN categories top ON top.id = sub.parent_id
       ${filter?.topCategoryId ? 'WHERE top.id = ?' : ''}
       ORDER BY e.expense_date DESC, e.id DESC`,
    )
    .all(...(filter?.topCategoryId ? [filter.topCategoryId] : []));
  return rows as Array<{
    id: number;
    amountCents: number;
    categoryId: number;
    categoryName: string;
    topCategoryId: number;
    topCategoryName: string;
    note: string;
    expenseDate: string;
  }>;
}
