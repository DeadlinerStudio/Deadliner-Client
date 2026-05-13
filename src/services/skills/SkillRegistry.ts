/**
 * Skill Registry - 工具注册表
 * 管理所有可用的工具及其执行
 */

import {
  AgentRole,
  ToolCapability,
  ToolMetadata,
  ResolvedToolCandidate,
  ToolExecutionPlan,
  CapabilityExecutionMode,
  AIToolCall,
  generateUUID,
} from '../types';

// 导入工具定义
import readTasksSchema from './definitions/read_tasks.json';
import createTaskSchema from './definitions/create_task.json';
import updateDeadlineSchema from './definitions/update_deadline.json';
import readHabitsSchema from './definitions/read_habits.json';
import createHabitSchema from './definitions/create_habit.json';

// 工具定义映射
const BUILT_IN_SKILLS: Record<string, ToolMetadata> = {
  read_tasks: readTasksSchema as ToolMetadata,
  create_task: createTaskSchema as ToolMetadata,
  update_deadline: updateDeadlineSchema as ToolMetadata,
  read_habits: readHabitsSchema as ToolMetadata,
  create_habit: createHabitSchema as ToolMetadata,
};

// ============================================================================
// 工具执行器接口
// ============================================================================

export interface ToolExecutor {
  execute(toolName: string, args: Record<string, unknown>): Promise<ToolExecutionResult>;
}

// ============================================================================
// 工具执行结果
// ============================================================================

export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  errorCode?: string;
}

// ============================================================================
// Skill Registry
// ============================================================================

export class SkillRegistry {
  private skills: Map<string, ToolMetadata> = new Map();
  private executors: Map<string, ToolExecutor> = new Map();
  private platform: string = 'web';

  constructor(platform: string = 'web') {
    this.platform = platform;
    this.registerBuiltInSkills();
  }

  /**
   * 注册内置工具
   */
  private registerBuiltInSkills(): void {
    Object.entries(BUILT_IN_SKILLS).forEach(([name, metadata]) => {
      this.registerSkill(metadata);
    });
  }

  /**
   * 注册工具
   */
  registerSkill(metadata: ToolMetadata): void {
    // 检查平台支持
    if (
      metadata.supportedPlatforms.length > 0 &&
      !metadata.supportedPlatforms.includes(this.platform)
    ) {
      console.warn(`Tool ${metadata.name} does not support platform ${this.platform}`);
      return;
    }
    this.skills.set(metadata.name, metadata);
  }

  /**
   * 注册工具执行器
   */
  registerExecutor(toolName: string, executor: ToolExecutor): void {
    this.executors.set(toolName, executor);
  }

  /**
   * 设置平台
   */
  setPlatform(platform: string): void {
    this.platform = platform;
  }

  /**
   * 获取所有工具
   */
  getAllSkills(): ToolMetadata[] {
    return Array.from(this.skills.values());
  }

  /**
   * 获取特定域的工具
   */
  getSkillsByDomain(domain: AgentRole): ToolMetadata[] {
    return this.getAllSkills().filter((skill) => skill.domain === domain);
  }

  /**
   * 根据能力获取工具
   */
  getSkillsByCapability(capability: ToolCapability): ToolMetadata[] {
    return this.getAllSkills().filter((skill) =>
      skill.capabilities.includes(capability)
    );
  }

  /**
   * 获取工具元数据
   */
  getSkill(name: string): ToolMetadata | undefined {
    return this.skills.get(name);
  }

  /**
   * 执行工具
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    const executor = this.executors.get(toolName);
    if (!executor) {
      return {
        success: false,
        error: `No executor registered for tool: ${toolName}`,
        errorCode: 'NO_EXECUTOR',
      };
    }

    try {
      const result = await executor.execute(toolName, args);
      return result;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        errorCode: 'EXECUTION_ERROR',
      };
    }
  }

  /**
   * 根据工具调用请求执行
   */
  async executeToolCall(toolCall: AIToolCall): Promise<ToolExecutionResult> {
    return this.executeTool(toolCall.tool, toolCall.args);
  }

