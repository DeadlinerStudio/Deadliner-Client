import React, { useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Stack,
  Alert,
  LinearProgress,
  Chip,
  IconButton,
  List,
  ListItem,
  Divider,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Sparkles,
  Settings,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  Clock,
  Loader2,
  RefreshCw,
  Puzzle,
  CalendarClock,
  Flag,
  Shield,
  Check,
  Lock,
  Dumbbell,
  BarChart3,
  Rocket,
  Headphones,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { triggerConfetti } from '../utils/confetti';
import {
  AI_PROVIDERS,
  AIProviderId,
  AuthManager,
} from '../utils/aiApi';

import { useAIProcess } from '../hooks/useAI';
import type { MixedResult } from '../services/types';
import { ThinkingIndicator } from './ai/ThinkingIndicator';
import { ToolCallProgress } from './ai/ToolCallProgress';
import { GuidedSupplementDialog } from './ai/GuidedSupplementDialog';

interface GeneratedTask {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  deadline?: Date;
  type?: 'task' | 'habit' | 'unknown';
}

interface MissingInfo {
  missingFields: string[];
  reason: string;
}

const examplePrompts = [
  { icon: <Dumbbell size={18} color="#22c55e" />, text: '制定一个30天的健身计划' },
  { icon: <BarChart3 size={18} color="#3b82f6" />, text: '学习数据分析并完成一个项目' },
  { icon: <Rocket size={18} color="#f97316" />, text: '准备一次产品发布计划' },
  { icon: <Headphones size={18} color="#ec4899" />, text: '每天提升英语听说能力' },
];

const outputFeatures = [
  {
    icon: <Puzzle size={22} color="#7C3AED" />,
    title: '目标拆解',
    desc: '将目标分解为清晰、可执行的子任务',
    bg: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0.02) 100%)',
  },
  {
    icon: <CalendarClock size={22} color="#3b82f6" />,
    title: '时间安排',
    desc: '为每个任务安排合适的时间与顺序',
    bg: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.02) 100%)',
  },
  {
    icon: <Flag size={22} color="#22c55e" />,
    title: '里程碑',
    desc: '识别关键节点，设置阶段性里程碑',
    bg: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.02) 100%)',
  },
  {
    icon: <Shield size={22} color="#f97316" />,
    title: '风险提醒',
    desc: '识别潜在风险，提供应对建议',
    bg: 'linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(249,115,22,0.02) 100%)',
  },
];

const timelineItems = [
  {
    num: 1,
    title: '明确目标与范围',
    desc: '确定目标、范围、预期成果和成功标准',
  },
  {
    num: 2,
    title: '拆分学习路径',
    desc: '拆解为可执行的学习模块与任务',
  },
  {
    num: 3,
    title: '每周执行计划',
    desc: '生成每周计划，明确任务与时间安排',
  },
  {
    num: 4,
    title: '复盘与优化',
    desc: '定期复盘进度，优化计划与方法',
  },
];

