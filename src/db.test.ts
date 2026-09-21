import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// 把 Electron 的「用户数据目录」指向一个临时文件夹，测试里造的数据绝不会碰到你的真账本。
// vi.hoisted 会在所有 import 之前执行，所以下面的 mock 才能放心引用 TEST_DB_DIR。
const { TEST_DB_DIR } = vi.hoisted(() => ({
  TEST_DB_DIR: `${process.env.TEMP ?? '.'}/mwg-test-${process.pid}-${Date.now()}`,
}));

vi.mock('electron', () => ({ app: { getPath: () => TEST_DB_DIR } }));

import {
  addExpense,
  closeDatabase,
  countCategories,
  countExpensesInMonth,
  deleteExpense,
  getCategoryTree,
  getMonthlyStats,
  initDatabase,
  isSubCategory,
  listExpenses,
  updateExpense,
} from './db';

/** 一级大类节点（分类管理功能上线后，多了一个 isPreset 标记：是不是预置分类） */
interface TopCategory {
  id: number;
  name: string;
  isPreset: boolean;
  children: Array<{ id: number; name: string; isPreset: boolean }>;
}

beforeAll(() => {
  fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  initDatabase();
});

afterAll(() => {
  // 必须先关数据库再删文件夹：Windows 下数据库文件还被占用时删不掉，会报 EPERM 错误
  closeDatabase();
  fs.rmSync(TEST_DB_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

/** 按名字从分类树里找出一级大类；找不到就直接报错，让测试立刻失败 */
function findTop(topName: string): TopCategory {
  const top = getCategoryTree().find((g) => g.name === topName);
  if (!top) throw new Error(`top category not found: ${topName}`);
  return top;
}

describe('category seed', () => {
  it('seeds 9 top categories and 41 sub categories', () => {
    const tree = getCategoryTree();
    expect(tree).toHaveLength(9);
    expect(tree.reduce((n, g) => n + g.children.length, 0)).toBe(41);
    // 全新数据库里只有预置分类，共 9 + 41 = 50。
    // 注意：分类管理功能允许用户自建分类，如果有测试建了新分类，这个数字会变大。
    expect(countCategories()).toBe(50);
  });

  it('builds the category tree in the designed order', () => {
    const tree = getCategoryTree();
    expect(tree.map((g) => g.name)).toEqual([
      '餐饮饮食', '交通出行', '购物消费', '居住生活', '休闲娱乐',
      '医疗健康', '教育学习', '人情往来', '其他',
    ]);
    expect(findTop('餐饮饮食').children.map((c) => c.name)).toEqual([
      '早餐', '午餐', '晚餐', '外卖', '零食饮料', '买菜食材', '聚餐',
    ]);
  });

  it('marks every seeded category as preset', () => {
    const tree = getCategoryTree();
    expect(tree.every((g) => g.isPreset)).toBe(true);
    expect(tree.every((g) => g.children.every((c) => c.isPreset))).toBe(true);
  });
});

describe('isSubCategory', () => {
  it('is false for a top category and true for one of its children', () => {
    const dining = findTop('餐饮饮食');
    expect(isSubCategory(dining.id)).toBe(false);
    expect(isSubCategory(dining.children[0].id)).toBe(true);
  });

  it('is false for a nonexistent id', () => {
    expect(isSubCategory(999999)).toBe(false);
  });
});

describe('addExpense and listExpenses', () => {
  it('round-trips a new expense with its category names filled in', () => {
    const dining = findTop('餐饮饮食');
    const lunchId = dining.children.find((c) => c.name === '午餐')!.id;
    const id = addExpense({
      amountCents: 1550,
      categoryId: lunchId,
      note: 'test lunch',
      expenseDate: '2026-09-21',
    });
    const row = listExpenses().find((r) => r.id === id)!;
    expect(row.amountCents).toBe(1550);
    expect(row.categoryName).toBe('午餐');
    expect(row.topCategoryName).toBe('餐饮饮食');
    expect(row.note).toBe('test lunch');
    expect(row.expenseDate).toBe('2026-09-21');
  });

  it('orders rows by expense date desc, then id desc', () => {
    const subId = findTop('餐饮饮食').children[0].id;
    addExpense({ amountCents: 100, categoryId: subId, note: '', expenseDate: '2026-12-01' });
    addExpense({ amountCents: 200, categoryId: subId, note: '', expenseDate: '2026-12-10' });
    addExpense({ amountCents: 300, categoryId: subId, note: '', expenseDate: '2026-12-10' });
    const rows = listExpenses();
    // 同一天记的多笔，后记的（300）要排在前面
    expect(rows[0].amountCents).toBe(300);
    expect(rows[1].amountCents).toBe(200);
    expect(rows.some((r) => r.amountCents === 100)).toBe(true);
  });

  it('filters the list by top-level category', () => {
    const dining = findTop('餐饮饮食');
    const transport = findTop('交通出行');
    addExpense({ amountCents: 111, categoryId: dining.children[0].id, note: '', expenseDate: '2026-09-05' });
    addExpense({ amountCents: 222, categoryId: transport.children[0].id, note: '', expenseDate: '2026-09-05' });
    const rows = listExpenses({ topCategoryId: transport.id });
    expect(rows).toHaveLength(1);
    expect(rows[0].amountCents).toBe(222);
    expect(rows[0].topCategoryName).toBe('交通出行');
  });
});

describe('updateExpense and deleteExpense', () => {
  it('updates amount, note and date of an existing expense', () => {
    const subId = findTop('餐饮饮食').children[0].id;
    const id = addExpense({ amountCents: 500, categoryId: subId, note: 'before', expenseDate: '2026-09-21' });
    expect(updateExpense(id, { amountCents: 600, categoryId: subId, note: 'after', expenseDate: '2026-09-22' })).toBe(1);
    const row = listExpenses().find((r) => r.id === id)!;
    expect(row.amountCents).toBe(600);
    expect(row.note).toBe('after');
    expect(row.expenseDate).toBe('2026-09-22');
  });

  it('returns 0 when updating a missing expense', () => {
    expect(updateExpense(999999, { amountCents: 1, categoryId: 1, note: '', expenseDate: '2026-09-21' })).toBe(0);
  });

  it('deletes an existing expense', () => {
    const subId = findTop('餐饮饮食').children[0].id;
    const id = addExpense({ amountCents: 700, categoryId: subId, note: '', expenseDate: '2026-09-21' });
    expect(deleteExpense(id)).toBe(1);
    expect(listExpenses().some((r) => r.id === id)).toBe(false);
  });

  it('returns 0 when deleting a missing expense', () => {
    expect(deleteExpense(999999)).toBe(0);
  });
});

describe('monthly stats', () => {
  it('sums per top category for the requested month only', () => {
    const dining = findTop('餐饮饮食');
    const transport = findTop('交通出行');
    // 用别的测试都没碰过的月份，这样算出来的金额是确定的
    addExpense({ amountCents: 1000, categoryId: dining.children[0].id, note: '', expenseDate: '2027-01-01' });
    addExpense({ amountCents: 2000, categoryId: dining.children[0].id, note: '', expenseDate: '2027-01-10' });
    addExpense({ amountCents: 3000, categoryId: transport.children[0].id, note: '', expenseDate: '2027-01-10' });
    addExpense({ amountCents: 9000, categoryId: dining.children[0].id, note: '', expenseDate: '2027-02-28' });

    const january = getMonthlyStats('2027-01');
    expect(january).toHaveLength(9);
    expect(january.find((s) => s.topCategoryName === '餐饮饮食')!.totalCents).toBe(3000);
    expect(january.find((s) => s.topCategoryName === '交通出行')!.totalCents).toBe(3000);

    const february = getMonthlyStats('2027-02');
    expect(february.find((s) => s.topCategoryName === '餐饮饮食')!.totalCents).toBe(9000);

    // 没有账单的月份：9 个大类全部返回 0（而不是缺行或者报错）
    const empty = getMonthlyStats('2027-03');
    expect(empty.every((s) => s.totalCents === 0)).toBe(true);

    expect(countExpensesInMonth('2027-01')).toBe(3);
    expect(countExpensesInMonth('2027-02')).toBe(1);
  });
});
