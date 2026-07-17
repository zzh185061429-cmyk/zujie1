import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PopCard } from "../components/ui/PopCard";
import { PopButton } from "../components/ui/PopButton";
import { History, ChevronRight, ChevronLeft, Play, Pause, Zap, FastForward } from "lucide-react";
import { useToast } from "../components/ToastProvider";
import { useGameContext } from "../state/GameContext";
import { parseScriptContent, ScriptLine } from "./scriptParser";
import { getLocationBackground, preloadLocationBackgrounds, preloadScriptBackgrounds } from "../data/locationImages";
import { getNsfwCg, canTriggerNsfw, NSFW_PHASES, NAMED_CHARS } from "../data/characterData";
import { cn } from "../utils";

/** 将 <user> 替换为显示名 */
function displayName(name: string): string {
  return name === '<user>' ? '我' : name;
}
const SPEED_DELAY: Record<number, number> = {
  1: 50,   // 普通
  2: 20,   // 倍速
  4: 5,    // 极速
};

/** 场景中的角色信息 */
interface SceneCharacter {
  speaker: string;
  emotion: string;
  sprite: string;
  position: 'left' | 'center' | 'right';
  isActive: boolean;
}

/** 情绪对应的屏幕特效 */
const EMOTION_EFFECTS: Record<string, {
  shake?: boolean;
  flashColor?: string;
  vignette?: string;
}> = {
  '生气': { shake: true, vignette: 'rgba(255,0,0,0.08)' },
  '惊讶': { shake: true, flashColor: 'rgba(255,255,255,0.2)' },
  '害羞': { vignette: 'rgba(255,105,180,0.1)' },
  '害怕': { vignette: 'rgba(0,0,0,0.25)' },
  '伤心': { vignette: 'rgba(0,0,139,0.15)' },
  '开心': { vignette: 'rgba(255,215,0,0.08)' },
  '吃醋': { vignette: 'rgba(255,165,0,0.1)' },
};

/** 获取切换动画配置 */
function getTransitionConfig(emotion: string) {
  switch (emotion) {
    case '生气':
    case '惊讶':
      return {
        initial: { opacity: 0, scale: 1.08, x: 8 },
        animate: { opacity: 1, scale: 1, x: 0 },
        transition: { duration: 0.18, type: "spring", stiffness: 350 }
      };
    case '害羞':
    case '害怕':
      return {
        initial: { opacity: 0, scale: 0.96, y: 12 },
        animate: { opacity: 1, scale: 1, y: 0 },
        transition: { duration: 0.35, ease: "easeOut" }
      };
    case '伤心':
      return {
        initial: { opacity: 0, y: 25 },
        animate: { opacity: 0.92, y: 0 },
        transition: { duration: 0.45 }
      };
    default:
      return {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.28 }
      };
  }
}

