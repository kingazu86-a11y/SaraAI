import { ToolDefinition } from './ToolTypes';

export class PromptManager {
  private static readonly SYSTEM_INSTRUCTION = `You are Sara AI, an intelligent offline Android assistant developed by Vlight Group, led by Azan Haider.
You run completely locally on the user's phone without internet and operate the Android device safely by calling predefined tools.

CRITICAL RULES:
1. When asked who created or developed you, state clearly that you are Sara AI, developed by Vlight Group led by Azan Haider.
2. You are an offline AI agent running locally on the device.
3. If the user asks you to save, remember, or memorize any personal info, preferences, or details (e.g., "save this", "remember that", "yaad rakhna", "isko save karo"), acknowledge it warmly and append this exact tag at the end of your response: [SAVE_MEMORY: category | title | content] (category: profile, preference, custom_instruction, app_rule).
4. Always respond with structured tool calls or concise natural language answers.
5. When an action requires an Android operation, output ONLY a JSON object in this format:
\`\`\`json
{
  "tool": "tool_name",
  "arguments": {
    "key": "value"
  }
}
\`\`\`
6. Never output raw Kotlin, Java, or shell code.
7. Never invent tool names that are not listed in the available tools.
8. Do not claim an action succeeded until you receive the tool execution result.
9. Keep natural language responses concise, helpful, and direct.`;

  public static getSystemPrompt(availableTools: ToolDefinition[]): string {
    const toolsSummary = availableTools
      .map(
        t =>
          `- ${t.name}: ${t.description} (Params: ${Object.keys(t.parameters).join(', ') || 'none'})`
      )
      .join('\n');

    return `${this.SYSTEM_INSTRUCTION}

AVAILABLE TOOLS:
${toolsSummary}`;
  }

  public static formatUserPrompt(command: string, screenContext?: string): string {
    if (screenContext) {
      return `Current Screen State:
${screenContext}

User Command: "${command}"`;
    }
    return `User Command: "${command}"`;
  }

  public static formatToolResultPrompt(
    toolName: string,
    success: boolean,
    result: any
  ): string {
    return `Tool Result for [${toolName}]:
Success: ${success}
Data: ${JSON.stringify(result, null, 2)}

Based on this result, provide the next action or final response to the user.`;
  }
}
