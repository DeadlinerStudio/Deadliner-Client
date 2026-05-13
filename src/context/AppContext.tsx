/**
 * Deadliner 应用程序上下文
 * 提供全局状态管理和数据操作功能
 */

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, Task, Category } from '../types';
import { v4 as uuidv4 } from 'uuid';

// 初始应用程序状态
const initialState: AppState = {
  user: null,
  tasks: [],
  categories: [],
  currentView: 'overview',
  currentFilter: 'all',
  selectedCategory: null,
  sortBy: 'deadline',
  searchQuery: '',
  isMultiSelectMode: false,
  selectedTasks: new Set(),
  sidebarCollapsed: false,
  loading: false,
  error: null,
};

// 检查是否在Electron环境中
const isElectron = typeof window !== 'undefined' && window.electron;

// 数据缓存，用于存储任务和分类数据
const cache = new Map<string, any>();
const dataCache = {
  get: (key: string) => cache.get(key),
  set: (key: string, value: any) => cache.set(key, value),
  invalidate: (key: string) => cache.delete(key)
};

// 全局 dispatch 引用，供 AI Agent Pipeline 使用
let globalDispatch: React.Dispatch<AppAction> | null = null;
export const setGlobalDispatch = (dispatch: React.Dispatch<AppAction>) => {
  globalDispatch = dispatch;
};
export const getGlobalDispatch = () => globalDispatch;

// 动作类型
export type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_VIEW'; payload: AppState['currentView'] }
  | { type: 'SET_FILTER'; payload: AppState['currentFilter'] }
  | { type: 'SET_CATEGORY'; payload: string | null }
  | { type: 'SET_SORT'; payload: AppState['sortBy'] }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_MULTI_SELECT' }
  | { type: 'SELECT_TASK'; payload: string }
  | { type: 'DESELECT_TASK'; payload: string }
  | { type: 'CLEAR_SELECTED_TASKS' }
  | { type: 'LOAD_TASKS'; payload: Task[] }
  | { type: 'LOAD_CATEGORIES'; payload: Category[] }
  | { type: 'ADD_TASK'; payload: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<Task, 'id' | 'createdAt' | 'updatedAt'>> }
  | { type: 'UPDATE_TASK'; payload: { id: string; updates: Partial<Task> } }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'TOGGLE_TASK_COMPLETION'; payload: string }
  | { type: 'TOGGLE_TASK_STAR'; payload: string }
  | { type: 'ARCHIVE_TASK'; payload: string }
  | { type: 'UNARCHIVE_TASK'; payload: string }
  | { type: 'BATCH_COMPLETE_TASKS'; payload: string[] }
  | { type: 'BATCH_DELETE_TASKS'; payload: string[] }
  | { type: 'BATCH_ARCHIVE_TASKS'; payload: string[] }
  | { type: 'ADD_CATEGORY'; payload: Omit<Category, 'id'> }
  | { type: 'UPDATE_CATEGORY'; payload: { id: string; updates: Partial<Category> } }
  | { type: 'DELETE_CATEGORY'; payload: string };

