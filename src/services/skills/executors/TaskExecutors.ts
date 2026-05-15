/**
 * 任务工具执行器
 * 实现 read_tasks, create_task, update_deadline 工具
 */

import { ToolExecutor, ToolExecutionResult } from '../SkillRegistry';
import { AITask } from '../../types';
import { getGlobalDispatch } from '../../../context/AppContext';

// 生成 UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface TaskData {
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
  isStarred: boolean;
  isArchived: boolean;
}

interface TaskQuery {
  query?: string;
  limit?: number;
  includeArchived?: boolean;
}

interface CreateTaskArgs {
  title: string;
  description?: string;
  deadline?: string;
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  tags?: string[];
}

interface UpdateDeadlineArgs {
  taskId: string;
  newDueTime: string;
}

// ============================================================================
// 数据访问层
// ============================================================================

/**
 * 获取任务存储键
 */
function getTaskStorageKey(): string {
  return 'deadliner_tasks';
}

/**
 * 从存储获取任务
 */
function getTasksFromStorage(): TaskData[] {
  try {
    const stored = localStorage.getItem(getTaskStorageKey());
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error('Failed to get tasks from storage:', err);
  }
  return [];
}

/**
 * 保存任务到存储
 */
function saveTasksToStorage(tasks: TaskData[]): void {
  try {
    localStorage.setItem(getTaskStorageKey(), JSON.stringify(tasks));
  } catch (err) {
    console.error('Failed to save tasks to storage:', err);
  }
}

/**
 * 通过 Electron IPC 获取任务（如果可用）
 */
async function getTasksViaIPC(): Promise<TaskData[]> {
  // 检查是否有 Electron API
  if (typeof window !== 'undefined' && (window as any).electron?.storage) {
    try {
      const tasks = await (window as any).electron.storage.getTasks();
      return tasks || [];
    } catch (err) {
      console.error('Failed to get tasks via IPC:', err);
    }
  }
  return getTasksFromStorage();
}

/**
 * 通过 Electron IPC 创建任务（如果可用）
 */
