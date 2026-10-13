import { AssistantState, Message, ToolCallData, ToolResultData } from '../ai/AgentTypes';
import { ToolRegistry } from '../ai/ToolRegistry';
import { PromptManager } from '../ai/PromptManager';
import { Agent } from '../ai/Agent';
import { AssistantNative } from '../native/AssistantNative';
import { logger } from '../utils/logger';

export class AssistantService {
  private agent: Agent;
  private registry: ToolRegistry;

  constructor() {
    this.agent = new Agent();
    this.registry = ToolRegistry.getInstance();
  }

  public async executeTool(toolCall: ToolCallData): Promise<ToolResultData> {
    logger.info(`Executing tool: ${toolCall.tool}`, toolCall.arguments);

    switch (toolCall.tool) {
      case 'open_app': {
        const pkg = toolCall.arguments.packageName;
        const res = await AssistantNative.openApp(pkg);
        return {
          tool: toolCall.tool,
          success: res.success,
          result: `Launched ${pkg}`,
          error: res.error,
        };
      }

      case 'get_installed_apps': {
        const apps = await AssistantNative.getInstalledApps();
        return {
          tool: toolCall.tool,
          success: true,
          result: apps.map(a => `${a.appName} (${a.packageName})`),
        };
      }

      case 'open_settings': {
        await AssistantNative.openAccessibilitySettings();
        return {
          tool: toolCall.tool,
          success: true,
          result: 'Opened System Settings',
        };
      }

      default: {
        // Fallback simulation for offline phase 1 tools
        logger.info(`Tool ${toolCall.tool} simulated successfully`);
        return {
          tool: toolCall.tool,
          success: true,
          result: `Executed ${toolCall.tool} with parameters ${JSON.stringify(toolCall.arguments)}`,
        };
      }
    }
  }
}
