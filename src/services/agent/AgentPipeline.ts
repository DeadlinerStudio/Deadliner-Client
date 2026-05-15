/**
 * Agent Pipeline - Agent 管道核心
 * 对齐 LifiAI-Core 的 orchestrator 实现
 */

import {
  AgentRole,
  AITask,
  AIHabit,
  AIToolCall,
  MixedResult,
  RouteInfo,
  LLMMessage,
  generateUUID,
  AIError,
  AIErrorCode,
} from '../types';
import {
  AgentEventEmitter,
  CoreEventType,
  LifecycleStage,
  getGlobalAgentEmitter,
  newRequestId,
} from '../events/AgentEventEmitter';
import { PromptBuilder } from './PromptBuilder';
import { getLLMClient, getStoredApiKey } from '../llm/DeepSeekClient';
import { getSkillRegistry, SkillRegistry } from '../skills/SkillRegistry';
import { getTaskExecutors } from '../skills/executors/TaskExecutors';
import { getHabitExecutors } from '../skills/executors/HabitExecutors';
import { getMemoryStore, MemoryStore } from '../memory/MemoryStore';

// ============================================================================
// 待处理工具上下文
// ============================================================================

interface PendingToolContext {
  id: string;
  toolName: string;
  role: AgentRole;
  originalText: string;
  retryCount: number;
}

// ============================================================================
// Agent Pipeline
// ============================================================================

export class AgentPipeline {
  private emitter: AgentEventEmitter;
  private skillRegistry: SkillRegistry;
  private memoryStore: MemoryStore;
  private pendingToolCalls: Map<string, PendingToolContext> = new Map();
  private preferredLang: string;
  private useMock: boolean = false;

  constructor(options: {
    emitter?: AgentEventEmitter;
    skillRegistry?: SkillRegistry;
    memoryStore?: MemoryStore;
    preferredLang?: string;
    useMock?: boolean;
  } = {}) {
    this.emitter = options.emitter || getGlobalAgentEmitter();
    this.skillRegistry = options.skillRegistry || getSkillRegistry();
    this.memoryStore = options.memoryStore || getMemoryStore();
    this.preferredLang = options.preferredLang || 'zh-CN';
    this.useMock = options.useMock || false;

    // 注册内置执行器
    this.registerExecutors();
  }

  /**
   * 注册工具执行器
   */
  private registerExecutors(): void {
    this.skillRegistry.registerExecutor('read_tasks', getTaskExecutors());
    this.skillRegistry.registerExecutor('create_task', getTaskExecutors());
    this.skillRegistry.registerExecutor('update_deadline', getTaskExecutors());
    this.skillRegistry.registerExecutor('read_habits', getHabitExecutors());
    this.skillRegistry.registerExecutor('create_habit', getHabitExecutors());
  }

  /**
   * 设置语言
   */
  setPreferredLang(lang: string): void {
    this.preferredLang = lang;
  }

  /**
   * 获取事件发射器
   */
  getEmitter(): AgentEventEmitter {
    return this.emitter;
  }

