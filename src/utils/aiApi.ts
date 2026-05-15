// AI API 统一接口
export interface AIProvider {
  name: string;
  id: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  success: boolean;
  content?: string;
  error?: string;
}

// 支持的 AI 提供商配置
export const AI_PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    id: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    maxTokens: 4096,
    temperature: 0.7,
  },
  claude: {
    name: 'Claude',
    id: 'claude',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-sonnet-20240229',
    maxTokens: 4096,
    temperature: 0.7,
  },
  gpt4: {
    name: 'GPT-4',
    id: 'gpt4',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-4',
    maxTokens: 4096,
    temperature: 0.7,
  },
  gpt35: {
    name: 'GPT-3.5 Turbo',
    id: 'gpt35',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-3.5-turbo',
    maxTokens: 4096,
    temperature: 0.7,
  },
  gpt4turbo: {
    name: 'GPT-4 Turbo',
    id: 'gpt4turbo',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-4-turbo-preview',
    maxTokens: 4096,
    temperature: 0.7,
  },
  qwen: {
    name: '通义千问',
    id: 'qwen',
    baseUrl: 'https://dashscope.aliyuncs.com',
    model: 'qwen-turbo',
    maxTokens: 4096,
    temperature: 0.7,
  },
  kimi: {
    name: 'Kimi',
    id: 'kimi',
    baseUrl: 'https://api.moonshot.cn',
    model: 'moonshot-v1-8k',
    maxTokens: 8192,
    temperature: 0.7,
  },
} as const;

export type AIProviderId = keyof typeof AI_PROVIDERS;

// 统一的 API 调用函数
export async function callAIAPI(
  provider: AIProvider,
  messages: AIMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  } = {}
): Promise<AIResponse> {
  const { temperature = provider.temperature, maxTokens = provider.maxTokens, stream = false } = options;

  try {
    switch (provider.id) {
      case 'deepseek':
      case 'gpt4':
      case 'gpt35':
      case 'gpt4turbo':
        return await callOpenAICompatibleAPI(provider, messages, { temperature, maxTokens, stream });

      case 'claude':
        return await callClaudeAPI(provider, messages, { temperature, maxTokens, stream });

      case 'qwen':
        return await callQwenAPI(provider, messages, { temperature, maxTokens, stream });

      case 'kimi':
        return await callKimiAPI(provider, messages, { temperature, maxTokens, stream });

      default:
        return { success: false, error: '不支持的 AI 提供商' };
    }
  } catch (error) {
    console.error('AI API 调用错误:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

// OpenAI 兼容 API 调用
async function callOpenAICompatibleAPI(
  provider: AIProvider,
  messages: AIMessage[],
  options: { temperature?: number; maxTokens?: number; stream?: boolean }
): Promise<AIResponse> {
  const response = await fetch(`${provider.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: options.stream,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API 调用失败: ${response.status}`);
  }

  const data = await response.json();
  return {
    success: true,
    content: data.choices[0].message.content,
  };
}

// Claude API 调用
async function callClaudeAPI(
  provider: AIProvider,
  messages: AIMessage[],
  options: { temperature?: number; maxTokens?: number; stream?: boolean }
): Promise<AIResponse> {
  // 将消息转换为 Claude 格式
  const claudeMessages = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content,
  }));

  const response = await fetch(`${provider.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: provider.model,
      messages: claudeMessages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: options.stream,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API 调用失败: ${response.status}`);
  }

  const data = await response.json();
  return {
    success: true,
    content: data.content[0].text,
  };
}

