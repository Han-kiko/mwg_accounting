import { useEffect, useState } from 'react';
import { Card, Col, DatePicker, Empty, Progress, Row, Statistic, Table, message } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import type { MonthlyStats } from '../shared/api';

interface CategoryRow {
  key: number;
  name: string;
  totalCents: number;
}

export default function StatsPage() {
  const [month, setMonth] = useState<Dayjs>(dayjs());
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    window.api
      .getMonthlyStats(month.format('YYYY-MM'))
      .then(setStats)
      .catch((err: Error) => {
        message.error(`加载汇总失败：${(err as Error).message}`);
      })
      .finally(() => setLoading(false));
  }, [month]);

  // 只展示当月有消费的分类
  const rows: CategoryRow[] =
    stats?.rows
      .filter((r) => r.totalCents > 0)
      .map((r) => ({ key: r.topCategoryId, name: r.topCategoryName, totalCents: r.totalCents })) ??
    [];

  const columns: ColumnsType<CategoryRow> = [
    {
      title: '分类',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '金额（元）',
      dataIndex: 'totalCents',
      align: 'right',
      width: 150,
      render: (cents: number) => `¥${(cents / 100).toFixed(2)}`,
    },
    {
      title: '占比',
      width: 260,
      render: (_, row) => {
        const percent = stats && stats.totalCents > 0 ? (row.totalCents / stats.totalCents) * 100 : 0;
        return <Progress percent={percent} format={() => `${percent.toFixed(1)}%`} />;
      },
    },
  ];

  return (
    <Card
      title="月度汇总"
      extra={
        <DatePicker
          picker="month"
          allowClear={false}
          value={month}
          onChange={(d) => d && setMonth(d)}
        />
      }
    >
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="当月总支出" value={stats ? stats.totalCents / 100 : 0} precision={2} prefix="¥" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="账单笔数" value={stats?.count ?? 0} suffix="笔" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="日均支出"
              value={stats && stats.count > 0 ? stats.totalCents / 100 / dayjs(month).daysInMonth() : 0}
              precision={2}
              prefix="¥"
            />
          </Card>
        </Col>
      </Row>
      <Table<CategoryRow>
        rowKey="key"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        locale={{
          emptyText: <Empty description="这个月还没有账单，去「记一笔」添加吧" />,
        }}
      />
    </Card>
  );
}
