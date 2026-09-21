import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import {
  addExpense,
  addSubCategory,
  addTopCategory,
  countCategories,
  countCategoryExpenses,
  countExpensesInMonth,
  deleteCategory,
  deleteExpense,
  getCategoryTree,
  getDbPath,
  getMonthlyStats,
  initDatabase,
  isSubCategory,
  listExpenses,
  renameCategory,
  updateExpense,
} from './db';
import type { AppInfo, ExpenseFilter, ExpenseInput } from './shared/api';

// Windows 安装/卸载本程序时会带一个特殊参数启动它，检测到就立刻退出（安装程序专用，正常使用不受影响）
if (started) {
  app.quit();
}

// 给界面提供应用信息（验证数据库是否正常工作的通道）
ipcMain.handle('app:info', (): AppInfo => {
  return {
    appVersion: app.getVersion(),
    dbPath: getDbPath(),
    categoryCount: countCategories(),
  };
});

// 分类树（记一笔、筛选共用）
ipcMain.handle('categories:getTree', () => getCategoryTree());

// ---- 分类管理（预置分类受保护；自建分类可新增、改名、删除） ----

// 新增一级大类
ipcMain.handle('categories:addTop', (_event, name: string) => addTopCategory(name));

// 新增二级小类
ipcMain.handle('categories:addSub', (_event, parentId: number, name: string) => {
  if (!Number.isInteger(parentId) || parentId <= 0) {
    throw new Error('一级分类无效');
  }
  return addSubCategory(parentId, name);
});

// 修改分类名称
ipcMain.handle('categories:rename', (_event, id: number, name: string) => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('分类编号无效');
  }
  if (renameCategory(id, name) === 0) {
    throw new Error('分类不存在或已被删除');
  }
  return true;
});

// 删除分类（若下面有账单，需带 targetCategoryId 把账单先搬走）
ipcMain.handle('categories:delete', (_event, id: number, targetCategoryId?: number) => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('分类编号无效');
  }
  if (deleteCategory(id, targetCategoryId) === 0) {
    throw new Error('分类不存在或已被删除');
  }
  return true;
});

// 某分类下的账单数（删除前判断是否需要搬移账单）
ipcMain.handle('categories:expenseCount', (_event, id: number) => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('分类编号无效');
  }
  return countCategoryExpenses(id);
});

/** 校验一笔账单的输入，不合法时抛出带中文提示的错误 */
function validateExpenseInput(input: ExpenseInput): void {
  if (!input || typeof input !== 'object') {
    throw new Error('数据无效');
  }
  if (
    !Number.isInteger(input.amountCents) ||
    input.amountCents <= 0 ||
    input.amountCents > 999999999
  ) {
    throw new Error('金额无效：请输入 0.01 ~ 9,999,999.99 之间的金额');
  }
  if (!isSubCategory(input.categoryId)) {
    throw new Error('分类无效：请选择二级小类');
  }
  if (typeof input.note !== 'string' || input.note.length > 100) {
    throw new Error('备注无效：最多 100 个字');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expenseDate)) {
    throw new Error('日期无效');
  }
}

// 新增一笔账单（先校验，再入库）
ipcMain.handle('expense:add', (_event, input: ExpenseInput) => {
  validateExpenseInput(input);
  return addExpense(input);
});

// 修改一笔账单
ipcMain.handle('expense:update', (_event, id: number, input: ExpenseInput) => {
  validateExpenseInput(input);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('账单编号无效');
  }
  if (updateExpense(id, input) === 0) {
    throw new Error('账单不存在或已被删除');
  }
  return true;
});

// 删除一笔账单
ipcMain.handle('expense:delete', (_event, id: number) => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('账单编号无效');
  }
  if (deleteExpense(id) === 0) {
    throw new Error('账单不存在或已被删除');
  }
  return true;
});

// 某月（YYYY-MM）的汇总统计
ipcMain.handle('expense:monthlyStats', (_event, month: string) => {
  if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('月份无效');
  }
  const rows = getMonthlyStats(month);
  return {
    month,
    totalCents: rows.reduce((sum, r) => sum + r.totalCents, 0),
    count: countExpensesInMonth(month),
    rows,
  };
});

// 账单列表（支持按一级分类筛选）
ipcMain.handle('expense:list', (_event, filter?: ExpenseFilter) =>
  listExpenses(filter?.topCategoryId ? { topCategoryId: filter.topCategoryId } : undefined),
);

const createWindow = () => {
  // 创建应用主窗口
  const mainWindow = new BrowserWindow({
    title: 'mwg记账',
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 诊断日志：排查窗口/进程意外退出的原因
  mainWindow.on('closed', () => console.log('[main] 窗口已关闭'));
  mainWindow.webContents.on('render-process-gone', (_e, details) =>
    console.log('[main] 渲染进程消失：', JSON.stringify(details)),
  );
  app.on('child-process-gone', (_e, details) =>
    console.log('[main] 子进程消失：', details.type, details.reason, details.exitCode),
  );

  // 开发模式：连 Vite 的本地开发服务器（改代码自动刷新页面）；打包后：直接读打进包里的页面文件。
  // 下面这两个大写变量是 Vite 插件在编译时自动塞进来的，这个文件里找不到它们的定义，不用担心。
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

// Electron 启动完毕后才建窗口——只有这时候窗口和数据库才能安全使用，数据库也在这里初始化
app.on('ready', () => {
  try {
    console.log('[main] ready 事件触发，开始初始化数据库…');
    initDatabase();
    console.log('[main] 数据库初始化完成');
    createWindow();
    console.log('[main] 窗口已创建');
  } catch (err) {
    console.error('[main] 启动失败：', err);
  }
});

// 所有窗口都关掉就退出程序；Mac 习惯不一样——关掉窗口不退出，要按 Cmd+Q 才算真的退出
app.on('window-all-closed', () => {
  console.log('[main] 所有窗口已关闭，准备退出');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // Mac 上点任务栏图标时，如果窗口都已经关了，就重新建一个
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
