/**
 * Agent 事件系统
 * 对齐 LifiAI-Core 的事件驱动架构
 */

import { generateUUID } from '../types';

// ============================================================================
// 事件类型
// ============================================================================

export enum CoreEventType {
  // 生命周期事件
  Lifecycle = 'lifecycle',
  // AI 思考状态
  Thinking = 'thinking',
  // 流式文本输出
  TextStream = 'text_stream',
  // 工具调用请求
  ToolRequest = 'tool_request',
  // 工具执行完成
  ToolResult = 'tool_result',
  // 处理完成
  Finish = 'finish',
  // 记忆已提交
  MemoryCommitted = 'memory_committed',
  // 错误
  Error = 'error',
}

// ============================================================================
// 生命周期阶段
// ============================================================================

export enum LifecycleStage {
  Started = 'started',
  WaitingTool = 'waiting_tool',
  OrchestrationCompleted = 'orchestration_completed',
  MemoryCommitted = 'memory_committed',
  Failed = 'failed',
}

// ============================================================================
// 事件载荷
// ============================================================================

export interface LifecyclePayload {
  requestId: string;
  stage: LifecycleStage;
  status: 'started' | 'completed' | 'failed';
  message?: string;
}

export interface ThinkingPayload {
  agentName: string; // 'Supervisor' | 'TaskAgent' | 'HabitAgent' | 'ChatAgent'
  phase: string; // 'routing' | 'analyzing' | 'executing' | 'synthesizing'
  message: string;
}

export interface TextStreamPayload {
  chunk: string;
  isComplete: boolean;
}

export interface ToolRequestPayload {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  reason?: string;
  executionMode: 'AUTO' | 'ASK_USER';
}

export interface ToolResultPayload {
  id: string;
  toolName: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface FinishPayload {
  requestId: string;
  primaryIntent: string;
  tasks: unknown[];
  habits: unknown[];
  chatResponse?: string;
  newMemories?: string[];
  sessionSummary?: string;
}

export interface MemoryCommittedPayload {
  requestId: string;
  addedMemories: string[];
  profileUpdated: boolean;
  newRevision: number;
}

export interface ErrorPayload {
  requestId: string;
  code: string;
  message: string;
  recoverable: boolean;
}

// ============================================================================
// Agent 事件
// ============================================================================

export interface AgentEvent {
  type: CoreEventType;
  requestId: string;
  payload: unknown;
  timestamp: string;
}

export type AgentEventCallback = (event: AgentEvent) => void;

export type LifecycleCallback = (payload: LifecyclePayload) => void;
export type ThinkingCallback = (payload: ThinkingPayload) => void;
export type TextStreamCallback = (payload: TextStreamPayload) => void;
export type ToolRequestCallback = (payload: ToolRequestPayload) => void;
export type ToolResultCallback = (payload: ToolResultPayload) => void;
export type FinishCallback = (payload: FinishPayload) => void;
export type MemoryCommittedCallback = (payload: MemoryCommittedPayload) => void;
export type ErrorCallback = (payload: ErrorPayload) => void;

// ============================================================================
// 事件发射器
// ============================================================================

export class AgentEventEmitter {
  private listeners: Map<CoreEventType, Set<AgentEventCallback>> = new Map();
  private lifecycleListeners: Set<LifecycleCallback> = new Set();
  private thinkingListeners: Set<ThinkingCallback> = new Set();
  private textStreamListeners: Set<TextStreamCallback> = new Set();
  private toolRequestListeners: Set<ToolRequestCallback> = new Set();
  private toolResultListeners: Set<ToolResultCallback> = new Set();
  private finishListeners: Set<FinishCallback> = new Set();
  private memoryCommittedListeners: Set<MemoryCommittedCallback> = new Set();
  private errorListeners: Set<ErrorCallback> = new Set();

  private globalListeners: Set<AgentEventCallback> = new Set();

  // 订阅特定类型的事件
  on(eventType: CoreEventType, callback: AgentEventCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  // 订阅所有事件
  onAny(callback: AgentEventCallback): () => void {
    this.globalListeners.add(callback);
    return () => {
      this.globalListeners.delete(callback);
    };
  }

  // 生命周期事件
  onLifecycle(callback: LifecycleCallback): () => void {
    this.lifecycleListeners.add(callback);
    return () => {
      this.lifecycleListeners.delete(callback);
    };
  }

  // 思考状态事件
  onThinking(callback: ThinkingCallback): () => void {
    this.thinkingListeners.add(callback);
    return () => {
      this.thinkingListeners.delete(callback);
    };
  }

  // 流式文本事件
  onTextStream(callback: TextStreamCallback): () => void {
    this.textStreamListeners.add(callback);
    return () => {
      this.textStreamListeners.delete(callback);
    };
  }

  // 工具请求事件
  onToolRequest(callback: ToolRequestCallback): () => void {
    this.toolRequestListeners.add(callback);
    return () => {
      this.toolRequestListeners.delete(callback);
    };
  }

  // 工具结果事件
  onToolResult(callback: ToolResultCallback): () => void {
    this.toolResultListeners.add(callback);
    return () => {
      this.toolResultListeners.delete(callback);
    };
  }

  // 完成事件
  onFinish(callback: FinishCallback): () => void {
    this.finishListeners.add(callback);
    return () => {
      this.finishListeners.delete(callback);
    };
  }

  // 记忆提交事件
  onMemoryCommitted(callback: MemoryCommittedCallback): () => void {
    this.memoryCommittedListeners.add(callback);
    return () => {
      this.memoryCommittedListeners.delete(callback);
    };
  }

  // 错误事件
  onError(callback: ErrorCallback): () => void {
    this.errorListeners.add(callback);
    return () => {
      this.errorListeners.delete(callback);
    };
  }

  // 发射事件
  emit(event: AgentEvent): void {
    // 触发特定类型监听器
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      typeListeners.forEach((callback) => {
        try {
          callback(event);
        } catch (err) {
          console.error(`Error in event listener for ${event.type}:`, err);
        }
      });
    }

    // 触发全局监听器
    this.globalListeners.forEach((callback) => {
      try {
        callback(event);
      } catch (err) {
        console.error('Error in global event listener:', err);
      }
    });

    // 触发特定类型的高层监听器
    switch (event.type) {
      case CoreEventType.Lifecycle:
        this.lifecycleListeners.forEach((cb) => cb(event.payload as LifecyclePayload));
        break;
      case CoreEventType.Thinking:
        this.thinkingListeners.forEach((cb) => cb(event.payload as ThinkingPayload));
        break;
      case CoreEventType.TextStream:
        this.textStreamListeners.forEach((cb) => cb(event.payload as TextStreamPayload));
        break;
      case CoreEventType.ToolRequest:
        this.toolRequestListeners.forEach((cb) => cb(event.payload as ToolRequestPayload));
        break;
      case CoreEventType.ToolResult:
        this.toolResultListeners.forEach((cb) => cb(event.payload as ToolResultPayload));
        break;
      case CoreEventType.Finish:
        this.finishListeners.forEach((cb) => cb(event.payload as FinishPayload));
        break;
      case CoreEventType.MemoryCommitted:
        this.memoryCommittedListeners.forEach((cb) => cb(event.payload as MemoryCommittedPayload));
        break;
      case CoreEventType.Error:
        this.errorListeners.forEach((cb) => cb(event.payload as ErrorPayload));
        break;
    }
  }