  /**
   * 处理用户输入（主入口）
   */
  async processInput(text: string): Promise<MixedResult> {
    const requestId = newRequestId();
    const emit = this.emitter.createEmitter(requestId);

    // 检查 API Key
    if (!getStoredApiKey() && !this.useMock) {
      emit.error(AIErrorCode.MissingAPIKey, '请先在设置中填写 DeepSeek API Key');
      throw AIError.missingAPIKey();
    }

    emit.lifecycle(LifecycleStage.Started, 'started', '开始处理请求');

    try {
      // 1. 记录用户输入到对话历史
      await this.memoryStore.appendConversationTurn('user', text);

      // 2. 路由阶段
      const routeInfo = await this.route(text, emit);
      const routedAgents = routeInfo.routedAgents;

      // 如果没有路由到任何 Agent
      if (routedAgents.length === 0) {
        emit.lifecycle(LifecycleStage.OrchestrationCompleted, 'completed', '无有效路由');
        return {
          chatResponse: '抱歉，我没太明白您的意思。',
          primaryIntent: 'Chat',
        };
      }

      // 3. 并行调用 Worker Agents
      emit.lifecycle(LifecycleStage.WaitingTool, 'started', '调用 Worker Agents');
      const workerResults = await this.callWorkers(routedAgents, text, emit);

      // 4. 合并结果
      const finalResult = this.mergeResults(routeInfo, workerResults);

      // 5. 添加助手回复到对话历史
      if (finalResult.chatResponse) {
        await this.memoryStore.appendConversationTurn(
          'assistant',
          finalResult.chatResponse
        );
      }

      // 6. 记忆整合
      emit.lifecycle(LifecycleStage.MemoryCommitted, 'started', '整理记忆');
      await this.finalizeWithMemory(text, finalResult);

      emit.lifecycle(LifecycleStage.OrchestrationCompleted, 'completed', '处理完成');

      // 发射完成事件
      emit.finish(
        finalResult.primaryIntent || 'Chat',
        finalResult.tasks || [],
        finalResult.habits || [],
        finalResult.chatResponse,
        finalResult.newMemories,
        finalResult.sessionSummary
      );

      return finalResult;
    } catch (err) {
      emit.lifecycle(LifecycleStage.Failed, 'failed', err instanceof Error ? err.message : '未知错误');
      emit.error(
        AIErrorCode.WorkerFailed,
        err instanceof Error ? err.message : '处理失败',
        true
      );
      throw err;
    }
  }

  /**
   * 路由阶段 - Supervisor Agent
   */
  private async route(
    text: string,
    emit: ReturnType<AgentEventEmitter['createEmitter']>
  ): Promise<RouteInfo> {
    emit.thinking('Supervisor', 'routing', '分析用户意图');

    try {
      const client = getLLMClient();
      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: PromptBuilder.buildSupervisorPrompt(this.preferredLang),
        },
        { role: 'user', content: text },
      ];

      const response = await client.chatComplete(messages, { temperature: 0.3 });

      // 解析路由结果
      const result = this.parseRouteResponse(response);

      emit.thinking('Supervisor', 'routing', `路由完成: ${result.routedAgents.join(', ')}`);

