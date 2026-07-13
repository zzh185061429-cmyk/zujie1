import React, { useState, useEffect } from 'react';
import { X, Brain, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameContext } from '../state/GameContext';

type ThinkSection = {
  label: string;
  content: string;
  collapsed: boolean;
};

/** 提取当前楼层的所有思维链内容 */
function extractThinkingChain(raw: string): ThinkSection[] {
  const sections: ThinkSection[] = [];

  // ── 以 </konatan_planning~> 为界，之前全是思维链 ──
  const konatanIdx = raw.search(/<\/konatan_planning~>/i);
  const thinkRaw = konatanIdx >= 0 ? raw.slice(0, konatanIdx) : raw;

  // ── 按顺序提取各标签内容 ──
  const tagDefs: { regex: RegExp; label: string }[] = [
    { regex: /<draft>([\s\S]*?)<\/draft>/gi, label: '草稿 (Draft)' },
    { regex: /<Chain_of_Thought>([\s\S]*?)<\/Chain_of_Thought>/gi, label: '思维链 (Chain of Thought)' },
    { regex: /<thinking>([\s\S]*?)<\/thinking>/gi, label: '思考 (Thinking)' },
    { regex: /<think>([\s\S]*?)<\/think>/gi, label: '思考 (Think)' },
  ];

  let remaining = thinkRaw;

  for (const { regex, label } of tagDefs) {
    let match: RegExpExecArray | null;
    let count = 0;
    const source = remaining; // 从剩余文本中按顺序匹配
    regex.lastIndex = 0;

    while ((match = regex.exec(source)) !== null) {
      const content = match[1].trim();
      if (content) {
        count++;
        sections.push({
          label: count > 1 ? `${label} #${count}` : label,
          content,
          collapsed: false,
        });
      }
    }

    // 从剩余文本中移除已提取的标签
    regex.lastIndex = 0;
    remaining = remaining.replace(regex, '');
  }

  // ── 残余未标记文本 ──
  remaining = remaining.trim();
  if (remaining) {
    sections.push({
      label: '未标记内容',
      content: remaining,
      collapsed: false,
    });
  }

  return sections;
}

interface ThinkingChainModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** 思维链查看器 — 展示当前楼层生成时的原始思维链内容 */
export function ThinkingChainModal({ isOpen, onClose }: ThinkingChainModalProps) {
  const [sections, setSections] = useState<ThinkSection[]>([]);
  const [floorId, setFloorId] = useState<number | null>(null);
  const { viewingFloorId, lastAssistantFloorId } = useGameContext();

  useEffect(() => {
    if (!isOpen) return;
    loadThinkingChain();
  }, [isOpen, viewingFloorId, lastAssistantFloorId]);

  function loadThinkingChain() {
    try {
      const targetFloor = viewingFloorId ?? lastAssistantFloorId;
      if (targetFloor == null) {
        setSections([]);
        setFloorId(null);
        return;
      }

      const msgs = getChatMessages(targetFloor);
      if (!msgs || msgs.length === 0) {
        setSections([]);
        setFloorId(targetFloor);
        return;
      }

      const raw = msgs[0].message || '';
      setSections(extractThinkingChain(raw));
      setFloorId(targetFloor);
    } catch {
      console.warn('[ThinkingChainModal] 读取楼层失败');
      setSections([]);
      setFloorId(null);
    }
  }

  function toggleSection(idx: number) {
    setSections((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, collapsed: !s.collapsed } : s)),
    );
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
            <div className="shrink-0 bg-pop-black text-white p-4 pop-border border-b-4 border-pop-pink flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="w-6 h-6 text-pop-cyan" />
                <h2 className="text-xl font-black italic">
                  思维链提取 {floorId != null ? `— 楼层 #${floorId}` : ''}
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
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {sections.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 font-bold text-lg">
                  当前楼层无思维链内容
                </div>
              ) : (
                <div className="space-y-4">
                  {sections.map((section, idx) => (
                    <div key={idx} className="border-2 border-gray-200 pop-border overflow-hidden">
                      {/* 可折叠标题 */}
                      <button
                        onClick={() => toggleSection(idx)}
                        className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                      >
                        {section.collapsed ? (
                          <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" />
                        )}
                        <span className="text-sm font-black text-pop-black">
                          {section.label}
                        </span>
                        <span className="ml-auto text-xs text-gray-400 tabular-nums">
                          {section.content.length} 字
                        </span>
                      </button>

                      {/* 内容体 */}
                      {!section.collapsed && (
                        <div className="p-4 bg-white">
                          <pre className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-mono break-all">
                            {section.content}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 底部 */}
            <div className="shrink-0 p-3 border-t-2 border-gray-100 flex justify-between items-center px-4">
              <span className="text-xs text-gray-400">
                共 {sections.length} 个段落
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