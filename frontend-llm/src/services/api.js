const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || `HTTP error! status: ${response.status}`
        );
      }

      return data;
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  // Health check
  async getHealth() {
    return this.request("/health");
  }

  // Run operations
  async createRun(runData) {
    return this.request("/runs", {
      method: "POST",
      body: JSON.stringify(runData),
    });
  }

  async listRuns(page = 1, limit = 10) {
    return this.request(`/runs?page=${page}&limit=${limit}`);
  }

  async getRun(runId) {
    return this.request(`/runs/${runId}`);
  }

  async getRunSummary(runId) {
    return this.request(`/runs/${runId}/summary`);
  }

  async getRunChat(runId) {
    return this.request(`/runs/${runId}/chat`);
  }
}

export default new ApiService();
