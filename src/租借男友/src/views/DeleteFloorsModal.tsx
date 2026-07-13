import React, { useState } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../components/ToastProvider';

interface DeleteFloorsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** 删除指定范围的楼层 */
export function DeleteFloorsModal({ isOpen, onClose }: DeleteFloorsModalProps) {
  const [startFloor, setStartFloor] = useState('');
  const [endFloor, setEndFloor] = useState('');
  const [deleting, setDeleting] = useState(false);
  const { showToast } = useToast();

  async function handleDelete() {
    const start = parseInt(startFloor, 10);
    const end = parseInt(endFloor, 10);

    if (isNaN(start) || isNaN(end) || start < 0 || end < start) {
      showToast('请输入有效的楼层范围', 'alert');
      return;
    }

    setDeleting(true);
    try {
      // 使用 /cut 命令彻底删除楼层（不是 deleteChatMessages，那个只是清空内容）
      await triggerSlash(`/cut ${start}-${end}`);
      showToast(`已彻底删除楼层 #${start} 到 #${end}`, 'normal');
      onClose();
      // 发送事件通知前端刷新，而不是强制页面重载（避免退出全屏）
      eventEmit('story_interaction_done');
    } catch (e: any) {
      showToast(e?.message || '删除失败', 'alert');
    }
    setDeleting(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center">
      {/* 背景遮罩 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-pop-black/85 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 内容面板 */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="relative w-full h-full md:w-auto md:max-w-sm bg-white pop-border shadow-pop-lg z-10 flex flex-col mx-0 md:mx-4"
      >
        {/* 标题栏 */}
        <div className="shrink-0 bg-pop-black text-white p-4 pop-border border-b-4 border-pop-pink flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trash2 className="w-5 h-5 text-pop-pink" />
            <h2 className="text-lg font-black italic">删除楼层</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-pop-pink hover:bg-pop-yellow hover:text-pop-black transition-colors pop-border"
            disabled={deleting}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 警告 */}
        <div className="shrink-0 bg-red-50 border-b-2 border-red-200 px-4 py-2 flex items-center gap-2 text-sm font-bold text-red-600">
          <AlertTriangle className="w-4 h-4" />
          此操作不可撤销
        </div>

        {/* 输入区 */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">起始楼层</label>
            <input
              type="number"
              min={0}
              value={startFloor}
              onChange={(e) => setStartFloor(e.target.value)}
              placeholder="如 5"
              className="w-full px-3 py-2 border-2 border-gray-300 pop-border text-sm font-bold focus:outline-none focus:border-pop-cyan"
              disabled={deleting}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">结束楼层</label>
            <input
              type="number"
              min={0}
              value={endFloor}
              onChange={(e) => setEndFloor(e.target.value)}
              placeholder="如 10"
              className="w-full px-3 py-2 border-2 border-gray-300 pop-border text-sm font-bold focus:outline-none focus:border-pop-cyan"
              disabled={deleting}
            />
          </div>

          <button
            onClick={handleDelete}
            disabled={deleting || !startFloor || !endFloor}
            className="w-full py-2 bg-pop-pink text-white font-black text-sm pop-border hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleting ? '删除中...' : '确认删除'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}