export function StoryView() {
  const [script, setScript] = useState<ScriptLine[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showBacklog, setShowBacklog] = useState(false);

  // ── 场景角色状态（多角色同屏） ──
  const [sceneCharacters, setSceneCharacters] = useState<SceneCharacter[]>([]);

  // ── 打字机控制状态 ──
  const [speedLevel, setSpeedLevel] = useState(1);
  const [isAutoMode, setIsAutoMode] = useState(false);

  // ── 隐藏对话框（看 CG 模式） ──
  const [isTextBoxHidden, setIsTextBoxHidden] = useState(false);

  // 使用 ref 跟踪跳过状态，避免触发 effect 重新执行
  const skipTypingRef = useRef(false);

  const { showToast } = useToast();
  const { viewingFloorId, lastAssistantFloorId, currentLocation, gameTime, nsfwEnabled, nsfwPhase, nsfwChar, setNsfwPhase, setCurrentSceneChar } = useGameContext();

  // 读取指定楼层（或最新楼层）消息文本，解析 <content> 标签
  const targetFloorId = viewingFloorId ?? lastAssistantFloorId;

  useEffect(() => {
    if (targetFloorId == null) return;
    try {
      const msg = getChatMessages(targetFloorId)[0];
      if (msg) {
        console.info('[StoryView] 原始消息:', msg.message.substring(0, 200));
        const parsed = parseScriptContent(msg.message);
        console.info('[StoryView] 解析结果:', parsed.slice(0, 3));
        setScript(parsed);
        setCurrentIndex(0);
        setSceneCharacters([]); // 重置场景

        // ── 预加载背景图片 ──
        const hour = gameTime.getHours();
        preloadLocationBackgrounds(currentLocation, hour);
        preloadScriptBackgrounds(msg.message, hour);

        // ── 预加载所有立绘 ──
        parsed.forEach(line => {
          if (line.sprite) {
            const img = new Image();
            img.src = line.sprite;
          }
        });
      } else {
        setScript([]);
        setSceneCharacters([]);
      }
    } catch {
      console.warn('StoryView: 无法读取楼层', targetFloorId, '的消息文本');
      setScript([]);
      setSceneCharacters([]);
    }
  }, [targetFloorId]);

  const currentLine = script[currentIndex];

  // ── 更新场景角色（当 currentLine 变化时） ──
  useEffect(() => {
    if (!currentLine?.speaker || currentLine.type === 'narrator') {
      // 旁白：所有角色设为非活跃（立绘变暗/隐藏）
      setSceneCharacters(prev => prev.map(c => ({ ...c, isActive: false })));
      return;
    }

    const emotion = currentLine.emotion || '默认';
    const sprite = currentLine.sprite || '';

    setSceneCharacters(prev => {
      const existingIndex = prev.findIndex(c => c.speaker === currentLine.speaker);

      if (existingIndex >= 0) {
        // 更新已有角色的情绪和 sprite
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          emotion,
          sprite: sprite || updated[existingIndex].sprite,
          isActive: true,
        };
        // 其他角色设为非活跃
        return updated.map((c, i) => ({ ...c, isActive: i === existingIndex }));
      } else {
        // 新角色加入场景
        const newChar: SceneCharacter = {
          speaker: currentLine.speaker!,
          emotion,
          sprite,
          position: prev.length === 0 ? 'center' : prev.length === 1 ? 'right' : 'left',
          isActive: true,
        };
        // 最多同时显示 3 个角色，移除同位置的旧角色
        const next = [...prev.filter(c => c.position !== newChar.position), newChar];
        const sliced = next.slice(-3);
        return sliced.map((c, i) => ({ ...c, isActive: i === sliced.length - 1 }));
      }
    });

    // 同步当前场景角色到 GameContext（用于 HUD 判断 NSFW）
    if (currentLine.speaker && NAMED_CHARS.includes(currentLine.speaker)) {
      setCurrentSceneChar(currentLine.speaker);
    }
  }, [currentLine]);

  // 打字机效果
  useEffect(() => {
    let rafId: number;
    let cancelled = false;

    skipTypingRef.current = false;

    if (currentLine && currentIndex < script.length) {
      setIsTyping(true);
      setDisplayedText("");

      const fullText = currentLine.text;
      let i = 0;
      const delay = SPEED_DELAY[speedLevel] || 50;
      let lastTime = performance.now();

      const typeChar = (timestamp: number) => {
        if (cancelled || skipTypingRef.current) {
          if (!cancelled) {
            setDisplayedText(fullText);
            setIsTyping(false);
          }
          return;
        }

        const elapsed = timestamp - lastTime;
        if (elapsed < delay) {
          rafId = requestAnimationFrame(typeChar);
          return;
        }

        lastTime = timestamp;

        if (i < fullText.length) {
          const batchSize = speedLevel >= 4 ? 3 : 1;
          const endIndex = Math.min(i + batchSize, fullText.length);
          setDisplayedText(fullText.substring(0, endIndex));
          i = endIndex;
          rafId = requestAnimationFrame(typeChar);
        } else {
          setIsTyping(false);
        }
      };

      rafId = requestAnimationFrame(typeChar);
    }
    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [currentIndex, currentLine, script.length, speedLevel]);

  // Auto 模式
  useEffect(() => {
    if (isAutoMode && !isTyping && currentIndex < script.length - 1) {
      const waitTime = Math.min(3000, Math.max(1000, (currentLine?.text.length || 0) * 100));
      const timer = setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, waitTime);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isAutoMode, isTyping, currentIndex, script.length, currentLine]);

  const handleNext = () => {
    if (!currentLine) return;
    if (isTyping) {
      skipTypingRef.current = true;
      setDisplayedText(currentLine.text);
      setIsTyping(false);
    } else {
      if (currentIndex < script.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        showToast("本章已读完", "normal");
      }
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  // 当前情绪特效
  const currentEmotion = currentLine?.emotion || '默认';
  const screenEffect = EMOTION_EFFECTS[currentEmotion];

  if (!currentLine) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-pop-black">
        <p className="text-white text-xl font-bold">等待剧情内容...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col bg-pop-black overflow-hidden pt-24 md:pt-20 font-sans">

      {/* Background Area — z-0 */}
      <div className="flex-1 relative bg-pop-black cursor-pointer overflow-hidden" onClick={handleNext}>
        {(() => {
          // NSFW 模式：显示 CG 覆盖背景
          if (nsfwEnabled && nsfwChar) {
            const cgUrl = getNsfwCg(nsfwChar, nsfwPhase);
            if (cgUrl) {
              return (
                <img
                  src={cgUrl}
                  alt={`NSFW-${nsfwPhase}`}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ willChange: 'transform' }}
                  decoding="async"
                />
              );
            }
            // 未解锁 CG 显示黑色背景
            return <div className="absolute inset-0 bg-black" />;
          }
          // 正常模式：显示地点背景
          const bgUrl = getLocationBackground(currentLocation, gameTime.getHours());
          return bgUrl ? (
            <img
              src={bgUrl}
              alt={currentLocation}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ willChange: 'transform' }}
              decoding="async"
            />
          ) : null;
        })()}
        <div className="absolute inset-0 bg-halftone opacity-20 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-linear-to-t from-pop-black via-transparent to-transparent z-10"></div>
      </div>

      {/* Sprite Area — z-15（立绘层，在背景之上，对话框之下） */}
      {!nsfwEnabled && (
        <div className="absolute inset-0 z-15 pointer-events-none overflow-hidden">
          <AnimatePresence mode="popLayout">
            {sceneCharacters.map((char) => (
              <motion.div
                key={char.speaker}
                className={cn(
                  "absolute bottom-0 h-full w-auto transition-all duration-300",
                  char.position === 'left' && "left-[5%]",
                  char.position === 'center' && "left-1/2 -translate-x-1/2",
                  char.position === 'right' && "right-[5%]",
                )}
                style={{
                  filter: char.isActive ? 'none' : 'brightness(0.55) grayscale(0.35)',
                  zIndex: char.isActive ? 16 : 15,
                  transform: char.isActive ? 'scale(1)' : 'scale(0.96)',
                  transition: 'filter 0.3s ease, transform 0.3s ease',
                }}
                {...getTransitionConfig(char.emotion)}
              >
                {char.sprite && (
                  <img
                    src={char.sprite}
                    alt={`${char.speaker}-${char.emotion}`}
                    className="h-full w-auto object-contain object-bottom"
                    style={{
                      // 底部渐变透明，自然融入对话框
                      maskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)',
                      WebkitMaskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)',
                      filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))',
                    }}
                    loading="eager"
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Screen Effects Layer — z-[18] */}
      <div className="absolute inset-0 z-18 pointer-events-none">
        {/* 震动效果 */}
        {screenEffect?.shake && (
          <motion.div
            animate={{ x: [0, -4, 4, -4, 4, 0] }}
            transition={{ duration: 0.25 }}
            className="w-full h-full"
          />
        )}
        {/* 暗角效果 */}
        {screenEffect?.vignette && (
          <div
            className="absolute inset-0"
            style={{ boxShadow: `inset 0 0 200px ${screenEffect.vignette}` }}
          />
        )}
        {/* 闪白效果 */}
        {screenEffect?.flashColor && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0"
            style={{ backgroundColor: screenEffect.flashColor }}
          />
        )}
      </div>

      {/* Text Box Area — z-20 */}
      <AnimatePresence>
        {!isTextBoxHidden && (
          <motion.div
            initial={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative h-[280px] md:h-[320px] w-full p-4 md:p-8 shrink-0 cursor-pointer z-20"
            onClick={handleNext}
          >

        {/* Name Tag + Avatar */}
        <AnimatePresence mode="wait">
          {currentLine.type !== 'narrator' && (
            <motion.div
              key={currentLine.speaker}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="absolute -top-12 md:-top-16 left-6 md:left-12 z-30 flex items-end gap-3 drop-shadow-[4px_4px_0_rgba(0,0,0,0.5)]"
            >
              {currentLine.avatar && (
                <div className={`w-16 h-16 md:w-20 md:h-20 bg-white pop-border border-4 flex items-center justify-center overflow-hidden clip-diagonal relative transform -skew-x-6 ${currentLine.color === 'bg-white' ? 'border-pop-yellow' : 'border-pop-black'}`}>
                  <img src={currentLine.avatar} alt="avatar" className="w-full h-full object-cover object-top scale-110" />
                </div>
              )}

              <div className={`px-4 md:px-6 py-1 md:py-2 pop-border border-4 text-xl md:text-2xl font-black italic -skew-x-6 text-pop-black mb-1 shadow-[2px_2px_0_#fff] ${currentLine.color === 'bg-white' ? 'bg-pop-yellow' : currentLine.color}`}>
                {displayName(currentLine.speaker!)}
                {currentLine.emotion && currentLine.emotion !== '默认' && (
                  <span className="ml-2 text-sm font-normal opacity-70">[{currentLine.emotion}]</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Text Box */}
        <PopCard
          className="h-full w-full relative clip-diagonal flex flex-col border-4 bg-pop-black border-white shadow-[8px_8px_0_#fff]"
          style={{ paddingTop: currentLine.type === 'narrator' ? '1.5rem' : '3.5rem' }}
        >
          <div className="absolute inset-0 bg-halftone opacity-[0.03] pointer-events-none"></div>

          <div
            className={`flex-1 overflow-y-auto hide-scrollbar text-xl md:text-[26px] font-bold leading-relaxed tracking-wide z-10 ${currentLine.type === 'thought' ? 'text-blue-400' : 'text-white'}`}
            style={{ willChange: 'contents' }}
          >
            {displayedText}
            {isTyping && <span className={`inline-block w-3 h-6 animate-pulse ml-1 align-middle ${currentLine.type === 'thought' ? 'bg-blue-400' : 'bg-white'}`}></span>}
          </div>

          <div className="flex justify-between items-end mt-4 z-10">
            <div className="flex gap-2 flex-wrap">
              <PopButton variant="ghost" size="sm" className="gap-2 bg-white/10 text-white hover:bg-white/20 pop-border border-white shadow-none" onClick={(e) => { e.stopPropagation(); setShowBacklog(true); }}>
                <History className="w-4 h-4" /> 历史记录
              </PopButton>
              <PopButton variant="ghost" size="sm" className="gap-2 bg-white/10 text-white hover:bg-white/20 pop-border border-white shadow-none" onClick={handlePrev} disabled={currentIndex === 0}>
                <ChevronLeft className="w-4 h-4" /> 上一句
              </PopButton>
              <PopButton
                variant="ghost"
                size="sm"
                className={`gap-2 pop-border border-white shadow-none ${isAutoMode ? 'bg-pop-pink text-white hover:bg-pop-pink/80' : 'bg-white/10 text-white hover:bg-white/20'}`}
                onClick={(e) => { e.stopPropagation(); setIsAutoMode(prev => !prev); }}
                title={isAutoMode ? '关闭 Auto 模式' : '开启 Auto 模式'}
              >
                {isAutoMode ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span className="hidden sm:inline">{isAutoMode ? 'Auto 开' : 'Auto'}</span>
              </PopButton>
              <PopButton
                variant="ghost"
                size="sm"
                className="gap-2 bg-white/10 text-white hover:bg-white/20 pop-border border-white shadow-none"
                onClick={(e) => {
                  e.stopPropagation();
                  setSpeedLevel(prev => {
                    if (prev === 1) return 2;
                    if (prev === 2) return 4;
                    return 1;
                  });
                }}
                title={`当前速度: ${speedLevel === 1 ? '普通' : speedLevel === 2 ? '倍速' : '极速'}`}
              >
                {speedLevel === 4 ? <Zap className="w-4 h-4 text-pop-yellow" /> : <FastForward className="w-4 h-4" />}
                <span className="hidden sm:inline">{speedLevel === 1 ? '普通' : speedLevel === 2 ? '倍速' : '极速'}</span>
              </PopButton>
              <PopButton
                variant="ghost"
                size="sm"
                className={`gap-2 pop-border border-white shadow-none ${isTextBoxHidden ? 'bg-pop-yellow text-pop-black hover:bg-pop-yellow/80' : 'bg-white/10 text-white hover:bg-white/20'}`}
                onClick={(e) => { e.stopPropagation(); setIsTextBoxHidden(prev => !prev); }}
                title={isTextBoxHidden ? '显示对话框' : '隐藏对话框'}
              >
                <span className="text-sm font-bold">{isTextBoxHidden ? '显' : '隐'}</span>
                <span className="hidden sm:inline">{isTextBoxHidden ? '显示文本' : '隐藏文本'}</span>
              </PopButton>
              {/* NSFW 阶段切换按钮 */}
              {nsfwEnabled && nsfwChar && (
                <PopButton
                  variant="ghost"
                  size="sm"
                  className="gap-2 bg-pop-pink text-white hover:bg-pop-pink/80 pop-border border-white shadow-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    const currentIdx = NSFW_PHASES.indexOf(nsfwPhase);
                    const nextIdx = (currentIdx + 1) % NSFW_PHASES.length;
                    setNsfwPhase(NSFW_PHASES[nextIdx]);
                  }}
                  title={`当前阶段: ${nsfwPhase}`}
                >
                  <span className="text-sm font-bold">{nsfwPhase}</span>
                  <span className="hidden sm:inline">切换</span>
                </PopButton>
              )}
            </div>
            {!isTyping && (
              <motion.div
                animate={{ x: [0, 8, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                <ChevronRight className="w-10 h-10 text-pop-yellow" />
              </motion.div>
            )}
          </div>
        </PopCard>
      </motion.div>
    )}
  </AnimatePresence>

  {/* 隐藏对话框时的底部收回按钮 */}
  <AnimatePresence>
    {isTextBoxHidden && (
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.25 }}
        onClick={() => setIsTextBoxHidden(false)}
        className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-md h-10 bg-pop-black/60 backdrop-blur-sm border-t-2 border-pop-yellow text-pop-yellow flex items-center justify-center hover:bg-pop-black/80 active:bg-pop-black transition-colors cursor-pointer"
        title="点击收回文本框"
      >
        <ChevronRight className="w-5 h-5 -rotate-90" />
        <span className="text-xs font-black ml-1">收回文本框</span>
        <ChevronRight className="w-5 h-5 -rotate-90" />
      </motion.button>
    )}
  </AnimatePresence>

      {/* Backlog Sidebar */}
      <AnimatePresence>
        {showBacklog && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-y-0 left-0 w-full md:w-[400px] bg-pop-black/95 backdrop-blur-md z-50 pop-border border-l-0 flex flex-col border-r-4 border-pop-cyan shadow-[10px_0_0_rgba(0,229,255,0.2)]"
          >
            <div className="p-4 bg-pop-cyan text-pop-black font-black text-2xl flex justify-between items-center clip-diagonal mx-2 mt-2 border-2 border-pop-black">
              <span>HISTORY LOG</span>
              <button onClick={() => setShowBacklog(false)} className="text-3xl hover:scale-110 active:scale-90 transition-transform">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {script.slice(0, currentIndex).map((log, idx) => (
                <div key={idx} className="space-y-2 border-b-2 border-pop-black pb-4 relative">
                  {log.type === 'narrator' ? (
                    <div className="text-white text-lg bg-white/5 p-3 clip-diagonal border border-white/10">{log.text}</div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        {log.avatar && <img src={log.avatar} alt="avatar" className="w-8 h-8 pop-border rounded-full object-cover object-top" />}
                        <div className={`font-black text-sm px-2 py-0.5 pop-border -skew-x-6 ${log.color === 'bg-white' ? 'bg-pop-yellow text-pop-black' : `${log.color} text-pop-black`}`}>
                          {displayName(log.speaker!)}
                          {log.emotion && log.emotion !== '默认' && (
                            <span className="ml-1 opacity-70">[{log.emotion}]</span>
                          )}
                        </div>
                      </div>
                      <div className={`text-lg font-bold pl-10 ${log.type === 'thought' ? 'text-blue-300' : 'text-white'}`}>
                        {log.text}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
