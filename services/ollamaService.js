const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:latest';

function isOllamaEnabled() {
  return String(process.env.OLLAMA_ENABLED || 'true').toLowerCase() !== 'false';
}

async function generateWithOllama(prompt, options = {}) {
  const model = options.model || OLLAMA_MODEL;
  const timeoutMs = Number(options.timeoutMs || 60000);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 500
        }
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`OLLAMA_HTTP_${res.status}`);
    }

    const data = await res.json();
    return {
      ok: true,
      model,
      text: String(data.response || '').trim()
    };
  } catch (err) {
    return {
      ok: false,
      model,
      error: err.message || 'OLLAMA_ERROR'
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  isOllamaEnabled,
  generateWithOllama,
  OLLAMA_MODEL,
  OLLAMA_URL
};
