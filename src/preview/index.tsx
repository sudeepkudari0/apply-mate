/**
 * Preview entry point — standalone page to test ResumeDocument rendering.
 * Run: npx vite --open /preview.html
 *
 * Loads master-resume.yaml dynamically so the preview always reflects
 * the latest YAML content without maintaining duplicate mock data.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import yaml from "js-yaml";
import { ResumePreview } from "../core/resumePreview";
import type { MasterResume } from "../core/types";

// Vite's ?raw suffix imports the file as a plain string at build time.
// Changes to the YAML will trigger HMR automatically.
import resumeYaml from "../../master-resume.yaml?raw";

const resume = yaml.load(resumeYaml) as MasterResume;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ResumePreview resume={resume} filename="Sudeep_Kudari_CV.pdf" />
  </React.StrictMode>
);
