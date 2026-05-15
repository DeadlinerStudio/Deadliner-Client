import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Divider,
  Paper,
  Stack,
  Chip,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  IconButton,
} from '@mui/material';
import {
  Palette,
  Sun,
  Moon,
  Cloud,
  CloudOff,
  RefreshCw,
  Upload,
  Download,
  Check,
  X,
  Info,
  Github,
  Heart,
} from 'lucide-react';
import { themeMetadata, themePalettes } from '../theme/themes';
import { useSettings } from '../hooks/useStorage';
import { useApp } from '../context/AppContext';
import { SyncSettings } from '../electron';

// 主题颜色键类型
type ThemeColorKey = keyof typeof themePalettes;

// 设置页面属性接口
interface SettingsPageProps {
  darkMode: boolean;
  onThemeToggle: () => void;
  themeColor: ThemeColorKey;
  onThemeColorChange: (color: ThemeColorKey) => void;
}

// 设置页面组件
export const SettingsPage: React.FC<SettingsPageProps> = ({
  darkMode,
  onThemeToggle,
  themeColor,
  onThemeColorChange,
}) => {
  const { settings: syncSettings, updateSettings: updateSyncSettings, reload: reloadSync } = useSettings<SyncSettings>('sync');
  const { dispatch } = useApp();
  const [webdavUrl, setWebdavUrl] = useState('');
  const [webdavUsername, setWebdavUsername] = useState('');
  const [webdavPassword, setWebdavPassword] = useState('');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (syncSettings) {
      setSyncEnabled(!!syncSettings.enabled);
      setAutoSync(!!syncSettings.autoSync);
      const w = syncSettings.webdav || { url: '', username: '', password: '' };
      setWebdavUrl(w.url || '');
      setWebdavUsername(w.username || '');
      setWebdavPassword(w.password || '');
    }
  }, [syncSettings]);

  const saveWebdavSettings = async () => {
    await updateSyncSettings({
      provider: 'webdav',
      enabled: syncEnabled,
      autoSync,
      webdav: { url: webdavUrl, username: webdavUsername, password: webdavPassword },
    });
    await reloadSync();
    setActionMsg('设置已保存');
    setTimeout(() => setActionMsg(null), 3000);
  };

  const testConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const res = await window.electron.storage.webdavTestConnection();
      setTestResult(res.success ? 'success' : 'error');
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  const uploadBackup = async () => {
    setSyncing(true);
    const res = await window.electron.storage.webdavUploadBackup();
    setSyncing(false);
    setActionMsg(res.success ? '备份已上传' : '上传失败');
    setTimeout(() => setActionMsg(null), 3000);
  };

  const downloadBackup = async () => {
    setSyncing(true);
    const res = await window.electron.storage.webdavDownloadBackup();
    if (res.success) {
      try {
        const [tasks, categories] = await Promise.all([
          window.electron.storage.getTasks(),
          window.electron.storage.getCategories(),
        ]);
        dispatch({ type: 'LOAD_TASKS', payload: tasks });
        dispatch({ type: 'LOAD_CATEGORIES', payload: categories });
        setActionMsg('数据已恢复');
      } catch {
        setActionMsg('数据已恢复，但刷新列表失败');
      }
    } else {
      setActionMsg('恢复失败');
    }
    setSyncing(false);
    setTimeout(() => setActionMsg(null), 3000);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{
        px: { xs: 2, md: 4 },
        py: 3,
        borderBottom: 1,
        borderColor: 'divider',
      }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          设置
        </Typography>
        <Typography variant="body2" color="text.secondary">
          个性化你的 Deadliner 体验
        </Typography>
      </Box>

      {/* Settings Content */}
      <Box sx={{ flex: 1, overflow: 'auto', px: { xs: 2, md: 4 }, py: 3 }}>
        <Stack spacing={3}>
          {/* Appearance Section */}
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
            <CardContent sx={{ p: 0 }}>
              {/* Section Header */}
              <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Palette size={18} />
                  外观
                </Typography>
              </Box>

              <Box sx={{ p: 3 }}>
                {/* Theme Toggle */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 500, mb: 0.5 }}>
                      深色模式
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {darkMode ? '当前为深色主题' : '当前为浅色主题'}
                    </Typography>
                  </Box>
                  <Box
                    onClick={onThemeToggle}
                    sx={{
                      width: 56,
                      height: 32,
                      borderRadius: 16,
                      bgcolor: darkMode ? 'primary.main' : 'grey.300',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      px: 0.5,
                      justifyContent: darkMode ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Box
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        bgcolor: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 1,
                      }}
                    >
                      {darkMode ? <Moon size={14} /> : <Sun size={14} />}
                    </Box>
                  </Box>
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* Theme Colors */}
                <Typography variant="body1" sx={{ fontWeight: 500, mb: 2 }}>
                  主题颜色
                </Typography>
                <Grid container spacing={2}>
                  {Object.entries(themeMetadata).map(([key, meta]) => (
                    <Grid size={{ xs: 6, sm: 4, md: 3 }} key={key}>
                      <Paper
                        elevation={themeColor === key ? 3 : 0}
                        sx={{
                          p: 2,
                          cursor: 'pointer',
                          border: 2,
                          borderColor: themeColor === key ? 'primary.main' : 'divider',
                          borderRadius: 3,
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            borderColor: 'primary.main',
                            transform: 'translateY(-2px)',
                          },
                        }}
                        onClick={() => onThemeColorChange(key as ThemeColorKey)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              bgcolor: (themePalettes as any)[key]?.light?.primary?.main || '#a855f7',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: '1.2rem',
                              boxShadow: 2,
                            }}
                          >
                            {meta.icon}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {meta.name}
                            </Typography>
                            {themeColor === key && (
                              <Chip
                                label="使用中"
                                size="small"
                                color="primary"
                                sx={{ height: 18, fontSize: '0.65rem', mt: 0.5 }}
                              />
                            )}
                          </Box>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {meta.description}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </CardContent>
          </Card>

          {/* Sync Section */}
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
            <CardContent sx={{ p: 0 }}>
              {/* Section Header */}
              <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  {syncEnabled ? <Cloud size={18} /> : <CloudOff size={18} />}
                  数据同步
                </Typography>
              </Box>

              <Box sx={{ p: 3 }}>
                {/* Sync Toggle */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 500, mb: 0.5 }}>
                      启用同步
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      通过 WebDAV 同步你的数据
                    </Typography>
                  </Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={syncEnabled}
                        onChange={(e) => setSyncEnabled(e.target.checked)}
                        color="primary"
                      />
                    }
                    label=""
                    sx={{ m: 0 }}
                  />
                </Box>

                {syncEnabled && (
                  <>
                    <Divider sx={{ mb: 3 }} />

                    {/* Auto Sync Toggle */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 500, mb: 0.5 }}>
                          自动同步
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          应用打开时自动同步数据
                        </Typography>
                      </Box>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={autoSync}
                            onChange={(e) => setAutoSync(e.target.checked)}
                            color="primary"
                          />
                        }
                        label=""
                        sx={{ m: 0 }}
                      />
                    </Box>

                    <Divider sx={{ mb: 3 }} />

                    {/* WebDAV Settings */}
                    <Typography variant="body1" sx={{ fontWeight: 500, mb: 2 }}>
                      WebDAV 配置
                    </Typography>
                    <Stack spacing={2}>
                      <TextField
                        label="服务器地址"
                        placeholder="https://example.com/remote.php/dav/files/username"
                        value={webdavUrl}
                        onChange={(e) => setWebdavUrl(e.target.value)}
                        fullWidth
                        size="small"
                        helperText="WebDAV 服务器的完整 URL 地址"
                      />
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            label="用户名"
                            value={webdavUsername}
                            onChange={(e) => setWebdavUsername(e.target.value)}
                            fullWidth
                            size="small"
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            label="密码"
                            type="password"
                            value={webdavPassword}
                            onChange={(e) => setWebdavPassword(e.target.value)}
                            fullWidth
                            size="small"
                          />
                        </Grid>
                      </Grid>

                      {/* Action Buttons */}
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<Check size={16} />}
                          onClick={saveWebdavSettings}
                        >
                          保存配置
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={testing ? <RefreshCw size={16} className="animate-spin" /> : <Cloud size={16} />}
                          onClick={testConnection}
                          disabled={testing || !webdavUrl}
                        >
                          {testing ? '测试中...' : '测试连接'}
                        </Button>
                      </Box>

                      {/* Test Result */}
                      {testResult && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: testResult === 'success'
                              ? (theme) => theme.palette.mode === 'dark' ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)'
                              : (theme) => theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
                            border: 1,
                            borderColor: testResult === 'success' ? 'success.main' : 'error.main',
                          }}
                        >
                          {testResult === 'success' ? <Check size={18} color="green" /> : <X size={18} color="red" />}
                          <Typography variant="body2" color={testResult === 'success' ? 'success.main' : 'error.main'}>
                            {testResult === 'success' ? '连接成功' : '连接失败，请检查配置'}
                          </Typography>
                        </Box>
                      )}

                      {/* Backup Actions */}
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        备份管理
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={syncing ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
                          onClick={uploadBackup}
                          disabled={syncing}
                        >
                          上传备份
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={syncing ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                          onClick={downloadBackup}
                          disabled={syncing}
                        >
                          恢复备份
                        </Button>
                      </Box>
                    </Stack>
                  </>
                )}

                {/* Action Message */}
                {actionMsg && (
                  <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: 'action.selected' }}>
                    <Typography variant="body2" color="text.secondary">
                      {actionMsg}
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* About Section */}
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
            <CardContent sx={{ p: 0 }}>
              {/* Section Header */}
              <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Info size={18} />
                  关于
                </Typography>
              </Box>

              <Box sx={{ p: 3 }}>
                {/* App Info */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
                  <Box
                    component="img"
                    src="./icon.png"
                    alt="Deadliner"
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: 0,
                      objectFit: 'contain',
                    }}
                  />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                      Deadliner
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      版本 1.0.0
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ mb: 2 }} />

                {/* Credits */}
                <Stack spacing={1.5}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">开发者</Typography>
                    <Typography variant="body2">Haomin Chen & Atrix Zhou</Typography>
                  </Box>
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">项目地址</Typography>
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<Github size={14} />}
                      component="a"
                      href="https://github.com/XiaoChennnng/Deadliner-Client"
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ textTransform: 'none' }}
                    >
                      GitHub
                    </Button>
                  </Box>
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Made with
                    </Typography>
                    <Heart size={14} fill="#ec4899" color="#ec4899" />
                    <Typography variant="body2" color="text.secondary">
                      using React & MUI
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Stack>
      </Box>

      {/* CSS Animation */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-spin {
            animation: spin 1s linear infinite;
          }
        `}
      </style>
    </Box>
  );
};
