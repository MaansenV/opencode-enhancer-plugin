// Validation Constants
const VALID_MODEL_PATTERNS = [
    /^opencode\//,
    /^anthropic\//,
    /^openai\//,
    /^google\//,
    /^mistral\//,
    /^cohere\//,
    /^ollama\//
];
const DEFAULT_MODEL = "opencode/kimi-k2.5-free";
// Model Validation Function
function validateModel(model, agentName, client) {
    if (!model || typeof model !== 'string') {
        client.app.log({
            service: "enhancer",
            level: "warn",
            message: `Invalid model for ${agentName}, using default`
        }).catch(() => { });
        return DEFAULT_MODEL;
    }
    const isValid = VALID_MODEL_PATTERNS.some(pattern => pattern.test(model));
    if (!isValid) {
        client.app.log({
            service: "enhancer",
            level: "warn",
            message: `Unknown model provider for ${agentName}: ${model}, using default`
        }).catch(() => { });
        return DEFAULT_MODEL;
    }
    return model;
}
// Model Resolver with Hierarchical Configuration
function resolveModel(agentName, agentType, existingConfig, client) {
    let model;
    // 1. Check existing OpenCode Config (highest priority)
    if (existingConfig?.model) {
        return validateModel(existingConfig.model, agentName, client);
    }
    // 2. Specific environment variable (e.g., ENHANCER_MODEL_REVIEW_PLAN)
    const specificVar = `ENHANCER_MODEL_${agentName.toUpperCase().replace(/-/g, '_')}`;
    model = process.env[specificVar];
    if (model) {
        client.app.log({
            service: "enhancer",
            level: "info",
            message: `Using specific env var ${specificVar} for ${agentName}`
        }).catch(() => { });
        return validateModel(model, agentName, client);
    }
    // 3. Grouped environment variable (ENHANCER_MODEL_SUBAGENT or ENHANCER_MODEL_PRIMARY)
    const groupVar = `ENHANCER_MODEL_${agentType.toUpperCase()}`;
    model = process.env[groupVar];
    if (model) {
        client.app.log({
            service: "enhancer",
            level: "info",
            message: `Using group env var ${groupVar} for ${agentName}`
        }).catch(() => { });
        return validateModel(model, agentName, client);
    }
    // 4. Default
    return DEFAULT_MODEL;
}
export const EnhancerPlugin = async ({ client }) => {
    client.app.log({
        service: "enhancer",
        level: "info",
        message: "Enhancer plugin initialized with model configuration support"
    }).catch(() => { });
    return {
        config: async (input) => {
            if (!input.agent) {
                input.agent = {};
            }
            // Helper function to configure agent with merging logic
            const configureAgent = (name, type, defaultConfig) => {
                const existing = input.agent[name] || {};
                const resolvedModel = resolveModel(name, type, existing, client);
                // Merge: Default → User Config → Resolved Model → Fixed Props
                input.agent[name] = {
                    ...defaultConfig,
                    ...existing,
                    model: resolvedModel,
                    mode: type === 'subagent' ? 'subagent' : 'primary',
                    ...(type === 'subagent' ? { hidden: true } : {})
                };
            };
            // Configure Subagents with merging
            // explore-context
            configureAgent('explore-context', 'subagent', {
                prompt: `Detect project identity and tech stack. Output: [PROJECT_IDENTITY] with Type, Entry Point, Main Directories.`,
                tools: {
                    list: true,
                    read: true,
                    grep: true,
                    bash: true
                }
            });
            // explore-code
            configureAgent('explore-code', 'subagent', {
                prompt: `Analyze source code files. Find relevant code for user request. Output: [CODE_ANALYSIS] with Relevant Files, Key Functions, Patterns.`,
                tools: {
                    list: true,
                    read: true,
                    grep: true,
                    bash: true
                }
            });
            // explore-deps
            configureAgent('explore-deps', 'subagent', {
                prompt: `Analyze dependencies and imports. Output: [DEPENDENCIES] with Core Libraries, Import Patterns, Context7 suggestions.`,
                tools: {
                    read: true,
                    grep: true,
                    bash: true
                }
            });
            // explore-tests
            configureAgent('explore-tests', 'subagent', {
                prompt: `Analyze test structure. Output: [TEST_FRAMEWORK] with Framework, Config, Test Patterns, Existing Tests.`,
                tools: {
                    list: true,
                    read: true,
                    grep: true,
                    bash: true
                }
            });
            // review-plan
            configureAgent('review-plan', 'subagent', {
                prompt: `You are a PLAN REVIEWER. Your job is to critically analyze implementation plans for completeness, correctness, and feasibility.

TASK: Review the provided plan and original context. Output a structured review report.

REVIEW CRITERIA:
1. Completeness: Does the plan cover all requirements? Are there missing steps?
2. Correctness: Are the technical approaches sound? Are file paths accurate?
3. Feasibility: Can this plan be executed successfully? Are there risks?
4. Edge Cases: Are error scenarios and edge cases handled?
5. Dependencies: Are all required dependencies identified and addressed?
6. Testing: Is there a clear validation/testing strategy?

OUTPUT FORMAT (Markdown):
# Plan Review Report

## Summary
- Status: [APPROVED / NEEDS_REVISION]
- Total Issues: [number]
- Critical Issues: [number]
- Warnings: [number]
- Suggestions: [number]

## Critical Issues (Must Fix)
1. **[SEVERITY: Critical]** [Issue description] - [File/Area affected]
   - Impact: [What could go wrong]
   - Recommendation: [Specific fix]

## Warnings (Should Fix)
1. **[SEVERITY: Warning]** [Issue description] - [File/Area affected]
   - Recommendation: [Specific improvement]

## Suggestions (Nice to Have)
1. **[SEVERITY: Suggestion]** [Issue description]
   - Recommendation: [Enhancement idea]

## Final Verdict
[One paragraph summary of plan quality and readiness]`,
                tools: {
                    read: true,
                    task: true
                }
            });
            // Configure Primary Agents
            // enhancer
            configureAgent('enhancer', 'primary', {
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
                prompt: `You are the CHIEF ARCHITECT (Enhancer). Generate enhanced, executable prompts by gathering context from parallel subagents.

WORKFLOW:
1. Classify intent: FIX/FEAT/REFACTOR/TEST/EXPLAIN
2. Call MULTIPLE task tools IN PARALLEL based on intent:
   - FIX/FEAT: explore-context + explore-code + explore-deps
   - REFACTOR: explore-context + explore-code + explore-tests  
   - TEST: explore-context + explore-code + explore-tests + explore-deps
   - EXPLAIN: explore-context + explore-code
3. Synthesize all results into unified understanding
4. Generate enhanced markdown prompt with specific paths and patterns

OUTPUT: Markdown code block with Task, Context, Instructions, Technical Constraints. End with "Copy the code block above and run it in Build mode to execute the plan."`
            });
            // ultraplan
            configureAgent('ultraplan', 'primary', {
                description: "Iterative Planning Agent with Multi-Review Loop",
                color: "#FF5722",
                steps: 20,
                tools: {
                    task: true,
                    read: true,
                    bash: false,
                    edit: false,
                    write: false
                },
                prompt: `You are the ULTRAPLAN ARCHITECT - an advanced planning agent that creates perfect implementation plans through iterative review loops.

=== STRICT WORKFLOW - FOLLOW EXACTLY ===

**STEP 1: ENHANCEMENT PHASE**
- Classify user intent (FIX/FEAT/REFACTOR/TEST/EXPLAIN)
- Call appropriate explore-* subagents IN PARALLEL based on intent:
  * FIX/FEAT: explore-context + explore-code + explore-deps
  * REFACTOR: explore-context + explore-code + explore-tests  
  * TEST: explore-context + explore-code + explore-tests + explore-deps
  * EXPLAIN: explore-context + explore-code
- WAIT for all subagents to return
- Synthesize results into enhanced technical context

**STEP 2: INITIAL PLAN CREATION**
- Use enhanced context to create comprehensive implementation plan
- Plan must include:
  * Specific file paths from analysis (NEVER invent paths)
  * Step-by-step implementation order
  * Error handling strategy
  * Validation/testing approach
- Store plan in memory

**STEP 3: REVIEW LOOP (Iterate up to 3 times max)**
FOR iteration = 1 TO 3:
  a. Call "review-plan" subagent via task tool:
     - Pass current plan and original context
     - Wait for review report
  
  b. Analyze review report:
     - If NO critical issues AND total issues < 3: BREAK loop (plan is perfect)
     - If critical issues exist AND iteration < 3: Continue to step c
     - If iteration == 3 AND issues remain: Log warning but proceed
  
  c. Revise plan based on review feedback:
     - Address all critical issues
     - Address high-priority warnings
     - Update plan with improvements
     - Store revised plan

**STEP 4: FINAL OUTPUT**
- Output the perfected plan as executable markdown prompt
- Include "Copy the code block above and run it in **Build** mode to execute the plan."
- Ensure all file paths are from actual analysis, never invented

IMPORTANT RULES:
- Maximum 3 review iterations to prevent infinite loops
- Always use task tool for subagent calls
- Never enable write/edit tools (analysis phase only)
- All file paths must come from actual code analysis`
            });
            // ask
            configureAgent('ask', 'primary', {
                description: "Context-Aware Question Answering Agent with Multi-Source Research",
                color: "#2196F3",
                steps: 15,
                tools: {
                    task: true,
                    read: true,
                    bash: false,
                    edit: false,
                    write: false
                },
                prompt: `You are the ASK AGENT - a context-aware research assistant that answers questions by orchestrating parallel sub-agent investigations and synthesizing their findings into comprehensive answers.

=== STRICT WORKFLOW - FOLLOW EXACTLY ===

**STEP 1: QUESTION CLASSIFICATION**
Analyze the user's question and classify into one of these types:
- CODE_QUESTION: "How does X work?", "Explain this function", "What does this code do?", "Where is Y implemented?"
- ARCHITECTURE_QUESTION: "How is this project structured?", "What patterns are used?", "What's the tech stack?"
- DEBUG_QUESTION: "Why is this not working?", "Fix this error", "Why does this fail?"
- GENERAL_INFO: "What is this project about?", "What does this repo do?"

**STEP 2: PARALLEL SUB-AGENT ORCHESTRATION (CRITICAL - MUST BE PARALLEL)**
Call MULTIPLE task tools IN PARALLEL based on question type:

| Question Type | Sub-Agents to Call |
|--------------|-------------------|
| CODE_QUESTION | explore-context + explore-code + explore-deps |
| ARCHITECTURE_QUESTION | explore-context + explore-code |
| DEBUG_QUESTION | explore-context + explore-code + explore-deps + explore-tests |
| GENERAL_INFO | explore-context |

**STEP 3: WAIT AND SYNTHESIZE**
- WAIT for ALL subagents to return (this is critical!)
- Read returned context carefully
- Synthesize information from all sources:
  * Combine findings from different sub-agents
  * Resolve any conflicts or gaps
  * Identify the most relevant files and patterns
  * Map relationships between components

**STEP 4: ANSWER GENERATION**
Generate a comprehensive answer with this exact structure:

\`\`\`markdown
## Answer

[Clear, direct answer to the question - 2-4 sentences maximum]

## Detailed Explanation

[In-depth explanation with technical details]

### Relevant Files
- \`path/to/file.ts\` - [Why this file matters]
- \`path/to/another.ts\` - [Why this file matters]

### Key Code Sections
\`\`\`typescript
// From: path/to/file.ts (lines X-Y)
[Most relevant code snippet]
\`\`\`

### Architecture Context
- **Tech Stack**: [What technologies are used]
- **Pattern**: [Design patterns identified]
- **Dependencies**: [Key dependencies involved]

## Related Areas to Explore
- [Suggestion 1 with specific file path]
- [Suggestion 2 with specific file path]
\`\`\`

**ERROR HANDLING RULES:**
- If a sub-agent fails or times out: Continue with available context and note the limitation
- If information is insufficient: Clearly state "Based on available context..." and explain what additional information would be needed
- If conflicting information exists: Present both perspectives and indicate the conflict
- Never invent file paths - only use paths returned by sub-agents

**IMPORTANT:**
- All file paths MUST come from actual sub-agent analysis
- Use read tool to verify critical code snippets
- Be concise but thorough - prioritize clarity over length
- Always cite your sources (which sub-agent provided what information)`
            });
            // Log configured agent models
            const configuredAgents = ['explore-context', 'explore-code', 'explore-deps', 'explore-tests', 'review-plan', 'enhancer', 'ultraplan', 'ask'];
            const modelSummary = configuredAgents
                .map(name => `${name}=${input.agent[name]?.model || 'default'}`)
                .join(', ');
            client.app.log({
                service: "enhancer",
                level: "info",
                message: `Registered agents: ${Object.keys(input.agent).join(", ")}`
            }).catch(() => { });
            client.app.log({
                service: "enhancer",
                level: "debug",
                message: `Agent models configured: ${modelSummary}`
            }).catch(() => { });
        },
        "tool.execute.before": async (input, output) => {
            if (input.tool === "task") {
                const args = output.args;
                const validSubagents = ["explore-context", "explore-code", "explore-deps", "explore-tests", "review-plan"];
                if (args?.subagent_type && validSubagents.includes(args.subagent_type)) {
                    client.app.log({
                        service: "enhancer",
                        level: "debug",
                        message: `Calling ${args.subagent_type} subagent`
                    }).catch(() => { });
                }
            }
        },
        "message.updated": async (input, output) => {
            const agentName = input.session?.agent?.name;
            if (agentName !== "enhancer" && agentName !== "ultraplan" && agentName !== "ask") {
                return;
            }
            const content = input.message?.content || "";
            if (content.includes("Build mode") || content.includes("Build Mode")) {
                return;
            }
            if (content.includes("```markdown") || content.includes("# Task:")) {
                const hint = "\n\n---\n**Next Step**: Copy this entire block and run it in **Build** mode to execute the plan.";
                if (output && typeof output === "object") {
                    output.content = content + hint;
                }
            }
        }
    };
};
export default EnhancerPlugin;
//# sourceMappingURL=index.js.map