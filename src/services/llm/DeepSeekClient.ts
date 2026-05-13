/**
 * DeepSeek/LLM 客户端封装
 * 复用现有的 aiApi.ts，并提供与 Agent Pipeline 对齐的接口
 */

import { callAIAPI, AIProvider, AI_PROVIDERS } from '../../utils/aiApi';
import { LLMMessage, LLMResponse, AgentConfig } from '../types';

// ============================================================================
// DeepSeek Client
// ============================================================================

export class DeepSeekClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: Partial<AgentConfig> & { apiKey: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || AI_PROVIDERS.deepseek.baseUrl;
    this.model = config.model || 'deepseek-chat';
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 4096;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AgentConfig>): void {
    if (config.apiKey) this.apiKey = config.apiKey;
    if (config.baseUrl) this.baseUrl = config.baseUrl;
    if (config.model) this.model = config.model;
    if (config.temperature !== undefined) this.temperature = config.temperature;
    if (config.maxTokens !== undefined) this.maxTokens = config.maxTokens;
  }

  /**
   * 发送聊天请求
   */
  async chat(
    messages: LLMMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    } = {}
  ): Promise<LLMResponse> {
    const provider: AIProvider = {
      name: 'DeepSeek',
      id: 'deepseek',
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      model: this.model,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
    };

    return callAIAPI(provider, messages, {
      temperature: options.temperature ?? this.temperature,
      maxTokens: options.maxTokens ?? this.maxTokens,
      stream: options.stream,
    });
  }

  /**
   * 发送聊天请求并返回完整响应
   */
  async chatComplete(
    messages: LLMMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<string> {
    const response = await this.chat(messages, options);

    if (!response.success || !response.content) {
      throw new Error(response.error || 'LLM request failed');
    }

    return response.content;
  }

  /**
   * 解析 JSON 响应
   */
  async chatJson<T>(
    messages: LLMMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<T> {
    const content = await this.chatComplete(messages, options);

    // 清理可能的代码块标记
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent
        .replace(/```json\s*/, '')
        .replace(/```\s*$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent
        .replace(/```\s*/, '')
        .replace(/```\s*$/, '');
    }

    try {
      return JSON.parse(cleanContent) as T;
    } catch (err) {
      // 尝试提取 JSON
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]) as T;
        } catch {
          // ignore
        }
      }
      throw new Error(`Failed to parse JSON: ${cleanContent.substring(0, 100)}...`);
    }
  }

  /**
   * 获取提供商信息
   */
  getProviderInfo(): { baseUrl: string; model: string } {
    return {
      baseUrl: this.baseUrl,
      model: this.model,
    };
  }
}

// ============================================================================
// 配置管理
// ============================================================================

const STORAGE_KEY = 'deadliner_agent_config';

/**
 * 获取 API Key（从 localStorage）
 */
export function getStoredApiKey(): string {
  // 优先使用 AI 配置页面的设置
  const aiProvider = localStorage.getItem('ai_selected_provider') || 'deepseek';
  const apiKey = localStorage.getItem(`ai_api_key_${aiProvider}`);
  return apiKey || '';
}

/**
 * 获取 Base URL
 */
export function getStoredBaseUrl(): string {
  const aiProvider = localStorage.getItem('ai_selected_provider') || 'deepseek';
  const baseUrl = localStorage.getItem(`ai_base_url_${aiProvider}`);
  return baseUrl || AI_PROVIDERS.deepseek.baseUrl;
}

/**
 * 保存 Agent 配置
 */
export function saveAgentConfig(config: AgentConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/**
 * 获取 Agent 配置
 */
export function getAgentConfig(): AgentConfig | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error('Failed to get agent config:', err);
  }
  return null;
}

// ============================================================================
// 客户端工厂
// ============================================================================

let globalClient: DeepSeekClient | null = null;

/**
 * 获取全局 LLM 客户端
 */
export function getLLMClient(): DeepSeekClient {
  if (!globalClient) {
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      throw new Error('API key not configured. Please set up DeepSeek API key in settings.');
    }

    globalClient = new DeepSeekClient({
      apiKey,
      baseUrl: getStoredBaseUrl(),
    });
  }
  return globalClient;
}

/**
 * 重新初始化 LLM 客户端
 */
export function resetLLMClient(): void {
  globalClient = null;
}

/**
 * 检查是否已配置
 */
export function isConfigured(): boolean {
  return !!getStoredApiKey();
}
