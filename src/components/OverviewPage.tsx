import React, { useMemo } from 'react';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Stack,
  Paper,
} from '@mui/material';
import {
  Clock,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { differenceInDays, differenceInHours, differenceInMinutes, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 概览页面组件
export const OverviewPage: React.FC = () => {
  // 获取应用状态
  const { state } = useApp();

  // 获取未完成且未归档的任务
  const activeTasks = useMemo(() => {
    return state.tasks.filter(task => !task.completed && !task.isArchived);
  }, [state.tasks]);

  // 获取即将到期的任务（7天内）
  const upcomingTasks = useMemo(() => {
    const now = new Date();
    return activeTasks
      .filter(task => {
        if (!task.deadline) return false;
        const deadline = new Date(task.deadline);
        const daysUntil = differenceInDays(deadline, now);
        return daysUntil >= 0 && daysUntil <= 7; // 7天内且未过期
      })
      .sort((a, b) => {
        const aTime = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const bTime = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return aTime - bTime; // 按截止时间升序排序
      });
  }, [activeTasks]);

  // 获取已逾期的任务
  const overdueTasks = useMemo(() => {
    const now = new Date();
    return activeTasks
      .filter(task => {
        if (!task.deadline) return false;
        return new Date(task.deadline) < now; // 已过期
      })
      .sort((a, b) => {
        const aTime = a.deadline ? new Date(a.deadline).getTime() : 0;
        const bTime = b.deadline ? new Date(b.deadline).getTime() : 0;
        return aTime - bTime; // 按截止时间升序排序
      });
  }, [activeTasks]);

  // 获取今天的任务
  const todayTasks = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return activeTasks.filter(task => {
      if (!task.deadline) return false;
      const deadline = new Date(task.deadline);
      return deadline >= today && deadline < tomorrow; // 今天截止的任务
    });
  }, [activeTasks]);

  // 统计数据
  const stats = useMemo(() => {
    const total = state.tasks.filter(t => !t.isArchived).length; // 总任务数（未归档）
    const completed = state.tasks.filter(t => t.completed && !t.isArchived).length; // 已完成数
    const active = activeTasks.length; // 活跃任务数
    const overdue = overdueTasks.length; // 逾期任务数
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0; // 完成率

    return { total, completed, active, overdue, completionRate };
  }, [state.tasks, activeTasks, overdueTasks]);

  // 格式化倒计时
  const formatCountdown = (deadline: Date) => {
    const now = new Date();
    const days = differenceInDays(deadline, now);
    const hours = differenceInHours(deadline, now) % 24;
    const minutes = differenceInMinutes(deadline, now) % 60;

    if (days > 0) {
      return `${days}天 ${hours}小时`; // 多天
    } else if (hours > 0) {
      return `${hours}小时 ${minutes}分钟`; // 今天内
    } else if (minutes > 0) {
      return `${minutes}分钟`; // 不到一小时
    } else {
      return '即将到期'; // 即将到期
    }
  };

  // 获取优先级颜色
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error'; // 高优先级
      case 'medium': return 'warning'; // 中优先级
      case 'low': return 'success'; // 低优先级
      default: return 'default'; // 默认
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ px: { xs: 2, md: 4 }, py: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          概览
        </Typography>
        <Typography variant="body2" color="text.secondary">
          查看您的任务进度和即将到期的项目
        </Typography>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, overflow: 'auto', px: { xs: 2, md: 4 }, py: 3 }}>
        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Card
              elevation={0}
              sx={{
                textAlign: 'center',
                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.08)',
                border: 1,
                borderColor: theme => theme.palette.mode === 'dark' ? 'rgba(168,85,247,0.3)' : 'rgba(168,85,247,0.15)',
                borderRadius: 3,
              }}
            >
              <CardContent sx={{ py: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {stats.active}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  进行中
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Card
              elevation={0}
              sx={{
                textAlign: 'center',
                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.08)',
                border: 1,
                borderColor: theme => theme.palette.mode === 'dark' ? 'rgba(34,197,94,0.3)' : 'rgba(34,197,94,0.15)',
                borderRadius: 3,
              }}
            >
              <CardContent sx={{ py: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                  {stats.completed}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  已完成
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Card
              elevation={0}
              sx={{
                textAlign: 'center',
                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
                border: 1,
                borderColor: theme => theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.15)',
                borderRadius: 3,
              }}
            >
              <CardContent sx={{ py: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>
                  {stats.overdue}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  已逾期
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Card
              elevation={0}
              sx={{
                textAlign: 'center',
                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)',
                border: 1,
                borderColor: theme => theme.palette.mode === 'dark' ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.15)',
                borderRadius: 3,
              }}
            >
              <CardContent sx={{ py: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'info.main' }}>
                  {stats.completionRate}%
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  完成率
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Progress Bar */}
        <Paper elevation={0} sx={{ p: 3, mb: 4, bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              总体进度
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
              {stats.completed} / {stats.total}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={stats.completionRate}
            sx={{ height: 12, borderRadius: 6 }}
          />
        </Paper>

        {/* Overdue Tasks */}
        {overdueTasks.length > 0 && (
          <Paper elevation={0} sx={{ p: 3, mb: 4, bgcolor: 'error.light', border: 2, borderColor: 'error.main' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <AlertCircle size={24} color="#ef4444" />
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'error.dark' }}>
                ⚠️ 已逾期任务 ({overdueTasks.length})
              </Typography>
            </Stack>
            <Stack spacing={2}>
              {overdueTasks.map(task => {
                const category = state.categories.find(cat => cat.id === task.category);
                return (
                  <Card key={task.id} elevation={1}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {task.title}
                          </Typography>
                          {task.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {task.description}
                            </Typography>
                          )}
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip
                              label={task.priority === 'high' ? '高优先级' : task.priority === 'medium' ? '中优先级' : '低优先级'}
                              size="small"
                              color={getPriorityColor(task.priority) as any}
                            />
                            {category && (
                              <Chip
                                label={category.name}
                                size="small"
                                sx={{ bgcolor: category.color, color: 'white' }}
                              />
                            )}
                          </Stack>
                        </Box>
                        <Chip
                          icon={<Clock size={14} />}
                          label={`逾期 ${Math.abs(differenceInDays(new Date(), new Date(task.deadline!)))} 天`}
                          color="error"
                          size="small"
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Paper>
        )}

        {/* Today's Tasks */}
        {todayTasks.length > 0 && (
          <Paper elevation={0} sx={{ p: 3, mb: 4, bgcolor: 'warning.light' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Calendar size={24} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                📅 今天的任务 ({todayTasks.length})
              </Typography>
            </Stack>
            <Stack spacing={2}>
              {todayTasks.map(task => {
                const category = state.categories.find(cat => cat.id === task.category);
                return (
                  <Card key={task.id} elevation={1}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {task.title}
                          </Typography>
                          {task.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {task.description}
                            </Typography>
                          )}
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip
                              label={task.priority === 'high' ? '高优先级' : task.priority === 'medium' ? '中优先级' : '低优先级'}
                              size="small"
                              color={getPriorityColor(task.priority) as any}
                            />
                            {category && (
                              <Chip
                                label={category.name}
                                size="small"
                                sx={{ bgcolor: category.color, color: 'white' }}
                              />
                            )}
                          </Stack>
                        </Box>
                        <Chip
                          icon={<Clock size={14} />}
                          label={formatCountdown(new Date(task.deadline!))}
                          color="warning"
                          size="small"
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Paper>
        )}

        {/* Upcoming Tasks (7 days) */}
        {upcomingTasks.length > 0 && (
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Clock size={24} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                🔔 即将到期 (7天内) ({upcomingTasks.length})
              </Typography>
            </Stack>
            <Stack spacing={2}>
              {upcomingTasks.map(task => {
                const category = state.categories.find(cat => cat.id === task.category);
                const deadline = new Date(task.deadline!);
                const daysUntil = differenceInDays(deadline, new Date());

                return (
                  <Card key={task.id} elevation={1}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {task.title}
                          </Typography>
                          {task.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {task.description}
                            </Typography>
                          )}
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip
                              label={task.priority === 'high' ? '高优先级' : task.priority === 'medium' ? '中优先级' : '低优先级'}
                              size="small"
                              color={getPriorityColor(task.priority) as any}
                            />
                            {category && (
                              <Chip
                                label={category.name}
                                size="small"
                                sx={{ bgcolor: category.color, color: 'white' }}
                              />
                            )}
                          </Stack>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Chip
                            icon={<Clock size={14} />}
                            label={formatCountdown(deadline)}
                            color={daysUntil <= 1 ? 'error' : daysUntil <= 3 ? 'warning' : 'info'}
                            size="small"
                            sx={{ mb: 0.5 }}
                          />
                          <Typography variant="caption" color="text.secondary" display="block">
                            {format(deadline, 'MM月dd日 HH:mm', { locale: zhCN })}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Paper>
        )}

        {/* Empty State */}
        {upcomingTasks.length === 0 && todayTasks.length === 0 && overdueTasks.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 8,
              textAlign: 'center',
            }}
          >
            <Typography variant="h4" sx={{ mb: 2 }}>
              🎉
            </Typography>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
              太棒了！
            </Typography>
            <Typography variant="body2" color="text.secondary">
              当前没有即将到期或逾期的任务
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};