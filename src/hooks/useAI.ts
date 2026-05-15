/**
 * AI Service Hooks
 * 提供 React 组件使用的 hooks
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AgentPipeline,
  getAgentPipeline,
  createAgentPipeline,
  CoreEventType,
  getMemoryStore,
  type LifecyclePayload,
  type ThinkingPayload,
  type ToolRequestPayload,
  type ToolResultPayload,
  type FinishPayload,
  type MixedResult,
  type AITask,
  type AIHabit,
  type MemorySnapshot,
  type MemoryFragment,
} from '../services';

// ============================================================================
// AI 处理 Hook
// ============================================================================

interface UseAIProcessOptions {
  onThinking?: (payload: ThinkingPayload) => void;
  onToolRequest?: (payload: ToolRequestPayload) => void;
  onToolResult?: (payload: ToolResultPayload) => void;
  onFinish?: (payload: FinishPayload) => void;
  onError?: (error: Error) => void;
}

interface UseAIProcessReturn {
  isProcessing: boolean;
  thinking: ThinkingPayload[];
  toolCalls: ToolRequestPayload[];
  toolResults: Map<string, ToolResultPayload>;
  result: MixedResult | null;
  error: Error | null;
  process: (text: string) => Promise<MixedResult | null>;
  reset: () => void;
}

export function useAIProcess(options: UseAIProcessOptions = {}): UseAIProcessReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [thinking, setThinking] = useState<ThinkingPayload[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolRequestPayload[]>([]);
  const [toolResults, setToolResults] = useState<Map<string, ToolResultPayload>>(new Map());
  const [result, setResult] = useState<MixedResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const pipelineRef = useRef<AgentPipeline | null>(null);
  const unsubscribersRef = useRef<(() => void)[]>([]);

  // 初始化 Pipeline
  useEffect(() => {
    pipelineRef.current = getAgentPipeline();

    const pipeline = pipelineRef.current;
    const emitter = pipeline.getEmitter();

    // 订阅事件
    const unsubThinking = emitter.onThinking((payload) => {
      setThinking((prev) => [...prev, payload]);
      options.onThinking?.(payload);
    });

    const unsubToolRequest = emitter.onToolRequest((payload) => {
      setToolCalls((prev) => [...prev, payload]);
      options.onToolRequest?.(payload);
    });

    const unsubToolResult = emitter.onToolResult((payload) => {
      setToolResults((prev) => {
        const next = new Map(prev);
        next.set(payload.id, payload);
        return next;
      });
      options.onToolResult?.(payload);
    });

    const unsubFinish = emitter.onFinish((payload) => {
      setIsProcessing(false);
      options.onFinish?.(payload);
    });

    const unsubError = emitter.on(CoreEventType.Error, (event) => {
      const payload = event.payload as { message: string };
      const err = new Error(payload.message);
      setError(err);
      setIsProcessing(false);
      options.onError?.(err);
    });

    unsubscribersRef.current = [
      unsubThinking,
      unsubToolRequest,
      unsubToolResult,
      unsubFinish,
      unsubError,
    ];

    return () => {
      unsubscribersRef.current.forEach((unsub) => unsub());
    };
  }, []);

  const process = useCallback(async (text: string): Promise<MixedResult | null> => {
    // 确保 pipeline 已初始化
    if (!pipelineRef.current) {
      pipelineRef.current = createAgentPipeline();
    }

    setIsProcessing(true);
    setThinking([]);
    setToolCalls([]);
    setToolResults(new Map());
    setResult(null);
    setError(null);

    try {
      const res = await pipelineRef.current.processInput(text);
      setResult(res);
      return res;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      console.error('AI Process Error:', error);
      setError(error);
      options.onError?.(error);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setThinking([]);
    setToolCalls([]);
    setToolResults(new Map());
    setResult(null);
    setError(null);
  }, []);

  return {
    isProcessing,
    thinking,
    toolCalls,
    toolResults,
    result,
    error,
    process,
    reset,
  };
}

// ============================================================================
// 简化的 AI 生成 Hook
// ============================================================================

interface UseAIGenerateOptions {
  onThinking?: (message: string) => void;
  onComplete?: (result: MixedResult) => void;
  onError?: (error: Error) => void;
}

interface UseAIGenerateReturn {
  isGenerating: boolean;
  thinkingMessage: string;
  result: MixedResult | null;
  error: Error | null;
  generate: (text: string) => Promise<MixedResult | null>;
}

export function useAIGenerate(options: UseAIGenerateOptions = {}): UseAIGenerateReturn {
  const { isProcessing: isGenerating, thinking, result, error, process } = useAIProcess({
    onThinking: (payload) => {
      options.onThinking?.(`${payload.agentName}: ${payload.message}`);
    },
    onFinish: (payload) => {
      // 转换为 MixedResult
      const mixedResult: MixedResult = {
        primaryIntent: payload.primaryIntent,
        tasks: payload.tasks as AITask[],
        habits: payload.habits as AIHabit[],
        chatResponse: payload.chatResponse,
        newMemories: payload.newMemories,
        sessionSummary: payload.sessionSummary,
      };
      options.onComplete?.(mixedResult);
    },
    onError: options.onError,
  });

  const thinkingMessage = thinking.length > 0
    ? thinking[thinking.length - 1].message
    : '';

  const generate = useCallback(async (text: string): Promise<MixedResult | null> => {
    return process(text);
  }, [process]);

  return {
    isGenerating,
    thinkingMessage,
    result,
    error,
    generate,
  };
}

// ============================================================================
// 记忆 Hook
// ============================================================================

interface UseMemoryReturn {
  fragments: MemoryFragment[];
  userProfile: string;
  stats: {
    revision: number;
    fragmentCount: number;
    conversationTurns: number;
  };
  saveMemory: (content: string, category: string) => Promise<void>;
  saveProfile: (profile: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => void;
}

export function useMemory(): UseMemoryReturn {
  const [fragments, setFragments] = useState<MemoryFragment[]>([]);
  const [userProfile, setUserProfile] = useState<string>('');
  const [stats, setStats] = useState({
    revision: 0,
    fragmentCount: 0,
    conversationTurns: 0,
  });

  const memoryStore = getMemoryStore();

  const refresh = useCallback(() => {
    memoryStore.getAllFragments().then(setFragments);
    memoryStore.getUserProfile().then(setUserProfile);
    setStats(memoryStore.getStats());
  }, [memoryStore]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveMemory = useCallback(async (content: string, category: string) => {
    await memoryStore.saveMemory(content, category);
    refresh();
  }, [memoryStore, refresh]);

  const saveProfile = useCallback(async (profile: string) => {
    await memoryStore.saveUserProfile(profile);
    refresh();
  }, [memoryStore, refresh]);

  const clearAll = useCallback(async () => {
    await memoryStore.clearAll();
    refresh();
  }, [memoryStore, refresh]);

  return {
    fragments,
    userProfile,
    stats,
    saveMemory,
    saveProfile,
    clearAll,
    refresh,
  };
}
