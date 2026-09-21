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

type PageKey = 'home' | 'add' | 'list' | 'stats' | 'categories' | 'game' | 'settings';

const MENU_ITEMS: MenuProps['items'] = [
  { key: 'home', icon: <AppstoreOutlined />, label: '首页' },
  { key: 'add', icon: <EditOutlined />, label: '记一笔' },
  { key: 'list', icon: <UnorderedListOutlined />, label: '账单' },
  { key: 'stats', icon: <BarChartOutlined />, label: '月度汇总' },
  { key: 'categories', icon: <TagsOutlined />, label: '分类管理' },
  { key: 'game', icon: <PlayCircleOutlined />, label: '小游戏' },
  { key: 'settings', icon: <SettingOutlined />, label: '设置' },
];

const PLACEHOLDER = new Map<PageKey, string>([
  ['settings', '「设置」功能开发中'],
]);

export default function App() {
  const [page, setPage] = useState<PageKey>('home');
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

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
