import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppInfo,
  CategoryNode,
  ExpenseFilter,
  ExpenseInput,
  ExpenseRow,
  MonthlyStats,
} from './shared/api';

// 界面可以安全调用的能力（通过 contextBridge 暴露，界面代码不直接接触 Node/Electron）
const api = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
  getCategoryTree: (): Promise<CategoryNode[]> => ipcRenderer.invoke('categories:getTree'),
  addTopCategory: (name: string): Promise<number> => ipcRenderer.invoke('categories:addTop', name),
  addSubCategory: (parentId: number, name: string): Promise<number> =>
    ipcRenderer.invoke('categories:addSub', parentId, name),
  renameCategory: (id: number, name: string): Promise<boolean> =>
    ipcRenderer.invoke('categories:rename', id, name),
  deleteCategory: (id: number, targetCategoryId?: number): Promise<boolean> =>
    ipcRenderer.invoke('categories:delete', id, targetCategoryId),
  countCategoryExpenses: (id: number): Promise<number> =>
    ipcRenderer.invoke('categories:expenseCount', id),
  addExpense: (input: ExpenseInput): Promise<number> => ipcRenderer.invoke('expense:add', input),
  updateExpense: (id: number, input: ExpenseInput): Promise<boolean> =>
    ipcRenderer.invoke('expense:update', id, input),
  deleteExpense: (id: number): Promise<boolean> => ipcRenderer.invoke('expense:delete', id),
  listExpenses: (filter?: ExpenseFilter): Promise<ExpenseRow[]> =>
    ipcRenderer.invoke('expense:list', filter),
  getMonthlyStats: (month: string): Promise<MonthlyStats> =>
    ipcRenderer.invoke('expense:monthlyStats', month),
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
