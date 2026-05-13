import React, { useState, useMemo } from 'react';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Fab,
  Paper,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import {
  Target,
  MoreVertical,
  CheckCircle,
  Archive,
  Trash2,
  Flame,
  Search,
  Grid3x3 as GridIcon,
  List as ListIcon,
  ArrowUpDown as SortByAlpha,
  CheckSquare,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Task } from '../types';

// 习惯页面属性接口
interface HabitsPageProps {
  onAddHabit: () => void; // 添加习惯回调
  onEditHabit: (habit: Task) => void; // 编辑习惯回调
}

// 习惯页面组件
export const HabitsPage: React.FC<HabitsPageProps> = ({ onAddHabit, onEditHabit }) => {
  // 获取应用状态和 dispatch 函数
  const { state, dispatch } = useApp();
  // 菜单锚点
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  // 选中的习惯
  const [selectedHabit, setSelectedHabit] = useState<Task | null>(null);
  // 搜索查询
  const [searchQuery, setSearchQuery] = useState('');
  // 视图模式
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  // 排序菜单锚点
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
  // 排序方式
  const [sortBy, setSortBy] = useState<'created' | 'updated' | 'priority'>('created');
  // 删除对话框开关
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // 要删除的习惯
  const [habitToDelete, setHabitToDelete] = useState<Task | null>(null);
  // 批量删除对话框开关
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);

  // 获取所有未归档的习惯并过滤搜索
  const habits = useMemo(() => {
    let filtered = state.tasks.filter(task => task.type === 'habit' && !task.isArchived);

    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(habit =>
        habit.title.toLowerCase().includes(query) ||
        habit.description?.toLowerCase().includes(query)
      );
    }

    // 排序：星标优先置顶，然后按选择的排序规则
    filtered.sort((a, b) => {
      const starDiff = Number(b.isStarred) - Number(a.isStarred);
      if (starDiff !== 0) return starDiff;

      switch (sortBy) {
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // 创建时间降序
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(); // 更新时间降序
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority]; // 优先级降序
        default:
          return 0;
      }
    });

    return filtered;
  }, [state.tasks, searchQuery, sortBy]);

  // 统计数据
  const stats = useMemo(() => {
    const total = habits.length; // 总习惯数
    const completed = habits.filter(h => h.completed).length; // 已完成数
    const active = habits.filter(h => !h.completed).length; // 活跃数
    const avgProgress = habits.length > 0
      ? Math.round(habits.reduce((sum, h) => sum + (h.progress || 0), 0) / habits.length)
      : 0; // 平均进度
    const totalStreak = habits.reduce((sum, h) => sum + (h.streak || 0), 0); // 总连续天数

    return { total, completed, active, avgProgress, totalStreak };
  }, [habits]);

  // 打开菜单
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, habit: Task) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedHabit(habit);
  };

  // 关闭菜单
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedHabit(null);
  };

  // 切换完成状态
  const handleToggleComplete = (habitId: string) => {
    dispatch({ type: 'TOGGLE_TASK_COMPLETION', payload: habitId });
  };

  // 切换星标状态
  const handleToggleStar = (habitId: string) => {
    dispatch({ type: 'TOGGLE_TASK_STAR', payload: habitId });
  };

  // 归档习惯
  const handleArchive = () => {
    if (selectedHabit) {
      dispatch({ type: 'ARCHIVE_TASK', payload: selectedHabit.id });
    }
    handleMenuClose();
  };

  // 处理删除
  const handleDelete = () => {
    if (selectedHabit) {
      setHabitToDelete(selectedHabit);
      setDeleteDialogOpen(true);
    }
    handleMenuClose();
  };

  // 确认删除习惯
  const confirmDelete = async () => {
    if (habitToDelete) {
      try {
        if (window.electron) {
          await window.electron.storage.deleteTask(habitToDelete.id); // 从数据库删除
        }
        dispatch({ type: 'DELETE_TASK', payload: habitToDelete.id }); // 更新状态
        setDeleteDialogOpen(false);
        setHabitToDelete(null);
        setSelectedHabit(null);
      } catch (error) {
        console.error('Failed to delete habit:', error);
        alert('删除失败,请重试');
      }
    }
  };

  // 处理批量删除
  const handleBatchDelete = () => {
    setBatchDeleteDialogOpen(true);
  };

  // 确认批量删除
  const confirmBatchDelete = () => {
    const selectedTaskIds = Array.from(state.selectedTasks);
    dispatch({ type: 'BATCH_DELETE_TASKS', payload: selectedTaskIds });
    setBatchDeleteDialogOpen(false);
  };

  // 处理编辑
  const handleEdit = () => {
    if (selectedHabit) {
      onEditHabit(selectedHabit);
    }
    handleMenuClose();
  };

  // 处理排序变化
  const handleSortChange = (newSortBy: typeof sortBy) => {
    setSortBy(newSortBy);
    setSortAnchorEl(null);
  };

  // 切换多选模式
  const toggleMultiSelect = () => {
    dispatch({ type: 'TOGGLE_MULTI_SELECT' });
  };

  // 处理选择习惯
  const handleSelect = (habitId: string) => {
    if (state.selectedTasks.has(habitId)) {
      dispatch({ type: 'DESELECT_TASK', payload: habitId }); // 取消选择
    } else {
      dispatch({ type: 'SELECT_TASK', payload: habitId }); // 选择
    }
  };

  // 批量完成
  const handleBatchComplete = () => {
    const selectedTaskIds = Array.from(state.selectedTasks);
    dispatch({ type: 'BATCH_COMPLETE_TASKS', payload: selectedTaskIds });
  };

  // 批量归档
  const handleBatchArchive = () => {
    const selectedTaskIds = Array.from(state.selectedTasks);
    dispatch({ type: 'BATCH_ARCHIVE_TASKS', payload: selectedTaskIds });
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
    <Box sx={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      bgcolor: 'background.default',
      overflow: 'hidden',
      transition: 'background-color 0.3s',
      position: 'relative'
    }}>
      {/* Header */}
      <Box sx={{ 
        px: { xs: 2, md: 4 }, 
        py: 3, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        zIndex: 10,
        flexWrap: 'wrap',
        gap: 2,
        borderBottom: 1, 
        borderColor: 'divider'
      }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5, color: 'text.primary' }}>
            习惯追踪
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            培养良好习惯，坚持每一天
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {/* Search */}
          <Box sx={{ position: 'relative' }}>
            <Search 
              size={16} 
              style={{ 
                position: 'absolute', 
                left: 12, 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: '#9ca3af' 
              }} 
            />
            <Box
              component="input"
              placeholder="搜索习惯..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              sx={{
                pl: 4.5,
                pr: 2,
                py: 1,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 50,
                fontSize: '0.875rem',
                outline: 'none',
                width: { xs: '100%', sm: 200, md: 250 },
                color: 'text.primary',
                transition: 'all 0.2s',
                '&:focus': {
                  borderColor: 'primary.main',
                  boxShadow: theme => `0 0 0 2px ${theme.palette.primary.main}33`
                }
              }}
            />
          </Box>

          {/* View Mode Toggle */}
          <Box sx={{ 
            display: 'flex', 
            bgcolor: 'background.paper', 
            border: '1px solid', 
            borderColor: 'divider', 
            borderRadius: 50, 
            p: 0.5 
          }}>
            <IconButton 
              size="small"
              onClick={() => setViewMode('list')}
              sx={{ 
                p: 0.75, 
                bgcolor: viewMode === 'list' ? 'action.selected' : 'transparent',
                color: viewMode === 'list' ? 'text.primary' : 'text.secondary',
                '&:hover': { bgcolor: viewMode === 'list' ? 'action.selected' : 'action.hover' }
              }}
            >
              <ListIcon size={16} />
            </IconButton>
            <IconButton 
              size="small"
              onClick={() => setViewMode('grid')}
              sx={{ 
                p: 0.75, 
                bgcolor: viewMode === 'grid' ? 'action.selected' : 'transparent',
                color: viewMode === 'grid' ? 'text.primary' : 'text.secondary',
                '&:hover': { bgcolor: viewMode === 'grid' ? 'action.selected' : 'action.hover' }
              }}
            >
              <GridIcon size={16} />
            </IconButton>
          </Box>

          {/* Sort Button */}
          <Button
            onClick={(e) => setSortAnchorEl(e.currentTarget)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 50,
              color: 'text.primary',
              fontSize: '0.875rem',
              fontWeight: 500,
              textTransform: 'none',
              minWidth: 'auto',
              '&:hover': {
                bgcolor: 'action.hover',
              }
            }}
          >
            <SortByAlpha size={16} />
            排序
          </Button>
          <Menu
            anchorEl={sortAnchorEl}
            open={Boolean(sortAnchorEl)}
            onClose={() => setSortAnchorEl(null)}
            PaperProps={{
              sx: { borderRadius: 2, mt: 1, boxShadow: 3 }
            }}
          >
            <MenuItem onClick={() => handleSortChange('created')} selected={sortBy === 'created'}>创建时间</MenuItem>
            <MenuItem onClick={() => handleSortChange('updated')} selected={sortBy === 'updated'}>更新时间</MenuItem>
            <MenuItem onClick={() => handleSortChange('priority')} selected={sortBy === 'priority'}>优先级</MenuItem>
          </Menu>

          {/* Multi-select Button */}
          <Button
            onClick={toggleMultiSelect}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1,
              bgcolor: state.isMultiSelectMode ? 'primary.main' : 'background.paper',
              border: '1px solid',
              borderColor: state.isMultiSelectMode ? 'primary.main' : 'divider',
              borderRadius: 50,
              color: state.isMultiSelectMode ? 'primary.contrastText' : 'text.primary',
              fontSize: '0.875rem',
              fontWeight: 500,
              textTransform: 'none',
              minWidth: 'auto',
              '&:hover': {
                bgcolor: state.isMultiSelectMode ? 'primary.dark' : 'action.hover',
              }
            }}
          >
            <CheckSquare size={16} />
            多选
          </Button>
        </Box>
      </Box>

      {/* Multi-select Toolbar */}
      {state.isMultiSelectMode && state.selectedTasks.size > 0 && (
        <Box sx={{ px: { xs: 2, md: 4 }, pt: 3, pb: 0, zIndex: 10 }}>
          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              px: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              borderRadius: 50,
              boxShadow: 3
            }}
          >
            <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
              已选中 {state.selectedTasks.size} 个习惯
            </Typography>
            <Button
              size="small"
              startIcon={<CheckSquare size={16} />}
              onClick={handleBatchComplete}
              sx={{ color: 'inherit', bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 50, px: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
            >
              完成
            </Button>
            <Button
              size="small"
              startIcon={<Archive size={16} />}
              onClick={handleBatchArchive}
              sx={{ color: 'inherit', bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 50, px: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
            >
              归档
            </Button>
            <Button
              size="small"
              startIcon={<Trash2 size={16} />}
              onClick={handleBatchDelete}
              sx={{ color: 'inherit', bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 50, px: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
            >
              删除
            </Button>
            <IconButton
              size="small"
              onClick={toggleMultiSelect}
              sx={{ color: 'inherit', ml: 1 }}
            >
              <X size={18} />
            </IconButton>
          </Paper>
        </Box>
      )}

      {/* Stats Cards */}
      <Box sx={{ px: { xs: 2, md: 4 }, py: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 3 }}>
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
                  {stats.total}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  全部
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 3 }}>
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
                  {stats.active}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  进行中
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 3 }}>
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
                  {stats.completed}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  已完成
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 3 }}>
            <Card
              elevation={0}
              sx={{
                textAlign: 'center',
                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.08)',
                border: 1,
                borderColor: theme => theme.palette.mode === 'dark' ? 'rgba(249,115,22,0.3)' : 'rgba(249,115,22,0.15)',
                borderRadius: 3,
              }}
            >
              <CardContent sx={{ py: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>
                  {stats.totalStreak}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  连续天数
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Habits Grid */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 4 }, py: 3, pb: 12, zIndex: 0 }}>
        {habits.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              py: 8,
            }}
          >
            {/* Empty State Illustration */}
            <Box
              sx={{
                width: 200,
                height: 200,
                mb: 4,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Main target */}
              <Box
                sx={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  border: 4,
                  borderStyle: 'dashed',
                  borderColor: theme => theme.palette.mode === 'dark' ? 'rgba(168,85,247,0.4)' : 'rgba(168,85,247,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Box
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    border: 3,
                    borderStyle: 'dashed',
                    borderColor: theme => theme.palette.mode === 'dark' ? 'rgba(168,85,247,0.6)' : 'rgba(168,85,247,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography sx={{ fontSize: '1.5rem' }}>🎯</Typography>
                </Box>
              </Box>
              {/* Decorative elements */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 10,
                  right: 30,
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: 'rotate(15deg)',
                }}
              >
                <Typography sx={{ fontSize: '1.2rem' }}>✓</Typography>
              </Box>
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 20,
                  left: 15,
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(249,115,22,0.2)' : 'rgba(249,115,22,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: 'rotate(-10deg)',
                }}
              >
                <Typography sx={{ fontSize: '1rem' }}>🔥</Typography>
              </Box>
              <Box
                sx={{
                  position: 'absolute',
                  top: 30,
                  left: 20,
                  width: 24,
                  height: 24,
                  borderRadius: 1,
                  bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography sx={{ fontSize: '0.8rem' }}>⭐</Typography>
              </Box>
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}>
              开始培养你的第一个习惯
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 300 }}>
              点击右下角的 + 按钮，创建你的第一个习惯
            </Typography>
          </Box>
        ) : (
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: viewMode === 'grid' ? { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(2, 1fr)', xl: 'repeat(2, 1fr)' } : '1fr',
            gap: 3 
          }}>
            {habits.map((habit) => {
              const isSelected = state.selectedTasks.has(habit.id);
              
              // 动态获取颜色，这里为了简化，可以使用习惯的主题色或随机分配颜色
              // 在此示例中，我们根据习惯ID的某些属性生成不同的背景色以保持视觉丰富性
              const colorSchemes = [
                { bg: 'status-orange-light', fill: 'status-orange-fill', hoverText: 'amber' },
                { bg: 'status-blue-light', fill: 'status-blue-fill', hoverText: 'blue' },
                { bg: 'status-purple-light', fill: 'status-purple-fill', hoverText: 'purple' },
              ];
              const schemeIndex = habit.id.length % colorSchemes.length;
              const scheme = colorSchemes[schemeIndex];

              return (
                <Box
                  key={habit.id}
                  sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '24px',
                    bgcolor: (theme) => {
                      if (habit.completed) return theme.palette.mode === 'dark' ? '#164A29' : '#DCFCE7';
                      if (scheme.bg === 'status-orange-light') return theme.palette.mode === 'dark' ? '#432C1B' : '#FFEDD5';
                      if (scheme.bg === 'status-blue-light') return theme.palette.mode === 'dark' ? '#1E3A5F' : '#DBEAFE';
                      return theme.palette.mode === 'dark' ? '#3B1E54' : '#F3E8FF';
                    },
                    boxShadow: isSelected ? 3 : 1,
                    transition: 'all 0.3s ease',
                    height: viewMode === 'grid' ? 112 : 'auto',
                    minHeight: viewMode === 'list' ? 88 : 112,
                    cursor: 'pointer',
                    '&:hover': {
                      boxShadow: 3,
                      '& .habit-title': {
                        color: (theme) => {
                          if (habit.completed) return theme.palette.mode === 'dark' ? '#A7F3D0' : '#065F46';
                          if (scheme.hoverText === 'amber') return theme.palette.mode === 'dark' ? '#FDE68A' : '#78350F';
                          if (scheme.hoverText === 'blue') return theme.palette.mode === 'dark' ? '#BFDBFE' : '#1E3A8A';
                          return theme.palette.mode === 'dark' ? '#E9D5FF' : '#581C87';
                        }
                      }
                    },
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                  onClick={(e) => {
                    if (state.isMultiSelectMode) {
                      handleSelect(habit.id);
                    } else {
                      handleMenuOpen(e, habit);
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
                      bgcolor: (theme) => {
                        if (habit.completed) return theme.palette.mode === 'dark' ? 'rgba(110, 231, 183, 0.8)' : 'rgba(110, 231, 183, 1)';
                        if (scheme.fill === 'status-orange-fill') return theme.palette.mode === 'dark' ? 'rgba(253, 186, 116, 0.2)' : 'rgba(253, 186, 116, 0.3)';
                        if (scheme.fill === 'status-blue-fill') return theme.palette.mode === 'dark' ? 'rgba(96, 165, 250, 0.3)' : 'rgba(96, 165, 250, 0.4)';
                        return theme.palette.mode === 'dark' ? 'rgba(192, 132, 252, 0.3)' : 'rgba(192, 132, 252, 0.4)';
                      },
                      width: habit.completed ? '100%' : `${habit.progress || 0}%`,
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
                          onChange={() => handleSelect(habit.id)}
                          onClick={(e) => e.stopPropagation()}
                          sx={{ p: 0, color: 'text.secondary', '&.Mui-checked': { color: 'primary.main' } }}
                        />
                      )}
                      {!state.isMultiSelectMode && (
                        <Checkbox
                          checked={habit.completed}
                          onChange={() => handleToggleComplete(habit.id)}
                          onClick={(e) => e.stopPropagation()}
                          icon={<CheckCircle size={22} />}
                          checkedIcon={<CheckCircle size={22} />}
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
                          className="habit-title"
                          variant="h6"
                          sx={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            color: habit.completed ? 'text.secondary' : 'text.primary',
                            textDecoration: habit.completed ? 'line-through' : 'none',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            mb: 0.5,
                            transition: 'color 0.2s ease',
                          }}
                        >
                          {habit.title}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {habit.streak && habit.streak > 0 ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'warning.main' }}>
                              <Flame size={14} />
                              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                                连续打卡 {habit.streak} 天
                              </Typography>
                            </Box>
                          ) : (
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
                              {habit.description || '添加描述...'}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>

                    {/* Right Side */}
                    <Box sx={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography
                        sx={{
                          fontSize: '1.125rem',
                          fontWeight: 700,
                          color: habit.completed ? (theme => theme.palette.mode === 'dark' ? 'white' : 'text.primary') : 'text.primary',
                          whiteSpace: 'nowrap',
                          display: { xs: 'none', sm: 'block' }
                        }}
                      >
                        {habit.completed ? '已打卡' : `${habit.progress || 0}%`}
                      </Typography>

                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, habit)}
                        sx={{ p: 0.5, color: 'text.secondary', opacity: 0.6, '&:hover': { opacity: 1, bgcolor: 'rgba(0,0,0,0.05)' } }}
                      >
                        <MoreVertical size={20} />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* FAB for Add Habit */}
      <Fab
        color="primary"
        onClick={onAddHabit}
        sx={{
          position: 'absolute',
          bottom: 32,
          right: 32,
          width: 56,
          height: 56,
          boxShadow: theme => `0 10px 15px -3px ${theme.palette.primary.main}4D`,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          '&:hover': {
            bgcolor: 'primary.dark',
            transform: 'scale(1.05)',
            boxShadow: theme => `0 20px 25px -5px ${theme.palette.primary.main}66`,
          },
          transition: 'all 0.2s ease-in-out',
          zIndex: 50
        }}
      >
        <AddRoundedIcon sx={{ fontSize: 28 }} />
      </Fab>

      {/* Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <Target size={18} style={{ marginRight: 8 }} />
          编辑
        </MenuItem>
        <MenuItem onClick={handleArchive}>
          <Archive size={18} style={{ marginRight: 8 }} />
          归档
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <Trash2 size={18} style={{ marginRight: 8 }} />
          删除
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setHabitToDelete(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除"{habitToDelete?.title}"吗？此操作无法撤销。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteDialogOpen(false);
            setHabitToDelete(null);
          }}>
            取消
          </Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            删除
          </Button>
        </DialogActions>
      </Dialog>

      {/* Batch Delete Confirmation Dialog */}
      <Dialog open={batchDeleteDialogOpen} onClose={() => setBatchDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>确认批量删除</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除选中的 {state.selectedTasks.size} 个习惯吗？此操作无法撤销。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchDeleteDialogOpen(false)}>取消</Button>
          <Button onClick={confirmBatchDelete} color="error" variant="contained">
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};