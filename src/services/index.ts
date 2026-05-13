/**
 * AI Services 导出索引
 * 统一导出所有 AI Agent 相关服务
 */

// Types
export * from './types';

// Events
export {
  AgentEventEmitter,
  CoreEventType,
  LifecycleStage,
  getGlobalAgentEmitter,
  createAgentEmitter,
  newRequestId,
  type AgentEvent,
  type LifecyclePayload,
  type ThinkingPayload,
  type ToolRequestPayload,
  type ToolResultPayload,
  type FinishPayload,
  type MemoryCommittedPayload,
  type ErrorPayload,
} from './events/AgentEventEmitter';

// Skills
export {
  SkillRegistry,
  getSkillRegistry,
  resetSkillRegistry,
  type ToolExecutor,
  type ToolExecutionResult,
} from './skills/SkillRegistry';

export {
  TaskExecutors,
  getTaskExecutors,
} from './skills/executors/TaskExecutors';

export {
  HabitExecutors,
  getHabitExecutors,
} from './skills/executors/HabitExecutors';

// Memory
export {
  MemoryStore,
  getMemoryStore,
  resetMemoryStore,
} from './memory/MemoryStore';

// LLM
export {
  DeepSeekClient,
  getLLMClient,
  resetLLMClient,
  getStoredApiKey,
  getStoredBaseUrl,
  isConfigured,
  saveAgentConfig,
  getAgentConfig,
} from './llm/DeepSeekClient';

// Agent
export {
  AgentPipeline,
  getAgentPipeline,
  resetAgentPipeline,
  createAgentPipeline,
} from './agent/AgentPipeline';

export { PromptBuilder } from './agent/PromptBuilder';
