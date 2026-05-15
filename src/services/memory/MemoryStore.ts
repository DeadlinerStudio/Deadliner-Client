/**
 * Memory Store - 记忆存储系统
 * 对齐 LifiAI-Core 的 MemoryStore 实现
 */

import {
  MemoryFragment,
  ConversationTurn,
  MemorySnapshot,
  MemorySyncOperation,
  MemorySyncPayload,
  MemorySyncOperationType,
  MEMORY_CONFIG,
  generateUUID,
} from '../types';

// ============================================================================
// 存储键
// ============================================================================

const STORAGE_KEYS = {
  REVISION: 'deadliner_memory_revision',
  FRAGMENTS: 'deadliner_memory_fragments',
  USER_PROFILE: 'deadliner_memory_user_profile',
  CONVERSATION_HISTORY: 'deadliner_memory_conversation_history',
  LAST_SYNCED_REVISION: 'deadliner_memory_last_synced_revision',
} as const;

// ============================================================================
// MemoryStore 类
// ============================================================================

export class MemoryStore {
  private revision: number = 0;
  private lastSyncedRevision: number = 0;
  private fragments: MemoryFragment[] = [];
  private userProfile: string = '';
  private conversationHistory: ConversationTurn[] = [];
  private pendingSync: MemorySyncOperation[] = [];

  constructor() {
    this.loadFromStorage();
  }

  // ============================================================================
  // 持久化
  // ============================================================================

