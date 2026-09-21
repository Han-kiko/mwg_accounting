// 渲染进程的入口文件——Electron 把窗口打开之后，界面就是从这里开始跑的。
// 可以把它理解成「整个界面的第一行代码」。
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
// 引入 Ant Design 的中文语言包，否则分页器、日期选择框这些组件会显示英文
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import 'antd/dist/reset.css';
import './index.css';
import App from './App';

// 让日期库 dayjs 也说中文（比如显示「周一」而不是「Mon」）
dayjs.locale('zh-cn');

// 把 App 这个根组件挂到 index.html 里 id 为 root 的那个容器上。
// 末尾的感叹号是在告诉 TypeScript「这个元素一定找得到，不用再判空」。
createRoot(document.getElementById('root')!).render(
  // StrictMode 只在开发时多检查一遍副作用写法，打包后的正式版本不受影响
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
