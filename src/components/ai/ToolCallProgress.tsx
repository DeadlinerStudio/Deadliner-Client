/**
 * ToolCallProgress - 工具调用进度
 * 显示工具执行状态
 */

import React from 'react';
import { Box, Typography, Stack, Chip, Paper, IconButton, Collapse } from '@mui/material';
import { Check, AlertCircle, Loader2, ChevronDown, ChevronUp, Settings } from 'lucide-react';

interface ToolCall {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  reason?: string;
  executionMode: 'AUTO' | 'ASK_USER';
}

interface ToolResult {
  id: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

interface ToolCallProgressProps {
  toolCalls: ToolCall[];
  results: Map<string, ToolResult>;
  onConfirm?: (toolCallId: string, args: Record<string, unknown>) => void;
  onCancel?: (toolCallId: string) => void;
}

export const ToolCallProgress: React.FC<ToolCallProgressProps> = ({
  toolCalls,
  results,
  onConfirm,
  onCancel,
}) => {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  if (toolCalls.length === 0) {
    return null;
  }

  const getToolIcon = (toolName: string): string => {
    switch (toolName) {
      case 'read_tasks':
        return '📋';
      case 'create_task':
        return '➕';
      case 'update_deadline':
        return '📅';
      case 'read_habits':
        return '🎯';
      case 'create_habit':
        return '🌱';
      default:
        return '🔧';
    }
  };

  const getToolLabel = (toolName: string): string => {
    switch (toolName) {
      case 'read_tasks':
        return '读取任务';
      case 'create_task':
        return '创建任务';
      case 'update_deadline':
        return '更新截止时间';
      case 'read_habits':
        return '读取习惯';
      case 'create_habit':
        return '创建习惯';
      default:
        return toolName;
    }
  };

  const getStatus = (id: string): 'pending' | 'executing' | 'completed' | 'error' | 'requires_confirm' => {
    const result = results.get(id);
    const toolCall = toolCalls.find((tc) => tc.id === id);

    if (result) {
      return result.success ? 'completed' : 'error';
    }
    if (toolCall?.executionMode === 'ASK_USER') {
      return 'requires_confirm';
    }
    return 'pending';
  };

  const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
    switch (status) {
      case 'completed':
        return (
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              bgcolor: 'success.main',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={14} />
          </Box>
        );
      case 'error':
        return (
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              bgcolor: 'error.main',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertCircle size={14} />
          </Box>
        );
      case 'executing':
        return (
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          </Box>
        );
      case 'requires_confirm':
        return (
          <Chip
            icon={<AlertCircle size={14} />}
            label="待确认"
            size="small"
            color="warning"
          />
        );
      default:
        return (
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              bgcolor: 'grey.300',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
            }}
          >
            ?
          </Box>
        );
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Settings size={16} />
        工具调用进度
      </Typography>

      <Stack spacing={1}>
        {toolCalls.map((toolCall) => {
          const status = getStatus(toolCall.id);
          const result = results.get(toolCall.id);
          const isExpanded = expandedId === toolCall.id;

          return (
            <Paper
              key={toolCall.id}
              variant="outlined"
              sx={{
                overflow: 'hidden',
                transition: 'all 0.2s ease',
                borderColor: status === 'error' ? 'error.main' : 'divider',
              }}
            >
              <Box
                sx={{
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
                onClick={() => setExpandedId(isExpanded ? null : toolCall.id)}
              >
                <StatusIcon status={status} />

                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" fontWeight={500}>
                      {getToolIcon(toolCall.tool)} {getToolLabel(toolCall.tool)}
                    </Typography>
                  </Stack>
                  {toolCall.reason && (
                    <Typography variant="caption" color="text.secondary">
                      {toolCall.reason}
                    </Typography>
                  )}
                </Box>

                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </Box>

              <Collapse in={isExpanded}>
                <Box
                  sx={{
                    px: 2,
                    py: 1.5,
                    bgcolor: 'grey.50',
                    borderTop: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    参数:
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      fontSize: '0.75rem',
                      bgcolor: 'background.paper',
                      p: 1,
                      borderRadius: 1,
                      overflow: 'auto',
                      maxHeight: 200,
                      m: 0,
                    }}
                  >
                    {JSON.stringify(toolCall.args, null, 2)}
                  </Box>

                  {result && (
                    <>
                      <Typography variant="caption" color="text.secondary" display="block" mt={1} mb={1}>
                        结果:
                      </Typography>
                      <Box
                        component="pre"
                        sx={{
                          fontSize: '0.75rem',
                          bgcolor: result.success ? 'success.50' : 'error.50',
                          p: 1,
                          borderRadius: 1,
                          overflow: 'auto',
                          maxHeight: 200,
                          m: 0,
                          color: result.success ? 'success.main' : 'error.main',
                        }}
                      >
                        {result.success
                          ? JSON.stringify(result.result, null, 2)
                          : result.error}
                      </Box>
                    </>
                  )}

                  {status === 'requires_confirm' && onConfirm && (
                    <Stack direction="row" spacing={1} mt={2}>
                      <Chip
                        label="确认执行"
                        color="primary"
                        onClick={() => onConfirm(toolCall.id, toolCall.args)}
                        sx={{ cursor: 'pointer' }}
                      />
                      {onCancel && (
                        <Chip
                          label="取消"
                          variant="outlined"
                          onClick={() => onCancel(toolCall.id)}
                          sx={{ cursor: 'pointer' }}
                        />
                      )}
                    </Stack>
                  )}
                </Box>
              </Collapse>
            </Paper>
          );
        })}
      </Stack>

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </Box>
  );
};

interface ToolCallSummaryProps {
  completedCount: number;
  totalCount: number;
  hasErrors: boolean;
}

export const ToolCallSummary: React.FC<ToolCallSummaryProps> = ({
  completedCount,
  totalCount,
  hasErrors,
}) => {
  return (
    <Stack direction="row" spacing={2} alignItems="center">
      <Chip
        icon={<Check size={14} />}
        label={`已完成 ${completedCount}/${totalCount}`}
        size="small"
        color={hasErrors ? 'warning' : 'success'}
      />
      {hasErrors && (
        <Chip
          icon={<AlertCircle size={14} />}
          label="部分失败"
          size="small"
          color="error"
        />
      )}
    </Stack>
  );
};
