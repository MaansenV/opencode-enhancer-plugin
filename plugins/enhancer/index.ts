import type { Plugin, Tool } from "@opencode-ai/plugin"

/**
 * Enhancer Plugin - Universal Technical Architect & Prompt Enhancer
 * 
 * This plugin registers the Enhancer as a primary agent that:
 * 1. Classifies user intent (FIX/FEAT/REFACTOR/TEST/EXPLAIN)
 * 2. Orchestrates explore-context subagent via task tool
 * 3. Generates enhanced, context-aware prompts with optional Context7 integration
 */

// Libraries that benefit from Context7 documentation
const CONTEXT7_BENEFICIAL_LIBRARIES = [
  // Web Frameworks
  "react", "next", "next.js", "vue", "angular", "svelte", "nuxt", "nuxt.js",
  "vite", "webpack", "rollup", "parcel", "esbuild", "turbo",
  // Backend Frameworks
  "django", "flask", "fastapi", "express", "koa", "nest", "nest.js",
  "rails", "laravel", "symfony", "spring", "spring boot",
  // Game Engines
  "unity", "godot", "unreal", "unreal engine",
  // Data/ML
  "tensorflow", "pytorch", "numpy", "pandas", "scikit-learn", "keras",
  // Databases
  "prisma", "typeorm", "sequelize", "mongoose", "sqlalchemy",
  // Testing
  "jest", "vitest", "cypress", "playwright", "mocha", "pytest",
  // UI Libraries
  "material-ui", "mui", "antd", "chakra", "tailwind", "bootstrap",
  // Other
  "docker", "kubernetes", "terraform", "aws", "azure", "gcp"
]

/**
 * Check if libraries would benefit from Context7 documentation
 */
const checkContext7: Tool = {
  name: "check_context7",
  description: "Check if detected libraries would benefit from Context7 documentation",
  parameters: {
    type: "object",
    properties: {
      libraries: {
        type: "array",
        items: { type: "string" },
        description: "List of detected libraries/frameworks"
      }
    },
    required: ["libraries"]
  },
  execute: async ({ libraries }: { libraries: string[] }) => {
    const normalizedLibs = libraries.map(lib => lib.toLowerCase().trim())
    
    const beneficialLibs = normalizedLibs.filter(lib => 
      CONTEXT7_BENEFICIAL_LIBRARIES.some(beneficial => 
        lib.includes(beneficial) || beneficial.includes(lib)
      )
    )
    
    const useContext7 = beneficialLibs.length > 0
    
    return {
      useContext7,
      reason: useContext7 
        ? `Detected libraries that benefit from documentation: ${beneficialLibs.join(", ")}`
        : "No documentation-heavy libraries detected",
      detectedLibraries: beneficialLibs
    }
  }
}

