import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Lock } from 'lucide-react';
import {
  CHARACTER_SPRITES,
  EMOTION_LIST,
  CHARACTER_COLORS,
  CHARACTER_AVATARS,
  getNsfwStages,
  hasNsfwData,
} from '../data/characterData';
import { useGameContext } from '../state/GameContext';
import { cn } from '../utils';

interface GalleryDetailViewProps {
  characterName: string;
  onBack: () => void;
}

export function GalleryDetailView({ characterName, onBack }: GalleryDetailViewProps) {
  const [selectedEmotion, setSelectedEmotion] = useState<string>('默认');
  const [mode, setMode] = useState<'sfw' | 'nsfw'>('sfw');
  const [selectedNsfwIndex, setSelectedNsfwIndex] = useState(0);

  const { isNsfwUnlocked } = useGameContext();
  const isUnlocked = isNsfwUnlocked(characterName);
  const hasNsfw = hasNsfwData(characterName);
  const nsfwStages = getNsfwStages(characterName);

  const sfwSprites = CHARACTER_SPRITES[characterName] || {};
  const emotions = EMOTION_LIST.filter((e) => sfwSprites[e]);
  const color = CHARACTER_COLORS[characterName] || 'bg-pop-yellow';
  const avatar = CHARACTER_AVATARS[characterName];

  const currentSprite = mode === 'nsfw'
    ? (isUnlocked ? nsfwStages[selectedNsfwIndex]?.imageUrl : null)
    : (sfwSprites[selectedEmotion] || sfwSprites['默认'] || avatar);

  return (
    <div className="w-full h-full bg-[#2a2a2a] pt-0 p-4 md:p-8 flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4 md:mb-6 z-10">
        <button
          onClick={onBack}
          className="p-2 bg-pop-black text-white pop-border shadow-pop hover:bg-pop-pink transition-colors clip-diagonal"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl md:text-3xl font-black italic text-white -skew-x-6 drop-shadow-md">
          <span className={cn("text-pop-pink", color.replace('bg-', 'text-'))}>
            {characterName}
          </span>
          <span className="text-gray-300 ml-2">/ {mode === 'nsfw' ? 'CG' : '立绘'}</span>
        </h1>

        {/* SFW / NSFW toggle */}
        <div className="ml-auto flex items-center gap-1 bg-pop-black p-1 pop-border clip-diagonal">
          <button
            onClick={() => setMode('sfw')}
            className={cn(
              "px-3 py-1 font-black text-xs transition-colors",
              mode === 'sfw'
                ? "bg-pop-cyan text-pop-black"
                : "bg-transparent text-gray-400 hover:text-white"
            )}
          >
            SFW
          </button>
          <button
            onClick={() => setMode('nsfw')}
            className={cn(
              "px-3 py-1 font-black text-xs transition-colors",
              mode === 'nsfw'
                ? "bg-pop-pink text-white"
                : "bg-transparent text-gray-400 hover:text-white"
            )}
          >
            NSFW
          </button>
        </div>
      </div>

      {/* Main display */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-6 z-10 overflow-hidden">
        {/* Left: Large sprite / CG */}
        <div className="flex-1 flex items-center justify-center relative">
          <div
            className={cn(
              "relative w-full max-w-md aspect-3/4 pop-border shadow-pop-lg overflow-hidden clip-diagonal",
              color
            )}
          >
            <div className="absolute inset-0 bg-halftone opacity-30 mix-blend-overlay pointer-events-none z-0"></div>
            <div className="absolute inset-0 bg-white/20 m-3 md:m-4 pop-border overflow-hidden z-10">
              {mode === 'nsfw' && !isUnlocked ? (
                // 未解锁状态
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-pop-black/90">
                  <Lock className="w-16 h-16 text-pop-pink mb-4" />
                  <div className="text-pop-pink font-black text-2xl italic -skew-x-6">
                    未解锁
                  </div>
                  <div className="text-gray-400 font-bold text-sm text-center mt-2 px-4">
                    在 StoryView 中触发该角色的 NSFW 模式即可解锁
                  </div>
                </div>
              ) : currentSprite ? (
                <img
                  src={currentSprite}
                  alt={`${characterName} - ${mode === 'nsfw' ? nsfwStages[selectedNsfwIndex]?.label : selectedEmotion}`}
                  className="absolute inset-0 w-full h-full object-cover object-top"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center font-black text-4xl opacity-50 -skew-x-6">
                  暂无立绘
                </div>
              )}
            </div>
            {/* Mode label */}
            <div className="absolute bottom-4 left-4 z-20">
              <div className="bg-pop-black text-white px-4 py-2 font-black text-lg pop-border shadow-pop clip-diagonal">
                {mode === 'nsfw'
                  ? (isUnlocked ? nsfwStages[selectedNsfwIndex]?.label : '???')
                  : selectedEmotion}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Emotion grid (SFW) or CG grid (NSFW) */}
        <div className="w-full md:w-64 flex flex-col gap-2 overflow-y-auto pb-24 md:pb-0">
          {mode === 'sfw' ? (
            <>
              <h3 className="text-lg font-black italic text-gray-300 -skew-x-3 mb-2">
                情绪选择
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-2 gap-2">
                {emotions.map((emotion) => {
                  const isActive = selectedEmotion === emotion;
                  const spriteUrl = sfwSprites[emotion];
                  return (
                    <motion.button
                      key={emotion}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedEmotion(emotion)}
                      className={cn(
                        "relative aspect-square pop-border overflow-hidden clip-diagonal transition-all",
                        isActive
                          ? "ring-4 ring-pop-pink shadow-pop-pink"
                          : "hover:shadow-pop"
                      )}
                    >
                      {spriteUrl ? (
                        <img
                          src={spriteUrl}
                          alt={emotion}
                          className="absolute inset-0 w-full h-full object-cover object-top"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center font-black text-sm opacity-50">
                          {emotion}
                        </div>
                      )}
                      {/* Label overlay */}
                      <div
                        className={cn(
                          "absolute bottom-0 left-0 right-0 px-1 py-1 text-center font-black text-[10px] md:text-xs truncate",
                          isActive
                            ? "bg-pop-pink text-white"
                            : "bg-pop-black/70 text-white"
                        )}
                      >
                        {emotion}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </>
          ) : hasNsfw ? (
            // NSFW CG 网格
            <>
              <h3 className="text-lg font-black italic text-pop-pink -skew-x-3 mb-2">
                {isUnlocked ? 'CG 选择' : '???'}
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-2 gap-2">
                {nsfwStages.map((stage, index) => {
                  const isActive = selectedNsfwIndex === index;
                  return (
                    <motion.button
                      key={index}
                      whileHover={isUnlocked ? { scale: 1.05 } : {}}
                      whileTap={isUnlocked ? { scale: 0.95 } : {}}
                      onClick={() => isUnlocked && setSelectedNsfwIndex(index)}
                      className={cn(
                        "relative aspect-square pop-border overflow-hidden clip-diagonal transition-all",
                        isActive && isUnlocked
                          ? "ring-4 ring-pop-pink shadow-pop-pink"
                          : "hover:shadow-pop",
                        !isUnlocked && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isUnlocked ? (
                        <img
                          src={stage.imageUrl}
                          alt={stage.label}
                          className="absolute inset-0 w-full h-full object-cover object-top"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-pop-black/80">
                          <Lock className="w-8 h-8 text-pop-pink" />
                        </div>
                      )}
                      {/* Label overlay */}
                      <div
                        className={cn(
                          "absolute bottom-0 left-0 right-0 px-1 py-1 text-center font-black text-[10px] md:text-xs truncate",
                          isActive && isUnlocked
                            ? "bg-pop-pink text-white"
                            : "bg-pop-black/70 text-white"
                        )}
                      >
                        {isUnlocked ? stage.label : '???'}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="text-pop-pink font-black text-2xl italic -skew-x-6">
                NSFW MODE
              </div>
              <div className="text-gray-400 font-bold text-sm text-center">
                该角色暂无 NSFW CG
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
