import React, { useState, useEffect } from 'react';
import {
  Paper,
  Tabs,
  Tab,
  Box,
  Typography,
  Chip,
  Card,
  CardContent,
  Divider,
  CircularProgress,
  Alert,
  Grid,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Token as TokenIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';
import './RunDetails.css';

const RunDetails = ({ runId }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [summary, setSummary] = useState(null);
  const [chat, setChat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentRunId, setCurrentRunId] = useState(null);

  // Load data when runId or activeTab changes
  useEffect(() => {
    if (!runId) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        if (activeTab === 'summary') {
          const data = await api.getRunSummary(runId);
          setSummary(data);
          setCurrentRunId(runId);
        } else if (activeTab === 'chat') {
          const data = await api.getRunChat(runId);
          setChat(data);
          setCurrentRunId(runId);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [runId, activeTab]);

  const renderSummary = () => {
    if (!summary) return null;

    return (
      <div className="summary-content">
        <section className="brand-metrics">
          <h3>Brand Metrics</h3>
          {summary.brandMetrics.map((brand, index) => (
            <div key={index} className="brand-card">
              <div className="brand-header">
                <h4>{brand.brandName}</h4>
                <div className="brand-stats">
                  <span className="stat">
                    <strong>{brand.totalMentions}</strong> mentions
                  </span>
                  <span className="stat">
                    <strong>{(brand.mentionRate * 100).toFixed(1)}%</strong>{' '}
                    rate
                  </span>
                </div>
              </div>

              <div className="prompt-breakdown">
                <h5>By Prompt:</h5>
                {brand.byPrompt.map((prompt, pIndex) => (
                  <div key={pIndex} className="prompt-item">
                    <div className="prompt-text">{prompt.promptText}</div>
                    <div className="prompt-stats">
                      <span
                        className={`mention-badge ${
                          prompt.mentioned ? 'mentioned' : 'not-mentioned'
                        }`}
                      >
                        {prompt.mentioned ? '✓ Mentioned' : '✗ Not Mentioned'}
                      </span>
                      {prompt.mentioned && (
                        <span className="mention-count">
                          {prompt.mentionCount} times
                        </span>
                      )}
                      <span className="models">
                        Models: {prompt.models.join(', ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="prompt-metrics">
          <h3>Prompt Metrics</h3>
          {summary.promptMetrics.map((prompt, index) => (
            <div key={index} className="prompt-metric-card">
              <div className="prompt-metric-text">{prompt.promptText}</div>
              <div className="prompt-metric-stats">
                <span>
                  {prompt.successfulResponses}/{prompt.totalResponses}{' '}
                  successful
                </span>
                <span>
                  Brands mentioned: {prompt.brandsMetioned.join(', ')}
                </span>
              </div>
            </div>
          ))}
        </section>
      </div>
    );
  };

  const renderChat = () => {
    if (!chat) return null;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {chat.conversations.map((conversation, index) => (
          <Card key={index} variant="outlined" sx={{ bgcolor: 'grey.50' }}>
            <CardContent>
              <Box
                sx={{
                  mb: 3,
                  p: 2,
                  bgcolor: '#e3f2fd',
                  borderRadius: 1,
                  borderLeft: 4,
                  borderColor: 'primary.main',
                }}
              >
                <Typography variant="overline" color="primary" fontWeight={600}>
                  Prompt {index + 1}
                </Typography>
                <Typography variant="body1" sx={{ mt: 1 }}>
                  {conversation.prompt}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {conversation.responses.map((response, rIndex) => (
                  <Card key={rIndex} elevation={2}>
                    <CardContent>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mb: 2,
                        }}
                      >
                        <Box
                          sx={{ display: 'flex', gap: 1, alignItems: 'center' }}
                        >
                          <Chip
                            label={`${response.provider}: ${response.model}`}
                            color="primary"
                            variant="outlined"
                            size="small"
                          />
                          <Chip
                            label={response.status}
                            color={
                              response.status === 'success'
                                ? 'success'
                                : 'error'
                            }
                            size="small"
                          />
                        </Box>
                      </Box>

                      {response.status === 'success' ? (
                        <>
                          <Paper
                            variant="outlined"
                            sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}
                          >
                            <Typography
                              variant="subtitle2"
                              color="text.secondary"
                              gutterBottom
                            >
                              Full Response:
                            </Typography>
                            <Box className="response-text">
                              <ReactMarkdown>{response.text}</ReactMarkdown>
                            </Box>
                          </Paper>

                          <Divider sx={{ my: 2 }} />

                          <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid item xs={12} sm={4}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                }}
                              >
                                <AccessTimeIcon
                                  fontSize="small"
                                  color="action"
                                />
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  <strong>Latency:</strong> {response.latencyMs}
                                  ms
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                }}
                              >
                                <ScheduleIcon fontSize="small" color="action" />
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  <strong>Time:</strong>{' '}
                                  {new Date(
                                    response.timestamp,
                                  ).toLocaleString()}
                                </Typography>
                              </Box>
                            </Grid>
                            {response.tokenUsage && (
                              <Grid item xs={12} sm={4}>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                  }}
                                >
                                  <TokenIcon fontSize="small" color="action" />
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    <strong>Tokens:</strong>{' '}
                                    {response.tokenUsage.totalTokens}(
                                    {response.tokenUsage.promptTokens} +{' '}
                                    {response.tokenUsage.completionTokens})
                                  </Typography>
                                </Box>
                              </Grid>
                            )}
                          </Grid>

                          {response.brandMentions &&
                            response.brandMentions.length > 0 && (
                              <Box
                                sx={{
                                  mt: 2,
                                  p: 2,
                                  bgcolor: 'grey.50',
                                  borderRadius: 1,
                                }}
                              >
                                <Typography variant="subtitle2" gutterBottom>
                                  Brand Mentions:
                                </Typography>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 1,
                                    mt: 1,
                                  }}
                                >
                                  {response.brandMentions.map(
                                    (mention, mIndex) => (
                                      <Chip
                                        key={mIndex}
                                        label={
                                          mention.mentioned
                                            ? `${mention.brandName} (${mention.mentionCount}x)`
                                            : `${mention.brandName} - Not mentioned`
                                        }
                                        color={
                                          mention.mentioned
                                            ? 'success'
                                            : 'default'
                                        }
                                        variant={
                                          mention.mentioned
                                            ? 'filled'
                                            : 'outlined'
                                        }
                                        size="small"
                                      />
                                    ),
                                  )}
                                </Box>
                              </Box>
                            )}
                        </>
                      ) : (
                        <Alert severity="error">
                          Error: {response.errorMessage || 'Unknown error'}
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  };

  if (!runId) {
    return (
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Select a run to view details
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Tabs
        value={activeTab}
        onChange={(e, newValue) => setActiveTab(newValue)}
        sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}
      >
        <Tab label="Summary" value="summary" />
        <Tab label="Chat View" value="chat" />
      </Tabs>

      <Box sx={{ p: 3, position: 'relative', minHeight: '400px' }}>
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
        {error && (
          <Alert severity="error" sx={{ my: 2 }}>
            Error: {error}
          </Alert>
        )}
        {(summary || chat) && (
          <>
            {activeTab === 'summary' && renderSummary()}
            {activeTab === 'chat' && renderChat()}
          </>
        )}
      </Box>
    </Paper>
  );
};

export default RunDetails;