export const AIGenerationPage: React.FC = () => {
  const { dispatch } = useApp();

  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
  const [chatResponse, setChatResponse] = useState<string | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guidedDialogOpen, setGuidedDialogOpen] = useState(false);
  const [missingInfo, setMissingInfo] = useState<MissingInfo | null>(null);
  const [originalPrompt, setOriginalPrompt] = useState('');

  const [typeSelectDialogOpen, setTypeSelectDialogOpen] = useState(false);
  const [taskToAdd, setTaskToAdd] = useState<GeneratedTask | null>(null);

  const [supplementForm, setSupplementForm] = useState({
    deadline: null as Date | null,
    detailedGoal: '',
    priority: 'medium',
    additionalInfo: '',
    type: '' as '' | 'task' | 'habit',
  });

  const [selectedProvider, setSelectedProvider] = useState<AIProviderId>(
    (localStorage.getItem('ai_selected_provider') as AIProviderId) || 'deepseek'
  );

  const [providerConfigs, setProviderConfigs] = useState<Record<AIProviderId, { apiKey: string; baseUrl: string }>>(() => {
    const configs: Record<AIProviderId, { apiKey: string; baseUrl: string }> = {} as any;
    Object.keys(AI_PROVIDERS).forEach(providerId => {
      const id = providerId as AIProviderId;
      configs[id] = {
        apiKey: localStorage.getItem(`ai_api_key_${id}`) || '',
        baseUrl: localStorage.getItem(`ai_base_url_${id}`) || AI_PROVIDERS[id].baseUrl,
      };
    });
    return configs;
  });

  const {
    isProcessing,
    thinking,
    toolCalls,
    toolResults,
    result,
    error: agentError,
    process,
    reset,
  } = useAIProcess({
    onThinking: (payload) => {
      console.log('Thinking:', payload.agentName, payload.message);
    },
    onToolRequest: (payload) => {
      console.log('Tool Request:', payload.toolName, payload.args);
    },
    onFinish: (payload) => {
      console.log('Finish:', payload);
      handleAgentResult(payload);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleAgentResult = useCallback((payload: any) => {
    const tasks: GeneratedTask[] = [];

    if (payload.tasks) {
      for (const task of payload.tasks as any[]) {
        tasks.push({
          title: task.name,
          description: task.note || '',
          priority: task.priority || 'medium',
          deadline: task.dueTime ? new Date(task.dueTime.replace(' ', 'T')) : undefined,
          type: 'task',
        });
      }
    }

    if (payload.habits) {
      for (const habit of payload.habits as any[]) {
        tasks.push({
          title: habit.name,
          description: habit.description || `${habit.period} - 目标 ${habit.timesPerPeriod} 次`,
          priority: 'medium',
          type: 'habit',
        });
      }
    }

    setGeneratedTasks(tasks);

    if (payload.chatResponse) {
      setChatResponse(payload.chatResponse);
    }
  }, []);

  const saveSettings = () => {
    const config = providerConfigs[selectedProvider];
    if (!config.apiKey.trim()) {
      setError('请输入 API Key');
      return;
    }

    localStorage.setItem('ai_selected_provider', selectedProvider);
    localStorage.setItem(`ai_api_key_${selectedProvider}`, config.apiKey);
    localStorage.setItem(`ai_base_url_${selectedProvider}`, config.baseUrl);

    const authManager = AuthManager.getInstance();
    authManager.setAuth(selectedProvider, config.apiKey, config.baseUrl);

    setSettingsOpen(false);
    setError(null);
  };

  const resetSupplementForm = () => {
    setSupplementForm({
      deadline: null,
      detailedGoal: '',
      priority: 'medium',
      additionalInfo: '',
      type: '',
    });
    setMissingInfo(null);
    setOriginalPrompt('');
  };

  const generateTasks = async () => {
    const config = providerConfigs[selectedProvider];
    if (!config.apiKey) {
      setError(`请先配置 ${AI_PROVIDERS[selectedProvider].name} API Key`);
      setSettingsOpen(true);
      return;
    }

    if (!prompt.trim()) {
      setError('请输入您的需求描述');
      return;
    }

    setError(null);
    setGeneratedTasks([]);
    setChatResponse(null);
    setMissingInfo(null);

    try {
      await process(prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成任务失败');
    }
  };

  const handleSupplementAndRegenerate = async () => {
    if (!missingInfo || !originalPrompt) return;

    if (missingInfo.missingFields.includes('type') && !supplementForm.type) {
      setError('请选择任务类型（任务或习惯）');
      return;
    }

    const supplementParts: string[] = [originalPrompt];

    if (supplementForm.type) {
      supplementParts.push(`类型：${supplementForm.type === 'task' ? '任务（一次性完成）' : '习惯（持续养成）'}`);
    }
    if (supplementForm.deadline) {
      const formatted = supplementForm.deadline.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      supplementParts.push(`截止时间：${formatted}`);
    }
    if (supplementForm.detailedGoal) {
      supplementParts.push(`详细目标：${supplementForm.detailedGoal}`);
    }
    if (supplementForm.additionalInfo) {
      supplementParts.push(`补充说明：${supplementForm.additionalInfo}`);
    }
    supplementParts.push(`优先级：${supplementForm.priority === 'high' ? '高' : supplementForm.priority === 'medium' ? '中' : '低'}`);

    const enhancedPrompt = supplementParts.join('\n');

    setGuidedDialogOpen(false);
    resetSupplementForm();

    await process(enhancedPrompt);
  };

  const addTask = (task: GeneratedTask) => {
    if (!task.type || task.type === 'unknown') {
      setTaskToAdd(task);
      setTypeSelectDialogOpen(true);
      return;
    }

    dispatch({
      type: 'ADD_TASK',
      payload: {
        title: task.title,
        description: task.description,
        type: task.type,
        priority: task.priority,
        category: 'uncategorized',
        tags: [],
        deadline: task.deadline,
        completed: false,
        isStarred: false,
        isArchived: false,
      },
    });

    setTimeout(() => triggerConfetti(), 100);
    setGeneratedTasks(tasks => tasks.filter(t => t !== task));
  };

  const confirmAddTaskWithType = (type: 'task' | 'habit') => {
    if (!taskToAdd) return;

    dispatch({
      type: 'ADD_TASK',
      payload: {
        title: taskToAdd.title,
        description: taskToAdd.description,
        type: type,
        priority: taskToAdd.priority,
        category: 'uncategorized',
        tags: [],
        deadline: taskToAdd.deadline,
        completed: false,
        isStarred: false,
        isArchived: false,
      },
    });

    setTimeout(() => triggerConfetti(), 100);
    setGeneratedTasks(tasks => tasks.filter(t => t !== taskToAdd));
    setTypeSelectDialogOpen(false);
    setTaskToAdd(null);
  };

  const removeTask = (task: GeneratedTask) => {
    setGeneratedTasks(tasks => tasks.filter(t => t !== task));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const hasApiKey = !!providerConfigs[selectedProvider]?.apiKey;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>
        {`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .animate-spin { animation: spin 1s linear infinite; }
        `}
      </style>

      {/* Header */}
      <Box sx={{
        px: { xs: 2, md: 4 },
        py: 3,
        borderBottom: 1,
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            AI 智能规划
          </Typography>
          <Typography variant="body2" color="text.secondary">
            使用 DeepSeek 智能分解任务和目标
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={hasApiKey ? <Check size={16} color="#22c55e" /> : <AlertTriangle size={16} color="#f97316" />}
            disabled
            sx={{
              borderColor: hasApiKey ? '#bbf7d0' : '#fed7aa',
              bgcolor: hasApiKey ? '#f0fdf4' : '#fff7ed',
              color: hasApiKey ? '#166534' : '#9a3412',
              borderRadius: 2,
              fontSize: '0.8rem',
              fontWeight: 500,
              textTransform: 'none',
              px: 1.5,
              py: 0.5,
              '&:hover': { bgcolor: hasApiKey ? '#dcfce7' : '#ffedd5', borderColor: hasApiKey ? '#86efac' : '#fdba74' },
              '&.Mui-disabled': { borderColor: hasApiKey ? '#bbf7d0' : '#fed7aa', bgcolor: hasApiKey ? '#f0fdf4' : '#fff7ed', color: hasApiKey ? '#166534' : '#9a3412' },
            }}
          >
            {hasApiKey ? 'DeepSeek 已配置' : 'DeepSeek 未配置'}
          </Button>

          <Box
            onClick={() => setSettingsOpen(true)}
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              transition: 'box-shadow 0.2s',
              '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.12)' },
            }}
          >
            <Settings size={18} color="#64748b" />
          </Box>
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, overflow: 'auto', px: { xs: 2, md: 4 }, py: 3 }}>
        {/* Warning Banner - only show when API not configured */}
        {!hasApiKey && (
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 44,
          px: 2.5,
          mb: 1.5,
          borderRadius: 2,
          background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
          border: 1,
          borderColor: '#fed7aa',
          maxWidth: '100%',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <AlertTriangle size={16} color="#f97316" />
            <Typography sx={{ fontSize: '0.8rem', color: '#9a3412', fontWeight: 500 }}>
              请先配置 DeepSeek API Key 才能使用 AI 规划功能
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={() => setSettingsOpen(true)}
            sx={{
              background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
              borderRadius: 1.5,
              textTransform: 'none',
              fontSize: '0.8rem',
              fontWeight: 600,
              px: 2.5,
              py: 0.8,
              color: 'white',
              '&:hover': { background: 'linear-gradient(135deg, #6D28D9, #5B21B6)' },
              boxShadow: 'none',
            }}
          >
            去设置
          </Button>
        </Box>
        )}

        {/* Error Alerts */}
        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {agentError && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
            AI 处理失败: {agentError.message}
          </Alert>
        )}

        {/* Two Column Layout */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: { xs: 'wrap', lg: 'nowrap' } }}>
          {/* Left Column - ~58% */}
          <Box sx={{ width: { xs: '100%', lg: '58%' }, minWidth: 0 }}>
            <Card elevation={0} sx={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: 1, borderColor: '#f1f5f9', mb: 0 }}>
              <CardContent sx={{ p: 2.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', mb: 0.3 }}>
                    描述您的目标或需求
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: '#94a3b8', mb: 1.5 }}>
                    越详细的描述，AI 生成的规划越精准、更有价值
                  </Typography>

                <Box sx={{ position: 'relative' }}>
                  <Box
                    component="textarea"
                    placeholder="例如：我想在三个月内学会 React 和 TypeScript，并能开发一个完整的 Web 应用..."
                    value={prompt}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                    disabled={isProcessing}
                    sx={{
                      width: '100%',
                      height: 380,
                      p: 1.5,
                      borderRadius: 1.5,
                      border: 1,
                      borderColor: '#ddd6fe',
                      bgcolor: '#fafafe',
                      fontSize: '0.85rem',
                      lineHeight: 1.5,
                      color: '#1e293b',
                      resize: 'none',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      fontFamily: 'inherit',
                      '&:focus': { borderColor: '#7C3AED', boxShadow: '0 0 0 3px rgba(124,58,237,0.1)' },
                      '&::placeholder': { color: '#cbd5e1' },
                    }}
                  />
                  <Typography sx={{ position: 'absolute', bottom: 6, right: 10, fontSize: '0.7rem', color: '#94a3b8' }}>
                    {prompt.length} / 1000
                  </Typography>
                </Box>

                {/* Example prompts */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5, mb: 1 }}>
                  <Typography sx={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                    试试这些例子
                  </Typography>
                  <Box
                    component="button"
                    onClick={() => {
                      const next = Math.floor(Math.random() * examplePrompts.length);
                      setPrompt(examplePrompts[next].text);
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      border: 'none',
                      bgcolor: 'transparent',
                      cursor: 'pointer',
                      color: '#7C3AED',
                      fontSize: '0.78rem',
                      fontWeight: 500,
                      '&:hover': { color: '#6D28D9' },
                    }}
                  >
                    <RefreshCw size={13} />
                    换一批
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {examplePrompts.map((item, i) => (
                    <Box
                      key={i}
                      onClick={() => setPrompt(item.text)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        px: 1.5,
                        py: 0.6,
                        borderRadius: 1.5,
                        border: 1,
                        borderColor: '#e2e8f0',
                        bgcolor: 'background.paper',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                        '&:hover': { borderColor: '#c4b5fd', boxShadow: '0 1px 3px rgba(124,58,237,0.1)' },
                      }}
                    >
                      {item.icon}
                      <Typography sx={{ fontSize: '0.78rem', color: '#475569', whiteSpace: 'nowrap', fontWeight: 500 }}>
                        {item.text}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                {/* Generate button */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 1.5 }}>
                  <Button
                    variant="contained"
                    startIcon={isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    onClick={generateTasks}
                    disabled={isProcessing || !hasApiKey}
                    sx={{
                      width: 300,
                      maxWidth: '100%',
                      height: 40,
                      background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                      borderRadius: 1.5,
                      textTransform: 'none',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'white',
                      boxShadow: '0 2px 8px rgba(124,58,237,0.25)',
                      '&:hover': { background: 'linear-gradient(135deg, #6D28D9, #5B21B6)', boxShadow: '0 4px 12px rgba(124,58,237,0.35)' },
                      '&.Mui-disabled': { background: '#e2e8f0', color: '#94a3b8' },
                    }}
                  >
                    {isProcessing ? '生成中...' : '生成规划'}
                  </Button>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                    <Info size={11} color="#94a3b8" />
                    <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      AI 生成的内容仅供参考，请结合实际情况调整和执行。
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Generated Tasks */}
            {generatedTasks.length > 0 && (
              <Card elevation={0} sx={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: 1, borderColor: '#f1f5f9', mb: 1.5 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
                    <CheckCircle size={20} color="#7C3AED" />
                    AI 生成的任务
                  </Typography>
                  <List>
                    {generatedTasks.map((task, index) => (
                      <React.Fragment key={index}>
                        {index > 0 && <Divider />}
                        <ListItem sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
                          <Box sx={{ width: '100%', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Typography variant="h6" sx={{ flex: 1, fontWeight: 600, fontSize: '0.95rem' }}>
                                {task.title}
                              </Typography>
                              <Stack direction="row" spacing={1}>
                                <Button size="small" variant="contained" startIcon={<Plus size={16} />} onClick={() => addTask(task)} sx={{ borderRadius: 1.5, textTransform: 'none' }}>
                                  添加
                                </Button>
                                <IconButton size="small" onClick={() => removeTask(task)} color="error">
                                  <Trash2 size={18} />
                                </IconButton>
                              </Stack>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                              {task.description}
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              <Chip label={task.priority === 'high' ? '高优先级' : task.priority === 'medium' ? '中优先级' : '低优先级'} size="small" color={getPriorityColor(task.priority) as any} />
                              {task.deadline && (
                                <Chip icon={<Clock size={14} />} label={`截止: ${task.deadline.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`} size="small" variant="outlined" color="info" />
                              )}
                              {task.type && (
                                <Chip label={task.type === 'habit' ? '习惯' : '任务'} size="small" variant="outlined" color={task.type === 'habit' ? 'success' : 'primary'} />
                              )}
                            </Stack>
                          </Box>
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

          </Box>

          {/* Right Column - ~42% */}
          <Box sx={{ width: { xs: '100%', lg: '42%' }, minWidth: 0 }}>
            {/* Output Features Card */}
            <Card elevation={0} sx={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: 1, borderColor: '#f1f5f9', mb: 1.5 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', mb: 1.5 }}>
                  AI 将为你输出
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  {outputFeatures.map((feature, i) => (
                    <Box
                      key={i}
                      sx={{
                        p: 1.2,
                        borderRadius: 1.5,
                        height: 86,
                        background: feature.bg,
                        border: 1,
                        borderColor: '#f1f5f9',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.3 }}>
                        {feature.icon}
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
                          {feature.title}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.3 }}>
                        {feature.desc}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>

            {/* Preview Card */}
            <Card elevation={0} sx={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: 1, borderColor: '#f1f5f9' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                    {isProcessing ? 'AI 规划中...' : '规划结果预览'}
                </Typography>
                </Box>

                {isProcessing ? (
                  <Box>
                    <LinearProgress sx={{ mb: 2, borderRadius: 2, height: 4, '& .MuiLinearProgress-bar': { bgcolor: '#7C3AED' } }} />
                    {thinking.length > 0 && (
                      <Box>
                        {thinking.map((item, index) => (
                          <ThinkingIndicator key={index} agentName={item.agentName} phase={item.phase} message={item.message} compact />
                        ))}
                      </Box>
                    )}
                    {toolCalls.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <ToolCallProgress
                          toolCalls={toolCalls.map(tc => ({ id: tc.id, tool: tc.toolName, args: tc.args, reason: tc.reason, executionMode: tc.executionMode }))}
                          results={new Map(Array.from(toolResults.entries()).map(([id, result]) => [id, { id: result.id, success: true, result: result.result, error: result.error }]))}
                        />
                      </Box>
                    )}
                  </Box>
                ) : (
                <Box>
                {chatResponse ? (
                  <Box>
                    <Typography sx={{ fontSize: '0.85rem', color: '#1e293b', whiteSpace: 'pre-wrap', lineHeight: 1.6, mb: 2 }}>
                      {chatResponse}
                    </Typography>
                    <Button size="small" sx={{ borderRadius: 1.5, textTransform: 'none', color: '#7C3AED' }} onClick={() => setChatResponse(null)}>
                      清除回复
                    </Button>
                  </Box>
                ) : (
                <Box>
                {/* Timeline */}
                <Box sx={{ position: 'relative', pl: 4.5 }}>
                  {timelineItems.map((item, index) => (
                    <Box key={index} sx={{ position: 'relative', pb: index < timelineItems.length - 1 ? 2.5 : 0, minHeight: 66 }}>
                      {index < timelineItems.length - 1 && (
                        <Box sx={{ position: 'absolute', left: -4, top: 24, bottom: 0, width: 2, bgcolor: '#ddd6fe' }} />
                      )}
                      <Box sx={{ position: 'absolute', left: -14, top: 3, width: 22, height: 22, borderRadius: '50%', bgcolor: '#f5f3ff', border: 2, borderColor: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#7C3AED' }}>
                          {item.num}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, ml: 3.5 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', mb: 0.2 }}>
                            {item.title}
                          </Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {item.desc}
                          </Typography>
                        </Box>
                        <Box sx={{ mt: 0.3, width: 20, height: 20, borderRadius: '50%', bgcolor: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={12} color="#7C3AED" />
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </Box>

                <Box
                  sx={{
                    mt: 1.5,
                    p: 1.2,
                    borderRadius: 1.5,
                    bgcolor: '#f5f3ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    opacity: 0.6,
                  }}
                >
                  <Lock size={13} color="#7C3AED" />
                  <Typography sx={{ fontSize: '0.78rem', color: '#7C3AED', fontWeight: 500 }}>
                    配置 API 后可生成完整规划
                  </Typography>
                </Box>
                </Box>
                )}
                </Box>
                )}
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 600 }}>AI API 配置</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>AI 提供商</InputLabel>
              <Select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as AIProviderId)}
                label="AI 提供商"
              >
                {Object.entries(AI_PROVIDERS).map(([id, provider]) => (
                  <MenuItem key={id} value={id}>{provider.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Alert severity="info" icon={<AlertCircle size={20} />}>
              {selectedProvider === 'deepseek' && (
                <>请访问 <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer">platform.deepseek.com</a> 申请 API Key</>
              )}
              {selectedProvider === 'claude' && (
                <>请访问 <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">console.anthropic.com</a> 申请 API Key</>
              )}
            </Alert>

            <TextField
              label="API Key"
              fullWidth
              type="password"
              value={providerConfigs[selectedProvider]?.apiKey || ''}
              onChange={(e) => setProviderConfigs(prev => ({
                ...prev,
                [selectedProvider]: { ...prev[selectedProvider], apiKey: e.target.value }
              }))}
              placeholder="sk-..."
              helperText="您的 API Key 将存储在本地浏览器中"
            />

            <TextField
              label="Base URL"
              fullWidth
              value={providerConfigs[selectedProvider]?.baseUrl || ''}
              onChange={(e) => setProviderConfigs(prev => ({
                ...prev,
                [selectedProvider]: { ...prev[selectedProvider], baseUrl: e.target.value }
              }))}
              helperText={`默认: ${AI_PROVIDERS[selectedProvider].baseUrl}`}
            />

            <Alert severity="warning">
              注意：API Key 仅存储在您的浏览器本地，不会上传到任何服务器
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={() => setSettingsOpen(false)} sx={{ borderRadius: 2, textTransform: 'none' }}>取消</Button>
          <Button onClick={saveSettings} variant="contained" disabled={!providerConfigs[selectedProvider]?.apiKey} sx={{ borderRadius: 2, textTransform: 'none', background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', '&:hover': { background: 'linear-gradient(135deg, #6D28D9, #5B21B6)' } }}>
            保存配置
          </Button>
        </DialogActions>
      </Dialog>

      {/* Guided Supplement Dialog */}
      <GuidedSupplementDialog
        open={guidedDialogOpen}
        originalPrompt={originalPrompt}
        missingInfo={missingInfo}
        onSubmit={handleSupplementAndRegenerate}
        onCancel={() => { setGuidedDialogOpen(false); resetSupplementForm(); }}
      />

      {/* Type Select Dialog */}
      <Dialog open={typeSelectDialogOpen} onClose={() => { setTypeSelectDialogOpen(false); setTaskToAdd(null); }} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 600 }}>选择类型</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Alert severity="info" icon={<HelpCircle size={20} />}>
              AI 无法判断这是任务还是习惯，请手动选择：
            </Alert>
            {taskToAdd && (
              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {taskToAdd.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {taskToAdd.description}
                </Typography>
              </Box>
            )}
            <Button fullWidth variant="outlined" size="large" onClick={() => confirmAddTaskWithType('task')} sx={{ py: 1.5, borderRadius: 2, textTransform: 'none' }}>
              📋 任务（一次性完成）
            </Button>
            <Button fullWidth variant="outlined" size="large" onClick={() => confirmAddTaskWithType('habit')} sx={{ py: 1.5, borderRadius: 2, textTransform: 'none' }}>
              🎯 习惯（持续养成）
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={() => { setTypeSelectDialogOpen(false); setTaskToAdd(null); }} sx={{ borderRadius: 2, textTransform: 'none' }}>取消</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
