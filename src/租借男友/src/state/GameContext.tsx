import React, { createContext, useContext, useState, useCallback } from 'react';

export type CurrentOrder = {
  charName: string;
  task: string;
  durationString?: string;
  price?: number;
  scheduledTime?: number;
  durationMinutes?: number;
  /** 撞单：每个角色的名字和原始服务时长（分钟），用于渲染独立进度条 */
  crashChars?: Array<{ name: string; totalMinutes: number }>;
} | null;

/** 与 MVU schema 一致的三种服务状态 */
export type CharacterServiceState = {
  剩余服务小时: number;
  剩余服务分钟: number;
  服务状态: '无服务' | '未开始' | '进行中';
};

/** MVU stat_data.今日派单 原始字段 */
export type MvuDispatchData = {
  模式?: string;
  客户1?: string;
  客户2?: string;
  任务类型1?: string;
  任务类型2?: string;
  预约时间1?: string;
  服务时长1?: number;
  价格1?: number;
  预约时间2?: string;
  服务时长2?: number;
  价格2?: number;
  任务描述?: string;
};

type GameContextType = {
  currentOrder: CurrentOrder;
  setCurrentOrder: (order: CurrentOrder) => void;
  isCalendarOpen: boolean;
  setIsCalendarOpen: (v: boolean) => void;
  isMapOpen: boolean;
  setIsMapOpen: (v: boolean) => void;
  totalDebt: number;
  totalIncome: number;
  remainingDebt: number;
  isEyeCareMode: boolean;
  setIsEyeCareMode: (v: boolean) => void;
  gameTime: Date;
  currentWeekday: string;
  currentLocation: string;
  characterServiceStates: Record<string, CharacterServiceState>;
  /** 接受派单：写入今日派单 + 角色状态到 MVU，同时更新 React state */
  acceptDispatch: (order: CurrentOrder, dispatch: MvuDispatchData) => Promise<void>;
  /** 地图/派单写入待发送文本到前端输入栏 */
  pendingMessage: string;
  setPendingMessage: (msg: string) => void;
  // ── 虚拟楼层导航 ──
  /** null = 跟随最新楼层；number = 查看指定楼层 */
  viewingFloorId: number | null;
  setViewingFloor: (floorId: number | null) => void;
  /** 最新 assistant 楼层号（用于 StoryView 默认数据源 + MVU 变量读取） */
  lastAssistantFloorId: number | null;
  /** 是否正在查看历史楼层（而非最新） */
  isViewingHistory: boolean;
  /** 回到最新楼层 */
  goToLatest: () => void;
  /** 是否正在生成新楼层 */
  isGenerating: boolean;
  /** 正在生成的目标楼层号（生成完成后才暴露） */
  generatingFloorId: number | null;
  /** 开始生成：锁定当前画面 */
  startGenerating: () => void;
  /** 结束生成：解锁 */
  finishGenerating: () => void;
};

const GameContext = createContext<GameContextType | undefined>(undefined);

// ── 解析工具函数 ──

function parseMvuTime(variables: Mvu.MvuData): Date | null {
  const timeStr = _.get(variables, 'stat_data.时间.当前日期时间');
  if (!timeStr || typeof timeStr !== 'string') return null;
  const m = timeStr.match(/(\d+)月(\d+)日\s+(\d+):(\d+)/);
  if (!m) return null;
  return new Date(2026, parseInt(m[1]) - 1, parseInt(m[2]), parseInt(m[3]), parseInt(m[4]));
}

function parseMvuTimeStr(timeStr: string): Date | null {
  const m = timeStr.match(/(\d+)月(\d+)日\s+(\d+):(\d+)/);
  if (!m) return null;
  return new Date(2026, parseInt(m[1]) - 1, parseInt(m[2]), parseInt(m[3]), parseInt(m[4]));
}

function parseMvuWeekday(variables: Mvu.MvuData): string {
  const weekday = _.get(variables, 'stat_data.时间.当前星期');
  return typeof weekday === 'string' ? weekday : '';
}

function parseMvuLocation(variables: Mvu.MvuData): string {
  const loc = _.get(variables, 'stat_data.状态.当前地点');
  return typeof loc === 'string' ? loc : '';
}

