/**
 * 文档切块工具
 * 将长文本按指定大小切分成多个块
 */
export interface Chunk {
  index: number;
  content: string;
  charCount: number;
}

/**
 * 将文本切分成多个块
 * @param text 原始文本
 * @param chunkSize 每块最大字符数（默认 500）
 * @param overlap 块之间的重叠字符数（默认 50）
 */
export function chunkText(text: string, chunkSize = 500, overlap = 50): Chunk[] {
  if (!text || text.length === 0) return [];

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    // 尝试在句子边界切分（句号、换行等）
    if (end < text.length) {
      const lastBreak = findLastBreak(text, start, end);
      if (lastBreak > start + chunkSize * 0.3) {
        end = lastBreak + 1;
      }
    }

    const content = text.slice(start, end).trim();
    if (content.length > 0) {
      chunks.push({
        index,
        content,
        charCount: content.length,
      });
      index++;
    }

    // 下一块的起始位置（减去重叠）
    start = end - overlap;
    // 已处理到文本末尾，终止循环
    if (end >= text.length) break;
    // 防止死循环：start 必须向前推进
    if (start <= 0) break;
  }

  return chunks;
}

/** 在 [start, end] 范围内找最后一个断句符 */
function findLastBreak(text: string, start: number, end: number): number {
  const breakChars = ['。', '！', '？', '\n', '.', '!', '?', '；', ';'];
  let lastPos = -1;
  for (let i = end; i >= start + 100; i--) {
    if (breakChars.includes(text[i])) {
      lastPos = i;
      break;
    }
  }
  return lastPos;
}
