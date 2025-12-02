import React, { useState } from "react";
import "./CreateRun.css";

const CreateRun = ({ onRunCreated }) => {
  const [formData, setFormData] = useState({
    prompts: "",
    brands: "",
    notes: "",
    models: [{ provider: "openai", model: "gpt-4o-mini" }],
    config: {
      concurrencyLimit: 5,
      retryAttempts: 3,
      timeout: 30000,
      enableCircuitBreaker: true,
    },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleConfigChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      config: {
        ...formData.config,
        [name]: type === "checkbox" ? checked : parseInt(value, 10),
      },
    });
  };

  const handleModelChange = (index, field, value) => {
    const newModels = [...formData.models];
    newModels[index][field] = value;
    setFormData({ ...formData, models: newModels });
  };

  const addModel = () => {
    setFormData({
      ...formData,
      models: [
        ...formData.models,
        { provider: "openai", model: "gpt-4o-mini" },
      ],
    });
  };

  const removeModel = (index) => {
    const newModels = formData.models.filter((_, i) => i !== index);
    setFormData({ ...formData, models: newModels });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        prompts: formData.prompts.split("\n").filter((p) => p.trim()),
        brands: formData.brands.split("\n").filter((b) => b.trim()),
        models: formData.models,
        notes: formData.notes,
        config: formData.config,
      };

      await onRunCreated(payload);

      // Reset form
      setFormData({
        prompts: "",
        brands: "",
        notes: "",
        models: [{ provider: "openai", model: "gpt-4o-mini" }],
        config: {
          concurrencyLimit: 5,
          retryAttempts: 3,
          timeout: 30000,
          enableCircuitBreaker: true,
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-run">
      <h2>Create New Run</h2>
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="prompts">Prompts (one per line)</label>
          <textarea
            id="prompts"
            name="prompts"
            value={formData.prompts}
            onChange={handleInputChange}
            placeholder="What are the best payment processors?&#10;Which payment gateway has the lowest fees?"
            rows="4"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="brands">Brands to Track (one per line)</label>
          <textarea
            id="brands"
            name="brands"
            value={formData.brands}
            onChange={handleInputChange}
            placeholder="Stripe&#10;PayPal&#10;Square"
            rows="4"
            required
          />
        </div>

        <div className="form-group">
          <label>Models</label>
          {formData.models.map((model, index) => (
            <div key={index} className="model-input">
              <select
                value={model.provider}
                onChange={(e) =>
                  handleModelChange(index, "provider", e.target.value)
                }
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>

              <select
                value={model.model}
                onChange={(e) =>
                  handleModelChange(index, "model", e.target.value)
                }
              >
                {model.provider === "openai" ? (
                  <>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </>
                ) : (
                  <>
                    <option value="claude-3-5-sonnet-20241022">
                      Claude 3.5 Sonnet
                    </option>
                    <option value="claude-3-5-haiku-20241022">
                      Claude 3.5 Haiku
                    </option>
                  </>
                )}
              </select>

              {formData.models.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeModel(index)}
                  className="btn-remove"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addModel} className="btn-add">
            Add Model
          </button>
        </div>

        <div className="form-group">
          <label htmlFor="notes">Notes (optional)</label>
          <input
            type="text"
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            placeholder="Test run for payment processors"
          />
        </div>

        <div className="config-group">
          <h3>Configuration</h3>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="concurrencyLimit">Concurrency Limit</label>
              <input
                type="number"
                id="concurrencyLimit"
                name="concurrencyLimit"
                value={formData.config.concurrencyLimit}
                onChange={handleConfigChange}
                min="1"
                max="50"
              />
            </div>

            <div className="form-group">
              <label htmlFor="retryAttempts">Retry Attempts</label>
              <input
                type="number"
                id="retryAttempts"
                name="retryAttempts"
                value={formData.config.retryAttempts}
                onChange={handleConfigChange}
                min="0"
                max="10"
              />
            </div>

            <div className="form-group">
              <label htmlFor="timeout">Timeout (ms)</label>
              <input
                type="number"
                id="timeout"
                name="timeout"
                value={formData.config.timeout}
                onChange={handleConfigChange}
                min="1000"
                max="120000"
                step="1000"
              />
            </div>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="enableCircuitBreaker"
                checked={formData.config.enableCircuitBreaker}
                onChange={handleConfigChange}
              />
              Enable Circuit Breaker
            </label>
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Creating Run..." : "Create Run"}
        </button>
      </form>
    </div>
  );
};

export default CreateRun;
