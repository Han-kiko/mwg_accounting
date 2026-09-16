/** 主进程与界面之间传递的数据结构定义 */

export interface AppInfo {
  /** 应用版本号 */
  appVersion: string;
  /** 数据库文件完整路径（备份时可复制这个文件） */
  dbPath: string;
  /** 分类总数 */
  categoryCount: number;
}

/** 两级分类树节点（一级分类及其下属小类） */
export interface CategoryNode {
  id: number;
  name: string;
  children: Array<{ id: number; name: string }>;
}

/** 一笔账单的完整信息（已关联分类名称） */
export interface ExpenseRow {
  id: number;
  /** 金额，单位：分 */
  amountCents: number;
  /** 二级分类 id */
  categoryId: number;
  /** 二级分类名 */
  categoryName: string;
  /** 一级分类 id */
  topCategoryId: number;
  /** 一级分类名 */
  topCategoryName: string;
  note: string;
  /** 消费日期 YYYY-MM-DD */
  expenseDate: string;
}

/** 新增一笔账单的输入 */
export interface ExpenseInput {
  amountCents: number;
  categoryId: number;
  note: string;
  expenseDate: string;
}

/** 账单列表的筛选条件 */
export interface ExpenseFilter {
  /** 按一级分类筛选；不传则查全部 */
  topCategoryId?: number;
}

/** 某月的汇总统计结果 */
export interface MonthlyStats {
  /** 月份 YYYY-MM */
  month: string;
  /** 当月总支出（分） */
  totalCents: number;
  /** 当月账单笔数 */
  count: number;
  /** 各一级分类的支出（降序，含未消费的分类） */
  rows: Array<{
    topCategoryId: number;
    topCategoryName: string;
    totalCents: number;
  }>;
}