// 通义千问 API 调用
async function callQwenAPI(
  provider: AIProvider,
  messages: AIMessage[],
  options: { temperature?: number; maxTokens?: number; stream?: boolean }
): Promise<AIResponse> {
  const response = await fetch(`${provider.baseUrl}/api/v1/services/aigc/text-generation/generation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
      'X-DashScope-SSE': options.stream ? 'enable' : 'disable',
    },
    body: JSON.stringify({
      model: provider.model,
      input: {
        messages,
      },
      parameters: {
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      },
    }),
  });

  if (!response.ok) {
    let errorMessage = `API 调用失败: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error?.message || errorMessage;
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return {
    success: true,
    content: data.output.text,
  };
}

// Kimi API 调用
async function callKimiAPI(
  provider: AIProvider,
  messages: AIMessage[],
  options: { temperature?: number; maxTokens?: number; stream?: boolean }
): Promise<AIResponse> {
  const response = await fetch(`${provider.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: options.stream,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API 调用失败: ${response.status}`);
  }

  const data = await response.json();
  return {
    success: true,
    content: data.choices[0].message.content,
  };
}

// 认证机制管理
export class AuthManager {
  private static instance: AuthManager;
  private authData: Map<string, { apiKey: string; baseUrl?: string; expiresAt?: number } | undefined> = new Map();

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  setAuth(providerId: string, apiKey: string, baseUrl?: string, expiresAt?: number) {
    this.authData.set(providerId, { apiKey, baseUrl, expiresAt });
    // 持久化存储
    localStorage.setItem(`ai_auth_${providerId}`, JSON.stringify({ apiKey, baseUrl, expiresAt }));
  }

  getAuth(providerId: string) {
    // 先从内存获取
    let auth = this.authData.get(providerId);
    if (!auth) {
      // 从 localStorage 加载
      const stored = localStorage.getItem(`ai_auth_${providerId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed) {
          auth = parsed;
          this.authData.set(providerId, auth);
        }
      }
    }

    // 检查是否过期
    if (auth?.expiresAt && Date.now() > auth.expiresAt) {
      this.authData.delete(providerId);
      localStorage.removeItem(`ai_auth_${providerId}`);
      return null;
    }

    return auth ?? undefined;
  }

  clearAuth(providerId: string) {
    this.authData.delete(providerId);
    localStorage.removeItem(`ai_auth_${providerId}`);
  }

  // 刷新令牌（如果支持）
  async refreshToken(providerId: string): Promise<boolean> {
    // 这里可以实现具体的令牌刷新逻辑
    // 目前返回 false，表示不支持自动刷新
    return false;
  }
}

// 请求限流管理
export class RateLimiter {
  private static instance: RateLimiter;
  private requests: Map<string, number[]> = new Map();

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  canMakeRequest(providerId: string, limit: number = 60, windowMs: number = 60000): boolean {
    const now = Date.now();
    const key = providerId;
    const timestamps = this.requests.get(key) || [];

    // 清理过期的时间戳
    const validTimestamps = timestamps.filter(ts => now - ts < windowMs);

    if (validTimestamps.length >= limit) {
      return false;
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    return true;
  }

  getRemainingRequests(providerId: string, limit: number = 60, windowMs: number = 60000): number {
    const now = Date.now();
    const timestamps = this.requests.get(providerId) || [];
    const validTimestamps = timestamps.filter(ts => now - ts < windowMs);
    return Math.max(0, limit - validTimestamps.length);
  }
}

// 配额管理
export class QuotaManager {
  private static instance: QuotaManager;
  private usage: Map<string, { used: number; limit: number; resetAt: number }> = new Map();

  static getInstance(): QuotaManager {
    if (!QuotaManager.instance) {
      QuotaManager.instance = new QuotaManager();
    }
    return QuotaManager.instance;
  }

  setQuota(providerId: string, used: number, limit: number, resetAt: number) {
    this.usage.set(providerId, { used, limit, resetAt });
  }

  canUseQuota(providerId: string, tokens: number = 1): boolean {
    const quota = this.usage.get(providerId);
    if (!quota) return true; // 没有配额限制

    if (Date.now() > quota.resetAt) {
      // 重置配额
      this.usage.delete(providerId);
      return true;
    }

    return quota.used + tokens <= quota.limit;
  }

  getQuotaInfo(providerId: string) {
    return this.usage.get(providerId);
  }
}