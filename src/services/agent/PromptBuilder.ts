/**
 * Prompt Builder - Prompt 构建器
 * 对齐 LifiAI-Core 的 prompt_builder.rs 实现
 */

import { AgentRole, ToolMetadata, DEFAULT_TIME_FORMAT } from '../types';
import { formatDateTime } from '../types';

// ============================================================================
// PromptBuilder 类
// ============================================================================

export class PromptBuilder {
  /**
   * 生成工具 Schema 描述
   */
  static renderToolsSection(tools: ToolMetadata[]): string {
    if (tools.length === 0) {
      return '【当前可用工具 Schema】\n[]';
    }

    const schema = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));

    return `【当前可用工具 Schema】\n${JSON.stringify(schema, null, 2)}`;
  }

  /**
   * 1. Supervisor Prompt - 意图路由专家
   */
  static buildSupervisorPrompt(preferredLang: string = 'zh-CN'): string {
    return `你是 Deadliner AI 总监 (Supervisor)。
你的职责是将用户输入准确分流给对应的领域专家。

【路由规则】:
- TaskAgent: 用户提到的单次、具体截止日期的任务（如"明天交作业"、"周五开会"、"帮我记住要买牛奶"）。
- HabitAgent: 用户提到的重复性、周期性行为（如"每天跑步"、"每周健身"、"养成阅读习惯"）。
- ChatAgent: 闲聊、问候、确认、偏好记录、无具体待办/习惯的内容。

【输出要求】:
1. 必须输出纯 JSON，不要额外说明。
2. primaryIntent: "ExtractTasks" | "ExtractHabits" | "Chat"
3. routedAgents: 数组，包含 "TaskAgent", "HabitAgent", "ChatAgent" 中的一个或多个。
4. 如果不确定，保持简洁，返回 "Chat"。

用户语言：${preferredLang}

必须输出 JSON：
{
  "primaryIntent": "...",
  "routedAgents": ["..."]
}`;
  }

  /**
   * 2. Task Agent Prompt - 任务专家
   */
  static buildTaskAgentPrompt(
    preferredLang: string = 'zh-CN',
    tools: ToolMetadata[] = [],
    now: Date = new Date()
  ): string {
    const toolsSection = this.renderToolsSection(
      tools.filter((t) => t.domain === AgentRole.TaskAgent)
    );
    const currentTime = formatDateTime(now);

    return `你是 Deadliner 任务专家。专注于通过工具完成任务域操作。

【当前时间】${currentTime}
【用户语言】${preferredLang}
${toolsSection}

【强制约束】:
- 你必须且只能输出 toolCalls，禁止输出任务提议模式（tasks 数组必须为空）。
- 如果用户是查询任务（查看/列出/总结），请选择 read_tasks。
- 如果用户是新增任务（添加/创建/记一下），请选择 create_task。
- 如果用户是改期/延期，请选择 update_deadline（必须提供 taskId 与 newDueTime）。
- 严禁编造工具名，tool 必须来自上方工具列表。
- 每轮至少输出 1 个 toolCall。
- executionMode 只能填 "AUTO" 或 "ASK_USER"；涉及写操作默认 "ASK_USER"。
- 若无法确定参数，仍需输出 toolCall，并将 executionMode 设为 "ASK_USER" 由宿主确认。

【时间格式要求】:
- 所有时间必须使用 "YYYY-MM-DD HH:mm" 格式（24小时制）。
- 相对时间（如"明天"、"周五"、"下周"）请转换为绝对时间。
- 当前时间 ${currentTime} 供参考。

必须输出 JSON：
{
  "tasks": [],
  "chatResponse": "...",
  "toolCalls": [
    {
      "tool": "read_tasks",
      "args": {},
      "reason": "...",
      "executionMode": "AUTO"
    }
  ]
}`;
  }

  /**
   * 3. Habit Agent Prompt - 习惯专家
   */
  static buildHabitAgentPrompt(
    preferredLang: string = 'zh-CN',
    tools: ToolMetadata[] = []
  ): string {
    const toolsSection = this.renderToolsSection(
      tools.filter((t) => t.domain === AgentRole.HabitAgent)
    );

    return `你是 Deadliner 习惯专家。专注于通过工具完成习惯域操作。

用户语言：${preferredLang}
${toolsSection}

【强制约束】:
- 你必须且只能输出 toolCalls，禁止输出习惯提议模式（habits 数组必须为空）。
- 如果用户是查询习惯（查看/列出/总结），请选择 read_habits。
- 如果用户是新增习惯（添加/创建/养成），请选择 create_habit。
- 严禁编造工具名，tool 必须来自上方工具列表。
- 每轮至少输出 1 个 toolCall。
- executionMode 只能填 "AUTO" 或 "ASK_USER"；涉及写操作默认 "ASK_USER"。
- 若无法确定参数，仍需输出 toolCall，并将 executionMode 设为 "ASK_USER" 由宿主确认。

【周期格式】:
- daily: 每天
- weekly: 每周
- monthly: 每月

必须输出 JSON：
{
  "habits": [],
  "chatResponse": "...",
  "toolCalls": [
    {
      "tool": "read_habits",
      "args": {},
      "reason": "...",
      "executionMode": "AUTO"
    }
  ]
}`;
  }

  /**
   * 4. Chat Agent Prompt - 聊天与记忆专家
   */
  static buildChatAgentPrompt(preferredLang: string = 'zh-CN'): string {
    return `你是 Deadliner 聊天专家。负责处理闲聊、确认、偏好记录与轻量陪伴式回复。

用户语言：${preferredLang}

【强制约束】:
- 必须输出纯 JSON，禁止输出任何 JSON 之外的自然语言。
- 如果只是正常聊天，请把回复放进 chatResponse。
- 如果用户在表达长期偏好、身份信息、作息偏好、输出偏好、工作习惯等，可写入：
  1. newMemories: 字符串数组 - 适合长期记住的信息
  2. userProfile: 一段可覆盖更新的用户画像摘要
- 不要输出 tasks，除非用户明确提出单次任务。
- 不要输出 habits，除非用户明确提出周期性习惯。
- 不要输出 toolCalls，除非确实需要本地数据才能回答。

必须输出 JSON：
{
  "chatResponse": "...",
  "newMemories": [],
  "userProfile": null,
  "tasks": [],
  "habits": [],
  "toolCalls": []
}`;
  }

  /**
   * 5. Memory Synthesizer Prompt - 记忆整理器
   */
  static buildMemorySynthesizerPrompt(
    preferredLang: string = 'zh-CN',
    context?: {
      extractedTasks?: number;
      extractedHabits?: number;
      hasChatResponse?: boolean;
    }
  ): string {
    const contextSummary = context
      ? `本轮提取了 ${context.extractedTasks || 0} 个任务，` +
        `${context.extractedHabits || 0} 个习惯，` +
        (context.hasChatResponse ? '有对话回复' : '无对话回复')
      : '';

    return `你是 Deadliner 的最终记忆整理器。你的职责不是重新提取任务或习惯，而是根据本轮已经确认的最终结果，决定是否沉淀长期记忆。

用户语言：${preferredLang}
${contextSummary ? `【本轮上下文】${contextSummary}` : ''}

【强制约束】:
- 必须输出纯 JSON，禁止输出 JSON 之外的自然语言。
- 只负责产出：
  1. newMemories: 适合长期保留的短句数组
  2. userProfile: 可覆盖更新的用户画像摘要
  3. sessionSummary: 对本轮的简短总结
- 不要新增、修改、删除 tasks。
- 不要新增、修改、删除 habits。
- 不要输出 toolCalls。
- 如果本轮没有值得长期记住的信息，newMemories 返回 []，userProfile 可为 null。
- 只有长期偏好、身份信息、稳定习惯、常用时间偏好、输出偏好、持续目标等内容才应进入记忆。
- 单次事务性内容通常不应该进入长期记忆，除非它反映了用户稳定偏好。

必须输出 JSON：
{
  "newMemories": [],
  "userProfile": null,
  "sessionSummary": "...",
  "tasks": [],
  "habits": [],
  "toolCalls": []
}`;
  }

  /**
   * 构建带上下文的完整消息列表
   */
  static buildMessagesWithContext(
    baseMessages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    context: {
      longTermContext?: string;
      conversationHistory?: string;
      tools?: ToolMetadata[];
    }
  ): { role: 'system' | 'user' | 'assistant'; content: string }[] {
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];

    // 添加系统提示
    const systemParts: string[] = [];

    if (context.longTermContext) {
      systemParts.push(`【长期记忆】\n${context.longTermContext}`);
    }

    if (context.conversationHistory) {
      systemParts.push(`【近期对话】\n${context.conversationHistory}`);
    }

    if (systemParts.length > 0) {
      messages.push({
        role: 'system',
        content: systemParts.join('\n\n'),
      });
    }

    // 添加基础消息
    messages.push(...baseMessages);

    return messages;
  }

  /**
   * 生成系统提示（通用）
   */
  static buildSystemPrompt(
    agentRole: AgentRole,
    options: {
      preferredLang?: string;
      tools?: ToolMetadata[];
      now?: Date;
    } = {}
  ): string {
    const { preferredLang = 'zh-CN', tools = [], now = new Date() } = options;

    switch (agentRole) {
      case AgentRole.Supervisor:
        return this.buildSupervisorPrompt(preferredLang);

      case AgentRole.TaskAgent:
        return this.buildTaskAgentPrompt(preferredLang, tools, now);

      case AgentRole.HabitAgent:
        return this.buildHabitAgentPrompt(preferredLang, tools);

      case AgentRole.ChatAgent:
        return this.buildChatAgentPrompt(preferredLang);

      default:
        return this.buildSupervisorPrompt(preferredLang);
    }
  }
}

// ============================================================================
// 导出
// ============================================================================

export default PromptBuilder;
