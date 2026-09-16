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
      sort_order INTEGER NOT NULL DEFAULT 0
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

  seedCategories();
}

/** 首次运行时写入两级分类数据 */
function seedCategories(): void {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM categories').get() as { c: number };
  if (c > 0) return;

  const insertTop = db.prepare(
    'INSERT INTO categories (name, parent_id, sort_order) VALUES (?, NULL, ?)',
  );
  const insertSub = db.prepare(
    'INSERT INTO categories (name, parent_id, sort_order) VALUES (?, ?, ?)',
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

/** 分类总数（用于验证数据库可用） */
export function countCategories(): number {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM categories').get() as { c: number };
  return c;
}

/** 两级分类树（界面下拉框用） */
export function getCategoryTree(): Array<{
  id: number;
  name: string;
  children: Array<{ id: number; name: string }>;
}> {
  const rows = db
    .prepare(
      `SELECT id, name, parent_id AS parentId, sort_order AS sortOrder
       FROM categories ORDER BY sort_order`,
    )
    .all() as Array<{ id: number; name: string; parentId: number | null; sortOrder: number }>;

  return rows
    .filter((r) => r.parentId === null)
    .map((top) => ({
      id: top.id,
      name: top.name,
      children: rows
        .filter((r) => r.parentId === top.id)
        .map((r) => ({ id: r.id, name: r.name })),
    }));
}

/** 判断一个分类 id 是否是二级小类 */
export function isSubCategory(id: number): boolean {
  const row = db.prepare('SELECT parent_id AS parentId FROM categories WHERE id = ?').get(id) as
    | { parentId: number | null }
    | undefined;
  return !!row && row.parentId !== null;
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
