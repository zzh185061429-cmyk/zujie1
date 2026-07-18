import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PopCard } from "../components/ui/PopCard";
import { PopButton } from "../components/ui/PopButton";
import { History, ChevronRight, ChevronLeft, Play, Pause, Zap, FastForward, Flame, SkipForward, SkipBack, ChevronUp, ChevronDown } from "lucide-react";
import { useToast } from "../components/ToastProvider";
import { useGameContext } from "../state/GameContext";
import { parseScriptContent, ScriptLine } from "./scriptParser";
import { getLocationBackground, preloadLocationBackgrounds, preloadScriptBackgrounds } from "../data/locationImages";
import { getNsfwData, hasNsfwData, canTriggerNsfw, getNsfwTriggerLocation } from "../data/characterData";
import { cn } from "../utils";

/** 将 <user> 替换为显示名 */
function displayName(name: string): string {
  return name === '<user>' ? '我' : name;
}

/** 打字机速度配置 */
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

  // ── 文本框收起状态 ──
  const [isTextBoxCollapsed, setIsTextBoxCollapsed] = useState(false);

  // 使用 ref 跟踪跳过状态，避免触发 effect 重新执行
  const skipTypingRef = useRef(false);

  const { showToast } = useToast();
  const {
    viewingFloorId, lastAssistantFloorId, currentLocation, gameTime,
    isNsfwMode, nsfwStageIndex, nsfwCharacter,
    enterNsfwMode, exitNsfwMode, nextNsfwStage, prevNsfwStage,
    unlockNsfw,
  } = useGameContext();

  // 读取指定楼层（或最新楼层）消息文本，解析 <content> 标签
  const targetFloorId = viewingFloorId ?? lastAssistantFloorId;

  // 获取当前 NSFW 阶段的背景图
  const nsfwBackgroundUrl = (() => {
    if (!isNsfwMode || !nsfwCharacter) return null;
    const data = getNsfwData(nsfwCharacter);
    if (!data) return null;
    const stage = data.stages[nsfwStageIndex];
    return stage?.imageUrl || null;
  })();

  // ── NSFW 相关逻辑 ──
  // 从 script 中检测所有角色名（包括当前和之前出现的角色）
  const currentSceneCharacters = (() => {
    const chars = new Set<string>();
    // 包含当前显示的角色
    sceneCharacters.forEach(c => chars.add(c.speaker));
    // 包含 script 中所有有立绘的角色（更全面地检测）
    script.forEach(line => {
      if (line.speaker && line.type !== 'narrator' && line.sprite) {
        chars.add(line.speaker);
      }
    });
    return Array.from(chars);
  })();

  // 判断是否可以显示 NSFW 按钮
  const canShowNsfwButton = (() => {
    if (isNsfwMode) return true; // NSFW 模式下始终显示（用于退出）
    return currentSceneCharacters.some(char => hasNsfwData(char));
  })();

  // 获取第一个可触发的角色名
  const getFirstNsfwCharacter = (): string | null => {
    for (const char of currentSceneCharacters) {
      if (hasNsfwData(char)) return char;
    }
    return null;
  };

  // 处理 NSFW 按钮点击
  const handleNsfwClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isNsfwMode) {
      exitNsfwMode();
      showToast('已退出 NSFW 模式', 'normal');
      return;
    }

    const targetChar = getFirstNsfwCharacter();
    if (!targetChar) return;

    if (!canTriggerNsfw(targetChar, currentLocation)) {
      const triggerLoc = getNsfwTriggerLocation(targetChar);
      showToast(`需要前往「${triggerLoc}」才能触发`, 'alert');
      return;
    }

    enterNsfwMode(targetChar);
    unlockNsfw(targetChar); // 解锁该角色的 NSFW CG
    showToast(`已进入 ${targetChar} 的特殊模式，CG 已解锁！点击「🔥 特殊模式」可退出`, 'normal');
  };

  // 获取当前 NSFW 阶段信息
  const nsfwData = nsfwCharacter ? getNsfwData(nsfwCharacter) : null;
  const currentStage = nsfwData?.stages[nsfwStageIndex];
  const hasNextStage = nsfwData ? nsfwStageIndex < nsfwData.stages.length - 1 : false;
  const hasPrevStage = nsfwStageIndex > 0;

  useEffect(() => {
    if (targetFloorId == null) return;
    try {
      const msg = getChatMessages(targetFloorId)[0];
      if (msg) {
        const parsed = parseScriptContent(msg.message);
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
    <div className="relative w-full h-full overflow-hidden font-sans">

      {/* 全屏背景层 — 固定不动 */}
      <div className="absolute inset-0 z-0">
        {(() => {
          // NSFW 模式下显示 CG 背景（全屏铺满）
          if (nsfwBackgroundUrl) {
            return (
              <img
                src={nsfwBackgroundUrl}
                alt={`NSFW CG ${nsfwStageIndex + 1}`}
                className="w-full h-full object-cover"
                style={{ willChange: 'transform' }}
                decoding="async"
              />
            );
          }
          // 正常模式显示地点背景
          const bgUrl = getLocationBackground(currentLocation, gameTime.getHours());
          if (bgUrl) {
            return (
              <img
                src={bgUrl}
                alt={currentLocation}
                className="w-full h-full object-cover"
                style={{ willChange: 'transform' }}
                decoding="async"
              />
            );
          }
          // 如果没有找到背景图，显示黑色背景+地点名称提示
          return (
            <div className="w-full h-full bg-pop-black flex items-center justify-center">
              <div className="text-white/30 text-2xl font-black">
                {currentLocation || '未知地点'}
              </div>
            </div>
          );
        })()}
      </div>

      {/* 底部渐变遮罩 — 让文本更易读 */}
      <div className="absolute inset-0 bg-linear-to-t from-pop-black via-transparent to-transparent z-10 pointer-events-none"></div>

      {/* Sprite Area — z-15（立绘层，在背景之上，对话框之下） */}
      <div className="absolute inset-0 z-15 pointer-events-none overflow-hidden">
        <AnimatePresence mode="popLayout">
          {!isNsfwMode && sceneCharacters.map((char) => (
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

      {/* Text Box Area — 绝对定位悬浮在底部 */}
      <AnimatePresence mode="wait">
        {isTextBoxCollapsed ? (
          <motion.div
            key="collapsed"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-4 right-4 z-30"
          >
            <button
              onClick={() => setIsTextBoxCollapsed(false)}
              className="p-2 bg-pop-black/90 border-2 border-pop-pink text-white hover:bg-pop-pink transition-colors clip-diagonal shadow-pop-pink"
              title="展开文本框"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-0 left-0 right-0 z-20 p-4 md:p-8 cursor-pointer"
            onClick={handleNext}
          >
            {/* 折叠按钮 */}
            <div className="absolute -top-3 right-6 md:right-12 z-40">
              <button
                onClick={(e) => { e.stopPropagation(); setIsTextBoxCollapsed(true); }}
                className="p-1 bg-pop-black/70 text-white hover:bg-pop-pink transition-colors clip-diagonal border border-white/30"
                title="折叠文本框"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

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
            <div
              className="h-full w-full relative flex flex-col p-4"
              style={{ paddingTop: currentLine.type === 'narrator' ? '1.5rem' : '3.5rem' }}
            >

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
                  {/* NSFW 按钮 */}
                  {canShowNsfwButton && (
                    <PopButton
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "gap-2 pop-border border-white shadow-none font-black",
                        isNsfwMode
                          ? "bg-pop-pink text-white hover:bg-pop-pink/80 animate-pulse"
                          : "bg-red-500 text-white hover:bg-red-600"
                      )}
                      onClick={handleNsfwClick}
                      title={isNsfwMode ? "点击退出特殊模式" : "点击进入特殊模式"}
                    >
                      <Flame className={cn("w-4 h-4", isNsfwMode && "animate-bounce")} />
                      <span className="hidden sm:inline">{isNsfwMode ? '🔥 特殊模式' : '特殊模式'}</span>
                    </PopButton>
                  )}
                  {/* NSFW 阶段切换按钮（仅在 NSFW 模式下显示） */}
                  {isNsfwMode && (
                    <>
                      <PopButton
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "gap-2 pop-border border-white shadow-none",
                          hasPrevStage ? "bg-pop-cyan text-pop-black hover:bg-pop-yellow" : "bg-gray-600 text-gray-400 cursor-not-allowed"
                        )}
                        onClick={(e) => { e.stopPropagation(); prevNsfwStage(); }}
                        disabled={!hasPrevStage}
                        title="上一阶段"
                      >
                        <SkipBack className="w-4 h-4" />
                      </PopButton>
                      <PopButton
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "gap-2 pop-border border-white shadow-none",
                          hasNextStage ? "bg-pop-cyan text-pop-black hover:bg-pop-yellow" : "bg-gray-600 text-gray-400 cursor-not-allowed"
                        )}
                        onClick={(e) => { e.stopPropagation(); nextNsfwStage(); }}
                        disabled={!hasNextStage}
                        title="下一阶段"
                      >
                        <SkipForward className="w-4 h-4" />
                      </PopButton>
                      {currentStage && (
                        <span className="text-xs text-pop-pink font-bold self-center whitespace-nowrap">
                          {nsfwStageIndex + 1}/{nsfwData?.stages.length} {currentStage.label}
                        </span>
                      )}
                    </>
                  )}
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
            </div>
          </motion.div>
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
