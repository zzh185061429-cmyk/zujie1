import React, { useState, useEffect } from 'react';
import { X, BookText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PopCard } from '../components/ui/PopCard';
import { PopButton } from '../components/ui/PopButton';

type ReadingEntry = {
  floorId: number;
  text: string;
};

interface ReadingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 阅读模式 — 扫描所有 assistant 楼层，提取文本内容，按楼层顺序展示在全屏弹窗中
 */
export function ReadingModal({ isOpen, onClose }: ReadingModalProps) {
  const [entries, setEntries] = useState<ReadingEntry[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    scanAndLoad();
  }, [isOpen]);

  function scanAndLoad() {
    try {
      const messages = getChatMessages(`0-{{lastMessageId}}`, { role: 'assistant' });
      // 只取最新 5 层
      const latestMessages = messages.slice(-5);
      const result: ReadingEntry[] = [];

      for (const msg of latestMessages) {
        // 步骤 1：先剥离思维链（防止思维链中误出现 <content> 标签干扰提取）
        const stripped = msg.message
          .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .replace(/[\s\S]*?<\/konatan_planning~>/i, '');

        // 步骤 2：仅提取 <content>...</content> 内的内容
        const contentMatch = stripped.match(/<content>([\s\S]*?)<\/content>/i);
        const cleaned = contentMatch
          ? contentMatch[1]
              .replace(/\n{3,}/g, '\n\n')
              .trim()
          : stripped
              .replace(/<[^>]+>/g, '')
              .replace(/\n{3,}/g, '\n\n')
              .trim();

        if (cleaned) {
          result.push({ floorId: msg.message_id, text: cleaned });
        }
      }

      setEntries(result);
    } catch {
      console.warn('[ReadingModal] 扫描楼层失败');
      setEntries([]);
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
            className="absolute inset-0 bg-pop-black/90 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* 内容面板 */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full h-full md:w-auto md:max-w-3xl md:h-[90%] md:max-h-[800px] bg-white pop-border shadow-pop-lg z-10 flex flex-col mx-0 md:mx-4"
          >
            {/* 标题栏 */}
            <div className="shrink-0 bg-pop-black text-white p-4 pop-border border-b-4 border-pop-yellow flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookText className="w-6 h-6 text-pop-cyan" />
                <h2 className="text-xl font-black italic">阅读模式 — 全剧情回顾</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-pop-pink hover:bg-pop-yellow hover:text-pop-black transition-colors pop-border"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 内容区 */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10">
              {entries.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 font-bold text-lg">
                  暂无剧情内容
                </div>
              ) : (
                <div className="space-y-8">
                  {entries.map((entry, idx) => (
                    <div key={entry.floorId}>
                      {/* 楼层分隔 */}
                      {idx > 0 && (
                        <div className="flex items-center gap-4 my-8">
                          <div className="flex-1 h-0.5 bg-gray-200" />
                          <span className="text-xs font-bold text-gray-400 tracking-widest">
                            ◆ 第 {entry.floorId} 层 ◆
                          </span>
                          <div className="flex-1 h-0.5 bg-gray-200" />
                        </div>
                      )}

                      {/* 楼层文本 */}
                      <div className="prose prose-lg max-w-none">
                        {entry.text.split('\n').map((paragraph, pIdx) => (
                          paragraph.trim() ? (
                            <p
                              key={pIdx}
                              className="text-gray-800 leading-[2.2] text-[15px] md:text-[17px]"
                              style={{ textIndent: '2em' }}
                            >
                              {paragraph.trim()}
                            </p>
                          ) : <br key={pIdx} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 底部关闭按钮 */}
            <div className="shrink-0 p-4 border-t-2 border-gray-100 flex justify-center">
              <PopButton variant="ghost" onClick={onClose} className="px-8 text-gray-500 hover:text-pop-black">
                关闭阅读模式
              </PopButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}