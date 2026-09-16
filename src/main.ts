import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import {
  addExpense,
  countCategories,
  countExpensesInMonth,
  deleteExpense,
  getCategoryTree,
  getDbPath,
  getMonthlyStats,
  initDatabase,
  isSubCategory,
  listExpenses,
  updateExpense,
} from './db';
import type { AppInfo, ExpenseFilter, ExpenseInput } from './shared/api';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
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
  // Create the browser window.
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

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
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

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
