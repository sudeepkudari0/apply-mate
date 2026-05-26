import React, { useState, useEffect, useRef } from "react";
import { GROQ_MODELS } from "../models/providers/groq";
import { GEMINI_MODELS } from "../models/providers/gemini";

type Provider = "ollama" | "groq" | "gemini";

interface Config {
  provider: Provider;
  ollamaBaseUrl: string;
  ollamaModelId: string;
  groqApiKey: string;
  groqModelId: string;
  geminiApiKey: string;
  geminiModelId: string;
  masterResumeYaml: string;
  masterResumeText: string;
}

export function Options() {
  const [config, setConfig] = useState<Config>({
    provider: "groq",
    ollamaBaseUrl: "http://localhost:11434",
    ollamaModelId: "qwen3:4b",
    groqApiKey: "",
    groqModelId: "llama-3.3-70b-versatile",
    geminiApiKey: "",
    geminiModelId: "gemini-1.5-flash",
    masterResumeYaml: "",
    masterResumeText: "",
  });

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"provider" | "resume">("provider");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_CONFIG" });
      if (response.success) {
        setConfig(response.data);
      }
    } catch (err) {
      console.error("Failed to load config:", err);
    }
  }

  async function saveConfig() {
    try {
      await chrome.runtime.sendMessage({ type: "SAVE_CONFIG", data: config });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setConfig({ ...config, masterResumeYaml: content });
    };
    reader.readAsText(file);
  }

  const providerIcons = {
    groq: "⚡",
    ollama: "🦙",
    gemini: "✨",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">📝</div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            ApplyMate Settings
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Configure your LLM provider and master resume
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 p-1 bg-slate-800/50 rounded-xl border border-slate-700">
          <button
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeSection === "provider"
              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
              : "text-slate-400 hover:text-white"
              }`}
            onClick={() => setActiveSection("provider")}
          >
            <span>🤖</span> LLM Provider
          </button>
          <button
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeSection === "resume"
              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
              : "text-slate-400 hover:text-white"
              }`}
            onClick={() => setActiveSection("resume")}
          >
            <span>📄</span> Master Resume
          </button>
        </div>

        {/* Provider Section */}
        {activeSection === "provider" && (
          <div className="card bg-slate-800/50 border border-slate-700 shadow-lg">
            <div className="card-body">
              {/* Provider Selection */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {(["groq", "ollama", "gemini"] as Provider[]).map((p) => (
                  <button
                    key={p}
                    className={`p-4 rounded-xl border-2 transition-all ${config.provider === p
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-slate-600 hover:border-slate-500 bg-slate-900/30"
                      }`}
                    onClick={() => setConfig({ ...config, provider: p })}
                  >
                    <div className="text-2xl mb-2">{providerIcons[p]}</div>
                    <div className={`font-medium ${config.provider === p ? "text-blue-400" : "text-slate-300"}`}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {p === "groq" && "Fast & Free"}
                      {p === "ollama" && "Local LLM"}
                      {p === "gemini" && "Google AI"}
                    </div>
                  </button>
                ))}
              </div>

              {/* Provider-specific settings */}
              <div className="space-y-4">
                {config.provider === "ollama" && (
                  <>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text text-slate-300">Ollama Base URL</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered bg-slate-900/50 border-slate-600 text-white"
                        value={config.ollamaBaseUrl}
                        onChange={(e) => setConfig({ ...config, ollamaBaseUrl: e.target.value })}
                        placeholder="http://localhost:11434"
                      />
                    </div>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text text-slate-300">Model ID</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered bg-slate-900/50 border-slate-600 text-white"
                        value={config.ollamaModelId}
                        onChange={(e) => setConfig({ ...config, ollamaModelId: e.target.value })}
                        placeholder="qwen3:4b"
                      />
                      <label className="label">
                        <span className="label-text-alt text-slate-500">
                          Use exact model name from <code className="text-blue-400">ollama list</code>
                        </span>
                      </label>
                    </div>
                    <div className="alert bg-amber-900/30 border border-amber-500/30 text-amber-300 text-sm">
                      <span>⚠️ Ollama requires CORS to be configured for browser extensions</span>
                    </div>
                  </>
                )}

                {config.provider === "groq" && (
                  <>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text text-slate-300">Groq API Key</span>
                      </label>
                      <input
                        type="password"
                        className="input input-bordered bg-slate-900/50 border-slate-600 text-white"
                        value={config.groqApiKey}
                        onChange={(e) => setConfig({ ...config, groqApiKey: e.target.value })}
                        placeholder="gsk_..."
                      />
                      <label className="label">
                        <span className="label-text-alt text-slate-500">
                          Get your API key at{" "}
                          <a href="https://console.groq.com" target="_blank" className="text-blue-400 hover:underline">
                            console.groq.com
                          </a>
                        </span>
                      </label>
                    </div>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text text-slate-300">Model</span>
                      </label>
                      <select
                        className="select select-bordered bg-slate-900/50 border-slate-600 text-white"
                        value={config.groqModelId}
                        onChange={(e) => setConfig({ ...config, groqModelId: e.target.value })}
                      >
                        {Object.entries(GROQ_MODELS).map(([id, name]) => (
                          <option key={id} value={id}>{name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {config.provider === "gemini" && (
                  <>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text text-slate-300">Gemini API Key</span>
                      </label>
                      <input
                        type="password"
                        className="input input-bordered bg-slate-900/50 border-slate-600 text-white"
                        value={config.geminiApiKey}
                        onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value })}
                        placeholder="AI..."
                      />
                      <label className="label">
                        <span className="label-text-alt text-slate-500">
                          Get your API key at{" "}
                          <a href="https://aistudio.google.com/apikey" target="_blank" className="text-blue-400 hover:underline">
                            aistudio.google.com
                          </a>
                        </span>
                      </label>
                    </div>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text text-slate-300">Model</span>
                      </label>
                      <select
                        className="select select-bordered bg-slate-900/50 border-slate-600 text-white"
                        value={config.geminiModelId}
                        onChange={(e) => setConfig({ ...config, geminiModelId: e.target.value })}
                      >
                        {Object.entries(GEMINI_MODELS).map(([id, name]) => (
                          <option key={id} value={id}>{name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Resume Section */}
        {activeSection === "resume" && (
          <div className="card bg-slate-800/50 border border-slate-700 shadow-lg">
            <div className="card-body">
              <h2 className="text-lg font-semibold text-white mb-2">Master Resume</h2>
              <p className="text-sm text-slate-400 mb-4">
                <strong>YAML</strong> for PDF generation • <strong>Raw Text</strong> for AI rewriting
              </p>

              {/* YAML Section */}
              <div className="mb-6 p-4 rounded-lg bg-slate-900/30 border border-slate-700">
                <label className="label">
                  <span className="label-text text-slate-300 font-medium">📄 YAML Format (for PDF)</span>
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Structured data for PDF with links and formatting.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".yaml,.yml"
                  className="hidden"
                  onChange={handleFileUpload}
                />

                <div className="flex items-center gap-3 mb-3">
                  <button
                    className="btn btn-sm bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    📁 Upload YAML
                  </button>
                  {config.masterResumeYaml && (
                    <div className="badge bg-green-600/20 text-green-400 border-green-500/30 gap-1">
                      <span>✓</span> YAML loaded
                    </div>
                  )}
                </div>

                <textarea
                  className="textarea textarea-bordered w-full h-48 bg-slate-900/50 border-slate-600 text-slate-300 font-mono text-xs"
                  value={config.masterResumeYaml}
                  onChange={(e) => setConfig({ ...config, masterResumeYaml: e.target.value })}
                  placeholder="Paste or upload your YAML resume..."
                />
              </div>

              {/* Raw Text Section */}
              <div className="p-4 rounded-lg bg-slate-900/30 border border-slate-700">
                <label className="label">
                  <span className="label-text text-slate-300 font-medium">📝 Raw Text (for AI)</span>
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Full resume text for AI rewriting. Preserves all content.
                </p>

                {config.masterResumeText && (
                  <div className="mb-3">
                    <div className="badge bg-green-600/20 text-green-400 border-green-500/30 gap-1">
                      <span>✓</span> {config.masterResumeText.length} chars
                    </div>
                  </div>
                )}

                <textarea
                  className="textarea textarea-bordered w-full h-64 bg-slate-900/50 border-slate-600 text-slate-300 font-mono text-xs"
                  value={config.masterResumeText}
                  onChange={(e) => setConfig({ ...config, masterResumeText: e.target.value })}
                  placeholder="Paste your full resume text here (copy from PDF)..."
                />
              </div>

              {/* Sample Template */}
              <details className="mt-4 bg-slate-900/30 rounded-lg border border-slate-700">
                <summary className="cursor-pointer p-4 text-sm font-medium text-slate-300 hover:text-white">
                  📝 View Sample YAML Template
                </summary>
                <pre className="text-xs text-slate-400 p-4 overflow-auto border-t border-slate-700">
                  {`name: John Doe
email: john.doe@email.com
phone: "+1 555-123-4567"
portfolio: https://johndoe.dev

experience:
  - title: Senior Software Engineer
    company: Tech Corp
    dates: Feb 2022 - Present
    technologies: [TypeScript, React, Node.js]
    bullets:
      - Led development of microservices
    intern_bullets:
      - Contributed to internal tools

projects:
  - name: My Project
    url: https://myproject.com
    bullets:
      - Built a full-stack SaaS platform

education:
  - degree: B.S. Computer Science
    school: University
    year: "2019"
    gpa: "3.8"

skills: [JavaScript, TypeScript, React]`}
                </pre>
              </details>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex items-center justify-between">
          <div>
            {error && (
              <div className="text-red-400 text-sm">{error}</div>
            )}
            {saved && (
              <div className="text-green-400 text-sm flex items-center gap-1">
                <span>✓</span> Settings saved!
              </div>
            )}
          </div>
          <button
            className="btn bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0 hover:from-blue-500 hover:to-purple-500 px-8"
            onClick={saveConfig}
          >
            💾 Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
