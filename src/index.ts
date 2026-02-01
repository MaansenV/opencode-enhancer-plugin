import type { Plugin } from "@opencode-ai/plugin"
import { TodoParser } from "./utils/todoParser.js";
import { todoStore } from "./utils/sessionStore.js";

// Configuration Types
interface AgentModelConfig {
  subagent?: string;
  primary?: string;
  perAgent?: Record<string, string>;
}

interface EnhancerPluginConfig {
  models?: AgentModelConfig;
}

// === TODO ENFORCER CONSTANTS ===
const TODO_ENFORCER_AGENTS = ['ultraplan', 'strategos'];
const TODO_MARKER_START = '<!-- TODOS-START -->';
const TODO_MARKER_END = '<!-- TODOS-END -->';

// === STRATEGOS MODE CONSTANTS ===
const STRATEGOS_KEYWORDS = [
  'strategos',
  'strategy',
  'strat',
  'interview mode',
  'strategic plan',
  'complex plan',
  'architecture decision',
  'design review',
  'comprehensive plan',
  '🎯',
];

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
function validateModel(model: string, agentName: string, client: any): string {
  if (!model || typeof model !== 'string') {
    client.app.log({
      service: "enhancer",
      level: "warn",
      message: `Invalid model for ${agentName}, using default`
    }).catch(() => {});
    return DEFAULT_MODEL;
  }
  
  const isValid = VALID_MODEL_PATTERNS.some(pattern => pattern.test(model));
  if (!isValid) {
    client.app.log({
      service: "enhancer",
      level: "warn",
      message: `Unknown model provider for ${agentName}: ${model}, using default`
    }).catch(() => {});
    return DEFAULT_MODEL;
  }
  
  return model;
}

// Model Resolver with Hierarchical Configuration
function resolveModel(
  agentName: string, 
  agentType: 'subagent' | 'primary',
  existingConfig: any,
  client: any
): string {
  let model: string | undefined;
  
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
    }).catch(() => {});
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
    }).catch(() => {});
    return validateModel(model, agentName, client);
  }
  
  // 4. Default
  return DEFAULT_MODEL;
}