// 状态管理器函数
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'LOAD_TASKS':
      return { ...state, tasks: action.payload, loading: false };

    case 'LOAD_CATEGORIES':
      return { ...state, categories: action.payload };

    case 'SET_VIEW':
      return { ...state, currentView: action.payload };

    case 'SET_FILTER':
      return { ...state, currentFilter: action.payload };

    case 'SET_CATEGORY':
      return { ...state, selectedCategory: action.payload };

    case 'SET_SORT':
      return { ...state, sortBy: action.payload };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };

    case 'TOGGLE_MULTI_SELECT':
      return {
        ...state,
        isMultiSelectMode: !state.isMultiSelectMode,
        selectedTasks: new Set(), // 切换时清除选择
      };

    case 'SELECT_TASK':
      return {
        ...state,
        selectedTasks: new Set(Array.from(state.selectedTasks).concat(action.payload)),
      };

    case 'DESELECT_TASK':
      const newSelectedTasks = new Set(state.selectedTasks);
      newSelectedTasks.delete(action.payload);
      return {
        ...state,
        selectedTasks: newSelectedTasks,
      };

    case 'CLEAR_SELECTED_TASKS':
      return { ...state, selectedTasks: new Set() };

    case 'ADD_TASK':
      const newTask: Task = {
        ...action.payload,
        id: action.payload.id || uuidv4(), // 如果 payload 中有 id 就使用,否则生成新的
        createdAt: action.payload.createdAt || new Date(),
        updatedAt: action.payload.updatedAt || new Date(),
      };
      dataCache.invalidate('tasks'); // 使任务缓存失效
      return {
        ...state,
        tasks: [...state.tasks, newTask],
      };

    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload.id
            ? { ...task, ...action.payload.updates, updatedAt: new Date() }
            : task
        ),
      };

    case 'DELETE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter(task => task.id !== action.payload),
      };

    case 'TOGGLE_TASK_COMPLETION':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload
            ? { ...task, completed: !task.completed, updatedAt: new Date() }
            : task
        ),
      };

    case 'TOGGLE_TASK_STAR':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload
            ? { ...task, isStarred: !task.isStarred, updatedAt: new Date() }
            : task
        ),
      };

    case 'ARCHIVE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload
            ? { ...task, isArchived: true, updatedAt: new Date() }
            : task
        ),
      };

    case 'UNARCHIVE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload
            ? { ...task, isArchived: false, updatedAt: new Date() }
            : task
        ),
      };

    case 'BATCH_COMPLETE_TASKS':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          action.payload.includes(task.id)
            ? { ...task, completed: true, updatedAt: new Date() }
            : task
        ),
        selectedTasks: new Set(),
        isMultiSelectMode: false,
      };

    case 'BATCH_DELETE_TASKS':
      return {
        ...state,
        tasks: state.tasks.filter(task => !action.payload.includes(task.id)),
        selectedTasks: new Set(),
        isMultiSelectMode: false,
      };

    case 'BATCH_ARCHIVE_TASKS':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          action.payload.includes(task.id)
            ? { ...task, isArchived: true, updatedAt: new Date() }
            : task
        ),
        selectedTasks: new Set(),
        isMultiSelectMode: false,
      };

    case 'ADD_CATEGORY':
      const newCategory: Category = {
        ...action.payload,
        id: uuidv4(),
      };
      return {
        ...state,
        categories: [...state.categories, newCategory],
      };

    case 'UPDATE_CATEGORY':
      return {
        ...state,
        categories: state.categories.map(category =>
          category.id === action.payload.id
            ? { ...category, ...action.payload.updates }
            : category
        ),
      };

    case 'DELETE_CATEGORY':
      return {
        ...state,
        categories: state.categories.filter(category => category.id !== action.payload),
        // 同时更新属于此分类的任务
        tasks: state.tasks.map(task =>
          task.category === action.payload
            ? { ...task, category: 'uncategorized', updatedAt: new Date() }
            : task
        ),
      };

    default:
      return state;
  }
}

  // 上下文
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

  // 提供者组件
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // 设置全局 dispatch 供 AI Agent Pipeline 使用
  useEffect(() => {
    setGlobalDispatch(dispatch);
    return () => setGlobalDispatch(null);
  }, [dispatch]);

  // 组件挂载时从数据库加载任务，支持缓存
  useEffect(() => {
    const loadData = async () => {
      if (isElectron) {
        try {
          dispatch({ type: 'SET_LOADING', payload: true });

          // 尝试从缓存加载
          let tasks = dataCache.get('tasks');
          let categories = dataCache.get('categories');

          if (!tasks) {
            tasks = await window.electron.storage.getTasks();
            dataCache.set('tasks', tasks);
          }

          if (!categories) {
            categories = await window.electron.storage.getCategories();
            dataCache.set('categories', categories);
          }

          console.log('Loaded tasks from cache/database:', tasks.length, 'tasks');
          dispatch({ type: 'LOAD_TASKS', payload: tasks });
          dispatch({ type: 'LOAD_CATEGORIES', payload: categories });
        } catch (error) {
          console.error('Failed to load data:', error);
          dispatch({ type: 'SET_ERROR', payload: 'Failed to load data' });
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      }
    };
    loadData();
  }, []);

  // 数据变化时更新缓存
  useEffect(() => {
    if (state.tasks.length > 0) {
      dataCache.set('tasks', state.tasks);
    }
  }, [state.tasks]);

  useEffect(() => {
    if (state.categories.length > 0) {
      dataCache.set('categories', state.categories);
    }
  }, [state.categories]);

  // 任务变化时同步到数据库
  useEffect(() => {
    if (isElectron && state.tasks.length > 0 && !state.loading) {
      // This effect will run after tasks are loaded and modified
      // We use a small delay to batch updates
      const syncTimer = setTimeout(async () => {
        try {
          // The database operations will be handled by individual actions
          // This is just to ensure we have the latest state
        } catch (error) {
          console.error('Failed to sync data:', error);
        }
      }, 100);
      return () => clearTimeout(syncTimer);
    }
  }, [state.tasks, state.loading]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

  // 使用上下文的钩子
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};