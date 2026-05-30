/// <reference types="vite/client" />

// Allow ?raw imports for YAML files
declare module "*.yaml?raw" {
  const content: string;
  export default content;
}
