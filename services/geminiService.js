const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function isGeminiEnabled() {
  return String(process.env.GEMINI_ENABLED || "true").toLowerCase() !== "false";
}

async function generateWithGemini(prompt, options = {}) {
  const apiKey = options.apiKey || GEMINI_API_KEY;
  const model = options.model || GEMINI_MODEL;
  const timeoutMs = Number(options.timeoutMs || 60000);

  if (!apiKey) {
    return {
      ok: false,
      model,
      error: "GEMINI_MISSING_API_KEY"
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Strip leading "models/" prefix if present, then build URL
    const modelId = model.replace(/^models\//, "");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: String(prompt || "") }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`GEMINI_HTTP_${res.status}`);
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .join("\n")
      .trim();

    return {
      ok: Boolean(text),
      model,
      text,
      raw: data
    };
  } catch (err) {
    return {
      ok: false,
      model,
      error: err.message || "GEMINI_ERROR"
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  GEMINI_MODEL,
  isGeminiEnabled,
  generateWithGemini
};