async function createTaskViaIPC(task: Omit<TaskData, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaskData> {
  if (typeof window !== 'undefined' && (window as any).electron?.storage) {
    try {
      return await (window as any).electron.storage.createTask(task);
    } catch (err) {
      console.error('Failed to create task via IPC:', err);
    }
  }

  // Web 后备：使用 localStorage
  const tasks = getTasksFromStorage();
  const now = new Date().toISOString();
  const newTask: TaskData = {
    ...task,
    id: generateUUID(),
    createdAt: now,
    updatedAt: now,
  };
  tasks.push(newTask);
  saveTasksToStorage(tasks);
  return newTask;
}

/**
 * 通过 Electron IPC 更新任务（如果可用）
 */
async function updateTaskViaIPC(taskId: string, updates: Partial<TaskData>): Promise<TaskData | null> {
  if (typeof window !== 'undefined' && (window as any).electron?.storage) {
    try {
      return await (window as any).electron.storage.updateTask(taskId, updates);
    } catch (err) {
      console.error('Failed to update task via IPC:', err);
    }
  }

  // Web 后备：使用 localStorage
  const tasks = getTasksFromStorage();
  const index = tasks.findIndex((t) => t.id === taskId);
  if (index === -1) return null;

  tasks[index] = {
    ...tasks[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveTasksToStorage(tasks);
  return tasks[index];
}

// ============================================================================
// 工具执行器实现
// ============================================================================

export class TaskExecutors implements ToolExecutor {
  /**
   * 执行工具
   */
  async execute(toolName: string, args: Record<string, unknown>): Promise<ToolExecutionResult> {
    switch (toolName) {
      case 'read_tasks':
        return this.readTasks(args as unknown as TaskQuery);
      case 'create_task':
        return this.createTask(args as unknown as CreateTaskArgs);
      case 'update_deadline':
        return this.updateDeadline(args as unknown as UpdateDeadlineArgs);
      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
          errorCode: 'UNKNOWN_TOOL',
        };
    }
  }

  /**
   * read_tasks: 读取任务列表
   */
  private async readTasks(query: TaskQuery): Promise<ToolExecutionResult> {
    try {
      const allTasks = await getTasksViaIPC();
      let filteredTasks = allTasks.filter((t) => t.type === 'task');

      // 过滤归档状态
      if (!query.includeArchived) {
        filteredTasks = filteredTasks.filter((t) => !t.isArchived);
      }

      // 搜索过滤
      if (query.query) {
        const searchLower = query.query.toLowerCase();
        filteredTasks = filteredTasks.filter(
          (t) =>
            t.title.toLowerCase().includes(searchLower) ||
            t.description?.toLowerCase().includes(searchLower)
        );
      }

      // 限制数量
      const limit = query.limit || 20;
      filteredTasks = filteredTasks.slice(0, limit);

      // 转换为 AI 任务格式
      const aiTasks: AITask[] = filteredTasks.map((t) => ({
        name: t.title,
        dueTime: t.deadline
          ? new Date(t.deadline).toISOString().replace('T', ' ').substring(0, 16)
          : undefined,
        note: t.description,
        priority: t.priority,
        category: t.category,
        tags: t.tags,
      }));

      return {
        success: true,
        result: {
          tasks: aiTasks,
          total: filteredTasks.length,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to read tasks',
        errorCode: 'READ_TASKS_ERROR',
      };
    }
  }

  /**
   * create_task: 创建新任务
   */
  private async createTask(args: CreateTaskArgs): Promise<ToolExecutionResult> {
    try {
      if (!args.title) {
        return {
          success: false,
          error: 'Task title is required',
          errorCode: 'MISSING_TITLE',
        };
      }

      const newTask = await createTaskViaIPC({
        title: args.title,
        description: args.description,
        deadline: args.deadline,
        priority: args.priority || 'medium',
        category: args.category || 'uncategorized',
        tags: args.tags || [],
        type: 'task',
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
            description: args.description || '',
            type: 'task',
            priority: args.priority || 'medium',
            category: args.category || 'uncategorized',
            tags: args.tags || [],
            deadline: args.deadline ? new Date(args.deadline) : undefined,
            completed: false,
            isStarred: false,
            isArchived: false,
          },
        });
      }

      return {
        success: true,
        result: {
          task: {
            name: newTask.title,
            dueTime: newTask.deadline
              ? new Date(newTask.deadline).toISOString().replace('T', ' ').substring(0, 16)
              : undefined,
            note: newTask.description,
          },
          taskId: newTask.id,
          message: `任务 "${args.title}" 已创建`,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create task',
        errorCode: 'CREATE_TASK_ERROR',
      };
    }
  }

  /**
   * update_deadline: 更新任务截止时间
   */
  private async updateDeadline(args: UpdateDeadlineArgs): Promise<ToolExecutionResult> {
    try {
      if (!args.taskId) {
        return {
          success: false,
          error: 'Task ID is required',
          errorCode: 'MISSING_TASK_ID',
        };
      }

      if (!args.newDueTime) {
        return {
          success: false,
          error: 'New due time is required',
          errorCode: 'MISSING_DUE_TIME',
        };
      }

      // 验证日期格式
      const dateMatch = args.newDueTime.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      if (!dateMatch) {
        return {
          success: false,
          error: 'Invalid date format. Expected: YYYY-MM-DD HH:mm',
          errorCode: 'INVALID_DATE_FORMAT',
        };
      }

      const updatedTask = await updateTaskViaIPC(args.taskId, {
        deadline: new Date(args.newDueTime).toISOString(),
      });

      if (!updatedTask) {
        return {
          success: false,
          error: `Task not found: ${args.taskId}`,
          errorCode: 'TASK_NOT_FOUND',
        };
      }

      return {
        success: true,
        result: {
          taskId: updatedTask.id,
          newDueTime: args.newDueTime,
          updated: true,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update deadline',
        errorCode: 'UPDATE_DEADLINE_ERROR',
      };
    }
  }
}

// ============================================================================
// 默认实例
// ============================================================================

let defaultTaskExecutors: TaskExecutors | null = null;

export function getTaskExecutors(): TaskExecutors {
  if (!defaultTaskExecutors) {
    defaultTaskExecutors = new TaskExecutors();
  }
  return defaultTaskExecutors;
}
