/**
 * GuidedSupplementDialog - 引导补充信息对话框
 * 用于分步引导用户补充缺失的任务信息
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
  Box,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  Chip,
  Divider,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { zhCN } from 'date-fns/locale';
import { HelpCircle, Sparkles, Clock, Target, ListChecks, Info } from 'lucide-react';

interface MissingFields {
  time?: boolean;
  goal?: boolean;
  detail?: boolean;
  priority?: boolean;
  type?: boolean;
}

interface SupplementForm {
  deadline: Date | null;
  detailedGoal: string;
  additionalInfo: string;
  priority: 'high' | 'medium' | 'low';
  type: '' | 'task' | 'habit';
}

interface GuidedSupplementDialogProps {
  open: boolean;
  originalPrompt: string;
  missingInfo: {
    missingFields: string[];
    reason: string;
  } | null;
  onSubmit: (supplement: string) => void;
  onCancel: () => void;
}

export const GuidedSupplementDialog: React.FC<GuidedSupplementDialogProps> = ({
  open,
  originalPrompt,
  missingInfo,
  onSubmit,
  onCancel,
}) => {
  const [form, setForm] = useState<SupplementForm>({
    deadline: null,
    detailedGoal: '',
    additionalInfo: '',
    priority: 'medium',
    type: '',
  });

  const resetForm = () => {
    setForm({
      deadline: null,
      detailedGoal: '',
      additionalInfo: '',
      priority: 'medium',
      type: '',
    });
  };

  const handleSubmit = () => {
    const parts: string[] = [originalPrompt];

    if (form.type) {
      parts.push(`类型：${form.type === 'task' ? '任务（一次性完成）' : '习惯（持续养成）'}`);
    }
    if (form.deadline) {
      const formatted = form.deadline.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      parts.push(`截止时间：${formatted}`);
    }
    if (form.detailedGoal) {
      parts.push(`详细目标：${form.detailedGoal}`);
    }
    if (form.additionalInfo) {
      parts.push(`补充说明：${form.additionalInfo}`);
    }
    parts.push(`优先级：${form.priority === 'high' ? '高' : form.priority === 'medium' ? '中' : '低'}`);

    onSubmit(parts.join('\n'));
    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onCancel();
  };

  if (!missingInfo) {
    return null;
  }

  const missingFields = missingInfo.missingFields;

  const FieldIcon: React.FC<{ field: string }> = ({ field }) => {
    switch (field) {
      case 'time':
        return <Clock size={16} />;
      case 'goal':
        return <Target size={16} />;
      case 'detail':
        return <ListChecks size={16} />;
      case 'priority':
        return null;
      case 'type':
        return null;
      default:
        return <HelpCircle size={16} />;
    }
  };

  const FieldLabel: React.FC<{ field: string }> = ({ field }) => {
    switch (field) {
      case 'time':
        return '截止时间';
      case 'goal':
        return '详细目标';
      case 'detail':
        return '补充说明';
      case 'priority':
        return '优先级';
      case 'type':
        return '类型选择';
      default:
        return field;
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <HelpCircle size={24} />
          <Typography variant="h6">补充任务信息</Typography>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhCN}>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Alert severity="info" icon={<Info size={20} />}>
              {missingInfo.reason}
            </Alert>

            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                您的原始需求：
              </Typography>
              <Typography
                variant="body2"
                sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}
              >
                {originalPrompt}
              </Typography>
            </Box>

            <Divider />

            {missingFields.includes('time') && (
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                  <FieldIcon field="time" />
                  <Typography variant="subtitle2">
                    <FieldLabel field="time" />
                  </Typography>
                </Stack>
                <DateTimePicker
                  value={form.deadline}
                  onChange={(newValue) => setForm({ ...form, deadline: newValue })}
                  format="yyyy-MM-dd HH:mm"
                  ampm={false}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      placeholder: '请选择截止日期和时间',
                    },
                  }}
                />
              </Box>
            )}

            {missingFields.includes('goal') && (
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                  <FieldIcon field="goal" />
                  <Typography variant="subtitle2">
                    <FieldLabel field="goal" />
                  </Typography>
                </Stack>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={form.detailedGoal}
                  onChange={(e) => setForm({ ...form, detailedGoal: e.target.value })}
                  placeholder="请详细描述您想要达成的具体目标..."
                />
              </Box>
            )}

            {missingFields.includes('detail') && (
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                  <FieldIcon field="detail" />
                  <Typography variant="subtitle2">
                    <FieldLabel field="detail" />
                  </Typography>
                </Stack>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={form.additionalInfo}
                  onChange={(e) => setForm({ ...form, additionalInfo: e.target.value })}
                  placeholder="请补充更详细的信息或具体要求..."
                />
              </Box>
            )}

            {missingFields.includes('priority') && (
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                  <FieldIcon field="priority" />
                  <Typography variant="subtitle2">
                    <FieldLabel field="priority" />
                  </Typography>
                </Stack>
                <RadioGroup
                  row
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                >
                  <FormControlLabel value="high" control={<Radio />} label="高" />
                  <FormControlLabel value="medium" control={<Radio />} label="中" />
                  <FormControlLabel value="low" control={<Radio />} label="低" />
                </RadioGroup>
              </Box>
            )}

            {missingFields.includes('type') && (
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                  <FieldIcon field="type" />
                  <Typography variant="subtitle2">
                    <FieldLabel field="type" />
                  </Typography>
                </Stack>
                <Stack spacing={2}>
                  <Button
                    fullWidth
                    variant={form.type === 'task' ? 'contained' : 'outlined'}
                    size="large"
                    onClick={() => setForm({ ...form, type: 'task' })}
                    sx={{ py: 2, justifyContent: 'flex-start', px: 2 }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box sx={{ fontSize: '1.5rem' }}>📋</Box>
                      <Stack alignItems="flex-start">
                        <Typography variant="body1" fontWeight={600}>
                          任务
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          一次性完成的事项
                        </Typography>
                      </Stack>
                    </Stack>
                  </Button>
                  <Button
                    fullWidth
                    variant={form.type === 'habit' ? 'contained' : 'outlined'}
                    size="large"
                    onClick={() => setForm({ ...form, type: 'habit' })}
                    sx={{ py: 2, justifyContent: 'flex-start', px: 2 }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box sx={{ fontSize: '1.5rem' }}>🎯</Box>
                      <Stack alignItems="flex-start">
                        <Typography variant="body1" fontWeight={600}>
                          习惯
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          需要持续养成的习惯
                        </Typography>
                      </Stack>
                    </Stack>
                  </Button>
                </Stack>
              </Box>
            )}
          </Stack>
        </LocalizationProvider>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>取消</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          startIcon={<Sparkles size={18} />}
          disabled={
            (missingFields.includes('type') && !form.type) ||
            (missingFields.includes('time') && !form.deadline)
          }
        >
          重新生成
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Alert 图标组件已移除，使用 lucide-react 的 Info 替代