function parseMvuEconomy(variables: Mvu.MvuData) {
  const debt = _.get(variables, 'stat_data.经济.总债务');
  const income = _.get(variables, 'stat_data.经济.累计收入');
  const remain = _.get(variables, 'stat_data.经济.剩余债务');
  return {
    totalDebt: typeof debt === 'number' ? debt : 300_000_000,
    totalIncome: typeof income === 'number' ? income : 0,
    remainingDebt: typeof remain === 'number' ? remain : 300_000_000,
  };
}

function parseMvuCharacterStates(variables: Mvu.MvuData): Record<string, CharacterServiceState> {
  const charData = _.get(variables, 'stat_data.角色数据');
  if (!charData || typeof charData !== 'object') return {};
  const result: Record<string, CharacterServiceState> = {};
  for (const [name, data] of Object.entries(charData as Record<string, any>)) {
    if (!data || typeof data !== 'object') continue;
    const status = data.服务状态;
    result[name] = {
      剩余服务小时: typeof data.剩余服务小时 === 'number' ? data.剩余服务小时 : 0,
      剩余服务分钟: typeof data.剩余服务分钟 === 'number' ? data.剩余服务分钟 : 0,
      服务状态: status === '未开始' || status === '进行中' ? status : '无服务',
    };
  }
  return result;
}

function parseMvuDispatch(variables: Mvu.MvuData): MvuDispatchData {
  const dispatch = _.get(variables, 'stat_data.今日派单');
  if (!dispatch || typeof dispatch !== 'object') return {};
  return {
    模式: typeof dispatch.模式 === 'string' ? dispatch.模式 : undefined,
    客户1: typeof dispatch.客户1 === 'string' ? dispatch.客户1 : undefined,
    客户2: typeof dispatch.客户2 === 'string' ? dispatch.客户2 : undefined,
    任务类型1: typeof dispatch.任务类型1 === 'string' ? dispatch.任务类型1 : undefined,
    任务类型2: typeof dispatch.任务类型2 === 'string' ? dispatch.任务类型2 : undefined,
    预约时间1: typeof dispatch.预约时间1 === 'string' ? dispatch.预约时间1 : undefined,
    服务时长1: typeof dispatch.服务时长1 === 'number' ? dispatch.服务时长1 : undefined,
    价格1: typeof dispatch.价格1 === 'number' ? dispatch.价格1 : undefined,
    预约时间2: typeof dispatch.预约时间2 === 'string' ? dispatch.预约时间2 : undefined,
    服务时长2: typeof dispatch.服务时长2 === 'number' ? dispatch.服务时长2 : undefined,
    价格2: typeof dispatch.价格2 === 'number' ? dispatch.价格2 : undefined,
    任务描述: typeof dispatch.任务描述 === 'string' ? dispatch.任务描述 : undefined,
  };
}

/** 从今日派单推导 CurrentOrder（供 HUD 显示） */
function deriveCurrentOrder(dispatch: MvuDispatchData): CurrentOrder {
  if (!dispatch.客户1 || dispatch.客户1 === '待定'
      || !dispatch.任务类型1 || dispatch.任务类型1 === '待定') {
    return null;
  }
  const isCrash = dispatch.模式 === '撞单' && dispatch.客户2 && dispatch.客户2 !== '无';
  const scheduled = dispatch.预约时间1 ? parseMvuTimeStr(dispatch.预约时间1) : null;
  return {
    charName: isCrash ? `${dispatch.客户1} & ${dispatch.客户2}` : dispatch.客户1,
    task: isCrash ? '修罗场并行' : dispatch.任务类型1,
    durationString: dispatch.服务时长1 ? `${dispatch.服务时长1} 小时` : undefined,
    price: (dispatch.价格1 || 0) + (isCrash ? (dispatch.价格2 || 0) : 0),
    scheduledTime: scheduled ? scheduled.getTime() : undefined,
    durationMinutes: (dispatch.服务时长1 || 0) * 60,
    crashChars: isCrash ? [
      { name: dispatch.客户1!, totalMinutes: (dispatch.服务时长1 || 0) * 60 },
      { name: dispatch.客户2!, totalMinutes: (dispatch.服务时长2 || 0) * 60 },
    ] : undefined,
  };
}

