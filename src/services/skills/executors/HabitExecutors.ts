/**
 * 习惯工具执行器
 * 实现 read_habits, create_habit 工具
 */

import { ToolExecutor, ToolExecutionResult } from '../SkillRegistry';
import { AIHabit } from '../../types';
import { getGlobalDispatch } from '../../../context/AppContext';

// 生成 UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface HabitData {
  id: string;
  title: string;
  description?: string;
  type: 'task' | 'habit';
  priority: 'high' | 'medium' | 'low';
  category: string;
  deadline?: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  progress: number;
  streak: number;
  isStarred: boolean;
  isArchived: boolean;
  period?: 'daily' | 'weekly' | 'monthly';
  timesPerPeriod?: number;
}

interface HabitQuery {
  query?: string;
  limit?: number;
  includeArchived?: boolean;
}

interface CreateHabitArgs {
  title: string;
  description?: string;
  period?: 'daily' | 'weekly' | 'monthly';
  timesPerPeriod?: number;
  targetType?: 'exact' | 'minimum' | 'maximum';
  totalTarget?: number;
  category?: string;
  tags?: string[];
}

// ============================================================================
// 数据访问层
// ============================================================================

/**
 * 获取习惯存储键
 */
function getHabitStorageKey(): string {
  return 'deadliner_habits';
}

/**
 * 从存储获取习惯
 */
function getHabitsFromStorage(): HabitData[] {
  try {
    const stored = localStorage.getItem(getHabitStorageKey());
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error('Failed to get habits from storage:', err);
  }
  return [];
}

/**
 * 保存习惯到存储
 */
function saveHabitsToStorage(habits: HabitData[]): void {
  try {
    localStorage.setItem(getHabitStorageKey(), JSON.stringify(habits));
  } catch (err) {
    console.error('Failed to save habits to storage:', err);
  }
}

/**
 * 通过 Electron IPC 获取习惯（如果可用）
 */
async function getHabitsViaIPC(): Promise<HabitData[]> {
  if (typeof window !== 'undefined' && (window as any).electron?.storage) {
    try {
      const tasks = await (window as any).electron.storage.getTasks();
      // 过滤出习惯类型的任务
      return (tasks || []).filter((t: TaskData) => t.type === 'habit');
    } catch (err) {
      console.error('Failed to get habits via IPC:', err);
    }
  }
  return getHabitsFromStorage();
}

/**
 * 通过 Electron IPC 创建习惯（如果可用）
 */
async function createHabitViaIPC(
  habit: Omit<HabitData, 'id' | 'createdAt' | 'updatedAt' | 'progress' | 'streak'>
): Promise<HabitData> {
  if (typeof window !== 'undefined' && (window as any).electron?.storage) {
    try {
      return await (window as any).electron.storage.createTask(habit);
    } catch (err) {
      console.error('Failed to create habit via IPC:', err);
    }
  }

  // Web 后备：使用 localStorage
  const habits = getHabitsFromStorage();
  const now = new Date().toISOString();
  const newHabit: HabitData = {
    ...habit,
    id: generateUUID(),
    progress: 0,
    streak: 0,
    createdAt: now,
    updatedAt: now,
  };
  habits.push(newHabit);
  saveHabitsToStorage(habits);
  return newHabit;
}

// 类型别名用于 IPC 响应
type TaskData = HabitData;

// ============================================================================
// 工具执行器实现
// ============================================================================

export class HabitExecutors implements ToolExecutor {
  /**
   * 执行工具
   */
  async execute(toolName: string, args: Record<string, unknown>): Promise<ToolExecutionResult> {
    switch (toolName) {
      case 'read_habits':
        return this.readHabits(args as unknown as HabitQuery);
      case 'create_habit':
        return this.createHabit(args as unknown as CreateHabitArgs);
      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
          errorCode: 'UNKNOWN_TOOL',
        };
    }
  }

  /**
   * read_habits: 读取习惯列表
   */
  private async readHabits(query: HabitQuery): Promise<ToolExecutionResult> {
    try {
      const allHabits = await getHabitsViaIPC();
      let filteredHabits = allHabits.filter((h) => h.type === 'habit');

      // 过滤归档状态
      if (!query.includeArchived) {
        filteredHabits = filteredHabits.filter((h) => !h.isArchived);
      }

      // 搜索过滤
      if (query.query) {
        const searchLower = query.query.toLowerCase();
        filteredHabits = filteredHabits.filter(
          (h) =>
            h.title.toLowerCase().includes(searchLower) ||
            h.description?.toLowerCase().includes(searchLower)
        );
      }

      // 限制数量
      const limit = query.limit || 20;
      filteredHabits = filteredHabits.slice(0, limit);

      // 转换为 AI 习惯格式
      const aiHabits: AIHabit[] = filteredHabits.map((h) => ({
        name: h.title,
        period: this.inferPeriod(h.description) || 'daily',
        timesPerPeriod: 1,
        goalType: 'minimum',
        totalTarget: h.streak > 0 ? h.streak : undefined,
        description: h.description,
      }));

      return {
        success: true,
        result: {
          habits: aiHabits,
          total: filteredHabits.length,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to read habits',
        errorCode: 'READ_HABITS_ERROR',
      };
    }
  }

  /**
   * create_habit: 创建新习惯
   */
  private async createHabit(args: CreateHabitArgs): Promise<ToolExecutionResult> {
    try {
      if (!args.title) {
        return {
          success: false,
          error: 'Habit title is required',
          errorCode: 'MISSING_TITLE',
        };
      }

      const period = args.period || 'daily';
      const timesPerPeriod = args.timesPerPeriod || 1;

      const newHabit = await createHabitViaIPC({
        title: args.title,
        description: args.description,
        period,
        priority: 'medium',
        category: args.category || 'uncategorized',
        tags: args.tags || [],
        type: 'habit',
        completed: false,
        isStarred: false,
        isArchived: false,
      });

      // 同步到 React 应用状态
      const dispatch = getGlobalDispatch();
      if (dispatch) {
        dispatch({
          type: 'ADD_TASK',
          payload: {
            title: args.title,
            description: args.description || `每${period === 'daily' ? '天' : period === 'weekly' ? '周' : '月'} ${timesPerPeriod} 次`,
            type: 'habit',
            priority: 'medium',
            category: args.category || 'uncategorized',
            tags: args.tags || [],
            completed: false,
            isStarred: false,
            isArchived: false,
          },
        });
      }

      return {
        success: true,
        result: {
          habit: {
            name: newHabit.title,
            period,
            timesPerPeriod,
            goalType: args.targetType || 'minimum',
            totalTarget: args.totalTarget,
            description: newHabit.description,
          },
          habitId: newHabit.id,
          message: `习惯 "${args.title}" 已创建`,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create habit',
        errorCode: 'CREATE_HABIT_ERROR',
      };
    }
  }

  /**
   * 从描述推断习惯周期
   */
  private inferPeriod(description?: string): string | null {
    if (!description) return null;

    const descLower = description.toLowerCase();

    if (descLower.includes('每天') || descLower.includes('daily')) {
      return 'daily';
    }
    if (descLower.includes('每周') || descLower.includes('weekly')) {
      return 'weekly';
    }
    if (descLower.includes('每月') || descLower.includes('monthly')) {
      return 'monthly';
    }

    return null;
  }
}

// ============================================================================
// 默认实例
// ============================================================================

let defaultHabitExecutors: HabitExecutors | null = null;

export function getHabitExecutors(): HabitExecutors {
  if (!defaultHabitExecutors) {
    defaultHabitExecutors = new HabitExecutors();
  }
  return defaultHabitExecutors;
}
