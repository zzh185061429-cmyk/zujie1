import { CHARACTER_SPRITES, CHARACTER_AVATARS, CHARACTER_COLORS, getCharacterSprite } from '../data/characterData';

export type LineType = 'narrator' | 'dialog' | 'thought';

export interface ScriptLine {
  type: LineType;
  speaker?: string;
  emotion?: string;
  text: string;
  color?: string;
  avatar?: string;
  sprite?: string;
}

/** 11个有立绘的角色名 */
const NAMED_CHARS = Object.keys(CHARACTER_SPRITES);

/** 11角色带情绪:"对话" */
const DIALOG_RE = /^(.+?)\[(.+?)\]:\s*["""](.+)["""]\s*$/s;

/** 11角色带情绪:*独白* */
const THOUGHT_RE = /^(.+?)\[(.+?)\]:\s*\*(.+)\*\s*$/s;

/** 任意名字（无情绪）:"对话" — 玩家或其他NPC */
const PLAIN_DIALOG_RE = /^\s*(.+?)\s*:\s*["""](.+)["""]\s*$/s;

/** 任意名字（无情绪）:*独白* — 玩家或其他NPC */
const PLAIN_THOUGHT_RE = /^\s*(.+?)\s*:\s*\*(.+)\*\s*$/s;

/**
 * 需要从解析前移除的思维/规划标签对及其内容
 * [开始标记, 结束标记]
 */
const STRIP_PAIRS: [string, string][] = [
  ['<Chain_of_Thought>', '</Chain_of_Thought>'],
  ['<draft>', '</draft>'],
  ['<think>', '</think>'],
  ['<thinking>', '</thinking>'],
  // <konatan_planning~> 由 cutAboveKonatanEnd 特殊处理，不走正则删除
];

/** 转义正则特殊字符 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 在提取正文之前清理原始文本：
 * 1. 切掉 </konatan_planning~> 及之前的所有内容
 * 2. 删除所有思维/规划标签对及其内容
 *
 * 这样即使思维链内部出现了 <content> 也不会干扰正文提取
 */
function stripThinkingZones(raw: string): string {
  let text = raw;

  // ── 切掉 </konatan_planning~>（含）之前的所有内容 ──
  const konatanEnd = text.indexOf('</konatan_planning~>');
  if (konatanEnd !== -1) {
    text = text.slice(konatanEnd + '</konatan_planning~>'.length);
  }

  // ── 删除所有思维标签对 ──
  for (const [open, close] of STRIP_PAIRS) {
    const re = new RegExp(escapeRegExp(open) + '[\\s\\S]*?' + escapeRegExp(close), 'gi');
    text = text.replace(re, '');
  }

  return text;
}

/**
 * 从 AI 消息文本中提取 <content> 标签内的剧本内容，解析为 ScriptLine[]
 * 按换行切段，一行 = 一次点击推进
 * 11个角色带情绪，其他名字（含玩家）无情绪
 */
export function parseScriptContent(rawText: string): ScriptLine[] {
  const cleaned = stripThinkingZones(rawText);
  const contentMatch = cleaned.match(/<content>([\s\S]*?)<\/content>/);
  if (!contentMatch) return [];

  const content = contentMatch[1].trim();
  const segments = content.split(/\n/).filter(s => s.trim());

  return segments.map(segment => {
    const trimmed = segment.trim();

    // 1. 优先匹配11角色的带情绪对话：角色名[情绪]:"对话"
    const dialogMatch = trimmed.match(DIALOG_RE);
    if (dialogMatch) {
      const speaker = dialogMatch[1].trim();
      const emotion = dialogMatch[2].trim();
      if (NAMED_CHARS.includes(speaker)) {
        return {
          type: 'dialog' as const,
          speaker,
          emotion,
          text: dialogMatch[3],
          color: CHARACTER_COLORS[speaker] || 'bg-pop-cyan',
          avatar: CHARACTER_AVATARS[speaker],
          sprite: getCharacterSprite(speaker, emotion),
        };
      }
    }

    // 2. 优先匹配11角色的带情绪独白：角色名[情绪]:*独白*
    const thoughtMatch = trimmed.match(THOUGHT_RE);
    if (thoughtMatch) {
      const speaker = thoughtMatch[1].trim();
      const emotion = thoughtMatch[2].trim();
      if (NAMED_CHARS.includes(speaker)) {
        return {
          type: 'thought' as const,
          speaker,
          emotion,
          text: thoughtMatch[3],
          color: CHARACTER_COLORS[speaker] || 'bg-pop-cyan',
          avatar: CHARACTER_AVATARS[speaker],
          sprite: getCharacterSprite(speaker, emotion),
        };
      }
    }

    // 3. 匹配任意名字的无情绪对话：名字:"对话"（含玩家名）
    const plainDialogMatch = trimmed.match(PLAIN_DIALOG_RE);
    if (plainDialogMatch) {
      const speaker = plainDialogMatch[1].trim();
      return {
        type: 'dialog' as const,
        speaker,
        text: plainDialogMatch[2],
        color: CHARACTER_COLORS[speaker] || 'bg-pop-cyan',
        avatar: CHARACTER_AVATARS[speaker],
      };
    }

    // 4. 匹配任意名字的无情绪独白：名字:*独白*（含玩家名）
    const plainThoughtMatch = trimmed.match(PLAIN_THOUGHT_RE);
    if (plainThoughtMatch) {
      const speaker = plainThoughtMatch[1].trim();
      return {
        type: 'thought' as const,
        speaker,
        text: plainThoughtMatch[2],
        color: CHARACTER_COLORS[speaker] || 'bg-pop-cyan',
        avatar: CHARACTER_AVATARS[speaker],
      };
    }

    // 5. 旁白
    return { type: 'narrator' as const, text: trimmed };
  });
}