      return result;
    } catch (err) {
      console.error('Route failed:', err);
      throw AIError.routeFailed(err instanceof Error ? err.message : '路由失败');
    }
  }

  /**
   * 解析路由响应
   */
  private parseRouteResponse(content: string): RouteInfo {
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent
          .replace(/```json\s*/, '')
          .replace(/```\s*$/, '');
      }

      const parsed = JSON.parse(cleanContent);

      const primaryIntent = parsed.primaryIntent || 'Chat';

      const routedAgents: AgentRole[] = [];
      if (Array.isArray(parsed.routedAgents)) {
        for (const agent of parsed.routedAgents) {
          switch (agent) {
            case 'TaskAgent':
              routedAgents.push(AgentRole.TaskAgent);
              break;
            case 'HabitAgent':
              routedAgents.push(AgentRole.HabitAgent);
              break;
            case 'ChatAgent':
              routedAgents.push(AgentRole.ChatAgent);
              break;
          }
        }
      }

      // 如果有领域专家，排除 ChatAgent
      const hasDomainSpecialist = routedAgents.some(
        (a) => a === AgentRole.TaskAgent || a === AgentRole.HabitAgent
      );
      if (hasDomainSpecialist) {
        const filtered = routedAgents.filter((a) => a !== AgentRole.ChatAgent);
        if (filtered.length > 0) {
          return { primaryIntent, routedAgents: filtered };
        }
      }

      return { primaryIntent, routedAgents };
    } catch (err) {
      console.error('Failed to parse route response:', err);
      return { primaryIntent: 'Chat', routedAgents: [AgentRole.ChatAgent] };
    }
  }

  /**
   * 并行调用 Worker Agents
   */
  private async callWorkers(
    agents: AgentRole[],
    text: string,
    emit: ReturnType<AgentEventEmitter['createEmitter']>
  ): Promise<MixedResult[]> {
    const promises = agents.map((agent) =>
      this.callWorker(agent, text, emit).catch((err) => {
        console.error(`Worker ${agent} failed:`, err);
        return this.createErrorResult(agent, err);
      })
    );

    return Promise.all(promises);
  }

  /**
   * 调用单个 Worker Agent
   */
  private async callWorker(
    agent: AgentRole,
    text: string,
    emit: ReturnType<AgentEventEmitter['createEmitter']>
  ): Promise<MixedResult> {
    emit.thinking(agent, 'analyzing', `${agent} 开始分析`);

    const tools = this.skillRegistry.getSkillsByDomain(agent);
    let systemPrompt: string;
    let userMessage = text;

    switch (agent) {
      case AgentRole.TaskAgent:
        systemPrompt = PromptBuilder.buildTaskAgentPrompt(
          this.preferredLang,
          tools
        );
        break;

      case AgentRole.HabitAgent:
        systemPrompt = PromptBuilder.buildHabitAgentPrompt(
          this.preferredLang,
          tools
        );
        break;

      case AgentRole.ChatAgent:
        systemPrompt = PromptBuilder.buildChatAgentPrompt(this.preferredLang);
        break;

      default:
        systemPrompt = PromptBuilder.buildChatAgentPrompt(this.preferredLang);
    }

    try {
      const client = getLLMClient();
      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ];

      const response = await client.chatComplete(messages);

      emit.thinking(agent, 'analyzing', `${agent} 响应已接收`);

      // 解析结果
      const result = this.parseWorkerResponse(agent, response);

      // 处理工具调用
      if (result.toolCalls && result.toolCalls.length > 0) {
        emit.thinking(agent, 'executing', `${agent} 正在执行工具调用`);

        // 等待工具执行
        const toolResults = await this.executePendingTools(
          result.toolCalls,
          agent,
          text,
          emit
        );

        // 将工具结果合并到结果中
        return this.mergeToolResults(result, toolResults);
      }

      return result;
    } catch (err) {
      console.error(`Worker ${agent} error:`, err);
      throw AIError.workerFailed(agent, err instanceof Error ? err.message : '执行失败');
    }
  }

  /**
   * 解析 Worker 响应
   */
  private parseWorkerResponse(agent: AgentRole, content: string): MixedResult {
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent
          .replace(/```json\s*/, '')
          .replace(/```\s*$/, '');
      }

      const parsed = JSON.parse(cleanContent);

      const result: MixedResult = {
        chatResponse: parsed.chatResponse,
        newMemories: parsed.newMemories,
        userProfile: parsed.userProfile,
      };

      // 解析 tasks
      if (Array.isArray(parsed.tasks)) {
        result.tasks = parsed.tasks.map((t: any) => ({
          name: t.name,
          dueTime: t.dueTime,
          note: t.note,
          priority: t.priority,
          category: t.category,
        }));
      }

      // 解析 habits
      if (Array.isArray(parsed.habits)) {
        result.habits = parsed.habits.map((h: any) => ({
          name: h.name,
          period: h.period,
          timesPerPeriod: h.timesPerPeriod,
          goalType: h.goalType,
          totalTarget: h.totalTarget,
        }));
      }

      // 解析 toolCalls
      if (Array.isArray(parsed.toolCalls)) {
        result.toolCalls = parsed.toolCalls.map((tc: any) => ({
          id: tc.id || generateUUID(),
          tool: tc.tool,
          args: tc.args || {},
          reason: tc.reason,
          executionMode:
            tc.executionMode === 'ASK_USER' ? 'ASK_USER' : 'AUTO',
        }));
      }

      return result;
    } catch (err) {
      console.error('Failed to parse worker response:', err);
      return {
        chatResponse: content,
        error: '解析响应失败',
      };
    }
  }

  /**
   * 执行待处理的工具调用
   */
  private async executePendingTools(
    toolCalls: AIToolCall[],
    role: AgentRole,
    originalText: string,
    emit: ReturnType<AgentEventEmitter['createEmitter']>
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    for (const toolCall of toolCalls) {
      // 发射工具请求事件
      emit.toolRequest(
        toolCall.id,
        toolCall.tool,
        toolCall.args,
        toolCall.reason,
        toolCall.executionMode as 'AUTO' | 'ASK_USER'
      );

      // 存储待处理上下文
      this.pendingToolCalls.set(toolCall.id, {
        id: toolCall.id,
        toolName: toolCall.tool,
        role,
        originalText,
        retryCount: 0,
      });

      // 验证参数
      const validation = this.skillRegistry.validateToolArgs(
        toolCall.tool,
        toolCall.args
      );

      if (!validation.valid) {
        console.warn(`Tool ${toolCall.tool} validation failed:`, validation.errors);
      }

      // 执行工具
      const result = await this.skillRegistry.executeTool(
        toolCall.tool,
        toolCall.args
      );

      // 发射工具结果事件
      emit.toolResult(
        toolCall.id,
        toolCall.tool,
        result.success,
        result.result,
        result.error
      );

      results.set(toolCall.id, result);

      // 从待处理中移除
      this.pendingToolCalls.delete(toolCall.id);
    }

    return results;
  }

  /**
   * 合并工具执行结果
   */
  private mergeToolResults(
    workerResult: MixedResult,
    toolResults: Map<string, any>
  ): MixedResult {
    const result = { ...workerResult };

    // 解析工具结果
    for (const [id, toolResult] of toolResults) {
      if (!toolResult.success) continue;

      const toolCall = workerResult.toolCalls?.find((tc) => tc.id === id);
      if (!toolCall) continue;

      const payload = toolResult.result || {};

      // 根据工具类型处理结果
      switch (toolCall.tool) {
        case 'read_tasks':
          if (payload.tasks) {
            result.retrievedTasks = payload.tasks.map((t: any) => ({
              name: t.name,
              dueTime: t.dueTime,
              note: t.note,
            }));
          }
          break;

        case 'read_habits':
          if (payload.habits) {
            result.retrievedHabits = payload.habits.map((h: any) => ({
              name: h.name,
              period: h.period,
              timesPerPeriod: h.timesPerPeriod,
              goalType: h.goalType,
            }));
          }
          break;

        case 'create_task':
        case 'create_habit':
          // 创建成功的任务/习惯已经在 workerResult 中
          if (payload.task || payload.habit) {
            result.chatResponse = `${toolCall.tool === 'create_task' ? '任务' : '习惯'}已创建成功！`;
          }
          break;

        case 'update_deadline':
          if (payload.updated) {
            result.chatResponse = '截止时间已更新！';
          }
          break;
      }
    }

    return result;
  }

  /**
   * 合并多个 Worker 结果
   */
  private mergeResults(routeInfo: RouteInfo, workerResults: MixedResult[]): MixedResult {
    const finalResult: MixedResult = {
      primaryIntent: routeInfo.primaryIntent,
      routedAgents: routeInfo.routedAgents,
    };

    for (const result of workerResults) {
      // 合并 tasks
      if (result.tasks && result.tasks.length > 0) {
        finalResult.tasks = [...(finalResult.tasks || []), ...result.tasks];
      }

      // 合并 habits
      if (result.habits && result.habits.length > 0) {
        finalResult.habits = [...(finalResult.habits || []), ...result.habits];
      }

      // 合并 retrievedTasks
      if (result.retrievedTasks && result.retrievedTasks.length > 0) {
        finalResult.retrievedTasks = [
          ...(finalResult.retrievedTasks || []),
          ...result.retrievedTasks,
        ];
      }

      // 合并 retrievedHabits
      if (result.retrievedHabits && result.retrievedHabits.length > 0) {
        finalResult.retrievedHabits = [
          ...(finalResult.retrievedHabits || []),
          ...result.retrievedHabits,
        ];
      }

      // 合并 newMemories
      if (result.newMemories && result.newMemories.length > 0) {
        finalResult.newMemories = [
          ...(finalResult.newMemories || []),
          ...result.newMemories,
        ];
      }

      // 合并 chatResponse
      if (result.chatResponse) {
        if (finalResult.chatResponse) {
          finalResult.chatResponse += '\n' + result.chatResponse;
        } else {
          finalResult.chatResponse = result.chatResponse;
        }
      }

      // 合并 sessionSummary
      if (result.sessionSummary) {
        finalResult.sessionSummary = result.sessionSummary;
      }

      // 合并 userProfile
      if (result.userProfile) {
        finalResult.userProfile = result.userProfile;
      }

      // 合并 toolCalls
      if (result.toolCalls && result.toolCalls.length > 0) {
        finalResult.toolCalls = [
          ...(finalResult.toolCalls || []),
          ...result.toolCalls,
        ];
      }
    }

    // 如果没有任何任务/习惯，但有对话回复，则为聊天
    if (
      (!finalResult.tasks || finalResult.tasks.length === 0) &&
      (!finalResult.habits || finalResult.habits.length === 0) &&
      finalResult.chatResponse
    ) {
      finalResult.primaryIntent = 'Chat';
    }

    return finalResult;
  }

  /**
   * 记忆整合
   */
  private async finalizeWithMemory(
    originalText: string,
    result: MixedResult
  ): Promise<void> {
    // 保存新的记忆
    if (result.newMemories && result.newMemories.length > 0) {
      for (const memory of result.newMemories) {
        await this.memoryStore.saveMemory(memory, 'user_preference');
      }
    }

    // 保存用户画像
    if (result.userProfile) {
      await this.memoryStore.saveUserProfile(result.userProfile);
    }
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(agent: AgentRole, err: Error): MixedResult {
    return {
      chatResponse: `处理失败: ${err.message}`,
      error: err.message,
    };
  }

  /**
   * 提交工具结果（用于异步工具执行）
   */
  async submitToolResult(
    toolCallId: string,
    resultJson: string
  ): Promise<MixedResult> {
    const context = this.pendingToolCalls.get(toolCallId);
    if (!context) {
      throw AIError.invalidToolCall(`未找到待回灌的工具调用 ${toolCallId}`);
    }

    this.pendingToolCalls.delete(toolCallId);

    // 解析结果
    try {
      const result = JSON.parse(resultJson);

      // 根据结果更新上下文
      // 这里可以添加重试逻辑等

      return { chatResponse: '工具执行完成' };
    } catch (err) {
      throw AIError.parsingFailed(
        err instanceof Error ? err.message : '无法解析工具结果'
      );
    }
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 辅助函数：检测是否为任务查询
 */
function looksLikeTaskQuery(text: string): boolean {
  const normalized = text.toLowerCase();
  
  const exclusionPatterns = ['重复', '冲突', '是否已有', '有没有重复', '避免重复', '去重'];
  if (exclusionPatterns.some(p => normalized.includes(p))) {
    return false;
  }

  const directPatterns = [
    '有哪些任务', '有什么任务', '任务列表', '列出任务', '看看任务',
    '查看任务', '总结任务', '哪些待办', '有什么待办', '最近有什么任务',
    '这周有什么任务', '本周有什么任务', 'read my tasks', 'show my tasks',
    'list my tasks', 'view my tasks', 'what are my tasks',
    'what\'s on my task list', 'task list', 'my tasks'
  ];

  const queryVerbs = ['列出', '查看', '看看', '总结', '查询', '盘点', 'read', 'show', 'list', 'view', 'summarize'];
  const taskNouns = ['任务', '待办', 'deadline', 'ddl', 'todo', 'task', 'tasks'];

  if (directPatterns.some(p => normalized.includes(p))) {
    return true;
  }

  return queryVerbs.some(v => normalized.includes(v)) && taskNouns.some(n => normalized.includes(n));
}

/**
 * 辅助函数：检测是否为习惯查询
 */
function looksLikeHabitQuery(text: string): boolean {
  const normalized = text.toLowerCase();
  const patterns = ['有哪些习惯', '我的习惯', '习惯列表', '查看习惯', '看看习惯', '总结习惯'];
  return patterns.some(p => normalized.includes(p));
}

/**
 * 辅助函数：是否为查询请求
 */
function isQueryRequest(role: AgentRole, text: string): boolean {
  switch (role) {
    case AgentRole.TaskAgent:
      return looksLikeTaskQuery(text);
    case AgentRole.HabitAgent:
      return looksLikeHabitQuery(text);
    default:
      return false;
  }
}

/**
 * 辅助函数：为查询生成任务摘要
 */
function summarizeTasksForQuery(tasks: AITask[]): string {
  if (tasks.length === 0) {
    return '当前没有查到相关任务。';
  }

  const summaries = tasks.slice(0, 5).map(task => {
    if (task.dueTime && task.dueTime.trim()) {
      return `${task.name}（${task.dueTime}）`;
    }
    return task.name;
  }).join('；');

  const suffix = tasks.length > 5 ? '；其余任务已省略。' : '。';
  return `我查到你当前有 ${tasks.length} 个相关任务：${summaries}${suffix}`;
}

/**
 * 辅助函数：为查询生成习惯摘要
 */
function summarizeHabitsForQuery(habits: AIHabit[]): string {
  if (habits.length === 0) {
    return '当前没有查到相关习惯。';
  }

  const summaries = habits.slice(0, 5).map(habit => {
    return `${habit.name}（${habit.period}）`;
  }).join('；');

  const suffix = habits.length > 5 ? '；其余习惯已省略。' : '。';
  return `我查到你当前有 ${habits.length} 个相关习惯：${summaries}${suffix}`;
}

/**
 * 辅助函数：规范化查询结果
 */
function normalizeQueryResult(role: AgentRole, originalText: string, result: MixedResult): void {
  if (!isQueryRequest(role, originalText)) {
    return;
  }

  switch (role) {
    case AgentRole.TaskAgent: {
      const tasks = result.tasks || [];
      if (!result.chatResponse || result.chatResponse.trim() === '') {
        result.chatResponse = summarizeTasksForQuery(tasks);
      }
      result.retrievedTasks = tasks;
      result.tasks = [];
      break;
    }
    case AgentRole.HabitAgent: {
      const habits = result.habits || [];
      if (!result.chatResponse || result.chatResponse.trim() === '') {
        result.chatResponse = summarizeHabitsForQuery(habits);
      }
      result.retrievedHabits = habits;
      result.habits = [];
      break;
    }
  }
}

/**
 * 辅助函数：检测是否为记忆语句
 */
function looksLikeMemoryStatement(text: string): boolean {
  const patterns = ['记住', '记一下', '以后', '我是', '我喜欢', '我习惯', '我通常', '请叫我'];
  return patterns.some(p => text.includes(p));
}

/**
 * 辅助函数：检测是否为画像语句
 */
function looksLikeProfileStatement(text: string): boolean {
  const patterns = ['我是', '我喜欢', '我习惯', '我通常', '偏好', '请叫我', '默认'];
  return patterns.some(p => text.includes(p));
}

/**
 * 辅助函数：提取 JSON 字符串
 */
function extractJson(raw: string): string | null {
  let cleaned = raw.trim();
  
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  cleaned = cleaned.trim();
  
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  
  if (start !== -1 && end !== -1 && start < end) {
    return cleaned.substring(start, end + 1);
  }
  
  return null;
}

/**
 * 辅助函数：回退到聊天结果
 */
function fallbackChatResult(text: string, content: string): MixedResult {
  const trimmedText = text.trim();
  const trimmedContent = content.trim();
  
  const result: MixedResult = {
    primaryIntent: 'Chat',
    chatResponse: trimmedContent,
  };

  if (looksLikeMemoryStatement(trimmedText)) {
    result.newMemories = [trimmedText];
  }

  if (looksLikeProfileStatement(trimmedText)) {
    result.userProfile = trimmedText;
  }

  return result;
}

// ============================================================================
// 单例
// ============================================================================

let globalPipeline: AgentPipeline | null = null;

/**
 * 获取全局 Agent Pipeline
 */
export function getAgentPipeline(): AgentPipeline {
  if (!globalPipeline) {
    globalPipeline = new AgentPipeline();
  }
  return globalPipeline;
}

/**
 * 重置 Agent Pipeline
 */
export function resetAgentPipeline(): void {
  globalPipeline = null;
}

/**
 * 创建新的 Agent Pipeline
 */
export function createAgentPipeline(): AgentPipeline {
  return new AgentPipeline();
}
