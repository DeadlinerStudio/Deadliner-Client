/**
 * ThinkingIndicator - AI 思考状态指示器
 * 显示 Agent 当前的思考状态
 */

import React from 'react';
import { Box, Typography, Stack, Chip, LinearProgress } from '@mui/material';
import { Brain, Loader2 } from 'lucide-react';

interface ThinkingIndicatorProps {
  agentName: string;
  phase: string;
  message: string;
  compact?: boolean;
}

const AGENT_COLORS: Record<string, 'primary' | 'secondary' | 'success' | 'warning'> = {
  Supervisor: 'primary',
  TaskAgent: 'secondary',
  HabitAgent: 'success',
  ChatAgent: 'warning',
};

const AGENT_ICONS: Record<string, string> = {
  Supervisor: '👁️',
  TaskAgent: '📋',
  HabitAgent: '🎯',
  ChatAgent: '💬',
};

const PHASE_LABELS: Record<string, string> = {
  routing: '意图分析',
  analyzing: '深度思考',
  executing: '执行中',
  synthesizing: '整合结果',
  waiting: '等待中',
};

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  agentName,
  phase,
  message,
  compact = false,
}) => {
  const color = AGENT_COLORS[agentName] || 'primary';
  const icon = AGENT_ICONS[agentName] || '🤖';
  const phaseLabel = PHASE_LABELS[phase] || phase;

  if (compact) {
    return (
      <Chip
        icon={<Brain size={14} />}
        label={`${agentName}: ${phaseLabel}`}
        color={color}
        size="small"
        variant="outlined"
      />
    );
  }

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: 'action.hover',
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            bgcolor: 'background.paper',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
          }}
        >
          {icon}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
            <Typography variant="subtitle2" fontWeight={600}>
              {agentName}
            </Typography>
            <Chip
              label={phaseLabel}
              size="small"
              color={color}
              variant="filled"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
        </Box>
        <Loader2
          size={20}
          style={{
            animation: 'spin 1s linear infinite',
          }}
        />
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

interface ThinkingChainProps {
  thinking: {
    agentName: string;
    phase: string;
    message: string;
    timestamp: string;
  }[];
}

export const ThinkingChain: React.FC<ThinkingChainProps> = ({ thinking }) => {
  if (thinking.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        AI 思考过程
      </Typography>
      <Stack spacing={1}>
        {thinking.map((item, index) => (
          <ThinkingIndicator
            key={index}
            agentName={item.agentName}
            phase={item.phase}
            message={item.message}
            compact
          />
        ))}
      </Stack>
    </Box>
  );
};

interface ThinkingProgressProps {
  currentPhase: 'routing' | 'analyzing' | 'executing' | 'synthesizing';
  progress: number; // 0-100
}

export const ThinkingProgress: React.FC<ThinkingProgressProps> = ({
  currentPhase,
  progress,
}) => {
  const phases: Array<{ key: string; label: string }> = [
    { key: 'routing', label: '意图路由' },
    { key: 'analyzing', label: '深度分析' },
    { key: 'executing', label: '工具执行' },
    { key: 'synthesizing', label: '结果整合' },
  ];

  const currentIndex = phases.findIndex((p) => p.key === currentPhase);

  return (
    <Box sx={{ mb: 2 }}>
      <Stack spacing={0.5}>
        {phases.map((phase, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;

          return (
            <Stack key={phase.key} direction="row" spacing={1} alignItems="center">
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  bgcolor: isCompleted
                    ? 'success.main'
                    : isActive
                    ? 'primary.main'
                    : 'grey.300',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  transition: 'all 0.3s ease',
                }}
              >
                {isCompleted ? '✓' : index + 1}
              </Box>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'primary.main' : isCompleted ? 'success.main' : 'text.secondary',
                }}
              >
                {phase.label}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{ mt: 2, height: 6, borderRadius: 3 }}
      />
    </Box>
  );
};
