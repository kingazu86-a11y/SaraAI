import { MathFormatter } from '../../../utils/MathFormatter';

export type ContentBlockType =
  | 'code'
  | 'math_block'
  | 'heading'
  | 'list'
  | 'paragraph';

export interface CodeBlockData {
  type: 'code';
  language: string;
  code: string;
}

export interface MathBlockData {
  type: 'math_block';
  raw: string;
  formatted: string;
}

export interface HeadingBlockData {
  type: 'heading';
  level: 1 | 2 | 3;
  text: string;
}

export interface ListItemData {
  number?: string;
  text: string;
}

export interface ListBlockData {
  type: 'list';
  listType: 'bullet' | 'number';
  items: ListItemData[];
}

export interface ParagraphBlockData {
  type: 'paragraph';
  text: string;
}

export type ContentBlock =
  | CodeBlockData
  | MathBlockData
  | HeadingBlockData
  | ListBlockData
  | ParagraphBlockData;

export class MarkdownParser {
  /**
   * Parses markdown text into structured content blocks.
   * Fully streaming-aware: unclosed code blocks (```) and math blocks ($$)
   * render immediately in their dedicated containers as characters stream in.
   */
  public static parse(content: string): ContentBlock[] {
    if (!content) return [];

    const blocks: ContentBlock[] = [];

    // 1. Check for unclosed streaming code block at the end of content
    let completedContent = content;
    let streamingCodeBlock: CodeBlockData | null = null;

    // Count occurrences of ```
    const codeDelimiters = content.match(/```/g);
    if (codeDelimiters && codeDelimiters.length % 2 === 1) {
      // Odd number of ``` means the last one is still open and streaming!
      const lastCodeIdx = content.lastIndexOf('```');
      const inner = content.slice(lastCodeIdx + 3);
      completedContent = content.slice(0, lastCodeIdx);

      const firstNewline = inner.indexOf('\n');
      let language = '';
      let code = inner;
      if (firstNewline !== -1) {
        language = inner.slice(0, firstNewline).trim().toLowerCase();
        code = inner.slice(firstNewline + 1);
      } else {
        // First line still being typed, might be language identifier
        language = inner.trim().toLowerCase();
        code = '';
      }

      streamingCodeBlock = {
        type: 'code',
        language: language || 'code',
        code: code.replace(/\r\n/g, '\n'),
      };
    }

    // 2. Separate completed code blocks
    const codeRegex = /(```[\s\S]*?```)/g;
    const segments = completedContent.split(codeRegex);

    for (const segment of segments) {
      if (!segment) continue;

      if (segment.startsWith('```') && segment.endsWith('```')) {
        const inner = segment.slice(3, -3);
        const firstNewline = inner.indexOf('\n');
        let language = '';
        let code = inner;

        if (firstNewline !== -1) {
          language = inner.slice(0, firstNewline).trim().toLowerCase();
          code = inner.slice(firstNewline + 1);
        }

        blocks.push({
          type: 'code',
          language: language || 'code',
          code: code.replace(/\r\n/g, '\n').trimEnd(),
        });
      } else {
        this.parseTextSegment(segment, blocks);
      }
    }

    // 3. Append streaming code block at the end if present
    if (streamingCodeBlock) {
      blocks.push(streamingCodeBlock);
    }

    return blocks;
  }

  private static parseTextSegment(text: string, blocks: ContentBlock[]): void {
    // 1. Check for unclosed streaming math block ($$)
    let completedMathText = text;
    let streamingMathBlock: MathBlockData | null = null;

    const mathDelimiters = text.match(/\$\$/g);
    if (mathDelimiters && mathDelimiters.length % 2 === 1) {
      const lastMathIdx = text.lastIndexOf('$$');
      const raw = text.slice(lastMathIdx + 2);
      completedMathText = text.slice(0, lastMathIdx);

      streamingMathBlock = {
        type: 'math_block',
        raw,
        formatted: MathFormatter.format(raw),
      };
    }

    // 2. Split on completed block math
    const blockMathRegex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\])/g;
    const mathSegments = completedMathText.split(blockMathRegex);

    for (const mSeg of mathSegments) {
      if (!mSeg) continue;

      if (
        (mSeg.startsWith('$$') && mSeg.endsWith('$$') && mSeg.length > 4) ||
        (mSeg.startsWith('\\[') && mSeg.endsWith('\\]') && mSeg.length > 4)
      ) {
        blocks.push({
          type: 'math_block',
          raw: mSeg,
          formatted: MathFormatter.format(mSeg),
        });
        continue;
      }

      // Process normal text lines
      const lines = mSeg.split(/\r?\n/);
      let currentList: ListBlockData | null = null;
      let currentParagraphLines: string[] = [];

      const flushParagraph = () => {
        if (currentParagraphLines.length > 0) {
          const joined = currentParagraphLines.join('\n').trim();
          if (joined.length > 0) {
            blocks.push({
              type: 'paragraph',
              text: joined,
            });
          }
          currentParagraphLines = [];
        }
      };

      const flushList = () => {
        if (currentList && currentList.items.length > 0) {
          blocks.push(currentList);
          currentList = null;
        }
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) {
          // Check if the next non-empty line continues the same list type
          let continuesList = false;
          if (currentList) {
            for (let j = i + 1; j < lines.length; j++) {
              const nextTrimmed = lines[j].trim();
              if (!nextTrimmed) continue;
              if (currentList.listType === 'bullet' && /^[-*+]\s+/.test(nextTrimmed)) {
                continuesList = true;
              } else if (currentList.listType === 'number' && /^\d+[.)]\s+/.test(nextTrimmed)) {
                continuesList = true;
              }
              break;
            }
          }

          if (!continuesList) {
            flushList();
            flushParagraph();
          }
          continue;
        }

        // Check for Headings: #, ##, ###
        const hMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if (hMatch) {
          flushList();
          flushParagraph();
          const level = hMatch[1].length as 1 | 2 | 3;
          blocks.push({
            type: 'heading',
            level,
            text: hMatch[2].trim(),
          });
          continue;
        }

        // Check for Bullet Lists: - item, * item, + item
        const bMatch = trimmed.match(/^[-*+]\s+(.+)$/);
        if (bMatch) {
          flushParagraph();
          if (!currentList || currentList.listType !== 'bullet') {
            flushList();
            currentList = {
              type: 'list',
              listType: 'bullet',
              items: [],
            };
          }
          currentList.items.push({ text: bMatch[1].trim() });
          continue;
        }

        // Check for Numbered Lists: 1. item, 2. item
        const nMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
        if (nMatch) {
          flushParagraph();
          if (!currentList || currentList.listType !== 'number') {
            flushList();
            currentList = {
              type: 'list',
              listType: 'number',
              items: [],
            };
          }
          currentList.items.push({
            number: nMatch[1],
            text: nMatch[2].trim(),
          });
          continue;
        }

        // Regular paragraph line
        flushList();
        currentParagraphLines.push(line);
      }

      flushList();
      flushParagraph();
    }

    if (streamingMathBlock) {
      blocks.push(streamingMathBlock);
    }
  }
}