  // 创建带 requestId 的发射函数
  createEmitter(requestId: string) {
    return {
      lifecycle: (stage: LifecycleStage, status: 'started' | 'completed' | 'failed', message?: string) => {
        this.emit({
          type: CoreEventType.Lifecycle,
          requestId,
          payload: { requestId, stage, status, message } as LifecyclePayload,
          timestamp: new Date().toISOString(),
        });
      },
      thinking: (agentName: string, phase: string, message: string) => {
        this.emit({
          type: CoreEventType.Thinking,
          requestId,
          payload: { agentName, phase, message } as ThinkingPayload,
          timestamp: new Date().toISOString(),
        });
      },
      textStream: (chunk: string, isComplete: boolean) => {
        this.emit({
          type: CoreEventType.TextStream,
          requestId,
          payload: { chunk, isComplete } as TextStreamPayload,
          timestamp: new Date().toISOString(),
        });
      },
      toolRequest: (id: string, toolName: string, args: Record<string, unknown>, reason?: string, executionMode: 'AUTO' | 'ASK_USER' = 'AUTO') => {
        this.emit({
          type: CoreEventType.ToolRequest,
          requestId,
          payload: { id, toolName, args, reason, executionMode } as ToolRequestPayload,
          timestamp: new Date().toISOString(),
        });
      },
      toolResult: (id: string, toolName: string, success: boolean, result?: unknown, error?: string) => {
        this.emit({
          type: CoreEventType.ToolResult,
          requestId,
          payload: { id, toolName, success, result, error } as ToolResultPayload,
          timestamp: new Date().toISOString(),
        });
      },
      finish: (primaryIntent: string, tasks: unknown[], habits: unknown[], chatResponse?: string, newMemories?: string[], sessionSummary?: string) => {
        this.emit({
          type: CoreEventType.Finish,
          requestId,
          payload: { requestId, primaryIntent, tasks, habits, chatResponse, newMemories, sessionSummary } as FinishPayload,
          timestamp: new Date().toISOString(),
        });
      },
      memoryCommitted: (addedMemories: string[], profileUpdated: boolean, newRevision: number) => {
        this.emit({
          type: CoreEventType.MemoryCommitted,
          requestId,
          payload: { requestId, addedMemories, profileUpdated, newRevision } as MemoryCommittedPayload,
          timestamp: new Date().toISOString(),
        });
      },
      error: (code: string, message: string, recoverable: boolean = true) => {
        this.emit({
          type: CoreEventType.Error,
          requestId,
          payload: { requestId, code, message, recoverable } as ErrorPayload,
          timestamp: new Date().toISOString(),
        });
      },
    };
  }

  // 移除所有监听器
  removeAllListeners(): void {
    this.listeners.clear();
    this.globalListeners.clear();
    this.lifecycleListeners.clear();
    this.thinkingListeners.clear();
    this.textStreamListeners.clear();
    this.toolRequestListeners.clear();
    this.toolResultListeners.clear();
    this.finishListeners.clear();
    this.memoryCommittedListeners.clear();
    this.errorListeners.clear();
  }

  // 获取监听器数量
  listenerCount(type?: CoreEventType): number {
    if (type) {
      return this.listeners.get(type)?.size ?? 0;
    }
    let count = 0;
    this.listeners.forEach((set) => (count += set.size));
    count += this.globalListeners.size;
    return count;
  }
}

// ============================================================================
// 单例
// ============================================================================

let globalEmitter: AgentEventEmitter | null = null;

export function getGlobalAgentEmitter(): AgentEventEmitter {
  if (!globalEmitter) {
    globalEmitter = new AgentEventEmitter();
  }
  return globalEmitter;
}

export function createAgentEmitter(requestId?: string): AgentEventEmitter {
  const emitter = new AgentEventEmitter();
  if (requestId) {
    return emitter;
  }
  return emitter;
}

export function newRequestId(): string {
  return generateUUID();
}
