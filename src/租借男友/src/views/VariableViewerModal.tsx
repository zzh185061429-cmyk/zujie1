import React, { useState, useEffect } from 'react';
import { X, Database, ChevronDown, ChevronRight, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameContext } from '../state/GameContext';

type TreeNodeProps = {
  label: string;
  value: unknown;
  path: string;
  depth: number;
};

/** 判断是否为叶子节点（不可展开） */
function isLeaf(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'object') {
    return Object.keys(value as object).length === 0;
  }
  return true;
}

/** 值类型标签样式 */
function getTypeBadge(value: unknown): { text: string; color: string } {
  if (value === null || value === undefined) return { text: 'null', color: 'bg-gray-300 text-gray-600' };
  if (typeof value === 'number') return { text: 'number', color: 'bg-blue-100 text-blue-700' };
  if (typeof value === 'boolean') return { text: 'boolean', color: 'bg-purple-100 text-purple-700' };
  if (typeof value === 'string') return { text: 'string', color: 'bg-green-100 text-green-700' };
  if (Array.isArray(value)) return { text: `array[${value.length}]`, color: 'bg-orange-100 text-orange-700' };
  if (typeof value === 'object') {
    const keys = Object.keys(value as object);
    return { text: `object{${keys.length}}`, color: 'bg-cyan-100 text-cyan-700' };
  }
  return { text: typeof value, color: 'bg-gray-100 text-gray-600' };
}

function ValuePreview({ value }: { value: unknown }) {
  if (value === null) return <span className="text-gray-400 italic">null</span>;
  if (value === undefined) return <span className="text-gray-400 italic">undefined</span>;
  if (typeof value === 'string') {
    const display = value.length > 60 ? value.slice(0, 60) + '…' : value;
    return <span className="text-green-700">"{display}"</span>;
  }
  if (typeof value === 'number') return <span className="text-blue-700">{value}</span>;
  if (typeof value === 'boolean') return <span className="text-purple-700">{value ? 'true' : 'false'}</span>;
  return null;
}

/** 递归树节点 */
function TreeNode({ label, value, path, depth }: TreeNodeProps) {
  const [collapsed, setCollapsed] = useState(depth >= 3); // 默认折叠深层节点
  const leaf = isLeaf(value);

  const badge = getTypeBadge(value);

  if (leaf) {
    return (
      <div
        className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 transition-colors group"
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        <Circle className="w-1.5 h-1.5 shrink-0 text-gray-300" />
        <span className="text-sm font-bold text-pop-black">{label}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0 rounded ${badge.color}`}>
          {badge.text}
        </span>
        <ValuePreview value={value} />
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? (value as unknown[]).map((v, i) => ({ key: String(i), val: v }))
    : Object.entries(value as Record<string, unknown>).map(([k, v]) => ({ key: k, val: v }));

  return (
    <div>
      {/* 可折叠标题行 */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 py-1 px-2 hover:bg-gray-50 transition-colors text-left"
        style={{ paddingLeft: `${depth * 20 + 4}px` }}
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-gray-400" />
        )}
        <span className="text-sm font-black text-pop-black">{label}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0 rounded ${badge.color}`}>
          {badge.text}
        </span>
      </button>

      {/* 子树 */}
      {!collapsed && (
        <div>
          {entries.map(({ key, val }) => (
            <TreeNode
              key={key}
              label={key}
              value={val}
              path={`${path}.${key}`}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface VariableViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** 变量查看器 — 类似酒馆变量管理器，展示当前楼层的 MVU 变量 */
export function VariableViewerModal({ isOpen, onClose }: VariableViewerModalProps) {
  const [statData, setStatData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [floorId, setFloorId] = useState<number | null>(null);
  const { viewingFloorId, lastAssistantFloorId } = useGameContext();

  useEffect(() => {
    if (!isOpen) return;
    loadVariables();
  }, [isOpen, viewingFloorId, lastAssistantFloorId]);

  async function loadVariables() {
    setLoading(true);
    try {
      const targetFloor = viewingFloorId ?? lastAssistantFloorId;
      if (targetFloor == null) {
        setStatData(null);
        setFloorId(null);
        setLoading(false);
        return;
      }

      await waitGlobalInitialized('Mvu');
      const variables = Mvu.getMvuData({ type: 'message', message_id: targetFloor });
      const data = _.get(variables, 'stat_data');
      setStatData(typeof data === 'object' && data !== null ? data as Record<string, unknown> : null);
      setFloorId(targetFloor);
    } catch {
      console.warn('[VariableViewerModal] 读取变量失败');
      setStatData(null);
      setFloorId(null);
    }
    setLoading(false);
  }

  const entries = statData
    ? Object.entries(statData).map(([k, v]) => ({ key: k, val: v }))
    : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-pop-black/85 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full h-full md:w-auto md:max-w-2xl md:h-[85%] md:max-h-[750px] bg-white pop-border shadow-pop-lg z-10 flex flex-col mx-0 md:mx-4"
          >
            {/* 标题栏 */}
            <div className="shrink-0 bg-pop-black text-white p-4 pop-border border-b-4 border-pop-cyan flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="w-6 h-6 text-pop-yellow" />
                <h2 className="text-xl font-black italic">
                  变量查看器 {floorId != null ? `— 楼层 #${floorId}` : ''}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-pop-pink hover:bg-pop-yellow hover:text-pop-black transition-colors pop-border"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 内容区 */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full text-gray-400 font-bold">
                  加载中...
                </div>
              ) : !statData || entries.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 font-bold text-lg">
                  当前楼层无变量数据
                </div>
              ) : (
                <div className="py-2 font-mono">
                  {entries.map(({ key, val }) => (
                    <TreeNode
                      key={key}
                      label={key}
                      value={val}
                      path={key}
                      depth={0}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 底部 */}
            <div className="shrink-0 p-3 border-t-2 border-gray-100 flex justify-between items-center px-4">
              <span className="text-xs text-gray-400">
                {statData ? `${Object.keys(statData).length} 个顶层字段` : ''}
              </span>
              <button
                onClick={onClose}
                className="px-6 py-1.5 bg-pop-black text-white text-sm font-bold hover:bg-pop-pink transition-colors pop-border"
              >
                关闭
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}