import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Container, Box } from '@mui/material';
import './App.css';
import Header from './components/Header';
import CreateRun from './components/CreateRun';
import RunList from './components/RunList';
import RunDetails from './components/RunDetails';
import api from './services/api';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2196f3',
    },
    secondary: {
      main: '#764ba2',
    },
    background: {
      default: '#f5f7fa',
    },
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
  },
});

function App() {
  const [runs, setRuns] = useState([]);
  const [filteredRuns, setFilteredRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 3,
    total: 0,
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date-desc'); // date-desc, date-asc, status
  const [filterLimit] = useState(50); // Maximum number of results to show after filtering

  const detailsRef = React.useRef(null);

  useEffect(() => {
    loadRuns();
  }, [pagination.page, pagination.limit]);

  // Apply search and sort filters with limit
  useEffect(() => {
    let result = [...runs];

    // Search filter
    if (searchTerm) {
      result = result.filter((run) => {
        const searchLower = searchTerm.toLowerCase();
        return (
          (run.notes && run.notes.toLowerCase().includes(searchLower)) ||
          (run.config.brands &&
            run.config.brands.some((brand) =>
              brand.toLowerCase().includes(searchLower),
            )) ||
          (run.config.models &&
            run.config.models.some((model) =>
              model.toLowerCase().includes(searchLower),
            )) ||
          run.status.toLowerCase().includes(searchLower)
        );
      });
    }

    // Sort
    switch (sortBy) {
      case 'date-desc':
        result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'date-asc':
        result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'status':
        const statusOrder = {
          running: 1,
          pending: 2,
          partial: 3,
          completed: 4,
          failed: 5,
        };
        result.sort(
          (a, b) =>
            (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99),
        );
        break;
      default:
        break;
    }

    // Limit results to prevent performance issues
    if (result.length > filterLimit) {
      result = result.slice(0, filterLimit);
    }

    setFilteredRuns(result);
  }, [runs, searchTerm, sortBy, filterLimit]);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.listRuns(pagination.page, pagination.limit);
      setRuns(data.data);

      setPagination((prev) => {
        if (prev.total !== data.total) {
          return {
            page: data.page,
            limit: data.limit,
            total: data.total,
          };
        }
        return prev;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit]);

  // Initial load and page change
  useEffect(() => {
    loadRuns();
  }, [pagination.page, pagination.limit]);

  // Separate effect for auto-refresh
  useEffect(() => {
    // Auto-refresh runs every 10 seconds
    const interval = setInterval(() => {
      // Call API directly to avoid dependency issues
      api
        .listRuns(pagination.page, pagination.limit)
        .then((data) => {
          setRuns(data.data);
          setPagination((prev) => {
            if (prev.total !== data.total) {
              return {
                page: data.page,
                limit: data.limit,
                total: data.total,
              };
            }
            return prev;
          });
        })
        .catch((err) => {
          console.error('Auto-refresh failed:', err);
        });
    }, 10000);
    return () => clearInterval(interval);
  }, [pagination.page, pagination.limit]);

  const handleCreateRun = async (runData) => {
    const result = await api.createRun(runData);
    setShowCreateForm(false);
    // Reset to page 1 - the effect will handle reloading automatically
    setPagination((prev) => ({ ...prev, page: 1 }));
    if (result.run) {
      setSelectedRunId(result.run._id);
    }
  };

  const handlePageChange = (newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleLimitChange = (newLimit) => {
    setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }));
  };

  const handleSelectRun = (runId) => {
    setSelectedRunId(runId);
    // Don't scroll automatically - let user maintain their current scroll position
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="App">
        <Header />

        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box className="top-panel">
              <div className="create-section">
                <button
                  className="toggle-form-button"
                  onClick={() => setShowCreateForm(!showCreateForm)}
                >
                  {showCreateForm ? '− Hide Create Form' : '+ Create New Run'}
                </button>
                {showCreateForm && <CreateRun onRunCreated={handleCreateRun} />}
              </div>

              <RunList
                runs={filteredRuns}
                loading={loading}
                error={error}
                onSelectRun={handleSelectRun}
                selectedRunId={selectedRunId}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                sortBy={sortBy}
                onSortChange={setSortBy}
              />
            </Box>

            <Box className="bottom-panel" ref={detailsRef}>
              <RunDetails runId={selectedRunId} />
            </Box>
          </Box>
        </Container>
      </div>
    </ThemeProvider>
  );
}

export default App;
