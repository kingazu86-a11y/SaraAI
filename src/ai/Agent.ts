import { AssistantState, Message, ToolCallData } from './AgentTypes';
import { ToolRegistry } from './ToolRegistry';
import { PromptManager } from './PromptManager';
import { logger } from '../utils/logger';

export class Agent {
  private registry: ToolRegistry;
  private maxSteps: number = 10;

  constructor() {
    this.registry = ToolRegistry.getInstance();
  }

  public setMaxSteps(steps: number) {
    this.maxSteps = Math.max(1, Math.min(steps, 20));
  }

  public parseModelResponse(rawText: string): {
    isToolCall: boolean;
    toolCall?: ToolCallData;
    textResponse?: string;
  } {
    try {
      // Look for ```json ... ``` or standalone JSON object
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || rawText.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.tool && typeof parsed.tool === 'string') {
          const validation = this.registry.validateToolCall(parsed.tool, parsed.arguments || {});
          if (validation.valid) {
            return {
              isToolCall: true,
              toolCall: {
                tool: parsed.tool,
                arguments: parsed.arguments || {},
              },
            };
          } else {
            logger.warn(`Model returned invalid tool arguments: ${validation.error}`);
          }
        }
      }
    } catch (e) {
      logger.debug('Response is natural language, not tool JSON');
    }

    // Clean markdown wrappers if any
    const cleanText = rawText.replace(/```[a-z]*\n?/g, '').trim();
    return {
      isToolCall: false,
      textResponse: cleanText,
    };
  }
}
