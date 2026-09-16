import { useEffect, useState } from 'react';
import { Button, Card, DatePicker, Form, Input, InputNumber, message } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { CategoryNode } from '../shared/api';
import CategoryPicker from '../components/CategoryPicker';

export default function AddExpensePage() {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [topId, setTopId] = useState<number | undefined>(undefined);
  const [subId, setSubId] = useState<number | undefined>(undefined);
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.api.getCategoryTree().then(setCategories).catch((err: Error) => {
      message.error(`加载分类失败：${err.message}`);
    });
  }, []);

  const canSave = amount !== null && amount > 0 && subId !== undefined;

  const handleSave = async () => {
    if (!canSave || subId === undefined || amount === null) return;
    setSaving(true);
    try {
      await window.api.addExpense({
        amountCents: Math.round(amount * 100),
        categoryId: subId,
        note: note.trim(),
        expenseDate: date.format('YYYY-MM-DD'),
      });
      message.success(`已保存 ¥${amount.toFixed(2)}`);
      // 清空表单，方便连续记下一笔
      setAmount(null);
      setTopId(undefined);
      setSubId(undefined);
      setNote('');
      setDate(dayjs());
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="记一笔" style={{ maxWidth: 560 }}>
      <Form layout="vertical">
        <Form.Item label="金额（元）" required>
          <InputNumber
            style={{ width: '100%' }}
            min={0.01}
            max={9999999.99}
            precision={2}
            placeholder="例如：25.50"
            value={amount}
            onChange={(v) => setAmount(v)}
            onPressEnter={handleSave}
          />
        </Form.Item>
        <Form.Item label="分类" required>
          <CategoryPicker
            categories={categories}
            topId={topId}
            subId={subId}
            onChange={(t, s) => {
              setTopId(t);
              setSubId(s);
            }}
          />
        </Form.Item>
        <Form.Item label="日期">
          <DatePicker
            style={{ width: '100%' }}
            value={date}
            onChange={(d) => d && setDate(d)}
            allowClear={false}
          />
        </Form.Item>
        <Form.Item label="备注（可选）">
          <Input
            placeholder="例如：和同事吃午饭"
            maxLength={100}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onPressEnter={handleSave}
          />
        </Form.Item>
        <Button type="primary" block size="large" disabled={!canSave} loading={saving} onClick={handleSave}>
          保存
        </Button>
      </Form>
    </Card>
  );
}
