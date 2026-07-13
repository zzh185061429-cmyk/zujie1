/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { HUD } from './components/HUD';
import { ToastProvider, useToast } from './components/ToastProvider';
import { ChatBar } from './components/ChatBar';
import { GameProvider, useGameContext } from './state/GameContext';
import { StoryView } from './views/StoryView';
import { DispatchView } from './views/DispatchView';
import { ArchiveView } from './views/ArchiveView';
import { ReadingModal } from './views/ReadingModal';
import { ThinkingChainModal } from './views/ThinkingChainModal';
import { VariableViewerModal } from './views/VariableViewerModal';
import { DeleteFloorsModal } from './views/DeleteFloorsModal';
import { regenerateCurrentFloor } from './utils/interaction';
import { MessageSquare, Calendar, Users, X, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './utils';

type Tab = 'story' | 'dispatch' | 'archive';

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('story');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isThinkingOpen, setIsThinkingOpen] = useState(false);
  const [isVariableViewerOpen, setIsVariableViewerOpen] = useState(false);
  const [isReadingOpen, setIsReadingOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { isEyeCareMode, isViewingHistory, viewingFloorId, lastAssistantFloorId, goToLatest, startGenerating, finishGenerating } = useGameContext();
  const { showToast } = useToast();

  // 检测脚本模式：通过 __TAVERN_SCRIPT_MODE__ 标记区分全屏策略和 CSS
  const isScriptMode = typeof (window as any).__TAVERN_SCRIPT_MODE__ !== 'undefined';

  // 监听全屏状态变化（用户按 Esc 退出等）— 仅前端模式需要
  useEffect(() => {
    if (isScriptMode) return;
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [isScriptMode]);

  const toggleFullscreen = async () => {
    if (isScriptMode) {
      const next = !isFullscreen;
      setIsFullscreen(next);
      (window as any).__setFullscreen__(next);
      return;
    }
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setIsGenerating(true);
    startGenerating();
    console.info('[App] 开始重新生成...');
    try {
      const result = await regenerateCurrentFloor();
      console.info('[App] 重新生成结果:', result);
      if (result.success) {
        showToast('已重新生成最后一楼层', 'normal');
      } else {
        showToast((result as { success: false; error: string }).error || '重新生成失败', 'alert');
      }
    } catch (e: any) {
      console.error('[App] 重新生成异常:', e);
      showToast(e?.message || '重新生成失败', 'alert');
    }
    setRegenerating(false);
    setIsGenerating(false);
    finishGenerating();
  };
  const navItems = [
    { id: 'story', label: '剧情推进', icon: MessageSquare },
    { id: 'dispatch', label: '债务调度', icon: Calendar },
    { id: 'archive', label: '角色图鉴', icon: Users },
  ] as const;

  return (
    <div 
      className="w-full h-dvh flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#1a1a1a' }}
    >
      <div 
        className={cn(
          "flex flex-col bg-pop-black overflow-hidden font-sans relative transition-all duration-300 w-full h-full",
        )}
        style={{ filter: isEyeCareMode ? 'sepia(0.2) brightness(0.9) contrast(0.95)' : 'none' }}
      >
        
        {/* Global HUD — fold button is inside HUD left column */}
        <HUD
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onOpenThinking={() => setIsThinkingOpen(true)}
          onOpenVariables={() => setIsVariableViewerOpen(true)}
          onOpenReading={() => setIsReadingOpen(true)}
          onOpenDelete={() => setIsDeleteOpen(true)}
          onRegenerate={handleRegenerate}
          regenerating={regenerating}
          isGenerating={isGenerating}
        />

        {/* Sidebar — slides in from left via translate-x */}
        <nav className={cn(
          "z-40 flex flex-col justify-start items-stretch bg-pop-black border-r-4 border-white h-full w-64 fixed top-0 left-0 transition-transform duration-300 pt-16",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          {/* Close button inside sidebar */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="absolute top-3 right-3 text-white hover:text-pop-pink transition-colors z-50"
          >
            <X className="w-6 h-6" />
          </button>
          {/* Logo */}
          <div className="flex flex-col items-center justify-center p-6 mb-8 bg-stripes-cyan-pink clip-diagonal mx-4 shadow-pop-pink pop-border">
            <h1 className="text-3xl font-black italic text-white text-stroke-sm -skew-x-12">DEBT</h1>
            <h1 className="text-4xl font-black italic text-pop-yellow text-stroke -skew-x-12 mt-1 drop-shadow-pop-pink">CLUB</h1>
          </div>

          <div className="flex flex-col w-full px-4 gap-4 h-auto items-stretch">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "relative flex-none flex flex-row items-center justify-start gap-4 p-4 transition-all duration-200 group pop-border overflow-hidden",
                    isActive ? "bg-pop-yellow text-pop-black clip-diagonal shadow-pop-pink" : "bg-white text-gray-500 hover:bg-gray-100"
                  )}
                >
                  {isActive && <div className="absolute inset-0 bg-halftone opacity-30"></div>}
                  
                  <div className="relative z-10 flex items-center justify-center">
                    <Icon className={cn("w-8 h-8", isActive ? "text-pop-pink" : "group-hover:text-pop-black")} />
                  </div>
                  <span className={cn("relative z-10 text-xl font-black tracking-wider whitespace-nowrap", isActive ? "text-pop-black" : "group-hover:text-pop-black")}>
                    {item.label}
                  </span>
                  
                  {isActive && <motion.div layoutId="nav-indicator" className="absolute top-0 bottom-0 left-0 w-2 bg-pop-pink" />}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 relative w-full h-dvh overflow-hidden bg-white">
          {activeTab === 'story' && <StoryView />}
          {activeTab === 'dispatch' && <DispatchView />}
          {activeTab === 'archive' && <ArchiveView />}
        </main>

        {/* 底部输入栏 — 可折叠 */}
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-50 pb-safe"
            >
              <ChatBar onClose={() => setIsChatOpen(false)} onGeneratingChange={setIsGenerating} isGenerating={isGenerating} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 折叠态浮动按钮 */}
        <AnimatePresence>
          {!isChatOpen && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              onClick={() => setIsChatOpen(true)}
              className="fixed bottom-4 left-4 z-50 w-12 h-12 bg-pop-yellow text-pop-black rounded-full pop-border shadow-pop-pink flex items-center justify-center hover:scale-110 transition-transform active:scale-90 pb-safe"
              title="展开输入栏"
            >
              <MessageCircle className="w-6 h-6" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* 全局 Modals */}
        <ThinkingChainModal isOpen={isThinkingOpen} onClose={() => setIsThinkingOpen(false)} />
        <VariableViewerModal isOpen={isVariableViewerOpen} onClose={() => setIsVariableViewerOpen(false)} />
        <ReadingModal isOpen={isReadingOpen} onClose={() => setIsReadingOpen(false)} />
        <DeleteFloorsModal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} />

      </div>
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </GameProvider>
  );
}
