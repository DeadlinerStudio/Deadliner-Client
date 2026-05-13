import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Button,
  Fab,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import {
  Grid3x3 as GridIcon,
  List as ListIcon,
  ArrowUpDown as SortByAlpha,
  CheckSquare,
  Archive,
  Trash2,
  X,
  Search,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TaskItem } from './TaskItemMUI';
import { Task } from '../types';

interface TaskListProps {
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
}

export const TaskList: React.FC<TaskListProps> = ({ onAddTask, onEditTask }) => {
  const { state, dispatch } = useApp();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);

  // 过滤和排序任务
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = state.tasks.filter(task => {
      // 按归档状态过滤
      if (task.isArchived && state.currentView !== 'archive') return false;
      if (!task.isArchived && state.currentView === 'archive') return false;

      // 只显示任务（不包括习惯）
      if (task.type !== 'task') return false;

      // 按搜索关键词过滤
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query)
        );
      }

      return true;
    });

    // 排序任务：星标优先，然后按选定的排序键
    filtered.sort((a, b) => {
      const starDiff = Number(b.isStarred) - Number(a.isStarred);
      if (starDiff !== 0) return starDiff;

      switch (state.sortBy) {
        case 'deadline':
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        default:
          return 0;
      }
    });

    return filtered;
  }, [state.tasks, searchQuery, state.sortBy, state.currentView]);



  const handleSortChange = (sortBy: typeof state.sortBy) => {
    dispatch({ type: 'SET_SORT', payload: sortBy });
    setSortAnchorEl(null);
  };

  const toggleMultiSelect = () => {
    dispatch({ type: 'TOGGLE_MULTI_SELECT' });
  };

  const handleBatchComplete = () => {
    const selectedTaskIds = Array.from(state.selectedTasks);
    dispatch({ type: 'BATCH_COMPLETE_TASKS', payload: selectedTaskIds });
  };

  const handleBatchDelete = () => {
    setBatchDeleteDialogOpen(true);
  };

  const confirmBatchDelete = () => {
    const selectedTaskIds = Array.from(state.selectedTasks);
    dispatch({ type: 'BATCH_DELETE_TASKS', payload: selectedTaskIds });
    setBatchDeleteDialogOpen(false);
  };

  const handleBatchArchive = () => {
    const selectedTaskIds = Array.from(state.selectedTasks);
    dispatch({ type: 'BATCH_ARCHIVE_TASKS', payload: selectedTaskIds });
  };

  const taskStats = useMemo(() => {
    const total = filteredAndSortedTasks.length;
    const completed = filteredAndSortedTasks.filter(t => t.completed).length;
    const overdue = filteredAndSortedTasks.filter(t =>
      t.deadline && new Date(t.deadline) < new Date() && !t.completed
    ).length;
    return { total, completed, overdue };
  }, [filteredAndSortedTasks]);

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
            {state.currentView === 'archive' ? '存档中心' : '任务管理'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {state.currentView === 'archive'
              ? `管理您的 ${taskStats.total} 个已存档项目`
              : '追踪您的任务进度与截止时间'
            }
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
              placeholder="搜索任务..."
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
            <MenuItem onClick={() => handleSortChange('deadline')} selected={state.sortBy === 'deadline'}>截止时间</MenuItem>
            <MenuItem onClick={() => handleSortChange('created')} selected={state.sortBy === 'created'}>创建时间</MenuItem>
            <MenuItem onClick={() => handleSortChange('updated')} selected={state.sortBy === 'updated'}>更新时间</MenuItem>
            <MenuItem onClick={() => handleSortChange('priority')} selected={state.sortBy === 'priority'}>优先级</MenuItem>
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
              已选中 {state.selectedTasks.size} 个项目
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

      {/* Task List/Grid */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 4 }, py: 3, pb: 12, zIndex: 0 }}>
        {filteredAndSortedTasks.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
            }}
          >
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              暂无任务
            </Typography>
            <Typography variant="body2" color="text.secondary">
              点击右下角的按钮添加新任务
            </Typography>
          </Box>
        ) : (
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: viewMode === 'grid' ? { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(2, 1fr)', xl: 'repeat(2, 1fr)' } : '1fr',
            gap: 3 
          }}>
            {filteredAndSortedTasks.map((task) => (
              <Box key={task.id}>
                <TaskItem task={task} viewMode={viewMode} onEdit={onEditTask} />
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* FAB for Add Task */}
      <Fab
        color="primary"
        onClick={onAddTask}
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

      {/* Batch Delete Confirmation Dialog */}
      <Dialog open={batchDeleteDialogOpen} onClose={() => setBatchDeleteDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 600 }}>确认批量删除</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除选中的 {state.selectedTasks.size} 个任务吗？此操作无法撤销。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={() => setBatchDeleteDialogOpen(false)} sx={{ borderRadius: 50, px: 3, color: 'text.secondary' }}>取消</Button>
          <Button onClick={confirmBatchDelete} color="error" variant="contained" disableElevation sx={{ borderRadius: 50, px: 3 }}>
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};