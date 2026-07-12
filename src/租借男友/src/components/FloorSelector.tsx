import React, { useState, useEffect, useCallback } from 'react';
import { Layers, ChevronDown, CornerDownRight, Navigation } from 'lucide-react';
import { PopCard } from './ui/PopCard';
import { getAssistantFloors } from '../utils/floorNav';
import { useGameContext } from '../state/GameContext';
import { cn } from '../utils';

/** 楼层下拉选择器 — 虚拟楼层导航，支持"跟随最新"和历史楼层查看 */
export function FloorSelector() {
  const [floors, setFloors] = useState<number[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { viewingFloorId, setViewingFloor, lastAssistantFloorId, isViewingHistory, isGenerating, generatingFloorId } = useGameContext();

  // 初始化：扫描所有 assistant 楼层
  useEffect(() => {
    setFloors(getAssistantFloors());
  }, []);

  const handleToggle = useCallback(() => {
    if (!isOpen) {
      // 生成中过滤掉未完成楼层（generatingFloorId 之前的楼层）
      const allFloors = getAssistantFloors();
      if (isGenerating && generatingFloorId != null) {
        // 只显示 generatingFloorId 之前的楼层（已完成的）
        setFloors(allFloors.filter(f => f < generatingFloorId));
      } else if (isGenerating) {
        // 生成中但还不知道目标楼层，显示所有已知楼层
        setFloors(allFloors);
      } else {
        setFloors(allFloors);
      }
    }
    setIsOpen((p) => !p);
  }, [isOpen, isGenerating, generatingFloorId]);

  const handleSelect = useCallback(
    (floorId: number | null) => {
      setIsOpen(false);
      setViewingFloor(floorId);
    },
    [setViewingFloor],
  );

  // 当前显示的楼层号（跟随最新或指定楼层）
  // 生成中：显示锁定的楼层；生成完成后：显示 generatingFloorId 作为最新
  const displayFloor = viewingFloorId ?? (isGenerating ? lastAssistantFloorId : (generatingFloorId ?? lastAssistantFloorId));

  return (
    <div className="relative shrink-0">
      <PopCard
        onClick={handleToggle}
        className="py-1 px-2 flex items-center gap-1.5 bg-pop-black text-white cursor-pointer hover:bg-pop-pink transition-colors clip-diagonal shrink-0"
        title="楼层导航"
      >
        <Layers className="w-3.5 h-3.5 shrink-0 text-pop-cyan" />
        <span className="text-xs font-bold tabular-nums">
          {isViewingHistory ? `#${displayFloor}` : `#${displayFloor}`}
        </span>
        <ChevronDown
          className={cn('w-3 h-3 transition-transform duration-200', isOpen && 'rotate-180')}
        />
      </PopCard>

      {isOpen && (
        <>
          {/* 点击外部关闭 */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute top-full right-0 mt-1 w-40 max-h-64 overflow-y-auto bg-pop-black border-2 border-white z-50 rounded shadow-[4px_4px_0_#fff]">
            <div className="sticky top-0 bg-pop-cyan text-pop-black text-xs font-black px-3 py-1 border-b-2 border-white">
              助手楼层 ({floors.length})
            </div>

            {/* "跟随最新" 选项 */}
            <button
              onClick={() => handleSelect(null)}
              className={cn(
                'w-full text-left px-3 py-1.5 text-sm font-bold transition-colors flex items-center gap-2 border-b border-white/10',
                !isViewingHistory
                  ? 'text-pop-yellow bg-white/10'
                  : 'text-white hover:bg-pop-pink hover:text-white',
              )}
            >
              <Navigation
                className={cn('w-3 h-3 shrink-0', !isViewingHistory ? 'text-pop-yellow' : 'opacity-40')}
              />
              <span>跟随最新</span>
              {!isViewingHistory && (
                <span className="ml-auto text-[10px] text-pop-yellow/70">◀ 当前</span>
              )}
            </button>

            {floors.map((f) => {
              const isActive = f === viewingFloorId;
              return (
                <button
                  key={f}
                  onClick={() => handleSelect(f)}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-sm font-bold transition-colors flex items-center gap-2',
                    isActive
                      ? 'text-pop-yellow bg-white/10'
                      : 'text-white hover:bg-pop-pink hover:text-white',
                  )}
                >
                  <CornerDownRight
                    className={cn('w-3 h-3 shrink-0', isActive ? 'text-pop-yellow' : 'opacity-40')}
                  />
                  <span className="tabular-nums">#{f}</span>
                  {isActive && (
                    <span className="ml-auto text-[10px] text-pop-yellow/70">◀ 查看中</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}