import React, { useState } from 'react';
import {
  Typography,
  IconButton,
  Box,
  Checkbox,
  Menu,
  MenuItem,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import {
  Star,
  MoreVertical,
  CheckSquare,
  Archive,
  Trash2,
  Edit,
} from 'lucide-react';
import { Task } from '../types';
import { useApp } from '../context/AppContext';
import { formatDistanceToNow, differenceInDays, differenceInHours, differenceInMinutes, startOfDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface TaskItemProps {
  task: Task;
  viewMode?: 'grid' | 'list';
  onEdit?: (task: Task) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task, viewMode = 'grid', onEdit }) => {
  const { state, dispatch } = useApp();
  const theme = useTheme();
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const isSelected = state.selectedTasks.has(task.id);

  const handleToggleComplete = async () => {
    try {
      if (window.electron) {
        await window.electron.storage.updateTask(task.id, { completed: !task.completed });
      }
      dispatch({ type: 'TOGGLE_TASK_COMPLETION', payload: task.id });
    } catch (error) {
      console.error('Failed to toggle completion:', error);
    }
  };

  const handleToggleStar = async () => {
    try {
      if (window.electron) {
        await window.electron.storage.updateTask(task.id, { isStarred: !task.isStarred });
      }
      dispatch({ type: 'TOGGLE_TASK_STAR', payload: task.id });
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  };

  const handleDelete = () => {
    setMenuAnchorEl(null);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    try {
      console.log('Deleting task:', task.id);
      if (window.electron) {
        const result = await window.electron.storage.deleteTask(task.id);
        console.log('Delete result:', result);
      }
      dispatch({ type: 'DELETE_TASK', payload: task.id });
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('删除失败,请重试');
    }
  };

  const handleArchive = async () => {
    try {
      if (window.electron) {
        await window.electron.storage.archiveTask(task.id);
      }
      dispatch({ type: 'ARCHIVE_TASK', payload: task.id });
      setMenuAnchorEl(null);
    } catch (error) {
      console.error('Failed to archive task:', error);
      alert('归档失败,请重试');
    }
  };

  const handleSelect = () => {
    if (isSelected) {
      dispatch({ type: 'DESELECT_TASK', payload: task.id });
    } else {
      dispatch({ type: 'SELECT_TASK', payload: task.id });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return theme.palette.error.main;
      case 'medium': return theme.palette.warning.main;
      case 'low': return theme.palette.success.main;
      default: return theme.palette.grey[400];
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return '';
    }
  };

  // 计算截止日期进度和状态
  const getDeadlineInfo = () => {
    if (!task.deadline) return null;

    const now = new Date();
    const deadline = new Date(task.deadline);

    const deadlineValid = !isNaN(deadline.getTime());
    if (!deadlineValid) return null;

    const remainingTime = deadline.getTime() - now.getTime();
    const daysRemaining = differenceInDays(deadline, now);
    const hoursRemaining = differenceInHours(deadline, now);

    // 进度条表示已经过去的时间百分比（0% = 刚开始，100% = 时间耗尽）
    // 为了可视性，设置一个最小可见进度阈值
    const MIN_VISIBLE_PROGRESS = 2; // 2%
    let progressPercentage = 0;

    // 使用"今天零点"为锚点，表示现在到 DDL 的接近度
    const anchor = startOfDay(now);
    const totalTimeFromAnchor = deadline.getTime() - anchor.getTime();
    if (totalTimeFromAnchor > 0) {
      const elapsedFromAnchor = now.getTime() - anchor.getTime();
      let pct = (elapsedFromAnchor / totalTimeFromAnchor) * 100;
      pct = Math.max(0, Math.min(100, pct));
      if (pct > 0 && pct < MIN_VISIBLE_PROGRESS) pct = MIN_VISIBLE_PROGRESS;
      progressPercentage = pct;
    } else {
      // DDL 早于今天零点：视为已逾期或立即截止
      progressPercentage = remainingTime <= 0 ? 100 : 0;
    }

    let statusColor = theme.palette.success.main;
    let statusText = '';

    if (remainingTime < 0) {
      statusColor = theme.palette.error.main;
      statusText = '已逾期'; // 已逾期
    } else if (daysRemaining === 0) {
      statusColor = theme.palette.warning.main;
      const minutesRemaining = Math.max(1, differenceInMinutes(deadline, now));
      if (minutesRemaining < 60) {
        statusText = `剩余${minutesRemaining}分钟`; // 剩余分钟
      } else {
        statusText = hoursRemaining <= 12 ? `${hoursRemaining}小时后截止` : '今天截止'; // 今天截止
      }
    } else if (daysRemaining === 1) {
      statusColor = theme.palette.warning.light;
      statusText = '明天截止'; // 明天截止
    } else if (daysRemaining <= 3) {
      statusColor = theme.palette.info.main;
      statusText = `${daysRemaining}天后截止`; // 几天后截止
    } else {
      statusText = `剩余${daysRemaining}天`; // 剩余天数
    }

     return {
      progressPercentage, // 进度百分比
      statusColor, // 状态颜色
      statusText, // 状态文本
      daysRemaining, // 剩余天数
      remainingTime, // 剩余时间
      deadline, // 截止时间
    };
  };

  const deadlineInfo = getDeadlineInfo();

  const getColorScheme = () => {
    const isDark = theme.palette.mode === 'dark';
    if (task.completed) {
      return {
        bg: isDark ? '#164A29' : '#DCFCE7',
        fill: isDark ? 'rgba(110, 231, 183, 0.8)' : 'rgba(110, 231, 183, 1)',
        textHover: isDark ? '#A7F3D0' : '#065F46',
      };
    }
    
    if (!deadlineInfo) {
      return {
        bg: isDark ? '#3B1E54' : '#F3E8FF',
        fill: isDark ? 'rgba(192, 132, 252, 0.3)' : 'rgba(192, 132, 252, 0.4)',
        textHover: isDark ? '#E9D5FF' : '#581C87',
      };
    }

    if (deadlineInfo.daysRemaining <= 1 || deadlineInfo.remainingTime < 0) {
      return {
        bg: isDark ? '#432C1B' : '#FFEDD5',
        fill: isDark ? 'rgba(253, 186, 116, 0.2)' : 'rgba(253, 186, 116, 0.3)',
        textHover: isDark ? '#FDE68A' : '#78350F',
      };
    }
    
    return {
      bg: isDark ? '#1E3A5F' : '#DBEAFE',
      fill: isDark ? 'rgba(96, 165, 250, 0.3)' : 'rgba(96, 165, 250, 0.4)',
      textHover: isDark ? '#BFDBFE' : '#1E3A8A',
    };
  };

  const scheme = getColorScheme();
  const progressWidth = task.completed ? 100 : (deadlineInfo ? deadlineInfo.progressPercentage : 0);
  const rightText = task.completed ? '已完成' : (deadlineInfo ? deadlineInfo.statusText : '无期限');

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '24px',
        bgcolor: scheme.bg,
        boxShadow: isSelected ? 3 : 1,
        transition: 'all 0.3s ease',
        height: viewMode === 'grid' ? 112 : 'auto',
        minHeight: viewMode === 'list' ? 88 : 112,
        cursor: 'pointer',
        '&:hover': {
          boxShadow: 3,
          '& .task-title': {
            color: scheme.textHover,
          }
        },
        display: 'flex',
        flexDirection: 'column'
      }}
      onClick={(e) => {
        if (state.isMultiSelectMode) {
          handleSelect();
        } else {
          setMenuAnchorEl(e.currentTarget);
        }
      }}
    >
      {/* Progress Fill */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          bgcolor: scheme.fill,
          width: `${progressWidth}%`,
          transition: 'width 0.5s ease-in-out',
          zIndex: 0
        }}
      />

      <Box sx={{ position: 'relative', height: '100%', p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        {/* Left Side */}
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', maxWidth: '70%', flex: 1, gap: 2 }}>
          {state.isMultiSelectMode && (
            <Checkbox
              size="medium"
              checked={isSelected}
              onChange={handleSelect}
              onClick={(e) => e.stopPropagation()}
              sx={{ p: 0, color: 'text.secondary', '&.Mui-checked': { color: 'primary.main' } }}
            />
          )}
          {!state.isMultiSelectMode && (
            <Checkbox
              checked={task.completed}
              onChange={handleToggleComplete}
              onClick={(e) => e.stopPropagation()}
              icon={<CheckSquare size={22} />}
              checkedIcon={<CheckSquare size={22} />}
              sx={{
                p: 0,
                color: 'text.secondary',
                opacity: 0.7,
                '&.Mui-checked': { color: 'success.main', opacity: 1 },
                '&:hover': { opacity: 1 }
              }}
            />
          )}
          
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}>
            <Typography
              className="task-title"
              variant="h6"
              sx={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: task.completed ? 'text.secondary' : 'text.primary',
                textDecoration: task.completed ? 'line-through' : 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                mb: 0.5,
                transition: 'color 0.2s ease',
              }}
            >
              {task.title}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.875rem',
                color: 'text.secondary',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {task.description || (deadlineInfo ? `${task.completed ? '完成于' : '截止于'} ${formatDistanceToNow(new Date(task.deadline!), { addSuffix: true, locale: zhCN })}` : '添加描述...')}
            </Typography>
          </Box>
        </Box>

        {/* Right Side */}
        <Box sx={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography
            sx={{
              fontSize: '1.125rem',
              fontWeight: 700,
              color: task.completed ? (theme.palette.mode === 'dark' ? 'white' : 'text.primary') : 'text.primary',
              whiteSpace: 'nowrap',
              display: { xs: 'none', sm: 'block' }
            }}
          >
            {rightText}
          </Typography>
          
          {/* Action Menu button shown on hover or when clicked */}
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setMenuAnchorEl(e.currentTarget);
            }}
            sx={{ p: 0.5, color: 'text.secondary', opacity: 0.6, '&:hover': { opacity: 1, bgcolor: 'rgba(0,0,0,0.05)' } }}
          >
            <MoreVertical size={20} />
          </IconButton>
        </Box>
      </Box>

      {/* Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={(e: any) => {
          e.stopPropagation();
          setMenuAnchorEl(null);
        }}
        PaperProps={{ sx: { borderRadius: 2, boxShadow: 3 } }}
      >
        <MenuItem onClick={(e) => {
          e.stopPropagation();
          setMenuAnchorEl(null);
          if (onEdit) onEdit(task);
        }}>
          <Edit size={18} style={{ marginRight: 8 }} />
          编辑
        </MenuItem>
        <MenuItem onClick={(e) => {
          e.stopPropagation();
          handleToggleStar();
          setMenuAnchorEl(null);
        }}>
          <Star size={18} fill={task.isStarred ? 'currentColor' : 'none'} style={{ marginRight: 8, color: task.isStarred ? theme.palette.warning.main : 'inherit' }} />
          {task.isStarred ? '取消标星' : '标星'}
        </MenuItem>
        <MenuItem onClick={(e) => {
          e.stopPropagation();
          handleArchive();
        }}>
          <Archive size={18} style={{ marginRight: 8 }} />
          归档
        </MenuItem>
        <MenuItem onClick={(e) => {
          e.stopPropagation();
          handleDelete();
        }} sx={{ color: 'error.main' }}>
          <Trash2 size={18} style={{ marginRight: 8 }} />
          删除
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 600 }}>确认删除</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除"{task.title}"吗？此操作无法撤销。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ borderRadius: 50, px: 3, color: 'text.secondary' }}>取消</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" disableElevation sx={{ borderRadius: 50, px: 3 }}>
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};