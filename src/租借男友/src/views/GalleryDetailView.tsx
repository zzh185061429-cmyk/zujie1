import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, X } from 'lucide-react';
import {
  CHARACTER_SPRITES,
  CHARACTER_SPRITES_NSFW,
  EMOTION_LIST,
  CHARACTER_COLORS,
  CHARACTER_AVATARS,
  NSFW_CGS,
  NSFW_PHASES,
  isNsfwUnlocked,
  checkGalleryPassword,
} from '../data/characterData';
import { cn } from '../utils';

interface GalleryDetailViewProps {
  characterName: string;
  onBack: () => void;
}

export function GalleryDetailView({ characterName, onBack }: GalleryDetailViewProps) {
  const [selectedEmotion, setSelectedEmotion] = useState<string>('默认');
  const [mode, setMode] = useState<'sfw' | 'nsfw'>('sfw');
  const [selectedPhase, setSelectedPhase] = useState<string>('开始');
  // ── 全屏 Lightbox ──
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  // ── 密码输入 ──
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const sfwSprites = CHARACTER_SPRITES[characterName] || {};
  const nsfwSprites = CHARACTER_SPRITES_NSFW[characterName] || {};
  const sprites = mode === 'sfw' ? sfwSprites : nsfwSprites;
  const emotions = EMOTION_LIST.filter((e) => sprites[e]);
  const color = CHARACTER_COLORS[characterName] || 'bg-pop-yellow';
  const avatar = CHARACTER_AVATARS[characterName];

  const nsfwUnlocked = isNsfwUnlocked(characterName);
  const nsfwCgs = NSFW_CGS[characterName] || {};

  const currentSprite = mode === 'nsfw'
    ? (nsfwCgs[selectedPhase as keyof typeof nsfwCgs] || '')
    : (sprites[selectedEmotion] || sprites['默认'] || avatar);

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
          <span className="text-gray-300 ml-2">/ 立绘</span>
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
        {/* Left: Large sprite */}
        <div className="flex-1 flex items-center justify-center relative">
          <div
            className={cn(
              "relative w-full max-w-md aspect-3/4 pop-border shadow-pop-lg overflow-hidden clip-diagonal",
              color
            )}
          >
            <div className="absolute inset-0 bg-halftone opacity-30 mix-blend-overlay pointer-events-none z-0"></div>
            <div 
              className="absolute inset-0 bg-white/20 m-3 md:m-4 pop-border overflow-hidden z-10 cursor-pointer"
              onClick={() => currentSprite && setLightboxUrl(currentSprite)}
            >
              {currentSprite ? (
                <img
                  src={currentSprite}
                  alt={`${characterName} - ${mode === 'nsfw' ? selectedPhase : selectedEmotion}`}
                  className="absolute inset-0 w-full h-full object-cover object-top"
                />
              ) : (
                <div className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-4">
                  <div className="font-black text-4xl opacity-50 -skew-x-6 text-white">
                    未解锁
                  </div>
                  {mode === 'nsfw' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowPasswordInput(true); }}
                      className="px-4 py-2 bg-pop-pink text-white font-black text-sm pop-border clip-diagonal hover:bg-pop-pink/80 transition-colors"
                    >
                      输入密码解锁
                    </button>
                  )}
                </div>
              )}
            </div>
            {/* Mode label */}
            <div className="absolute bottom-4 left-4 z-20">
              <div className="bg-pop-black text-white px-4 py-2 font-black text-lg pop-border shadow-pop clip-diagonal">
                {mode === 'nsfw' ? selectedPhase : selectedEmotion}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Emotion grid (SFW) or Phase grid (NSFW) */}
        <div className="w-full md:w-64 flex flex-col gap-2 overflow-y-auto pb-24 md:pb-0">
          {mode === 'sfw' ? (
            <>
              <h3 className="text-lg font-black italic text-gray-300 -skew-x-3 mb-2">
                情绪选择
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-2 gap-2">
                {emotions.map((emotion) => {
                  const isActive = selectedEmotion === emotion;
                  const spriteUrl = sprites[emotion];
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
          ) : (
            <>
              <h3 className="text-lg font-black italic text-gray-300 -skew-x-3 mb-2">
                阶段选择
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {NSFW_PHASES.map((phase) => {
                  const isActive = selectedPhase === phase;
                  const cgUrl = nsfwCgs[phase];
                  const isUnlocked = !!cgUrl;
                  return (
                    <motion.button
                      key={phase}
                      whileHover={isUnlocked ? { scale: 1.05 } : {}}
                      whileTap={isUnlocked ? { scale: 0.95 } : {}}
                      onClick={() => isUnlocked && setSelectedPhase(phase)}
                      className={cn(
                        "relative aspect-square pop-border overflow-hidden clip-diagonal transition-all",
                        !isUnlocked && "opacity-50",
                        isActive && isUnlocked
                          ? "ring-4 ring-pop-pink shadow-pop-pink"
                          : isUnlocked && "hover:shadow-pop"
                      )}
                    >
                      {isUnlocked ? (
                        <img
                          src={cgUrl}
                          alt={phase}
                          className="absolute inset-0 w-full h-full object-cover object-top"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-black flex items-center justify-center">
                          <div className="font-black text-sm opacity-50 text-white -skew-x-3">
                            未解锁
                          </div>
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
                        {phase}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Lightbox 全屏查看 ── */}
      {lightboxUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-pop-black/80 text-white pop-border hover:bg-pop-pink transition-colors z-50"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="fullscreen"
            className="w-full h-full object-cover"
            onClick={(e) => e.stopPropagation()}
          />
        </motion.div>
      )}

      {/* ── 密码输入弹窗 ── */}
      {showPasswordInput && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowPasswordInput(false)}
        >
          <div
            className="bg-pop-black border-2 border-pop-pink p-6 w-full max-w-sm clip-diagonal shadow-pop-pink"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-black italic text-white mb-4 -skew-x-3">
              输入解锁密码
            </h3>
            <input
              type="text"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
              placeholder="请输入密码..."
              className="w-full px-4 py-2 bg-white/10 border-2 border-white text-white font-bold placeholder:text-gray-500 focus:border-pop-pink focus:outline-none clip-diagonal mb-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (checkGalleryPassword(passwordInput)) {
                    setShowPasswordInput(false);
                    setPasswordInput('');
                    setPasswordError(false);
                  } else {
                    setPasswordError(true);
                  }
                }
              }}
            />
            {passwordError && (
              <p className="text-pop-pink text-sm font-bold mb-2">密码错误</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (checkGalleryPassword(passwordInput)) {
                    setShowPasswordInput(false);
                    setPasswordInput('');
                    setPasswordError(false);
                  } else {
                    setPasswordError(true);
                  }
                }}
                className="flex-1 px-4 py-2 bg-pop-pink text-white font-black text-sm pop-border clip-diagonal hover:bg-pop-pink/80 transition-colors"
              >
                解锁
              </button>
              <button
                onClick={() => { setShowPasswordInput(false); setPasswordInput(''); setPasswordError(false); }}
                className="px-4 py-2 bg-gray-700 text-white font-black text-sm pop-border clip-diagonal hover:bg-gray-600 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
