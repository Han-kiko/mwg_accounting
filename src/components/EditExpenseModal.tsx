import { useEffect, useState } from 'react';
import { DatePicker, Form, Input, InputNumber, Modal, message } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { CategoryNode, ExpenseRow } from '../shared/api';
import CategoryPicker from './CategoryPicker';

interface Props {
  /** 要编辑的账单；null 表示弹窗关闭 */
  expense: ExpenseRow | null;
  categories: CategoryNode[];
  onClose: () => void;
  /** 保存成功后回调（用于刷新列表） */
  onSaved: () => void;
}

/** 弹窗内编辑账单 */
export default function EditExpenseModal({ expense, categories, onClose, onSaved }: Props) {
  const [topId, setTopId] = useState<number | undefined>(undefined);
  const [subId, setSubId] = useState<number | undefined>(undefined);
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // 每次打开弹窗时，把账单的当前值填进表单
  useEffect(() => {
    if (expense) {
      setAmount(expense.amountCents / 100);
      setTopId(expense.topCategoryId);
      setSubId(expense.categoryId);
      setDate(dayjs(expense.expenseDate));
      setNote(expense.note);
    }
  }, [expense]);

  const canSave = amount !== null && amount > 0 && subId !== undefined;

  const handleSave = async () => {
    if (!expense || !canSave || subId === undefined || amount === null) return;
    setSaving(true);
    try {
      await window.api.updateExpense(expense.id, {
        amountCents: Math.round(amount * 100),
        categoryId: subId,
        note: note.trim(),
        expenseDate: date.format('YYYY-MM-DD'),
      });
      message.success('修改已保存');
      onSaved();
      onClose();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`编辑账单 #${expense?.id ?? ''}`}
      open={expense !== null}
      onCancel={onClose}
      onOk={handleSave}
      okText="保存"
      cancelText="取消"
      okButtonProps={{ disabled: !canSave, loading: saving }}
      destroyOnClose
    >
      <Form layout="vertical">
        <Form.Item label="金额（元）" required>
          <InputNumber
            style={{ width: '100%' }}
            min={0.01}
            max={9999999.99}
            precision={2}
            value={amount}
            onChange={(v) => setAmount(v)}
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
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
