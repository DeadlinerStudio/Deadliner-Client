const DatabaseHelper = require('./database');
const SecureSettingsManager = require('./settings');
const WebDAVSync = require('./webdav');

/**
 * StorageService - 存储服务门面
 * 统一管理数据库和配置存储，提供给渲染进程使用的API
 */
class StorageService {
  constructor() {
    if (StorageService.instance) {
      return StorageService.instance;
    }

    this.db = new DatabaseHelper();
    this.settings = new SecureSettingsManager();

    // 更新应用启动统计
    this.settings.updateAppLaunch();

    StorageService.instance = this;
  }

  // ==================== 任务API ====================

  async getTasks() {
    try {
      return this.db.getAllTasks();
    } catch (error) {
      console.error('Error getting tasks:', error);
      throw error;
    }
  }

  async clearAllTasks() {
    try {
      return this.db.clearAllTasks();
    } catch (error) {
      console.error('Error clearing tasks:', error);
      throw error;
    }
  }

  async getTask(id) {
    try {
      return this.db.getTaskById(id);
    } catch (error) {
      console.error('Error getting task:', error);
      throw error;
    }
  }

  async createTask(task) {
    try {
      this.db.createTask(task);
      return { success: true };
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  async updateTask(id, updates) {
    try {
      this.db.updateTask(id, updates);
      return { success: true };
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  async deleteTask(id) {
    try {
      this.db.deleteTask(id);
      return { success: true };
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }

  async archiveTask(id) {
    try {
      this.db.archiveTask(id);
      return { success: true };
    } catch (error) {
      console.error('Error archiving task:', error);
      throw error;
    }
  }

  async unarchiveTask(id) {
    try {
      this.db.unarchiveTask(id);
      return { success: true };
    } catch (error) {
      console.error('Error unarchiving task:', error);
      throw error;
    }
  }

  async batchUpdateTasks(ids, updates) {
    try {
      this.db.batchUpdateTasks(ids, updates);
      return { success: true };
    } catch (error) {
      console.error('Error batch updating tasks:', error);
      throw error;
    }
  }

  // ==================== 分类API ====================

  async getCategories() {
    try {
      return this.db.getAllCategories();
    } catch (error) {
      console.error('Error getting categories:', error);
      throw error;
    }
  }

  async createCategory(category) {
    try {
      this.db.createCategory(category);
      return { success: true };
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  // ==================== 习惯打卡API ====================

  async createHabitCheckin(checkin) {
    try {
      this.db.createHabitCheckin(checkin);
      return { success: true };
    } catch (error) {
      console.error('Error creating habit checkin:', error);
      throw error;
    }
  }

  async getHabitCheckins(taskId, startDate, endDate) {
    try {
      return this.db.getHabitCheckins(taskId, startDate, endDate);
    } catch (error) {
      console.error('Error getting habit checkins:', error);
      throw error;
    }
  }

  // ==================== 统计API ====================

  async getStats() {
    try {
      return this.db.getStats();
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  }

  // ==================== 设置API ====================

  async getSetting(key, defaultValue) {
    try {
      return this.settings.get(key, defaultValue);
    } catch (error) {
      console.error('Error getting setting:', error);
      throw error;
    }
  }

  async setSetting(key, value) {
    try {
      this.settings.set(key, value);
      return { success: true };
    } catch (error) {
      console.error('Error setting value:', error);
      throw error;
    }
  }

  async getSecureSetting(key, defaultValue) {
    try {
      return this.settings.getSecure(key, defaultValue);
    } catch (error) {
      console.error('Error getting secure setting:', error);
      throw error;
    }
  }

  async setSecureSetting(key, value) {
    try {
      this.settings.setSecure(key, value);
      return { success: true };
    } catch (error) {
      console.error('Error setting secure value:', error);
      throw error;
    }
  }

  async getUISettings() {
    try {
      return this.settings.getUISettings();
    } catch (error) {
      console.error('Error getting UI settings:', error);
      throw error;
    }
  }

  async setUISettings(uiSettings) {
    try {
      this.settings.setUISettings(uiSettings);
      return { success: true };
    } catch (error) {
      console.error('Error setting UI settings:', error);
      throw error;
    }
  }

  async getNotificationSettings() {
    try {
      return this.settings.getNotificationSettings();
    } catch (error) {
      console.error('Error getting notification settings:', error);
      throw error;
    }
  }

  async setNotificationSettings(notificationSettings) {
    try {
      this.settings.setNotificationSettings(notificationSettings);
      return { success: true };
    } catch (error) {
      console.error('Error setting notification settings:', error);
      throw error;
    }
  }

  async getSyncSettings() {
    try {
      return this.settings.getSyncSettings();
    } catch (error) {
      console.error('Error getting sync settings:', error);
      throw error;
    }
  }

  async setSyncSettings(syncSettings) {
    try {
      this.settings.setSyncSettings(syncSettings);
      return { success: true };
    } catch (error) {
      console.error('Error setting sync settings:', error);
      throw error;
    }
  }

  async getFeatureSettings() {
    try {
      return this.settings.getFeatureSettings();
    } catch (error) {
      console.error('Error getting feature settings:', error);
      throw error;
    }
  }

  async setFeatureSettings(featureSettings) {
    try {
      this.settings.setFeatureSettings(featureSettings);
      return { success: true };
    } catch (error) {
      console.error('Error setting feature settings:', error);
      throw error;
    }
  }

  async getAISettings() {
    try {
      return this.settings.getAISettings();
    } catch (error) {
      console.error('Error getting AI settings:', error);
      throw error;
    }
  }

  async setAISettings(aiSettings) {
    try {
      this.settings.setAISettings(aiSettings);
      return { success: true };
    } catch (error) {
      console.error('Error setting AI settings:', error);
      throw error;
    }
  }

  async getUserPreferences() {
    try {
      return this.settings.getUserPreferences();
    } catch (error) {
      console.error('Error getting user preferences:', error);
      throw error;
    }
  }

  async setUserPreferences(preferences) {
    try {
      this.settings.setUserPreferences(preferences);
      return { success: true };
    } catch (error) {
      console.error('Error setting user preferences:', error);
      throw error;
    }
  }

  async getAppInfo() {
    try {
      return this.settings.getAppInfo();
    } catch (error) {
      console.error('Error getting app info:', error);
      throw error;
    }
  }

  // ==================== 备份与恢复API ====================

  async exportData() {
    try {
      return {
        tasks: this.db.getAllTasks(),
        categories: this.db.getAllCategories(),
        settings: this.settings.exportSettings(),
        exportedAt: Date.now(),
        version: '1.0',
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  async importData(data) {
    try {
      // 导入设置（如果提供）并尽量清理旧任务，避免重复
      if (data.settings) {
        this.settings.importSettings(data.settings);
        try {
          this.db.clearAllTasks();
        } catch (clearErr) {
          console.warn('Failed to clear tasks before import:', clearErr);
        }
      }

      // 导入分类
      if (data.categories && Array.isArray(data.categories)) {
        for (const category of data.categories) {
          try {
            this.db.createCategory(category);
          } catch (error) {
            console.warn('Category already exists:', category.id);
          }
        }
      }

      // 导入任务
      if (data.tasks && Array.isArray(data.tasks)) {
        for (const task of data.tasks) {
          try {
            this.db.createTask(task);
          } catch (error) {
            console.warn('Task import conflict:', task.id);
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }

  /**
   * 将移动端 snapshot-v1.json 数据导入为本地任务
   */
  async importSnapshot(snapshot) {
    try {
      if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.items)) {
        throw new Error('无效的快照数据');
      }

      // 确保默认分类存在
      const preferences = this.settings.getUserPreferences();
      const defaultCategoryId = preferences?.defaultCategory || 'personal';
      const categories = this.db.getAllCategories();
      const hasDefault = categories.some(c => c.id === defaultCategoryId);
      if (!hasDefault) {
        try {
          this.db.createCategory({
            id: defaultCategoryId,
            name: defaultCategoryId === 'personal' ? '个人' : defaultCategoryId,
            color: '#6200EE',
            icon: null,
          });
        } catch (catErr) {
          console.warn('Failed to create default category:', catErr);
        }
      }

      let imported = 0;
      for (const item of snapshot.items) {
        if (item.deleted === 1 || item.deleted === true) continue;
        if (!item.doc) continue;

        const doc = item.doc;
        const now = Date.now();
        const task = {
          id: String(doc.id ?? item.uid ?? `${now}-${Math.random().toString(36).slice(2)}`),
          title: String(doc.name ?? '未命名任务'),
          description: doc.note ?? null,
          type: doc.type === 'habit' ? 'habit' : 'task',
          priority: 'medium',
          category: defaultCategoryId,
          deadline: doc.end_time ? new Date(doc.end_time) : null,
          completed: doc.is_completed === 1,
          createdAt: doc.start_time ? new Date(doc.start_time) : new Date(now),
          updatedAt: doc.timestamp ? new Date(doc.timestamp) : new Date(now),
          tags: [],
          progress: doc.type === 'habit' ? (doc.habit_total_count ? Math.round((doc.habit_count || 0) * 100 / doc.habit_total_count) : (doc.habit_count || 0)) : null,
          streak: doc.type === 'habit' ? (doc.habit_count || 0) : null,
          isStarred: doc.is_stared === 1,
          isArchived: doc.is_archived === 1,
        };

        try {
          this.db.createTask(task);
          imported += 1;
        } catch (error) {
          console.warn('Snapshot item import conflict:', task.id, error?.message);
        }
      }

      return { success: true, imported };
    } catch (error) {
      console.error('Error importing snapshot:', error);
      throw error;
    }
  }

  /**
   * 导出当前本地任务为移动端快照格式 snapshot-v1.json
   */
  async exportSnapshot() {
    try {
      const tasks = this.db.getAllTasks();
      const now = new Date().toISOString();
      const nowMs = Date.now();
      const deviceId = 'pc';

      const items = tasks.map(t => ({
        uid: String(t.id),
        ver: { ts: now, ctr: 0, dev: deviceId },
        deleted: t.is_deleted === 1 || t.is_deleted === true,
        doc: {
          id: String(t.id),
          name: t.title,
          start_time: t.created_at ? new Date(t.created_at).toISOString() : now,
          end_time: t.deadline ? new Date(t.deadline).toISOString() : null,
          is_completed: t.completed ? 1 : 0,
          complete_time: t.completed ? (t.updated_at ? new Date(t.updated_at).toISOString() : now) : null,
          note: t.description || '',
          is_archived: t.is_archived ? 1 : 0,
          is_stared: t.is_starred ? 1 : 0,
          type: t.type === 'habit' ? 'habit' : 'task',
          habit_count: t.streak || 0,
          habit_total_count: t.type === 'habit' ? (t.progress !== null ? Math.round(t.progress) || 0 : 0) : 0,
          calendar_event: null,
          timestamp: t.updated_at ? new Date(t.updated_at).toISOString() : now,
        },
      }));

      return {
        version: { ts: now, dev: deviceId },
        items,
      };
    } catch (error) {
      console.error('Error exporting snapshot:', error);
      throw error;
    }
  }

  // ==================== WebDAV 同步（可选） ====================

  async webdavTestConnection() {
    try {
      const sync = this.settings.getSyncSettings();
      if (!sync || sync.provider !== 'webdav') {
        return { success: false, error: '未选择 WebDAV 作为同步提供者' };
      }
      return await WebDAVSync.testConnection(sync.webdav);
    } catch (error) {
      console.error('Error testing WebDAV connection:', error);
      return { success: false, error: error.message };
    }
  }

  async webdavUploadBackup() {
    try {
      const sync = this.settings.getSyncSettings();
      if (!sync || sync.provider !== 'webdav') {
        return { success: false, error: '未选择 WebDAV 作为同步提供者' };
      }
      const data = await this.exportData();
      const backupRes = await WebDAVSync.uploadBackup(sync.webdav, data);
      const snapshot = await this.exportSnapshot();
      const snapshotRes = await WebDAVSync.uploadSnapshot(sync.webdav, snapshot);
      return {
        success: backupRes.success && snapshotRes.success,
        backup: backupRes,
        snapshot: snapshotRes,
      };
    } catch (error) {
      console.error('Error uploading backup to WebDAV:', error);
      return { success: false, error: error.message };
    }
  }

  async webdavDownloadBackup() {
    try {
      const sync = this.settings.getSyncSettings();
      if (!sync || sync.provider !== 'webdav') {
        return { success: false, error: '未选择 WebDAV 作为同步提供者' };
      }
      const res = await WebDAVSync.downloadBackup(sync.webdav);
      if (res.success && res.data && Array.isArray(res.data.tasks)) {
        await this.importData(res.data);
        return { success: true, source: 'backup.json' };
      }

      const snapRes = await WebDAVSync.downloadSnapshot(sync.webdav);
      if (!snapRes.success) {
        return { success: false, error: snapRes.error || '无法下载备份或快照' };
      }
      await this.importSnapshot(snapRes.data);
      return { success: true, source: 'snapshot-v1.json' };
    } catch (error) {
      console.error('Error downloading backup from WebDAV:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 直接下载并导入 snapshot（供设置页按钮复用）
   */
  async webdavDownloadSnapshot() {
    try {
      const sync = this.settings.getSyncSettings();
      if (!sync || sync.provider !== 'webdav') {
        return { success: false, error: '未选择 WebDAV 作为同步提供者' };
      }

      const { webdav } = sync;
      const { url, username, password } = webdav || {};
      if (!url) return { success: false, error: '未配置 WebDAV 地址' };
      if (!username) return { success: false, error: '未配置 WebDAV 用户名' };
      if (!password) return { success: false, error: '未配置 WebDAV 密码' };

      const snapRes = await WebDAVSync.downloadSnapshot(webdav);
      if (!snapRes.success) {
        const raw = snapRes.error || '';
        let friendly = '';
        if (/401|Unauthorized/i.test(raw)) {
          friendly = 'WebDAV 身份验证失败，请检查用户名或密码';
        } else if (/404|Not\sFound/i.test(raw)) {
          friendly = '未找到远端快照文件（/Deadliner/snapshot-v1.json）';
        } else if (/ECONNREFUSED|ENOTFOUND|timed?out|connect/i.test(raw)) {
          friendly = '无法连接到 WebDAV 服务器，请检查地址和网络';
        } else if (/Unexpected\s token|JSON\s?parse/i.test(raw)) {
          friendly = '快照文件内容不是有效 JSON';
        } else if (/配置不完整|URL、用户名与密码/.test(raw)) {
          friendly = 'WebDAV 配置不完整：请填写地址、用户名与密码';
        } else {
          friendly = `下载快照失败：${raw}`;
        }
        return { success: false, error: friendly };
      }

      const importRes = await this.importSnapshot(snapRes.data);
      return { success: true, imported: importRes.imported };
    } catch (error) {
      const raw = error && error.message ? error.message : String(error);
      let friendly = '';
      if (/配置不完整|URL、用户名与密码/.test(raw)) {
        friendly = 'WebDAV 配置不完整：请填写地址、用户名与密码';
      } else if (/401|Unauthorized/i.test(raw)) {
        friendly = 'WebDAV 身份验证失败，请检查用户名或密码';
      } else if (/404|Not\sFound/i.test(raw)) {
        friendly = '未找到远端快照文件（/Deadliner/snapshot-v1.json）';
      } else if (/ECONNREFUSED|ENOTFOUND|timed?out|connect/i.test(raw)) {
        friendly = '无法连接到 WebDAV 服务器，请检查地址和网络';
      } else if (/Unexpected\s token|JSON\s?parse/i.test(raw)) {
        friendly = '快照文件内容不是有效 JSON';
      } else {
        friendly = `下载快照异常：${raw}`;
      }
      console.error('Error downloading snapshot from WebDAV:', error);
      return { success: false, error: friendly };
    }
  }

  async resetAll() {
    try {
      // 注意：这会清除所有数据！
      this.settings.reset();
      // 数据库需要手动清理或重建
      return { success: true };
    } catch (error) {
      console.error('Error resetting data:', error);
      throw error;
    }
  }

  // ==================== 同步日志API ====================

  async logSync(syncType, status, itemsSynced, errorMessage) {
    try {
      this.db.logSync(syncType, status, itemsSynced, errorMessage);
      return { success: true };
    } catch (error) {
      console.error('Error logging sync:', error);
      throw error;
    }
  }

  // ==================== 清理与维护 ====================

  close() {
    try {
      this.db.close();
    } catch (error) {
      console.error('Error closing storage:', error);
    }
  }

  getStorageInfo() {
    try {
      return {
        database: {
          stats: this.db.getStats(),
        },
        settings: {
          paths: this.settings.getStorePath(),
        },
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      throw error;
    }
  }
}

module.exports = StorageService;