export const EnhancerPlugin: Plugin = async ({ client }: { client: any }) => {
  client.app.log({
    service: "enhancer",
    level: "info",
    message: "🔥 Enhancer plugin v1.4.0 initialized with Todo Enforcer & Strategos Mode"
  }).catch(() => {})

  return {
    config: async (input: any) => {
      if (!input.agent) {
        input.agent = {}
      }

      // Helper function to configure agent with merging logic
      const configureAgent = (
        name: string, 
        type: 'subagent' | 'primary',
        defaultConfig: any
      ) => {
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

      // Configure Subagents
      
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

      // strategos-interviewer (NEW)
      configureAgent('strategos-interviewer', 'subagent', {
        prompt: `You are STRATEGOS INTERVIEWER - a strategic requirements analyst.

YOUR MISSION: Clarify unclear or complex requests through targeted interviewing.

=== INTERVIEW METHODOLOGY ===

1. **Request Analysis** (30 seconds)
   - Identify the core problem
   - Recognize ambiguities and assumptions
   - Mark missing information

2. **Clarification Questions** (2-5 questions)
   Always ask about:
   - ✓ **Scope**: What exactly is In/Out of scope?
   - ✓ **Constraints**: Time, budget, technical limits?
   - ✓ **Priorities**: What is most important? (Moscow: Must/Should/Could/Won't)
   - ✓ **Success Criteria**: When is it "done"?
   - ✓ **Edge Cases**: What could go wrong?
   - ✓ **Dependencies**: What needs to happen first?
   - ✓ **Stakeholders**: Who needs to be involved?
   - ✓ **Integration**: Does it fit the existing architecture?

3. **Follow-up questions** based on answers
   - Go deeper on critical points
   - Challenge assumptions
   - Offer alternatives

=== OUTPUT FORMAT ===

# 🎯 Strategos Interview Report

## Original Request
[What is this about?]

## Clarification Questions

### Q1: [Question]
**Context**: [Why is this important?]
**Options**: [If multiple choice]

### Q2: [Question]
...

### Q3: [Question]
...

## Anticipated Complexity
- **Level**: [Low/Medium/High/Critical]
- **Estimated Effort**: [X hours/days]
- **Main Risks**: [List]

## Recommended Approach
1. [Suggestion 1]
2. [Suggestion 2]

---
**Status**: ⏳ Waiting for user answers
**Next Step**: Evaluate interview → Create plan

=== RULES ===
- NEVER ask more than 5 questions at once
- Formulate questions to be easy to answer
- Offer options for complex decisions
- ALWAYS wait for user answers before proceeding`,
        tools: {
          read: true,
          task: true,
        },
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
        permission: {
          edit: "deny",
          bash: "deny"
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

      // ultraplan (UPDATED with Todo System)
      configureAgent('ultraplan', 'primary', {
        description: "Planning Agent with Discovery Subagents & Todo Enforcement 🔒",
        color: "#FF5722",
        steps: 20,
        tools: {
          task: true,
          read: true,
          bash: false,
          edit: false,
          write: false
        },
        permission: {
          edit: "deny",
          bash: "deny"
        },
        prompt: `You are the ULTRAPLAN ARCHITECT - create implementation plans through discovery and analysis.

=== STRICT WORKFLOW - FOLLOW EXACTLY ===

**STEP 1: DISCOVERY PHASE**
Call ALL explore-* subagents IN PARALLEL:
- explore-context: Project structure and tech stack
- explore-code: Relevant source code files  
- explore-deps: Dependencies and imports
- explore-tests: Test framework and existing tests

WAIT for all subagents to return. Synthesize their findings.

**STEP 2: TODO CREATION (CRITICAL!)**
For every complex task, you MUST create a TODO list:

## 📋 My TODOs
- [ ] Step 1: [Concrete task]
- [ ] Step 2: [Concrete task]
- [ ] Step 3: [Concrete task]

Format RULES:
- ALWAYS use format: "- [ ] Description"
- Mark completed with: "- [x] Description"
- Be SPECIFIC (no vague tasks)
- Create 3-10 todos depending on complexity

**STEP 3: PLAN CREATION**
Create a comprehensive implementation plan based on discovery results:
- Specific file paths from actual analysis (NEVER invent paths)
- Step-by-step implementation order
- Error handling strategy
- Validation/testing approach

**STEP 4: OUTPUT**
Output the plan as an executable markdown prompt with:
- Clear task description
- Context from discovery
- Step-by-step instructions
- Technical constraints
- Your TODO list

End with: "Copy the code block above and run it in **Build** mode to execute the plan."

=== TODO ENFORCER SYSTEM 🔒 ===

⚠️ **IMPORTANT**: You CANNOT stop until all Todos are marked with [x]!

The system enforces:
- Tracking of all your Todos
- Blocking "Stop" with open Todos
- Automatic continuation until everything is done

Finish it! 🔥

IMPORTANT RULES:
- All file paths must come from actual code analysis, never invented
- Never enable write/edit tools (analysis phase only)
- Always use task tool for subagent calls

=== WHEN TO USE STRATEGOS ===

For complex tasks requiring interview mode, use Strategos (Tab → strategos):
- New features (>1 file)
- Architecture changes
- Integrations
- Performance/Security improvements`
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
        permission: {
          edit: "deny",
          bash: "deny"
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

      // strategos (NEW - instead of Prometheus)
      configureAgent('strategos', 'primary', {
        description: "🎯 Strategic Planner with Interview Mode - Complex task planning through clarification",
        color: "#FF6F00", // Deep Orange for Strategos
        steps: 30,
        tools: {
          task: true,
          read: true,
          bash: false,
          edit: false,
          write: false,
        },
        permission: {
          edit: "deny",
          bash: "deny",
        },
        prompt: `You are STRATEGOS - the Strategic General. You plan complex tasks through strategic interviewing and deep analysis.

=== STRATEGOS WORKFLOW ===

**PHASE 1: INTERVIEW (Critical!)**

When the request is complex or unclear (new feature, architecture change, large refactor):

1. Call the **strategos-interviewer** subagent
2. Let the interviewer ask clarification questions
3. Analyze the answers
4. Ask follow-up questions if needed (more interviewer calls)

**ACTIVATE Interview Mode for:**
- Unclear requirements
- New features (>1 file affected)
- Architecture decisions
- Integration with external systems
- Performance-critical changes

**PHASE 2: DISCOVERY**

When interview is complete (or for simple requests):
1. Call ALL explore-* subagents PARALLEL
2. Analyze: context + code + deps + tests
3. Synthesize findings

**PHASE 3: STRATEGIC PLANNING**

Create a comprehensive, strategic plan:

# 🎯 Strategos Strategic Plan

## 🎯 Mission Statement
[1-2 sentences: What is the goal?]

## 📋 Requirements Analysis
### Must Have (Critical)
- [Req 1]
- [Req 2]

### Should Have (Important)
- [Req 3]

### Could Have (Nice-to-have)
- [Req 4]

## 🏗️ Architecture Decisions
| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| [Decision 1] | [Reasoning] | [Alternative] |
| [Decision 2] | [Reasoning] | [Alternative] |

## 📊 Implementation Roadmap

### Phase 1: Foundation ([Time estimate])
**Goal**: [What is achieved here?]
**Deliverables**:
- [ ] [Concrete Deliverable 1]
- [ ] [Concrete Deliverable 2]

**Files to Modify**:
- \`path/to/file.ts\` - [Why?]
- \`path/to/config.js\` - [Why?]

**Steps**:
1. [Concrete step with technology]
2. [Concrete step]
3. [Concrete step]

### Phase 2: Core Implementation ([Time estimate])
...

### Phase 3: Integration & Testing ([Time estimate])
...

## ⚠️ Risk Assessment
| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|-------------------|
| [Risk 1] | High/Medium/Low | High/Medium/Low | [How to avoid?] |
| [Risk 2] | ... | ... | ... |

## ✅ Quality Gates
- [ ] Gate 1: [Criterion]
- [ ] Gate 2: [Criterion]
- [ ] Gate 3: [Criterion]

## 🔄 Rollback Strategy
If something goes wrong:
1. [Step 1]
2. [Step 2]

## 🧪 Validation Plan
[How do we test success?]

## 📝 Open Questions
- [ ] [Question 1] → [Recommended solution]
- [ ] [Question 2] → [Recommended solution]

---
**Planned by**: Strategos Engine 🎯
**Based on**: Interview + Codebase Analysis
**Confidence Level**: [High/Medium/Low]

**NEXT STEP**: Copy this plan and run in **Build** mode.

=== STRATEGOS PRINCIPLES ===

🎯 **Strategic Vision**: Anticipate problems BEFORE they occur
🎯 **Tactical Depth**: Think in phases, not just steps
🎯 **Risk Awareness**: Every plan has risks - name them
🎯 **Clarity through Interviewing**: No assumptions, only clear requirements

=== WHEN TO USE STRATEGOS ===

Use Strategos for:
- ✅ New features (>1 file)
- ✅ Architecture changes
- ✅ Integrations (APIs, DBs, external services)
- ✅ Performance optimizations
- ✅ Security improvements
- ✅ Refactors with far-reaching consequences

Use ultraplan for:
- ✅ Simple bugfixes
- ✅ Small features (1-2 files)
- ✅ Documentation
- ✅ Adding tests

=== TODO SYSTEM 🔒 ===

IMPORTANT: Create TODOs for each phase!

## 📋 My TODOs
- [ ] Phase 1: [Description]
- [ ] Phase 2: [Description]
- [ ] Phase 3: [Description]

⚠️ You cannot stop until all Todos are completed!

=== ACTIVATION KEYWORDS ===

Strategos is automatically activated by:
- "strategos" in the prompt
- "interview mode" in the prompt
- "strategic plan" in the prompt
- "complex task" in the prompt
- "🎯" emoji

Or select the strategos Agent manually (Tab → strategos)`,
      });
      
      // Log configured agent models
      const configuredAgents = [
        'explore-context', 'explore-code', 'explore-deps', 'explore-tests', 
        'review-plan', 'strategos-interviewer',
        'enhancer', 'ultraplan', 'ask', 'strategos'
      ];
      const modelSummary = configuredAgents
        .map(name => `${name}=${input.agent[name]?.model || 'default'}`)
        .join(', ');
      
      client.app.log({
        service: "enhancer",
        level: "info",
        message: `🔥 Registered ${Object.keys(input.agent).length} agents: ${Object.keys(input.agent).join(", ")}`
      }).catch(() => {});
      
      client.app.log({
        service: "enhancer",
        level: "debug",
        message: `Agent models configured: ${modelSummary}`
      }).catch(() => {});
    },

    "tool.execute.before": async (input: any, output: any) => {
      if (input.tool === "task") {
        const args = output.args as { subagent_type?: string } | undefined
        const validSubagents = [
          "explore-context", "explore-code", "explore-deps", 
          "explore-tests", "review-plan", "strategos-interviewer"
        ]
        
        if (args?.subagent_type && validSubagents.includes(args.subagent_type)) {
          client.app.log({
            service: "enhancer",
            level: "debug",
            message: `Calling ${args.subagent_type} subagent`
          }).catch(() => {})
        }
      }
    },

    "message.updated": async (input: any, output: any) => {
      const agentName = input.session?.agent?.name
      if (!["enhancer", "ultraplan", "ask", "strategos"].includes(agentName)) {
        return
      }

      const content = input.message?.content || ""
      if (content.includes("Build mode") || content.includes("Build Mode")) {
        return
      }

      if (content.includes("\`\`\`markdown") || content.includes("# Task:")) {
        const hint = "\n\n---\n**Next Step**: Copy this entire block and run it in **Build** mode to execute the plan."
        if (output && typeof output === "object") {
          output.content = content + hint
        }
      }
    },

    // === TODO ENFORCER: Message Completed Hook ===
    // Extracts todos from agent responses and stores them
    "message.completed": async (input: any, output: any) => {
      const agentName = input.session?.agent?.name;
      const sessionId = input.session?.id || input.sessionId || 'default';
      
      // Only for Todo-enforced agents
      if (!TODO_ENFORCER_AGENTS.includes(agentName)) {
        return;
      }

      try {
        const content = input.message?.content || output?.content || "";
        
        // Extract todos
        const result = TodoParser.extractTodos(content);
        
        if (result.hasTodos) {
          // Store todos
          todoStore.set(sessionId, result.todos, agentName);
          
          // Log for debugging
          await client.app.log({
            service: "enhancer",
            level: "info",
            message: `📝 Todos detected in ${agentName}: ${result.completedCount}/${result.todos.length} completed`
          }).catch(() => {});
          
          // Add visual todo block if pending todos exist
          if (result.pendingCount > 0) {
            const todoBlock = `\n\n${TODO_MARKER_START}\n## 📋 Open Todos (${result.pendingCount}/${result.todos.length})\n\n${TodoParser.formatTodoList(result.todos, true)}\n\n⚠️ **Note**: You cannot stop until all Todos are completed!\n${TODO_MARKER_END}`;
            
            if (output && typeof output === "object") {
              output.content = content + todoBlock;
            }
          }
        }
      } catch (error) {
        await client.app.log({
          service: "enhancer",
          level: "warn",
          message: `Error in todo extraction: ${error}`
        }).catch(() => {});
      }
    },

    // === TODO ENFORCER: Stop Requested Hook ===
    // Prevents stop when todos are open
    "stop.requested": async (input: any, output: any) => {
      const agentName = input.session?.agent?.name;
      const sessionId = input.session?.id || input.sessionId || 'default';
      
      // Only for Todo-enforced agents
      if (!TODO_ENFORCER_AGENTS.includes(agentName)) {
        return;
      }

      try {
        const unfinishedCount = todoStore.countUnfinished(sessionId);
        
        if (unfinishedCount > 0) {
          const pendingTodos = todoStore.getAllPending(sessionId);
          
          // DENY STOP
          output.continue = true;
          output.reason = `🛑 **STOP DENIED** - ${unfinishedCount} TODO(S) STILL OPEN!\n\nYou cannot end the session until all tasks are completed. Please work on the remaining todos:\n\n${pendingTodos.map((t, i) => `${i + 1}. [ ] ${t.description}`).join('\n')}\n\n---\n**FORCED CONTINUATION MODE**\nThe agent must now complete the open todos.`;
          
          await client.app.log({
            service: "enhancer",
            level: "warn",
            message: `🛑 Stop blocked for ${agentName}: ${unfinishedCount} todos open`
          }).catch(() => {});
        } else {
          // All todos completed - clean up store
          if (todoStore.has(sessionId)) {
            todoStore.delete(sessionId);
            
            await client.app.log({
              service: "enhancer",
              level: "info",
              message: `✅ All todos completed in ${agentName} - Store cleaned`
            }).catch(() => {});
          }
        }
      } catch (error) {
        await client.app.log({
          service: "enhancer",
          level: "error",
          message: `Error in stop.requested hook: ${error}`
        }).catch(() => {});
      }
    },

    // === TODO ENFORCER: Session Start Hook ===
    // Cleans old todos on new session
    "session.start": async (input: any, output: any) => {
      const agentName = input.agent?.name;
      
      if (TODO_ENFORCER_AGENTS.includes(agentName)) {
        // Cleanup old sessions
        todoStore.cleanup();
        
        await client.app.log({
          service: "enhancer",
          level: "debug",
          message: `🔄 New ${agentName} session started - Todo Store cleaned`
        }).catch(() => {});
      }
    },

    // === TODO ENFORCER: Session End Hook ===
    "session.end": async (input: any, output: any) => {
      const agentName = input.agent?.name;
      const sessionId = input.session?.id || input.sessionId || 'default';
      
      if (TODO_ENFORCER_AGENTS.includes(agentName)) {
        // Check if open todos exist
        if (todoStore.has(sessionId)) {
          const stats = todoStore.get(sessionId);
          const unfinished = stats?.todos.filter(t => t.status !== 'completed').length || 0;
          
          if (unfinished > 0) {
            await client.app.log({
              service: "enhancer",
              level: "warn",
              message: `⚠️ Session ended with ${unfinished} open todos`
            }).catch(() => {});
          }
          
          // Clean up
          todoStore.delete(sessionId);
        }
      }
    },

    // === STRATEGOS MODE ACTIVATION ===
    // Auto-switch to strategos on keywords
    "user.prompt.submitted": async (input: any, output: any) => {
      const prompt = input.prompt || "";
      const currentAgent = input.agent?.name;
      const lowerPrompt = prompt.toLowerCase();
      
      // Check for Strategos keywords
      const detectedKeyword = STRATEGOS_KEYWORDS.find(kw => 
        lowerPrompt.includes(kw.toLowerCase())
      );
      
      if (detectedKeyword && currentAgent !== 'strategos') {
        // Switch to strategos Agent
        output.agent = 'strategos';
        
        // Add hint
        output.hint = `🎯 **Strategos Mode activated** (Keyword: "${detectedKeyword}")\n\nI will interview you first to clarify requirements, then create a strategic plan.`;
        
        await client.app.log({
          service: "enhancer",
          level: "info",
          message: `🎯 Strategos Mode activated by keyword: "${detectedKeyword}"`
        }).catch(() => {});
      }
      
      // Alternative: Interview Mode hint for ultraplan
      if (lowerPrompt.includes('interview me') && currentAgent === 'ultraplan') {
        output.hint = `💡 **Tip**: For complex tasks with interview, use the **strategos** Agent (Tab → strategos)`;
      }
    },
  }
}

export default EnhancerPlugin
