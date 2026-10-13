import { PREDEFINED_TOOLS, ToolDefinition } from './ToolTypes';
import { logger } from '../utils/logger';

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, ToolDefinition> = new Map();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  private registerDefaults(): void {
    Object.values(PREDEFINED_TOOLS).forEach(tool => {
      this.tools.set(tool.name, tool);
    });
  }

  public getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  public getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getToolSchemaJson(): string {
    const schemas = this.getAllTools().map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
    return JSON.stringify(schemas, null, 2);
  }

  public validateToolCall(
    toolName: string,
    args: Record<string, any>
  ): { valid: boolean; error?: string } {
    const tool = this.getTool(toolName);
    if (!tool) {
      logger.warn(`Tool not found: ${toolName}`);
      return { valid: false, error: `Tool '${toolName}' is not recognized in registry.` };
    }

    // Validate required parameters
    for (const [paramName, schema] of Object.entries(tool.parameters)) {
      if (schema.required && (args[paramName] === undefined || args[paramName] === null)) {
        return {
          valid: false,
          error: `Missing required parameter '${paramName}' for tool '${toolName}'.`,
        };
      }

      if (args[paramName] !== undefined && schema.enum) {
        if (!schema.enum.includes(args[paramName])) {
          return {
            valid: false,
            error: `Invalid value for parameter '${paramName}'. Must be one of: ${schema.enum.join(', ')}`,
          };
        }
      }
    }

    return { valid: true };
  }
}