  /**
   * 解析工具调用请求，生成执行计划
   */
  resolveToolCall(toolCall: AIToolCall): ToolExecutionPlan | null {
    const skill = this.getSkill(toolCall.tool);
    if (!skill) {
      return null;
    }

    const executionMode =
      toolCall.executionMode ||
      (skill.requiresUiConfirmation
        ? CapabilityExecutionMode.AskUser
        : CapabilityExecutionMode.Auto);

    return {
      capability: skill.capabilities[0],
      toolName: toolCall.tool,
      args: toolCall.args,
      requiresUiConfirmation: skill.requiresUiConfirmation,
      executionMode,
    };
  }

  /**
   * 从 LLM 响应中提取工具调用
   */
  extractToolCalls(
    responseContent: string,
    domain?: AgentRole
  ): AIToolCall[] {
    const toolCalls: AIToolCall[] = [];

    try {
      // 尝试解析 JSON
      let jsonStr = responseContent.trim();

      // 清理代码块标记
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\s*/, '').replace(/```\s*$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\s*/, '').replace(/```\s*$/, '');
      }

      const parsed = JSON.parse(jsonStr);

      // 支持多种格式
      const rawToolCalls = parsed.toolCalls || parsed.tools || [];

      for (const raw of rawToolCalls) {
        const toolName = raw.tool || raw.name;
        const skill = this.getSkill(toolName);

        if (skill) {
          // 如果指定了域，检查是否匹配
          if (domain && skill.domain !== domain) {
            continue;
          }

          toolCalls.push({
            id: raw.id || generateUUID(),
            tool: toolName,
            args: raw.args || raw.arguments || {},
            reason: raw.reason,
            executionMode:
              raw.executionMode === 'ASK_USER'
                ? CapabilityExecutionMode.AskUser
                : CapabilityExecutionMode.Auto,
          });
        }
      }
    } catch (err) {
      console.error('Failed to extract tool calls:', err);
    }

    return toolCalls;
  }

  /**
   * 生成工具 Schema 描述（用于 Prompt）
   */
  generateToolsDescription(domain?: AgentRole): string {
    const skills = domain ? this.getSkillsByDomain(domain) : this.getAllSkills();

    if (skills.length === 0) {
      return '【当前可用工具 Schema】\n[]';
    }

    const schema = skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      parameters: skill.parameters,
    }));

    return `【当前可用工具 Schema】\n${JSON.stringify(schema, null, 2)}`;
  }

  /**
   * 验证工具参数
   */
  validateToolArgs(
    toolName: string,
    args: Record<string, unknown>
  ): { valid: boolean; errors: string[] } {
    const skill = this.getSkill(toolName);
    if (!skill) {
      return { valid: false, errors: [`Unknown tool: ${toolName}`] };
    }

    const errors: string[] = [];
    const { parameters } = skill;

    // 检查必需参数
    if (parameters.required) {
      for (const required of parameters.required) {
        if (args[required] === undefined || args[required] === null) {
          errors.push(`Missing required parameter: ${required}`);
        }
      }
    }

    // 检查参数类型
    for (const [key, value] of Object.entries(args)) {
      const prop = parameters.properties[key];
      if (prop) {
        const expectedType = prop.type;
        const actualType = Array.isArray(value)
          ? 'array'
          : typeof value;

        if (expectedType === 'number' && actualType !== 'number') {
          errors.push(
            `Parameter ${key} should be number, got ${actualType}`
          );
        } else if (expectedType === 'string' && actualType !== 'string') {
          errors.push(
            `Parameter ${key} should be string, got ${actualType}`
          );
        } else if (expectedType === 'boolean' && actualType !== 'boolean') {
          errors.push(
            `Parameter ${key} should be boolean, got ${actualType}`
          );
        } else if (expectedType === 'array' && !Array.isArray(value)) {
          errors.push(`Parameter ${key} should be array, got ${actualType}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

// ============================================================================
// 默认实例
// ============================================================================

let defaultRegistry: SkillRegistry | null = null;

export function getSkillRegistry(platform?: string): SkillRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new SkillRegistry(platform);
  }
  return defaultRegistry;
}

export function resetSkillRegistry(): void {
  defaultRegistry = null;
}
