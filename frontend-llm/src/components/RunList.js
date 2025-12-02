import React from 'react';
import {
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  IconButton,
  Card,
  CardContent,
  Chip,
  Grid,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Clear as ClearIcon,
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon,
} from '@mui/icons-material';
import './RunList.css';

const RunList = ({
  runs,
  loading,
  error,
  onSelectRun,
  selectedRunId,
  pagination,
  onPageChange,
  onLimitChange,
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
}) => {
  const getStatusColor = (status) => {
    const colors = {
      pending: '#FF9800',
      running: '#2196F3',
      completed: '#4CAF50',
      partial: '#FFC107',
      failed: '#f44336',
    };
    return colors[status] || '#999';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
      <Typography variant="h5" component="h2" gutterBottom fontWeight={600}>
        Runs
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
        <Box sx={{ position: 'relative' }}>
          <TextField
            fullWidth
            placeholder="Search by notes, brands, models, or status..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            size="small"
            InputProps={{
              endAdornment: searchTerm && (
                <IconButton
                  size="small"
                  onClick={() => onSearchChange('')}
                  edge="end"
                >
                  <ClearIcon />
                </IconButton>
              ),
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Sort by</InputLabel>
            <Select
              value={sortBy}
              label="Sort by"
              onChange={(e) => onSortChange(e.target.value)}
            >
              <MenuItem value="date-desc">Date (Newest First)</MenuItem>
              <MenuItem value="date-asc">Date (Oldest First)</MenuItem>
              <MenuItem value="status">Status</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Show</InputLabel>
            <Select
              value={pagination.limit}
              label="Show"
              onChange={(e) => onLimitChange(Number(e.target.value))}
            >
              <MenuItem value={3}>3 per page</MenuItem>
              <MenuItem value={5}>5 per page</MenuItem>
              <MenuItem value={10}>10 per page</MenuItem>
              <MenuItem value={20}>20 per page</MenuItem>
              <MenuItem value={50}>50 per page</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      <Box sx={{ position: 'relative', minHeight: '350px' }}>
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              bgcolor: 'rgba(255, 255, 255, 0.8)',
              zIndex: 10,
            }}
          >
            <CircularProgress />
          </Box>
        )}
        {error ? (
          <Alert severity="error" sx={{ my: 2 }}>
            Error: {error}
          </Alert>
        ) : !runs || runs.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
            <Typography>
              {searchTerm
                ? 'No runs match your search. Try different keywords.'
                : 'No runs found. Create one to get started!'}
            </Typography>
          </Box>
        ) : (
          <>
            {searchTerm && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Showing {runs.length} result{runs.length !== 1 ? 's' : ''}{' '}
                {runs.length >= 50 && '(limited to 50 max)'}
              </Alert>
            )}
            <Box
              className="carousel-wrapper"
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
            >
              <IconButton
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                sx={{
                  border: 2,
                  borderColor: 'primary.main',
                  '&:disabled': { borderColor: 'grey.300' },
                }}
              >
                <NavigateBeforeIcon />
              </IconButton>

              <Box
                className="runs-carousel"
                sx={{
                  display: 'flex',
                  gap: 2,
                  overflowX: 'auto',
                  p: 1,
                  flex: 1,
                }}
              >
                {runs.map((run) => (
                  <Card
                    key={run._id}
                    onClick={() => onSelectRun(run._id)}
                    sx={{
                      minWidth: 350,
                      maxWidth: 350,
                      height: 280,
                      cursor: 'pointer',
                      border: 2,
                      borderColor:
                        selectedRunId === run._id ? 'primary.main' : 'grey.300',
                      bgcolor: selectedRunId === run._id ? '#e3f2fd' : 'white',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: 4,
                        transform: 'translateY(-2px)',
                      },
                    }}
                  >
                    <CardContent
                      sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        p: 2,
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mb: 1.5,
                        }}
                      >
                        <Chip
                          label={run.status}
                          size="small"
                          sx={{
                            bgcolor: getStatusColor(run.status),
                            color: 'white',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(run.createdAt)}
                        </Typography>
                      </Box>

                      <Typography
                        variant="body2"
                        fontWeight={500}
                        sx={{
                          mb: 1.5,
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {run.notes || 'No notes'}
                      </Typography>

                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Brands: {run.config.brands?.join(', ')}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                        >
                          Models: {run.config.models?.join(', ')}
                        </Typography>
                      </Box>

                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-around',
                          pt: 1.5,
                          borderTop: 1,
                          borderColor: 'divider',
                        }}
                      >
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography
                            variant="h6"
                            color="primary.main"
                            fontWeight={600}
                          >
                            {run.completedPrompts}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            textTransform="uppercase"
                          >
                            Completed
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography
                            variant="h6"
                            color="primary.main"
                            fontWeight={600}
                          >
                            {run.failedPrompts}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            textTransform="uppercase"
                          >
                            Failed
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography
                            variant="h6"
                            color="primary.main"
                            fontWeight={600}
                          >
                            {run.totalPrompts}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            textTransform="uppercase"
                          >
                            Total
                          </Typography>
                        </Box>
                      </Box>

                      {run.metrics && (
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 2,
                            pt: 1.5,
                            mt: 1.5,
                            borderTop: 1,
                            borderColor: 'divider',
                          }}
                        >
                          {run.metrics.avgLatencyMs && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Avg Latency: {run.metrics.avgLatencyMs}ms
                            </Typography>
                          )}
                          {run.metrics.estimatedCost && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Cost: ${run.metrics.estimatedCost.toFixed(4)}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Box>

              <IconButton
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={
                  pagination.page * pagination.limit >= pagination.total
                }
                sx={{
                  border: 2,
                  borderColor: 'primary.main',
                  '&:disabled': { borderColor: 'grey.300' },
                }}
              >
                <NavigateNextIcon />
              </IconButton>
            </Box>

            {pagination && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  textAlign: 'center',
                  py: 1.5,
                  px: 2,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  mt: 2,
                }}
              >
                Page {pagination.page} of{' '}
                {Math.ceil(pagination.total / pagination.limit)} •{' '}
                {pagination.total} total runs
              </Typography>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
};

export default RunList;