// ── 服务状态机辅助 ──

function getScheduledTimeForChar(dispatch: MvuDispatchData, charName: string): Date | null {
  if (dispatch.客户1 === charName && dispatch.预约时间1) return parseMvuTimeStr(dispatch.预约时间1);
  if (dispatch.客户2 === charName && dispatch.预约时间2) return parseMvuTimeStr(dispatch.预约时间2);
  return null;
}

function getServiceHoursForChar(dispatch: MvuDispatchData, charName: string): number {
  if (dispatch.客户1 === charName && typeof dispatch.服务时长1 === 'number') return dispatch.服务时长1;
  if (dispatch.客户2 === charName && typeof dispatch.服务时长2 === 'number') return dispatch.服务时长2;
  return 0;
}

/** 空白的今日派单（服务结束后复位用） */
const EMPTY_DISPATCH: MvuDispatchData = {
  模式: '单人', 客户1: '待定', 客户2: '无',
  任务类型1: '待定', 任务类型2: '无',
  预约时间1: '', 服务时长1: 0, 价格1: 0,
  预约时间2: '', 服务时长2: 0, 价格2: 0,
  任务描述: '待生成',
};

// ── Provider ──

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [currentOrder, setCurrentOrder] = useState<CurrentOrder>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isEyeCareMode, setIsEyeCareMode] = useState(false);

  const [gameTime, setGameTime] = useState<Date>(new Date(2026, 9, 8, 8, 0, 0));
  const [currentWeekday, setCurrentWeekday] = useState('');
  const [currentLocation, setCurrentLocation] = useState('沈家别墅');

  const [totalDebt, setTotalDebt] = useState(300_000_000);
  const [totalIncome, setTotalIncome] = useState(0);
  const [remainingDebt, setRemainingDebt] = useState(300_000_000);

  const [characterServiceStates, setCharacterServiceStates] = useState<Record<string, CharacterServiceState>>({});

  // ── 前端输入栏文本管道：地图/派单写入，ChatBar 消费 ──
  const [pendingMessage, setPendingMessage] = useState('');

  // ── 虚拟楼层导航 ──
  const [viewingFloorId, setViewingFloor] = useState<number | null>(null);
  const [lastAssistantFloorId, setLastAssistantFloorId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingFloorId, setGeneratingFloorId] = useState<number | null>(null);
  const isViewingHistory = viewingFloorId !== null;
  const goToLatest = useCallback(() => setViewingFloor(null), []);

  /** 开始生成：记录当前画面楼层并锁定 */
  const startGenerating = useCallback(() => {
    // 记录当前正在查看的楼层（如果是跟随最新，则记录 lastAssistantFloorId）
    const currentFloor = viewingFloorId ?? lastAssistantFloorId;
    if (currentFloor != null) {
      setViewingFloor(currentFloor);
    }
    setIsGenerating(true);
    // generatingFloorId 在生成完成后由轮询逻辑设置
    console.info('[GameContext] 开始生成，锁定画面到楼层', currentFloor);
  }, [viewingFloorId, lastAssistantFloorId]);

  /** 结束生成：解锁，记录新生成的楼层号 */
  const finishGenerating = useCallback(() => {
    setIsGenerating(false);
    // 获取最新 assistant 楼层作为 generatingFloorId
    try {
      const lastId = getLastMessageId();
      if (lastId != null) {
        const msg = getChatMessages(lastId)[0];
        if (msg && msg.role === 'assistant') {
          setGeneratingFloorId(msg.message_id);
        } else if (lastId > 0) {
          const prev = getChatMessages(lastId - 1)[0];
          if (prev && prev.role === 'assistant') {
            setGeneratingFloorId(prev.message_id);
          }
        }
      }
    } catch {
      // 忽略错误
    }
    console.info('[GameContext] 生成完成');
  }, []);

  // ── MVU 同步 + 服务状态机 ──
  React.useEffect(() => {
    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let eventStop: EventOnReturn | null = null;

    /** 获取最新 assistant 楼层号 */
    function getLatestAssistantId(): number | null {
      try {
        const lastId = getLastMessageId();
        if (lastId == null) return null;
        // getLastMessageId 返回的是最新楼层（可能是 user 或 assistant）
        // 我们需要往回找到 assistant
        const msg = getChatMessages(lastId)[0];
        if (!msg) return null;
        if (msg.role === 'assistant') return msg.message_id;
        // 如果最新是 user，往前找
        if (lastId > 0) {
          const prev = getChatMessages(lastId - 1)[0];
          if (prev && prev.role === 'assistant') return prev.message_id;
        }
        return lastId;
      } catch {
        return null;
      }
    }

    const syncFromMvu = async () => {
      if (cancelled) return;
      try {
        // ── MVU 数据始终从最新 assistant 楼层读取 ──
        const mvuMsgId = getLatestAssistantId();
        if (mvuMsgId == null) return;

        const variables = Mvu.getMvuData({ type: 'message', message_id: mvuMsgId });

        // ── 跟踪最新 assistant 楼层号 ──
        // 生成中不更新 lastAssistantFloorId，避免画面跳转
        if (!isGenerating) {
          setLastAssistantFloorId(mvuMsgId);
        } else {
          // 生成中但发现新楼层已完成（mvuMsgId 比 generatingFloorId 大）
          // 说明生成完成了
          const currentGenId = generatingFloorId;
          if (currentGenId == null || mvuMsgId > currentGenId) {
            // 新楼层已生成，更新 generatingFloorId 但不自动跳转画面
            setGeneratingFloorId(mvuMsgId);
          }
        }

        const now = parseMvuTime(variables);
        const dispatch = parseMvuDispatch(variables);
        let needsWrite = false;

        // ── 服务状态机：未开始 → 进行中 ──
        const charData = _.get(variables, 'stat_data.角色数据') || {};
        for (const [name, state] of Object.entries(charData as Record<string, any>)) {
          if (!state || typeof state !== 'object') continue;

          if (state.服务状态 === '未开始' && now) {
            const scheduled = getScheduledTimeForChar(dispatch, name);
            if (scheduled && now >= scheduled) {
              state.服务状态 = '进行中';
              console.info(`[状态机] ${name} 未开始 → 进行中`);
              needsWrite = true;
            }
          }
        }

        // ── 服务状态机：进行中 → 递减剩余时间 / → 无服务 ──
        for (const [name, state] of Object.entries(charData as Record<string, any>)) {
          if (!state || typeof state !== 'object') continue;

          if (state.服务状态 === '进行中' && now) {
            const scheduled = getScheduledTimeForChar(dispatch, name);
            const serviceHours = getServiceHoursForChar(dispatch, name);
            if (scheduled && serviceHours > 0) {
              const elapsedMin = (now.getTime() - scheduled.getTime()) / 60000;
              const remainingMin = Math.max(0, serviceHours * 60 - elapsedMin);
              const newHours = Math.floor(remainingMin / 60);
              const newMins = Math.floor(remainingMin % 60);

              if (state.剩余服务小时 !== newHours || state.剩余服务分钟 !== newMins) {
                state.剩余服务小时 = newHours;
                state.剩余服务分钟 = newMins;
                needsWrite = true;
              }

              if (remainingMin <= 0) {
                state.服务状态 = '无服务';
                state.剩余服务小时 = 0;
                state.剩余服务分钟 = 0;
                console.info(`[状态机] ${name} 进行中 → 无服务（时间耗尽）`);
                needsWrite = true;
              }
            }
          }
        }

        // 撞单安全：仅当所有涉及角色都不在「进行中」时才复位今日派单
        const dispatchChars = [dispatch.客户1, dispatch.客户2].filter(c => c && c !== '待定' && c !== '无');
        const anyActive = dispatchChars.some(name => {
          const s = charData[name];
          return s && s.服务状态 === '进行中';
        });
        const anyFinished = dispatchChars.some(name => {
          const s = charData[name];
          return s && s.服务状态 === '无服务';
        });
        if (!anyActive && anyFinished) {
          const sd = _.get(variables, 'stat_data');
          if (sd) sd.今日派单 = { ...EMPTY_DISPATCH };
          console.info('[状态机] 全部服务结束，复位今日派单');
          needsWrite = true;
        }

        if (needsWrite) {
          await Mvu.replaceMvuData(variables, { type: 'message', message_id: mvuMsgId });
        }

        // ── 更新 React state ──
        if (now) setGameTime(now);
        setCurrentWeekday(parseMvuWeekday(variables));
        setCurrentLocation(parseMvuLocation(variables));
        const economy = parseMvuEconomy(variables);
        setTotalDebt(economy.totalDebt);
        setTotalIncome(economy.totalIncome);
        setRemainingDebt(economy.remainingDebt);
        const charStates = parseMvuCharacterStates(variables);
        setCharacterServiceStates(charStates);
        // 从 MVU 推导 currentOrder
        setCurrentOrder(deriveCurrentOrder(dispatch));
      } catch {
        // MVU 尚未就绪
      }
    };

    async function initSync() {
      try {
        await waitGlobalInitialized('Mvu');
        if (cancelled) return;
        await syncFromMvu();
        pollInterval = setInterval(syncFromMvu, 2000);
        eventStop = eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, () => {
          syncFromMvu();
        });
      } catch {
        // MVU 不可用，保持默认值
      }
    }

    initSync();

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
      if (eventStop) eventStop.stop();
    };
  }, []);

  // ── 接受派单：前端确认 → 写入 MVU（写到最新 assistant 楼层） ──
  const acceptDispatch = useCallback(async (order: CurrentOrder, dispatchData: MvuDispatchData) => {
    const msgId = lastAssistantFloorId;
    if (msgId == null) return;
    const variables = Mvu.getMvuData({ type: 'message', message_id: msgId });
    const sd = _.get(variables, 'stat_data');
    if (!sd) return;

    sd.今日派单 = dispatchData;

    if (dispatchData.客户1 && dispatchData.客户1 !== '待定') {
      _.set(sd, `角色数据.${dispatchData.客户1}.服务状态`, '未开始');
      _.set(sd, `角色数据.${dispatchData.客户1}.剩余服务小时`, dispatchData.服务时长1 || 0);
      _.set(sd, `角色数据.${dispatchData.客户1}.剩余服务分钟`, 0);
    }
    if (dispatchData.客户2 && dispatchData.客户2 !== '无') {
      _.set(sd, `角色数据.${dispatchData.客户2}.服务状态`, '未开始');
      _.set(sd, `角色数据.${dispatchData.客户2}.剩余服务小时`, dispatchData.服务时长2 || 0);
      _.set(sd, `角色数据.${dispatchData.客户2}.剩余服务分钟`, 0);
    }

    // 接单时结算收入，剩余债务由 schema transform 自动更新
    const currentIncome = typeof sd.经济?.累计收入 === 'number' ? sd.经济.累计收入 : 0;
    _.set(sd, '经济.累计收入', currentIncome + (dispatchData.价格1 || 0) + (dispatchData.价格2 || 0));

    await Mvu.replaceMvuData(variables, { type: 'message', message_id: msgId });

    setCurrentOrder(order);
    setCharacterServiceStates(parseMvuCharacterStates(variables));
    console.info(`[acceptDispatch] 写入 MVU: ${dispatchData.客户1} 未开始, ${dispatchData.服务时长1}h`);
  }, []);

  return (
    <GameContext.Provider value={{
      currentOrder, setCurrentOrder,
      isCalendarOpen, setIsCalendarOpen,
      isMapOpen, setIsMapOpen,
      totalDebt, totalIncome, remainingDebt,
      isEyeCareMode, setIsEyeCareMode,
      gameTime, currentWeekday, currentLocation,
      characterServiceStates,
      acceptDispatch,
      pendingMessage, setPendingMessage,
      viewingFloorId, setViewingFloor,
      lastAssistantFloorId,
      isViewingHistory,
      goToLatest,
      isGenerating,
      generatingFloorId,
      startGenerating,
      finishGenerating,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGameContext() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGameContext must be used within GameProvider');
  return ctx;
}