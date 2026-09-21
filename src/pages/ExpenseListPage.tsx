import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Empty, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { CategoryNode, ExpenseRow } from '../shared/api';
import EditExpenseModal from '../components/EditExpenseModal';

/**
 * 账单列表页。
 * 按日期倒序展示所有账单，可以按一级分类筛选，也能在这里修改或删除某一笔。
 */
export default function ExpenseListPage() {
  // 一级分类列表，只用来填充右上角的筛选下拉框
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  // 当前选中的一级分类 id。undefined 表示「全部分类」
  const [topFilter, setTopFilter] = useState<number | undefined>(undefined);
  // 从数据库查回来的账单，已经按日期倒序排好
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  // 不为空时，编辑弹窗打开，里面装着正在编辑的那一行
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

  // 进页面时只加载一次分类（分类不常改动，不必每次筛选都重新查）
  useEffect(() => {
    window.api.getCategoryTree().then(setCategories).catch((err: Error) => {
      message.error(`加载分类失败：${err.message}`);
    });
  }, []);

  // 按当前筛选条件重新查账单。
  // 包在 useCallback 里是为了让下面的 useEffect 只在 topFilter 真的变化时才重新请求，
  // 而不是组件每次重画都请求一次（那样会没完没了地查数据库）。
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setExpenses(await window.api.listExpenses(topFilter ? { topCategoryId: topFilter } : {}));
    } catch (err) {
      message.error(`加载账单失败：${(err as Error).message}`);
    } finally {
      // 不管成功还是失败都要关掉转圈，否则出错后界面会一直转下去
      setLoading(false);
    }
  }, [topFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // 删除一笔账单。点「删除」时 Popconfirm 已经弹框确认过了，这里直接执行。
  const handleDelete = async (row: ExpenseRow) => {
    try {
      await window.api.deleteExpense(row.id);
      message.success(`已删除 ¥${(row.amountCents / 100).toFixed(2)}`);
      // 删完必须重新查一次，否则表格里还留着刚删掉的那一行
      load();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  // 表格的列定义。
  // 金额在数据库里存的是「分」（整数，避免小数误差），显示时要除以 100 换成「元」。
  const columns: ColumnsType<ExpenseRow> = [
    {
      title: '日期',
      dataIndex: 'expenseDate',
      width: 120,
    },
    {
      title: '分类',
      width: 200,
      // 二级分类名直接显示，后面跟一个蓝色小标签标出它属于哪个一级分类
      render: (_, row) => (
        <>
          {row.categoryName} <Tag color="blue">{row.topCategoryName}</Tag>
        </>
      ),
    },
    {
      title: '金额（元）',
      dataIndex: 'amountCents',
      align: 'right',
      width: 140,
      render: (cents: number) => `¥${(cents / 100).toFixed(2)}`,
    },
    {
      title: '备注',
      dataIndex: 'note',
      // 没写备注时显示一个灰色短横线，比留空好看，也让人知道是「没有」而不是「没加载出来」
      render: (note: string) =>
        note ? note : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: '操作',
      width: 140,
      align: 'center',
      render: (_, row) => (
        <Space>
          <Button type="link" size="small" onClick={() => setEditing(row)}>
            编辑
          </Button>
          <Popconfirm
            title={`确定删除这笔 ¥${(row.amountCents / 100).toFixed(2)} 吗？`}
            description="删除后无法恢复"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(row)}
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 当前筛选条件下所有账单的合计（注意：是全部结果，不只是屏幕上这一页的 20 条）。
  // 筛了「餐饮」就想知道餐饮总共花了多少，这个数比单页合计更有用，
  // 也和分页栏里「共 N 笔」的口径一致。
  const totalCents = expenses.reduce((sum, e) => sum + e.amountCents, 0);

  return (
    <>
      <Card
        title="账单"
        extra={
          <Select
            style={{ width: 160 }}
            placeholder="全部分类"
            allowClear
            value={topFilter}
            onChange={(v) => setTopFilter(v)}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        }
      >
        <Table<ExpenseRow>
          rowKey="id"
          size="middle"
          loading={loading}
          columns={columns}
          dataSource={expenses}
          locale={{
            emptyText: <Empty description="还没有账单，去「记一笔」添加第一笔吧" />,
          }}
          pagination={{ pageSize: 20, hideOnSinglePage: true, showTotal: (t) => `共 ${t} 笔` }}
          // 一条账单都没有时不显示合计，否则会出现一个孤零零的「合计 ¥0.00」
          footer={() =>
            expenses.length > 0 ? (
              <div style={{ textAlign: 'right' }}>
                合计：<b>¥{(totalCents / 100).toFixed(2)}</b>
              </div>
            ) : undefined
          }
        />
      </Card>
      <EditExpenseModal
        expense={editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
    </>
  );
}
