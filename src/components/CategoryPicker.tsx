import { useMemo } from 'react';
import { Select } from 'antd';
import type { CategoryNode } from '../shared/api';

interface Props {
  categories: CategoryNode[];
  /** 当前选中的一级分类 id */
  topId?: number;
  /** 当前选中的二级小类 id */
  subId?: number;
  /** 一级或二级变化时回调 */
  onChange: (topId: number | undefined, subId: number | undefined) => void;
}

/** 两级联动分类选择器（先选一级大类，二级小类跟随变化） */
export default function CategoryPicker({ categories, topId, subId, onChange }: Props) {
  // 根据选中的一级分类，联动出二级小类选项
  const subOptions = useMemo(
    () => categories.find((c) => c.id === topId)?.children ?? [],
    [categories, topId],
  );

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <Select
        style={{ width: '50%' }}
        placeholder="一级分类"
        value={topId}
        onChange={(v) => onChange(v, undefined)}
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
      />
      <Select
        style={{ width: '50%' }}
        placeholder="二级小类"
        value={subId}
        onChange={(v) => onChange(topId, v)}
        options={subOptions.map((c) => ({ value: c.id, label: c.name }))}
        disabled={!topId}
      />
    </div>
  );
}
