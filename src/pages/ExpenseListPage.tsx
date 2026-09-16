import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Empty, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { CategoryNode, ExpenseRow } from '../shared/api';
import EditExpenseModal from '../components/EditExpenseModal';

export default function ExpenseListPage() {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [topFilter, setTopFilter] = useState<number | undefined>(undefined);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

  useEffect(() => {
    window.api.getCategoryTree().then(setCategories).catch((err: Error) => {
      message.error(`加载分类失败：${err.message}`);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setExpenses(await window.api.listExpenses(topFilter ? { topCategoryId: topFilter } : {}));
    } catch (err) {
      message.error(`加载账单失败：${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [topFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (row: ExpenseRow) => {
    try {
      await window.api.deleteExpense(row.id);
      message.success(`已删除 ¥${(row.amountCents / 100).toFixed(2)}`);
      load();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const columns: ColumnsType<ExpenseRow> = [
    {
      title: '日期',
      dataIndex: 'expenseDate',
      width: 120,
    },
    {
      title: '分类',
      width: 200,
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
          footer={() =>
            expenses.length > 0 ? (
              <div style={{ textAlign: 'right' }}>
                本页合计：<b>¥{(totalCents / 100).toFixed(2)}</b>
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