  private loadFromStorage(): void {
    try {
      this.revision = this.getNumber(STORAGE_KEYS.REVISION) || 0;
      this.lastSyncedRevision = this.getNumber(STORAGE_KEYS.LAST_SYNCED_REVISION) || 0;

      const fragmentsJson = localStorage.getItem(STORAGE_KEYS.FRAGMENTS);
      if (fragmentsJson) {
        this.fragments = JSON.parse(fragmentsJson);
      }

      this.userProfile =
        localStorage.getItem(STORAGE_KEYS.USER_PROFILE) || '';

      const historyJson = localStorage.getItem(STORAGE_KEYS.CONVERSATION_HISTORY);
      if (historyJson) {
        this.conversationHistory = JSON.parse(historyJson);
      }
    } catch (err) {
      console.error('Failed to load memory from storage:', err);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(
        STORAGE_KEYS.REVISION,
        this.revision.toString()
      );
      localStorage.setItem(
        STORAGE_KEYS.LAST_SYNCED_REVISION,
        this.lastSyncedRevision.toString()
      );
      localStorage.setItem(
        STORAGE_KEYS.FRAGMENTS,
        JSON.stringify(this.fragments)
      );
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, this.userProfile);
      localStorage.setItem(
        STORAGE_KEYS.CONVERSATION_HISTORY,
        JSON.stringify(this.conversationHistory)
      );
    } catch (err) {
      console.error('Failed to save memory to storage:', err);
    }
  }

  private getNumber(key: string): number | null {
    const value = localStorage.getItem(key);
    if (value) {
      const num = parseInt(value, 10);
      return isNaN(num) ? null : num;
    }
    return null;
  }

  // ============================================================================
  // 记忆片段管理
  // ============================================================================

  /**
   * 保存记忆片段
   */
  async saveMemory(content: string, category: string): Promise<void> {
    // 去重检查
    if (this.fragments.some((f) => f.content === content)) {
      return;
    }

    const fragment: MemoryFragment = {
      id: generateUUID(),
      content,
      category,
      timestamp: new Date().toISOString(),
      importance: 3,
    };

    this.fragments.push(fragment);
    this.revision++;

    this.pendingSync.push({
      type: MemorySyncOperationType.UpsertFragment,
      fragment,
    });

    await this.pruneMemories();
    this.saveToStorage();
  }

  /**
   * 获取所有记忆片段
   */
  async getAllFragments(): Promise<MemoryFragment[]> {
    return [...this.fragments];
  }

  /**
   * 删除记忆片段
   */
  async deleteFragment(fragmentId: string): Promise<void> {
    const index = this.fragments.findIndex((f) => f.id === fragmentId);
    if (index !== -1) {
      this.fragments.splice(index, 1);
      this.revision++;
      this.pendingSync.push({
        type: MemorySyncOperationType.DeleteFragment,
        fragmentId,
      });
      this.saveToStorage();
    }
  }

  // ============================================================================
  // 用户画像
  // ============================================================================

  /**
   * 保存用户画像
   */
  async saveUserProfile(profile: string): Promise<void> {
    this.userProfile = profile.trim();
    this.revision++;
    this.pendingSync.push({
      type: MemorySyncOperationType.ReplaceUserProfile,
      profile: this.userProfile,
    });
    this.saveToStorage();
  }

  /**
   * 获取用户画像
   */
  async getUserProfile(): Promise<string> {
    return this.userProfile;
  }

  // ============================================================================
  // 长期上下文
  // ============================================================================

  /**
   * 获取长期上下文（用于 Prompt 注入）
   */
  async getLongTermContext(): Promise<string> {
    const parts: string[] = [];

    // 用户画像
    if (this.userProfile) {
      parts.push(`【用户画像】\n${this.userProfile}`);
    } else {
      parts.push('【用户画像】\n(暂无)');
    }

    // 近期偏好/事实
    if (this.fragments.length > 0) {
      const bullets = this.fragments
        .slice(-6)
        .reverse()
        .map((f) => `- ${f.content}`)
        .join('\n');
      parts.push(`【近期用户偏好/事实】\n${bullets}`);
    }

    const joined = parts.join('\n\n');

    // 限制总长度
    if (joined.length > MEMORY_CONFIG.MAX_LONG_TERM_CONTEXT_CHARS) {
      return joined.substring(0, MEMORY_CONFIG.MAX_LONG_TERM_CONTEXT_CHARS) + '…';
    }

    return joined;
  }

  // ============================================================================
  // 对话历史
  // ============================================================================

  /**
   * 添加对话轮次
   */
  async appendConversationTurn(
    role: 'user' | 'assistant',
    content: string
  ): Promise<void> {
    const normalized = this.normalizeContent(content);
    if (!normalized) return;

    this.conversationHistory.push({
      role,
      content: normalized,
      timestamp: new Date().toISOString(),
    });

    // 限制对话历史长度
    if (this.conversationHistory.length > MEMORY_CONFIG.MAX_CONVERSATION_TURNS) {
      const overflow =
        this.conversationHistory.length - MEMORY_CONFIG.MAX_CONVERSATION_TURNS;
      this.conversationHistory.splice(0, overflow);
    }

    this.saveToStorage();
  }

  /**
   * 获取最近的对话上下文
   */
  async getRecentConversationContext(
    limit: number = MEMORY_CONFIG.MAX_CONVERSATION_CONTEXT_TURNS
  ): Promise<string> {
    if (this.conversationHistory.length === 0) {
      return '';
    }

    const take = Math.max(1, Math.min(limit, MEMORY_CONFIG.MAX_CONVERSATION_CONTEXT_TURNS));
    const recent = this.conversationHistory.slice(-take);

    return recent
      .map((turn) => {
        const label = turn.role === 'assistant' ? '助手' : '用户';
        return `${label}: ${turn.content}`;
      })
      .join('\n');
  }

  // ============================================================================
  // 快照同步
  // ============================================================================

  /**
   * 替换整个快照
   */
  async replaceSnapshot(snapshot: MemorySnapshot): Promise<void> {
    this.revision = snapshot.revision;
    this.lastSyncedRevision = snapshot.revision;
    this.fragments = snapshot.fragments;
    this.userProfile = snapshot.userProfile;
    this.pendingSync = [];
    this.saveToStorage();
  }

  /**
   * 获取当前快照
   */
  async currentSnapshot(): Promise<MemorySnapshot> {
    return {
      revision: this.revision,
      fragments: [...this.fragments],
      userProfile: this.userProfile,
    };
  }

  /**
   * 获取待同步的增量
   */
  async drainPendingSync(): Promise<MemorySyncPayload> {
    const payload: MemorySyncPayload = {
      baseRevision: this.lastSyncedRevision,
      nextRevision: this.revision,
      operations: [...this.pendingSync],
    };

    this.lastSyncedRevision = this.revision;
    this.pendingSync = [];
    this.saveToStorage();

    return payload;
  }

  /**
   * 导出增量同步 JSON
   */
  async exportDeltaSync(): Promise<string | null> {
    const payload = await this.drainPendingSync();
    if (payload.operations.length === 0) {
      return null;
    }
    return JSON.stringify(payload);
  }

  /**
   * 导入增量同步
   */
  async importDeltaSync(deltaJson: string): Promise<void> {
    try {
      const delta = JSON.parse(deltaJson) as MemorySyncPayload;

      for (const operation of delta.operations) {
        switch (operation.type) {
          case 'UpsertFragment':
            if (operation.fragment) {
              const exists = this.fragments.some(
                (f) => f.id === operation.fragment!.id
              );
              if (exists) {
                const index = this.fragments.findIndex(
                  (f) => f.id === operation.fragment!.id
                );
                this.fragments[index] = operation.fragment;
              } else {
                this.fragments.push(operation.fragment);
              }
            }
            break;

          case 'DeleteFragment':
            if (operation.fragmentId) {
              this.fragments = this.fragments.filter(
                (f) => f.id !== operation.fragmentId
              );
            }
            break;

          case 'ReplaceUserProfile':
            if (operation.profile !== undefined) {
              this.userProfile = operation.profile;
            }
            break;
        }
      }

      this.revision = delta.nextRevision;
      this.saveToStorage();
    } catch (err) {
      console.error('Failed to import delta sync:', err);
    }
  }

  // ============================================================================
  // 清理
  // ============================================================================

  /**
   * 清理过期和超量记忆
   */
  private async pruneMemories(): Promise<void> {
    const now = new Date();
    const cutoff = new Date(
      now.getTime() - MEMORY_CONFIG.MAX_AGE_DAYS * 24 * 60 * 60 * 1000
    );
    const cutoffISO = cutoff.toISOString();

    const removedIds: string[] = [];

    // 1. 时间过期淘汰
    this.fragments = this.fragments.filter((f) => {
      const keep = f.timestamp >= cutoffISO;
      if (!keep) {
        removedIds.push(f.id);
      }
      return keep;
    });

    // 2. 超容量淘汰（按重要性和时间排序）
    if (this.fragments.length > MEMORY_CONFIG.MAX_FRAGMENTS) {
      this.fragments.sort((a, b) => {
        if (a.importance !== b.importance) {
          return b.importance - a.importance;
        }
        return b.timestamp.localeCompare(a.timestamp);
      });

      const removed = this.fragments.splice(MEMORY_CONFIG.MAX_FRAGMENTS);
      removedIds.push(...removed.map((f) => f.id));
    }

    // 添加删除操作到待同步队列
    for (const id of removedIds) {
      this.pendingSync.push({
        type: MemorySyncOperationType.DeleteFragment,
        fragmentId: id,
      });
    }
  }

  /**
   * 清空所有记忆
   */
  async clearAll(): Promise<void> {
    this.revision++;
    this.fragments = [];
    this.userProfile = '';
    this.conversationHistory = [];
    this.pendingSync = [
      {
        type: MemorySyncOperationType.ReplaceUserProfile,
        profile: '',
      },
    ];
    this.saveToStorage();
  }

  // ============================================================================
  // 工具函数
  // ============================================================================

  private normalizeContent(content: string): string {
    const trimmed = content.trim();
    if (trimmed.length <= MEMORY_CONFIG.MAX_CONVERSATION_MESSAGE_CHARS) {
      return trimmed;
    }
    return (
      trimmed.substring(0, MEMORY_CONFIG.MAX_CONVERSATION_MESSAGE_CHARS) + '…'
    );
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    revision: number;
    fragmentCount: number;
    conversationTurns: number;
    hasProfile: boolean;
  } {
    return {
      revision: this.revision,
      fragmentCount: this.fragments.length,
      conversationTurns: this.conversationHistory.length,
      hasProfile: !!this.userProfile,
    };
  }
}

// ============================================================================
// 单例
// ============================================================================

let globalMemoryStore: MemoryStore | null = null;

export function getMemoryStore(): MemoryStore {
  if (!globalMemoryStore) {
    globalMemoryStore = new MemoryStore();
  }
  return globalMemoryStore;
}

export function resetMemoryStore(): void {
  globalMemoryStore = null;
}
