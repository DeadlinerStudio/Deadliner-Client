/**
 * LifiAI Agent 类型定义
 * 与 LifiAI-Core (Rust) 对齐的 TypeScript 类型
 */

// ============================================================================
// Agent 角色与能力
// ============================================================================

export enum AgentRole {
  Supervisor = 'Supervisor',
  TaskAgent = 'TaskAgent',
  HabitAgent = 'HabitAgent',
  ChatAgent = 'ChatAgent',
}

export enum ToolCapability {
  ReadTaskContext = 'READ_TASK_CONTEXT',
  ReadHabitContext = 'READ_HABIT_CONTEXT',
  CreateTask = 'CREATE_TASK',
  CreateHabit = 'CREATE_HABIT',
  UpdateTaskDeadline = 'UPDATE_TASK_DEADLINE',
}

export enum CapabilityExecutionMode {
  Auto = 'AUTO',
  AskUser = 'ASK_USER',
  Never = 'NEVER',
}

// ============================================================================
// JSON Schema 类型 (简化版)
// ============================================================================

export interface JSONSchemaProperty {
  type: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

export interface JSONSchema {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

// ============================================================================
// 工具元数据
// ============================================================================

export interface ToolMetadata {
  name: string;
  description: string;
  domain: AgentRole;
  capabilities: ToolCapability[];
  supportedPlatforms: string[];
  requiresUiConfirmation: boolean;
  parameters: JSONSchema;
}

export interface ResolvedToolCandidate {
  capability: ToolCapability;
  tool: ToolMetadata;
}

export interface ToolExecutionPlan {
  capability: ToolCapability;
  toolName: string;
  args: Record<string, unknown>;
  requiresUiConfirmation: boolean;
  executionMode: CapabilityExecutionMode;
}

// ============================================================================
// 记忆系统
// ============================================================================

export interface MemoryFragment {
  id: string;
  content: string;
  category: string;
  timestamp: string; // ISO 8601
  importance: number; // 1-5
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface MemorySnapshot {
  revision: number;
  fragments: MemoryFragment[];
  userProfile: string;
}

export enum MemorySyncOperationType {
  UpsertFragment = 'UpsertFragment',
  DeleteFragment = 'DeleteFragment',
  ReplaceUserProfile = 'ReplaceUserProfile',
}

export interface MemorySyncOperation {
  type: MemorySyncOperationType;
  fragment?: MemoryFragment;
  fragmentId?: string;
  profile?: string;
}

export interface MemorySyncPayload {
  baseRevision: number;
  nextRevision: number;
  operations: MemorySyncOperation[];
}

// ============================================================================
// AI 任务与习惯 (来自 LifiAI-Core)
// ============================================================================

export interface AITask {
  name: string;
  dueTime?: string; // "YYYY-MM-DD HH:mm"
  note?: string;
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  tags?: string[];
}

export interface AIHabit {
  name: string;
  period: string; // "daily", "weekly", "monthly"
  timesPerPeriod: number;
  goalType: string;
  totalTarget?: number;
  description?: string;
}

// ============================================================================
// 工具调用
// ============================================================================

export interface AIToolCall {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  reason?: string;
  executionMode: CapabilityExecutionMode;
}

export interface ToolCallResult {
  id: string;
  tool: string;
  appliedArgs: Record<string, unknown>;
  payload: unknown;
  generatedAt: string;
}

// ============================================================================
// 混合结果 (Agent 执行结果)
// ============================================================================

export interface RouteInfo {
  primaryIntent: string;
  routedAgents: AgentRole[];
}

export interface MixedResult {
  primaryIntent?: string;
  routedAgents?: AgentRole[];
  tasks?: AITask[];
  habits?: AIHabit[];
  retrievedTasks?: AITask[];
  retrievedHabits?: AIHabit[];
  newMemories?: string[];
  chatResponse?: string;
  sessionSummary?: string;
  userProfile?: string;
  toolCalls?: AIToolCall[];
  pendingToolCalls?: AIToolCall[];
  error?: string;
}

// ============================================================================
// LLM 请求/响应
// ============================================================================

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  success: boolean;
  content?: string;
  error?: string;
  rawResponse?: unknown;
}

// ============================================================================
// 错误定义
// ============================================================================

export enum AIErrorCode {
  MissingAPIKey = 'MISSING_API_KEY',
  EmptyResponse = 'EMPTY_RESPONSE',
  ParsingFailed = 'PARSING_FAILED',
  NetworkError = 'NETWORK_ERROR',
  ConfigError = 'CONFIG_ERROR',
  InvalidToolCall = 'INVALID_TOOL_CALL',
  RouteFailed = 'ROUTE_FAILED',
  WorkerFailed = 'WORKER_FAILED',
}

export class AIError extends Error {
  constructor(
    public code: AIErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'AIError';
  }

  static missingAPIKey(): AIError {
    return new AIError(AIErrorCode.MissingAPIKey, '请先在设置中填写 DeepSeek API Key');
  }

  static emptyResponse(): AIError {
    return new AIError(AIErrorCode.EmptyResponse, 'AI 返回内容为空');
  }

  static parsingFailed(details?: string): AIError {
    return new AIError(
      AIErrorCode.ParsingFailed,
      details ? `AI 数据解析失败: ${details}` : 'AI 数据解析失败'
    );
  }

  static networkError(err: string): AIError {
    return new AIError(AIErrorCode.NetworkError, `网络请求失败: ${err}`);
  }

  static configError(err: string): AIError {
    return new AIError(AIErrorCode.ConfigError, `配置错误: ${err}`);
  }

  static invalidToolCall(err: string): AIError {
    return new AIError(AIErrorCode.InvalidToolCall, `工具调用无效: ${err}`);
  }

  static routeFailed(err: string): AIError {
    return new AIError(AIErrorCode.RouteFailed, `意图路由失败: ${err}`);
  }

  static workerFailed(role: AgentRole, err: string): AIError {
    return new AIError(
      AIErrorCode.WorkerFailed,
      `${role} 执行失败: ${err}`
    );
  }
}

// ============================================================================
// 配置
// ============================================================================

export interface AgentConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  storageDir?: string; // 存储目录 (用于 Electron)
  platform?: 'ios' | 'android' | 'harmony' | 'web';
  useMock?: boolean;
}

// ============================================================================
// 常量
// ============================================================================

export const DEFAULT_TIME_FORMAT = '%Y-%m-%d %H:%M';

export const MEMORY_CONFIG = {
  MAX_FRAGMENTS: 60,
  MAX_AGE_DAYS: 120,
  MAX_CONVERSATION_TURNS: 24,
  MAX_CONVERSATION_CONTEXT_TURNS: 8,
  MAX_CONVERSATION_MESSAGE_CHARS: 400,
  MAX_LONG_TERM_CONTEXT_CHARS: 900,
} as const;

// ============================================================================
// 工具函数
// ============================================================================

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function formatDateTime(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseDateTime(dateStr: string): Date | null {
  // 支持 "YYYY-MM-DD HH:mm" 和 "YYYY-MM-DD HH:mm:ss"
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second = '0'] = match;
  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  );
}
