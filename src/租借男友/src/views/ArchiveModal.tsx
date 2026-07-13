import React, { useState, useEffect } from 'react';
import { X, Save, CornerDownRight, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PopCard } from '../components/ui/PopCard';
import { PopButton } from '../components/ui/PopButton';
import { useToast } from '../components/ToastProvider';

type ArchiveEntry = {
  floorId: number;
  summary: string;
};

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 读档功能 — 扫描所有 assistant 楼层中的 <sum> 标签作为存档摘要，
 * 用户选择后执行 branch-create 分支 + 刷新页面
 */
export function ArchiveModal({ isOpen, onClose }: ArchiveModalProps) {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (!isOpen) return;
    scanArchives();
  }, [isOpen]);

  function scanArchives() {
    try {
      const messages = getChatMessages(`0-{{lastMessageId}}`, { role: 'assistant' });
      const result: ArchiveEntry[] = [];

      for (const msg of messages) {
        const sumMatch = msg.message.match(/<sum>([\s\S]*?)<\/sum>/i);
        if (sumMatch) {
          const summary = sumMatch[1].trim();
          if (summary) {
            result.push({ floorId: msg.message_id, summary });
          }
        }
      }

      setEntries(result);
    } catch {
      console.warn('[ArchiveModal] 扫描存档失败');
      setEntries([]);
    }
  }

  async function handleLoadArchive(floorId: number) {
    setLoading(true);
    setSelectedId(floorId);
    try {
      await triggerSlash('/branch-create ' + floorId);
      console.info(`[ArchiveModal] 分支已创建，跳转到楼层 ${floorId}`);
      showToast(`读档成功，正在跳转到分支...`, 'normal');
      // 延迟刷新，让 toast 显示出来
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (err: any) {
      console.error('[ArchiveModal] 读档失败:', err?.message || err);
      showToast('读档失败，请重试', 'alert');
      setLoading(false);
      setSelectedId(null);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center">
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-pop-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* 内容面板 */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full h-full md:w-auto md:max-w-lg bg-white pop-border shadow-pop-lg z-10 flex flex-col md:max-h-[80vh] mx-0 md:mx-4"
          >
            {/* 标题栏 */}
            <div className="shrink-0 bg-pop-black text-white p-4 pop-border border-b-4 border-pop-yellow flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Save className="w-6 h-6 text-pop-cyan" />
                <h2 className="text-xl font-black italic">读档 — 选择存档点</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-pop-pink hover:bg-pop-yellow hover:text-pop-black transition-colors pop-border"
                disabled={loading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 提示 */}
            <div className="shrink-0 bg-pop-yellow/20 border-b-2 border-pop-yellow/30 px-4 py-2 flex items-center gap-2 text-sm font-bold text-pop-black">
              <AlertTriangle className="w-4 h-4 text-pop-yellow" />
              读档将创建新的分支聊天，当前进度不会丢失
            </div>

            {/* 列表区 */}
            <div className="flex-1 overflow-y-auto">
              {entries.length === 0 ? (
                <div className="p-8 text-center text-gray-400 font-bold">
                  暂无存档点 — 请在世界书中添加 &lt;sum&gt; 标签
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {entries.map((entry) => (
                    <button
                      key={entry.floorId}
                      onClick={() => handleLoadArchive(entry.floorId)}
                      disabled={loading}
                      className="w-full text-left p-4 hover:bg-pop-cyan/10 transition-colors flex items-start gap-4 disabled:opacity-50"
                    >
                      <CornerDownRight className="w-4 h-4 mt-1 shrink-0 text-pop-cyan" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-black bg-pop-black text-white px-2 py-0.5 pop-border tabular-nums">
                            #{entry.floorId}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-gray-700 line-clamp-2 leading-relaxed">
                          {entry.summary}
                        </p>
                      </div>
                      {selectedId === entry.floorId && loading && (
                        <span className="text-xs text-pop-pink font-bold animate-pulse mt-1">
                          加载中...
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 底部 */}
            <div className="shrink-0 p-4 border-t-2 border-gray-100 flex justify-center">
              <PopButton
                variant="ghost"
                onClick={onClose}
                disabled={loading}
                className="px-8 text-gray-500 hover:text-pop-black"
              >
                取消
              </PopButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}