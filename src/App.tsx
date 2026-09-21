import { useEffect, useState } from 'react';
import {
  AppstoreOutlined,
  BarChartOutlined,
  EditOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  TagsOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Card, Descriptions, Layout, Menu, Typography } from 'antd';
import type { MenuProps } from 'antd';
import type { AppInfo } from './shared/api';
import AddExpensePage from './pages/AddExpensePage';
import CategoryManagePage from './pages/CategoryManagePage';
import ExpenseListPage from './pages/ExpenseListPage';
import SnakeGamePage from './pages/SnakeGamePage';
import StatsPage from './pages/StatsPage';

const { Header, Sider, Content } = Layout;

// 左侧菜单里每一个可点的项，对应一个页面标识。
// 用这种「字符串联合类型」而不是随便写字符串，是为了让 TypeScript 帮忙检查——
// 打错字或者用了不存在的页面名，编辑器当场就会报错。
type PageKey = 'home' | 'add' | 'list' | 'stats' | 'categories' | 'game' | 'settings';

// 左侧导航菜单的内容：每一项是「标识 + 图标 + 显示的中文名」。
// 想加新页面，在这里加一行，再去下面渲染的地方加一个分支即可。
const MENU_ITEMS: MenuProps['items'] = [
  { key: 'home', icon: <AppstoreOutlined />, label: '首页' },
  { key: 'add', icon: <EditOutlined />, label: '记一笔' },
  { key: 'list', icon: <UnorderedListOutlined />, label: '账单' },
  { key: 'stats', icon: <BarChartOutlined />, label: '月度汇总' },
  { key: 'categories', icon: <TagsOutlined />, label: '分类管理' },
  { key: 'game', icon: <PlayCircleOutlined />, label: '小游戏' },
  { key: 'settings', icon: <SettingOutlined />, label: '设置' },
];

// 还没做的页面先放一句「开发中」占位，点进去不会白屏。
// 做完一个就从这里删掉，再去下面渲染的地方加一个真正的分支。
const PLACEHOLDER = new Map<PageKey, string>([
  ['settings', '「设置」功能开发中'],
]);

/**
 * 应用的外壳：左边是导航菜单，上面是标题栏，右边是各个页面。
 * 它自己不处理业务，只负责「点哪个菜单就显示哪个页面」。
 */
export default function App() {
  // 当前正在看哪个页面，默认是首页
  const [page, setPage] = useState<PageKey>('home');
  // 从主进程取回来的应用信息：版本号、分类数量、账本文件位置
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  // 数据库连不上时把错误信息记在这里，首页会红字提示
  const [dbError, setDbError] = useState<string | null>(null);

  // 应用启动时问一次主进程要信息。window.api 这个接口由 preload 脚本
  // 从主进程那边「搭桥」过来，界面代码不能直接碰数据库。
  useEffect(() => {
    window.api
      .getAppInfo()
      .then(setAppInfo)
      .catch((err: Error) => setDbError(err.message));
  }, []);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={200}>
        <div
          style={{
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          💰 mwg记账
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[page]}
          items={MENU_ITEMS}
          onClick={(e) => setPage(e.key as PageKey)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', paddingInline: 24 }}>
          <Typography.Title level={4} style={{ margin: 0, lineHeight: '64px' }}>
            mwg记账
          </Typography.Title>
        </Header>
        {/* 下面这一长串三元判断就是最简单的「路由」：按当前 page 决定渲染哪个页面组件。
            页面再多下去可以换成 react-router 之类的专门库，现在这样够用也好懂。 */}
        <Content style={{ padding: 24 }}>
          {page === 'home' ? (
            <Card title="欢迎使用 mwg记账">
              {dbError ? (
                <Typography.Text type="danger">
                  数据库连接失败：{dbError}
                </Typography.Text>
              ) : appInfo ? (
                <>
                  <Descriptions column={1}>
                    <Descriptions.Item label="应用版本">{appInfo.appVersion}</Descriptions.Item>
                    <Descriptions.Item label="数据库状态">
                      ✅ 已连接（分类 {appInfo.categoryCount} 个）
                    </Descriptions.Item>
                    <Descriptions.Item label="数据文件位置">
                      <Typography.Text copyable>{appInfo.dbPath}</Typography.Text>
                    </Descriptions.Item>
                  </Descriptions>
                  <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
                    提示：数据文件就是你的账本。把这个文件复制到 U 盘或网盘即可备份账单。
                  </Typography.Paragraph>
                </>
              ) : (
                <Typography.Text>正在连接数据库…</Typography.Text>
              )}
            </Card>
          ) : page === 'add' ? (
            <AddExpensePage />
          ) : page === 'list' ? (
            <ExpenseListPage />
          ) : page === 'stats' ? (
            <StatsPage />
          ) : page === 'categories' ? (
            <CategoryManagePage />
          ) : page === 'game' ? (
            <SnakeGamePage />
          ) : (
            <Card>
              <Typography.Title level={5} style={{ marginTop: 0 }}>
                {PLACEHOLDER.get(page)}
              </Typography.Title>
            </Card>
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
