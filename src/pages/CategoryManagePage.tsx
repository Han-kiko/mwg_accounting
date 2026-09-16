import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  List,
  Modal,
  Row,
  Select,
  Tag,
  Typography,
  message,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import type { CategoryNode } from '../shared/api';

/** 页面里操作的分类条目（比树节点多一个 isTop 标记） */
interface CatItem {
  id: number;
  name: string;
  isPreset: boolean;
  isTop: boolean;
}

type ModalState = { type: 'addTop' } | { type: 'addSub' } | { type: 'rename'; id: number };

/** 分类管理：预置分类锁定，自建分类可新增、改名、删除（删除时账单可搬移） */
export default function CategoryManagePage() {
  const [tree, setTree] = useState<CategoryNode[] | null>(null);
  const [selectedTopId, setSelectedTopId] = useState<number>();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<{ item: CatItem; expenseCount: number } | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<number>();

  const load = useCallback(async () => {
    const t = await window.api.getCategoryTree();
    setTree(t);
    // 选中项被删掉后自动清空选择
    setSelectedTopId((prev) =>
      prev !== undefined && t.some((c) => c.id === prev) ? prev : undefined,
    );
  }, []);

  useEffect(() => {
    load().catch((err: Error) => message.error(`加载分类失败：${err.message}`));
  }, [load]);

  const selectedTop = useMemo(
    () => tree?.find((c) => c.id === selectedTopId) ?? null,
    [tree, selectedTopId],
  );

  // 删除时账单可搬移的目标小类（排除即将被删掉的分类）
  const moveOptions = useMemo(() => {
    if (!tree || !deleting) return [];
    const opts: Array<{ value: number; label: string }> = [];
    tree.forEach((top) => {
      top.children.forEach((sub) => {
        if (deleting.item.isTop && top.id === deleting.item.id) return;
        if (!deleting.item.isTop && sub.id === deleting.item.id) return;
        opts.push({ value: sub.id, label: `${top.name} · ${sub.name}` });
      });
    });
    return opts;
  }, [tree, deleting]);

  const openAdd = (type: 'addTop' | 'addSub') => {
    setNameInput('');
    setModal({ type });
  };

  const openRename = (item: CatItem) => {
    setNameInput(item.name);
    setModal({ type: 'rename', id: item.id });
  };

  const openDelete = async (item: CatItem) => {
    try {
      const n = await window.api.countCategoryExpenses(item.id);
      setDeleting({ item, expenseCount: n });
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const handleModalOk = async () => {
    const name = nameInput.trim();
    if (!name) {
      message.warning('请输入分类名称');
      return;
    }
    setSaving(true);
    try {
      if (modal?.type === 'addTop') {
        await window.api.addTopCategory(name);
      } else if (modal?.type === 'addSub') {
        if (selectedTopId === undefined) throw new Error('请先在左侧选择一个一级大类');
        await window.api.addSubCategory(selectedTopId, name);
      } else if (modal?.type === 'rename') {
        await window.api.renameCategory(modal.id, name);
      }
      message.success('已保存');
      setModal(null);
      await load();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOk = async () => {
    if (!deleting) return;
    if (deleting.expenseCount > 0 && moveTargetId === undefined) {
      message.warning('请先选择账单要归入的二级小类');
      return;
    }
    setSaving(true);
    try {
      await window.api.deleteCategory(deleting.item.id, moveTargetId);
      message.success('已删除');
      setDeleting(null);
      await load();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const modalTitle =
    modal?.type === 'addTop'
      ? '新增一级分类'
      : modal?.type === 'addSub'
        ? `新增二级小类（挂在「${selectedTop?.name ?? ''}」下）`
        : '修改分类名称';

  const renderItemActions = (item: CatItem) =>
    item.isPreset
      ? [<Tag key="preset" color="blue">预置</Tag>]
      : [
          <Button
            key="rename"
            size="small"
            type="text"
            icon={<EditOutlined />}
            title="改名"
            onClick={() => openRename(item)}
          />,
          <Button
            key="delete"
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            title="删除"
            onClick={() => openDelete(item)}
          />,
        ];

  return (
    <>
      <Typography.Paragraph type="secondary">
        规则：带「预置」标记的分类是软件自带的，不能改名、不能删除；你自己新建的分类可以改名、删除。删除时，它下面的历史账单可以搬到别的分类，不会丢。
      </Typography.Paragraph>
      <Row gutter={16}>
        <Col span={12}>
          <Card
            size="small"
            title="一级大类"
            extra={
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => openAdd('addTop')}
              >
                新增一级分类
              </Button>
            }
          >
            {tree === null ? (
              <Typography.Text type="secondary">加载中…</Typography.Text>
            ) : tree.length === 0 ? (
              <Empty description="暂无分类" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={tree}
                renderItem={(item) => (
                  <List.Item
                    onClick={() => setSelectedTopId(item.id)}
                    style={{
                      cursor: 'pointer',
                      background: item.id === selectedTopId ? '#e6f4ff' : undefined,
                      paddingInline: 12,
                    }}
                    actions={renderItemActions({
                      id: item.id,
                      name: item.name,
                      isPreset: item.isPreset,
                      isTop: true,
                    })}
                  >
                    {item.name}
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card
            size="small"
            title={selectedTop ? `二级小类（${selectedTop.name}）` : '二级小类'}
            extra={
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                disabled={!selectedTop}
                onClick={() => openAdd('addSub')}
              >
                新增二级小类
              </Button>
            }
          >
            {!selectedTop ? (
              <Empty
                description="先在左侧选择一个一级大类"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : selectedTop.children.length === 0 ? (
              <Empty
                description="该大类下还没有二级小类，点右上角「新增二级小类」添加"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <List
                size="small"
                dataSource={selectedTop.children}
                renderItem={(item) => (
                  <List.Item
                    style={{ paddingInline: 12 }}
                    actions={renderItemActions({
                      id: item.id,
                      name: item.name,
                      isPreset: item.isPreset,
                      isTop: false,
                    })}
                  >
                    {item.name}
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 新增 / 改名共用弹窗 */}
      <Modal
        title={modalTitle}
        open={modal !== null}
        onOk={handleModalOk}
        onCancel={() => setModal(null)}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
      >
        <Input
          placeholder="分类名称（最多 10 个字）"
          maxLength={10}
          showCount
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onPressEnter={handleModalOk}
          autoFocus
        />
      </Modal>

      {/* 删除确认弹窗（有账单时需选择搬移目标） */}
      <Modal
        title={deleting ? `删除「${deleting.item.name}」` : '删除分类'}
        open={deleting !== null}
        onOk={handleDeleteOk}
        onCancel={() => setDeleting(null)}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        confirmLoading={saving}
      >
        {deleting &&
          (deleting.expenseCount === 0 ? (
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              该分类下没有账单，可以直接删除。
              {deleting.item.isTop && '（它下面的二级小类会一并删除）'}
            </Typography.Paragraph>
          ) : (
            <>
              <Typography.Paragraph>
                该分类下有 {deleting.expenseCount} 笔账单。删除后，这些账单将归入下面选择的分类：
                {deleting.item.isTop && '（它下面的二级小类也会一并删除）'}
              </Typography.Paragraph>
              <Select
                style={{ width: '100%' }}
                placeholder="选择账单要归入的二级小类"
                value={moveTargetId}
                onChange={(v) => setMoveTargetId(v)}
                options={moveOptions}
                showSearch
                optionFilterProp="label"
              />
            </>
          ))}
      </Modal>
    </>
  );
}
