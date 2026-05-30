import { useState, useEffect } from "react";
import yaml from "js-yaml";
import { createProvider } from "../models/providers/factory";
import { ProviderConfig } from "../models/providers/types";
import { ResumeEditor } from "../core/resumeEditor";
import { CoverLetterGenerator } from "../core/coverLetter";
import { generateResumePDF, buildFilename } from "../core/pdfGenerator";
import { MasterResume, JDAnalysis } from "../core/types";
import { JobSearchPanel } from "../features/jobSearch";
import { CompanyManager } from "../features/companies";
import { MatchScoreCard, calculateMatch, type MatchResult } from "../features/matching";
import { loadUserProfile, profileToFillData } from "../core/userProfile";

type MainTab = "tailor" | "search" | "companies";
type ResultTab = "resume" | "cover-letter";

export function SidePanel() {
  // Main navigation
  const [mainTab, setMainTab] = useState<MainTab>("tailor");

  // Form state
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");

  // Results
  const [resume, setResume] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [jdAnalysis, setJdAnalysis] = useState<JDAnalysis | null>(null);
  const [masterResume, setMasterResume] = useState<MasterResume | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  // UI state
  const [resultTab, setResultTab] = useState<ResultTab>("resume");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // Detection state
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<"idle" | "success" | "error">("idle");
  const [fillStatus, setFillStatus] = useState<string | null>(null);

  useEffect(() => {
    checkConfiguration();
  }, []);

  async function checkConfiguration() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "IS_CONFIGURED" });
      setIsConfigured(response.data);
    } catch (err) {
      console.error("Failed to check configuration:", err);
    }
  }

  // Auto detect JD from current page
  async function detectFromPage() {
    setIsDetecting(true);
    setError(null);
    setDetectionStatus("idle");
    setMatchResult(null);

    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) throw new Error("No active tab");

      // Try to inject content script first (in case it's not loaded)
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["contentScript.js"],
        });
      } catch {
        // Script might already be injected, continue
      }

      // Small delay to ensure script is ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, { type: "DETECT_JD" });

      if (response.success && response.data.jd) {
        setJobDescription(response.data.jd);
        setJobTitle(response.data.jobTitle || "");
        setCompany(response.data.company || "");
        setDetectionStatus("success");

        // Calculate match score if we have master resume
        if (masterResume) {
          const match = calculateMatch(masterResume, response.data.jd);
          setMatchResult(match);
        } else {
          // Try to load master resume for matching
          try {
            const configResponse = await chrome.runtime.sendMessage({ type: "GET_CONFIG" });
            if (configResponse.success && configResponse.data.masterResumeYaml) {
              const parsed = yaml.load(configResponse.data.masterResumeYaml) as MasterResume;
              setMasterResume(parsed);
              const match = calculateMatch(parsed, response.data.jd);
              setMatchResult(match);
            }
          } catch {
            // Ignore matching for now
          }
        }
      } else {
        throw new Error("Could not detect job description on this page");
      }
    } catch (err: any) {
      setDetectionStatus("error");
      if (err.message?.includes("Receiving end does not exist")) {
        setError("Cannot access this page. Try a job posting page.");
      } else {
        setError(err.message || "Failed to detect job description");
      }
    } finally {
      setIsDetecting(false);
    }
  }

  // Fill form on the page using full user profile
  async function fillPageForm() {
    setFillStatus("Filling form...");

    try {
      // Load full user profile
      const profile = await loadUserProfile();
      const fillData = profileToFillData(profile);

      // Add cover letter if generated
      if (coverLetter) {
        fillData.coverLetter = coverLetter;
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) throw new Error("No active tab");

      // Ensure content script is injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["contentScript.js"],
        });
      } catch {
        // Script might already be injected
      }
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "FILL_FORM",
        data: fillData,
      });

      if (response.success) {
        const { filled, ambiguous } = response.data;
        setFillStatus(`✓ ${filled} fields filled${ambiguous ? `, ${ambiguous} needs review` : ''}`);
        setTimeout(() => setFillStatus(null), 5000);
      } else {
        throw new Error(response.error || "Failed to fill form");
      }
    } catch (err: any) {
      setFillStatus(null);
      setError(err.message || "Failed to fill form");
    }
  }

  async function handleGenerate() {
    if (!jobDescription.trim() || !jobTitle.trim() || !company.trim()) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResume("");
    setCoverLetter("");

    try {
      setLoadingStatus("Loading configuration...");
      const configResponse = await chrome.runtime.sendMessage({ type: "GET_PROVIDER_CONFIG" });
      if (!configResponse.success) {
        throw new Error(configResponse.error);
      }
      const providerConfig: ProviderConfig = configResponse.data;

      const fullConfigResponse = await chrome.runtime.sendMessage({ type: "GET_CONFIG" });
      if (!fullConfigResponse.success) {
        throw new Error(fullConfigResponse.error);
      }

      const masterResumeYaml = fullConfigResponse.data.masterResumeYaml;
      const masterResumeText = fullConfigResponse.data.masterResumeText;
      if (!masterResumeYaml) {
        throw new Error("Please upload your master resume YAML in Settings first");
      }

      const parsedResume = yaml.load(masterResumeYaml) as MasterResume;
      setMasterResume(parsedResume);

      // Calculate match score
      const match = calculateMatch(parsedResume, jobDescription);
      setMatchResult(match);

      setLoadingStatus("Connecting to LLM...");
      const provider = await createProvider(providerConfig);
      const resumeEditor = new ResumeEditor(provider);
      const coverLetterGen = new CoverLetterGenerator(provider);

      setLoadingStatus("Analyzing job description...");
      // Use raw text for LLM if available, otherwise use converted YAML
      const { resume: optimizedResume, jdAnalysis: analysis } = await resumeEditor.optimize(
        parsedResume,
        jobDescription,
        jobTitle,
        company,
        masterResumeText || undefined
      );
      setResume(optimizedResume);
      setJdAnalysis(analysis);

      setLoadingStatus("Writing cover letter...");
      const letter = await coverLetterGen.generate(company, jobTitle, jobDescription, optimizedResume);
      setCoverLetter(letter);
      setLoadingStatus("");
    } catch (err: any) {
      setError(err.message || "Generation failed");
      setLoadingStatus("");
    } finally {
      setIsLoading(false);
    }
  }

  function handleCopy(text: string, type: string) {
    navigator.clipboard.writeText(text);
    setCopySuccess(type);
    setTimeout(() => setCopySuccess(null), 2000);
  }

  function handleDownload(text: string, filename: string) {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadPDF() {
    if (!resume) return;

    try {
      const name = masterResume?.name || 'Resume';
      const filename = buildFilename(name);
      await generateResumePDF(resume, filename, masterResume || undefined);
    } catch (err: any) {
      setError(`PDF generation failed: ${err.message}`);
    }
  }

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📝</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Welcome to ApplyMate</h2>
            <p className="text-gray-600 text-sm mt-2">
              Configure your LLM provider and upload your master resume to get started.
            </p>
            <button
              className="mt-4 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              onClick={() => chrome.runtime.openOptionsPage()}
            >
              ⚙️ Open Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">CV</span>
            </div>
            <h1 className="text-lg font-semibold text-gray-900">ApplyMate</h1>
          </div>
          <button
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => chrome.runtime.openOptionsPage()}
          >
            ⚙️
          </button>
        </div>

        {/* Main Navigation Tabs */}
        <div className="flex gap-1 mt-3 p-1 bg-gray-100 rounded-lg">
          <button
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${mainTab === "tailor"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
              }`}
            onClick={() => setMainTab("tailor")}
          >
            ✨ Tailor
          </button>
          <button
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${mainTab === "search"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
              }`}
            onClick={() => setMainTab("search")}
          >
            🔍 Search
          </button>
          <button
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${mainTab === "companies"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
              }`}
            onClick={() => setMainTab("companies")}
          >
            🏢 Companies
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Search Tab */}
        {mainTab === "search" && <JobSearchPanel />}

        {/* Companies Tab */}
        {mainTab === "companies" && <CompanyManager />}

        {/* Tailor Tab */}
        {mainTab === "tailor" && (
          <div className="space-y-4">
            {/* Detect from Page Section */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center gap-2">
                  {detectionStatus === "success" && (
                    <>
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span className="text-sm text-gray-600">Job detected from page</span>
                    </>
                  )}
                  {detectionStatus === "error" && (
                    <>
                      <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                      <span className="text-sm text-gray-600">Detection failed</span>
                    </>
                  )}
                  {detectionStatus === "idle" && (
                    <span className="text-sm text-gray-500">Detect job details from current page</span>
                  )}
                </div>
                <button
                  className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-50"
                  onClick={detectFromPage}
                  disabled={isDetecting}
                >
                  {isDetecting ? "Detecting..." : "🔍 Detect"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <input
                  type="text"
                  placeholder="Job Title"
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Company"
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>

              <textarea
                placeholder="Paste job description here..."
                className="w-full h-32 px-3 py-2 mt-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={jobDescription}
                onChange={(e) => {
                  setJobDescription(e.target.value);
                  setMatchResult(null); // Reset match when JD changes
                }}
              />

              <button
                className={`w-full mt-3 py-2.5 px-4 rounded-lg font-medium transition-colors ${isLoading
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                onClick={handleGenerate}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {loadingStatus || "Generating..."}
                  </span>
                ) : (
                  "Generate Resume & Cover Letter"
                )}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <span className="text-red-500">⚠️</span>
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            {/* Match Score Card */}
            {matchResult && !resume && (
              <MatchScoreCard
                matchResult={matchResult}
                onApply={handleGenerate}
              />
            )}

            {/* Results */}
            {(resume || coverLetter) && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                <div className="p-4">
                  {/* Tabs */}
                  <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                    <button
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${resultTab === "resume"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                        }`}
                      onClick={() => setResultTab("resume")}
                    >
                      📄 Resume
                    </button>
                    <button
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${resultTab === "cover-letter"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                        }`}
                      onClick={() => setResultTab("cover-letter")}
                    >
                      ✉️ Cover Letter
                    </button>
                  </div>

                  {/* Content */}
                  <div className="mt-4">
                    {resultTab === "resume" && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${copySuccess === "resume"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            onClick={() => handleCopy(resume, "resume")}
                          >
                            {copySuccess === "resume" ? "✓ Copied!" : "📋 Copy"}
                          </button>
                          <button
                            className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
                            onClick={() => handleDownload(resume, `Resume_${company}_${jobTitle}.txt`)}
                          >
                            📝 TXT
                          </button>
                          <button
                            className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors"
                            onClick={handleDownloadPDF}
                          >
                            📑 PDF
                          </button>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-auto border border-gray-200">
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                            {resume}
                          </pre>
                        </div>
                      </div>
                    )}

                    {resultTab === "cover-letter" && (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <button
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${copySuccess === "letter"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            onClick={() => handleCopy(coverLetter, "letter")}
                          >
                            {copySuccess === "letter" ? "✓ Copied!" : "📋 Copy"}
                          </button>
                          <button
                            className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
                            onClick={() =>
                              handleDownload(coverLetter, `CoverLetter_${company}_${jobTitle}.txt`)
                            }
                          >
                            ⬇️ Download
                          </button>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {coverLetter}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Auto-fill button */}
                  <button
                    className="w-full mt-4 py-2.5 px-4 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={fillPageForm}
                    disabled={!resume}
                  >
                    {fillStatus || "🚀 Auto-fill Application Form"}
                  </button>
                </div>
              </div>
            )}

            {/* Match Score after generation */}
            {matchResult && resume && (
              <MatchScoreCard matchResult={matchResult} />
            )}

            {/* JD Analysis */}
            {jdAnalysis && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                <details className="p-4">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 flex items-center gap-2">
                    <span>📊</span>
                    <span>JD Analysis</span>
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                      {jdAnalysis.hard_skills.length + jdAnalysis.tools_technologies.length} keywords
                    </span>
                  </summary>
                  <div className="mt-3 space-y-2 text-xs">
                    <div>
                      <span className="font-medium text-gray-900">Hard Skills: </span>
                      <span className="text-gray-600">
                        {jdAnalysis.hard_skills.join(", ") || "None detected"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Tools & Tech: </span>
                      <span className="text-gray-600">
                        {jdAnalysis.tools_technologies.join(", ") || "None detected"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Must Have: </span>
                      <span className="text-gray-600">
                        {jdAnalysis.keyword_priorities.must_have.join(", ") || "None detected"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Nice to Have: </span>
                      <span className="text-gray-600">
                        {jdAnalysis.keyword_priorities.nice_to_have.join(", ") || "None detected"}
                      </span>
                    </div>
                    {jdAnalysis.action_verbs?.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-900">Action Verbs: </span>
                        <span className="text-gray-600">
                          {jdAnalysis.action_verbs.join(", ")}
                        </span>
                      </div>
                    )}
                    {jdAnalysis.key_phrases_verbatim?.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-900">Key ATS Phrases: </span>
                        <span className="text-gray-600">
                          {jdAnalysis.key_phrases_verbatim.join(" | ")}
                        </span>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