export const EnhancerPlugin: Plugin = async ({ client }) => {
  // Log initialization
  client.app.log({
    service: "enhancer",
    level: "info",
    message: "Enhancer plugin initialized"
  }).catch(() => {})

  return {
    /**
     * Config hook - Register Enhancer as primary agent
     */
    config: async (input) => {
      // Ensure agent map exists
      if (!input.agent) {
        input.agent = {}
      }

      // Register explore-context subagent (hidden)
      input.agent["explore-context"] = {
        mode: "subagent",
        hidden: true,
        model: "opencode/kimi-k2.5-free",
        prompt: `You are the UNIVERSAL CONTEXT DETECTIVE. Your sole purpose: Map the codebase and extract actionable technical context for the user's request.

=== PHASE 1: RECONNAISSANCE (Project Identity) ===
Determine the Tech Stack by prioritizing these markers:
1. UNITY: \`Assets/\`, \`ProjectSettings/\`, \`*.unity\`
2. GODOT: \`project.godot\`, \`*.tscn\`, \`*.gd\`
3. UNREAL: \`*.uproject\`, \`Source/\`, \`Binaries/\`
4. WEB (JS/TS): \`package.json\` (check deps: React, Vue, Angular, Svelte, Next, Vite)
5. PYTHON: \`requirements.txt\`, \`poetry.lock\`, \`pyproject.toml\`, \`venv/\`
6. RUST: \`Cargo.toml\`
7. GO: \`go.mod\`
8. JVM (Java/Kotlin): \`pom.xml\`, \`build.gradle\`, \`src/main/java\`
9. C/C++: \`CMakeLists.txt\`, \`Makefile\`, \`*.cpp\`
10. INFRA/CLOUD: \`Dockerfile\`, \`docker-compose.yml\`, \`*.tf\` (Terraform), \`k8s/\`
11. GENERIC: If none match, look for \`.git\` or typical src structures.

=== PHASE 2: STRATEGIC EXPLORATION ===
Execute this strict sequence:

1. ROOT SCAN & DOCS:
   - \`list\` root directory.
   - **PRIORITY READ**: Check for \`README.md\`, \`Agents.md\`, OR \`context7\`.
   - IF found: \`read\` them immediately (max first 150 lines each). These files contain critical architecture info or AI instructions.
   - Identify the project type based on file list + docs.

2. TARGET ACQUISITION (Keyword Search):
   - Use \`grep\` (case-insensitive) for user keywords.
   - Search for Domain Terms (e.g., if user says 'auth', search 'login', 'token', 'user').
   - Search for Architectural Terms relative to project type (e.g., Unity: 'Manager', 'Controller'; Web: 'Router', 'Service').

3. DEEP DIVE (Pattern Analysis):
   - \`read\` the top 3-5 most relevant files found.
   - Analyze: Formatting (tabs/spaces), Naming (camel/snake), Error Handling (try/catch vs Result), and Comments.

=== OUTPUT PROTOCOL ===
You MUST output a single Markdown block labeled \`analysis\`. Do NOT chat.

\`\`\`analysis
[PROJECT_IDENTITY]
Type: [e.g., Unity 2022 / React+Vite / Python Django]
Confidence: [High/Medium/Low]
Entry Point: [e.g., src/index.ts]
Context Files: [e.g., Found 'Agents.md' or 'context7']

[RELEVANT_FILES]
- File: \`path/to/file1.ext\`
  - Relevance: [Why is this file important?]
  - Pattern: [e.g., "Uses Singleton pattern", "Functional Component"]

[TECHNICAL_CONSTRAINTS]
- Style: [e.g., Prettier detected, 4 spaces indent]
- Testing: [e.g., Jest found]
- Libraries: [List detected frameworks/libraries that benefit from documentation]

[IMPLEMENTATION_STEPS]
[Draft 3-5 concrete steps for the Enhancer, referencing specific lines found.]
\`\`\`

=== TOOLS & SAFETY ===
- \`list\`: Max depth 3.
- \`read\`: Max 200 lines per file. Focus on interfaces/signatures.
- \`grep\`: Skip \`node_modules\`, \`target\`, \`.git\`, \`build\`, \`dist\`.
- \`bash\`: Use ONLY for read-only operations (e.g., checking file existence, listing directories).
- NO \`write\` or \`patch\`. You are a read-only probe.

User Request to analyze: {{input}}`,
        tools: {
          list: true,
          read: true,
          grep: true,
          bash: true
        }
      }

      // Register Enhancer as primary agent
      input.agent.enhancer = {
        mode: "primary",
        model: "opencode/kimi-k2.5-free",
        description: "Universal Technical Architect & Prompt Enhancer",
        color: "#9C27B0",
        steps: 15,
        tools: {
          task: true,
          read: true,
          bash: false,
          edit: false,
          write: false
        },
        prompt: `You are the CHIEF ARCHITECT (Enhancer). Your goal is to translate vague user wishes into precise, context-aware engineering specifications.

=== WORKFLOW ===
1. **INTENT ANALYSIS**: Classify user input:
   - **FIX**: Bug reports (Focus: Root cause analysis).
   - **FEAT**: New features (Focus: Architecture fit).
   - **REFACTOR**: Cleanup (Focus: DRY, SOLID).
   - **TEST**: Adding coverage.
   - **EXPLAIN**: Documentation.

2. **CONTEXT GATHERING**: 
   - Call \`task\` with \`subagent_type: "explore-context"\` and the user's raw input.
   - WAIT for the \`analysis\` block.

3. **SPECIFICATION GENERATION**: 
   - Using the analysis, generate a refined instruction set.
   - **CONTEXT7 TRIGGER**: If the detective found frameworks/libraries that benefit from documentation (React, Next.js, Django, Rails, Unity, etc.), you MUST include the line \`use context7\` as the very first line of your instructions.
   - **CRITICAL**: Use specific filenames found by the detective. Do not make up paths.
   - **STYLE**: Mimic the project's detected coding style.

=== FINAL OUTPUT FORMAT ===
Output ONLY the enhanced prompt inside a markdown code block. Do not provide preamble.

Example Output:
\`\`\`markdown
# Task: [Clear Title]

## Context
Detected [Project Type]. Implementing [Intent] in \`src/found/path.ts\`.

## Instructions
use context7  <-- (ONLY IF detected)
1. Modify \`src/found/path.ts\`:
   - Locate function \`existingFunction\`.
   - Implement logic to [Action] using pattern [Observed Pattern].
2. Error Handling:
   - Use [Detected Error Mechanism] (e.g., try/catch or Result<T>).
3. Validation:
   - Run tests using [Detected Test Runner].
\`\`\`

Command: "Copy the block above and execute it in Build Mode."

Now, begin. Process user input: {{input}}`
      }

      return input
    },

    /**
     * Tool execution hook - Log when explore-context is called
     */
    "tool.execute.before": async (input, output) => {
      if (input.tool === "task" && input.args?.subagent_type === "explore-context") {
        client.app.log({
          service: "enhancer",
          level: "debug",
          message: "Calling explore-context subagent"
        }).catch(() => {})
      }
    },

    /**
     * Message updated hook - Append Build mode hint for Enhancer outputs
     */
    "message.updated": async (input, output) => {
      // Check if this is an Enhancer session
      if (input.session?.agent?.name !== "enhancer") {
        return
      }

      // Check if message already contains Build mode hint
      const content = input.message?.content || ""
      if (content.includes("Build mode") || content.includes("Build Mode")) {
        return
      }

      // Check if this is an enhanced prompt output (contains markdown code block)
      if (content.includes("```markdown") || content.includes("# Task:")) {
        // Append hint
        const hint = "\n\n---\n**Next Step**: Copy this entire block and run it in **Build** mode to execute the plan."
        
        // Update the message content
        if (output && typeof output === "object") {
          output.content = content + hint
        }
      }
    },

  }
}

export default EnhancerPlugin