<div align="center">
  <h1>ApplyMate</h1>
  <p><b>Your Intelligent Co-Pilot for Job Applications</b></p>
  <p>
    Auto-fill forms, tailor resumes on the fly, and generate human-sounding answers to application questions using LLMs.
  </p>
</div>

<br />

## 🚀 Features

- **🧠 Smart Auto-Fill**: Intelligently maps your profile to job application forms (LinkedIn, Indeed, Workday, Greenhouse, Lever, etc.) using multi-tier fuzzy matching.
- **📄 AI Resume Tailoring**: Re-writes your resume bullets to highlight experience relevant to the specific job description, then generates a perfectly formatted PDF.
- **🤖 Human-Sounding Answers**: Detects long-form questions (e.g., "Why do you want to work here?") and uses AI to generate short, natural-sounding answers that incorporate your background and the job description.
- **🔐 Privacy First**: Your profile data stays securely in your browser's local storage.
- **🔌 Multi-LLM Support**: Bring your own API key for Gemini, Groq, or use local models via Ollama.

## 📦 Installation

Since this is an unpacked Chrome Extension, follow these steps to install it:

1. Clone the repository:
   ```bash
   git clone https://github.com/sudeepkudari0/apply-mate.git
   cd applymate
   ```
2. Install dependencies and build the extension:
   ```bash
   bun install
   bun run build
   ```
3. Open Google Chrome and go to `chrome://extensions/`.
4. Enable **Developer mode** in the top right corner.
5. Click **Load unpacked** and select the `dist` folder inside the `applymate` directory.

## 🛠 Usage

1. **Onboarding**: Click the ApplyMate extension icon for the first time to complete your profile setup (Name, Experience, Education, Skills, and upload a base Resume PDF).
2. **Apply to Jobs**: Go to any job portal (e.g., LinkedIn Jobs or Workday).
3. **Auto-Fill**: Click the extension popup and hit **Auto-Fill Form**. The extension will highlight filled fields in green and ambiguous ones in yellow.
4. **Answer Questions**: Click **AI Answer Questions** to inject "✨ AI Answer" buttons next to any open-ended text areas.
5. **Tailor Resume**: Open the Side Panel to view the detected Job Description, generate a custom cover letter, or tailor your resume for the specific role.

## 💻 Tech Stack

- **React & TypeScript**: UI components for Side Panel, Options, Popup, and Onboarding.
- **Vite**: Fast, optimized bundling.
- **Tailwind CSS**: Styling.
- **jsPDF**: Document generation preserving layout and formatting.
- **LLM Integrations**:
  - `@google/genai` for Gemini
  - `openai` wrapper for Groq
  - `ollama/browser` for local models

## 🏗 Architecture

- **Service Worker (`background/`)**: Manages configurations, user profiles, and orchestrates AI calls.
- **Content Script (`content/`)**: Reads the DOM, detects fields, performs fuzzy matching, auto-fills inputs, and injects AI answer buttons.
- **Core Engine (`core/`)**: Handles resume parsing, merging LLM output with original layout, and PDF generation.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check the [issues page](https://github.com/yourusername/applymate/issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
