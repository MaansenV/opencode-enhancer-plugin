# 🚀 OpenCode Enhancer Plugin

[![npm version](https://img.shields.io/npm/v/opencode-enhancer-plugin.svg)](https://www.npmjs.com/package/opencode-enhancer-plugin)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![OpenCode](https://img.shields.io/badge/OpenCode-Plugin-purple.svg)](https://opencode.ai)

> **Universal Technical Architect & Prompt Enhancer** - Transform vague ideas into precise, context-aware engineering specifications.

## ✨ What is Enhancer?

The **Enhancer** is a third primary agent mode for OpenCode that sits alongside **Plan** and **Build**. It acts as your technical architect, analyzing your codebase and generating detailed, actionable prompts that you can execute in Build mode.

### 🎯 Key Features

- **🔍 Intelligent Context Analysis** - Automatically explores your project structure, tech stack, and relevant files
- **🧠 Intent Classification** - Categorizes requests as FIX, FEAT, REFACTOR, TEST, or EXPLAIN
- **🔒 Todo Enforcer System** - Tracks TODOs and prevents stopping until all tasks are completed (for ultraplan and strategos agents)
- **🎯 Strategos Mode** - Strategic planning with interview mode for complex tasks
- **📚 Context7 Integration** - Conditionally includes `use context7` when documentation-heavy frameworks are detected
- **🎨 Style-Aware** - Mimics your project's coding style and patterns
- **⚡ One-Click Workflow** - Generates copy-pasteable prompts ready for Build mode

## 🚀 Quick Start

### Installation

#### From npm (Recommended)

Add to your OpenCode config (`~/.config/opencode/opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "opencode-enhancer-plugin@latest"
  ]
}
```

**Restart OpenCode** and press `Tab` to cycle through modes:
```
Plan → Build → Enhancer → Plan
```

#### From Source (Development)

1. **Clone** this repository:
   ```bash
   git clone https://github.com/MaansenV/opencode-enhancer-plugin.git
   cd opencode-enhancer-plugin
   ```

2. **Install dependencies** and build:
   ```bash
   npm install
   npm run build
   ```

3. **Add to your OpenCode config** using the local path:
   ```json
   {
     "plugin": [
       "file:///path/to/opencode-enhancer-plugin/dist/index.js"
     ]
   }
   ```

### Version Management

- **Latest version**: `"opencode-enhancer-plugin@latest"`
- **Current version**: `"opencode-enhancer-plugin@1.4.0"`
- **Specific version**: `"opencode-enhancer-plugin@1.0.0"`
- **Update**: OpenCode auto-updates plugins on startup, or run `opencode --update-plugins`

### Uninstall

Remove from your `opencode.json`:
```json
{
  "plugin": []
}
```

## 📖 How It Works

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   User      │────▶│  Enhancer    │────▶│   Build     │
│  Request    │     │   Agent      │     │   Mode      │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Explore-    │
                    │   Context    │
                    │  (Subagent)  │
                    └──────────────┘
```

### Workflow

1. **Select Enhancer Mode** (Tab to cycle)
2. **Describe your goal** - "Fix the login bug" or "Add user authentication"
3. **Enhancer analyzes** - Calls explore-context to map your codebase
4. **Receive enhanced prompt** - Structured markdown with context, instructions, and technical requirements
5. **Copy & Execute** - Switch to Build mode and run the generated prompt

## 📝 Changelog

### v1.4.0 - Todo Enforcer & Strategos Mode
- **🔒 Todo Enforcer System** - Tracks TODOs and prevents stopping until all tasks are completed (for ultraplan and strategos agents)
- **🎯 Strategos Mode** - New primary agent with strategic planning and interview mode for complex multi-phase tasks
- **strategos-interviewer** subagent for stakeholder requirement gathering
- Enhanced hooks for session management and TODO tracking
- Auto-activation of strategos mode on keyword detection

### v1.2.0 - New Agents & Model Configuration
- **ultraplan** & **ask** primary agents
- **review-plan** subagent for critical analysis
- Enhanced model configuration with environment variables

### v1.0.0 - Initial Release
- **enhancer** primary agent
- **explore-context** subagent for project analysis
- Intent classification and Context7 integration
- Style-aware prompt generation

---

## 🎨 Example Output

```markdown
# Task: Fix Authentication Token Validation

## Context
Detected **React + TypeScript + Express** project. Authentication logic located in `src/auth/middleware.ts` and `src/utils/token.ts`.

## Instructions
use context7
1. Modify `src/auth/middleware.ts`:
   - Locate function `validateToken` (line 45)
   - Add null check for `req.headers.authorization`
   - Implement JWT verification using existing `verify()` pattern
2. Update `src/utils/token.ts`:
   - Add error handling for expired tokens
   - Return structured error object instead of throwing
3. Testing:
   - Run `npm test` to verify auth flow
   - Check edge cases: missing token, expired token, malformed token

## Technical Requirements
- **Style**: Follow existing async/await patterns
- **Error Handling**: Use `try/catch` with custom AuthError class
- **TypeScript**: Maintain strict typing, add interfaces for token payload
```

## 🛠️ Architecture

### Components

#### Primary Agents (User-Facing)
Activated via `Tab` key in OpenCode:

| Agent | Color | Steps | Description |
|-------|-------|-------|-------------|
| **enhancer** | Purple (#9C27B0) | 15 | Universal Technical Architect - analyzes intent and generates executable prompts |
| **ultraplan** | Orange (#FF5722) | 20 | Iterative Planner with Todo Enforcement - creates plans through parallel subagent analysis and review loops |
| **ask** | Blue (#2196F3) | 15 | Research Assistant - answers codebase questions via multi-source context gathering |
| **strategos** | Deep Orange (#BF360C) | 30 | Strategic Planner with Interview Mode - handles complex multi-phase tasks with strategic planning and stakeholder interviews |

#### Subagents (Background Workers)
Called automatically by primary agents via `task` tool:

| Subagent | Called By | Description |
|----------|-----------|-------------|
| **explore-context** | enhancer, ultraplan, ask | Maps project structure, detects tech stack, identifies entry points |
| **explore-code** | enhancer, ultraplan, ask | Deep-dive source code analysis for relevant files and patterns |
| **explore-deps** | enhancer, ultraplan, ask | Analyzes dependencies, imports, and external libraries |
| **explore-tests** | ultraplan, ask (for TEST intent) | Discovers test framework, patterns, and existing coverage |
| **review-plan** | ultraplan only | Critical analysis of implementation plans during review loop |
| **strategos-interviewer** | strategos only | Conducts stakeholder interviews to gather strategic requirements and constraints |

### Supported Tech Stacks

- **Web**: React, Vue, Angular, Svelte, Next.js, Nuxt, Vite
- **Backend**: Express, Django, Flask, FastAPI, Rails, Laravel, Spring
- **Game Engines**: Unity, Godot, Unreal Engine
- **Data/ML**: TensorFlow, PyTorch, NumPy, Pandas
- **Infrastructure**: Docker, Kubernetes, Terraform
- **And more...**

## ⚙️ Configuration

### Agent Configuration

The plugin automatically registers agents via the `config` hook with **configurable models**:

```typescript
// Enhancer (Primary Agent) - Model configurable via opencode.json or env vars
{
  mode: "primary",
  model: "opencode/kimi-k2.5-free",  // Default, can be overridden
  description: "Universal Technical Architect & Prompt Enhancer",
  color: "#9C27B0",
  steps: 15,
  tools: { task: true, read: true }
}

// Explore-Context (Subagent) - Model configurable via opencode.json or env vars
{
  mode: "subagent",
  hidden: true,
  model: "opencode/kimi-k2.5-free",  // Default, can be overridden
  tools: { list: true, read: true, grep: true, bash: true }
}
```

### Model Configuration

You can configure custom models for Enhancer agents. This is useful for:
- Using more powerful models for complex planning tasks
- Saving costs by using simpler models for subagents
- Testing specific models for certain task types

#### Configuration Methods (Priority: Highest → Lowest)

##### 1. OpenCode Agent Config (Recommended)
Configure models directly in your `opencode.json`:

```json
{
  "agent": {
    "review-plan": {
      "model": "anthropic/claude-sonnet-4-5"
    },
    "enhancer": {
      "model": "anthropic/claude-sonnet-4-5"
    }
  }
}
```

##### 2. Environment Variables
Use environment variables for CI/CD or temporary changes:

```bash
# All Subagents
export ENHANCER_MODEL_SUBAGENT="opencode/kimi-k2.5-free"

# All Primary Agents  
export ENHANCER_MODEL_PRIMARY="anthropic/claude-sonnet-4-5"

# Specific Agent (highest priority among env vars)
export ENHANCER_MODEL_REVIEW_PLAN="anthropic/claude-opus-4"
export ENHANCER_MODEL_ENHANCER="anthropic/claude-sonnet-4-5"
```

#### Model Recommendations by Agent Type

**Primary Agents** (Use stronger models for complex reasoning):

| Agent | Recommended | Minimum | Purpose |
|-------|-----------|---------|---------|
| enhancer | anthropic/claude-sonnet-4-5 | opencode/kimi-k2.5-free | Intent classification & prompt generation |
| ultraplan | anthropic/claude-sonnet-4-5 | opencode/kimi-k2.5-free | Iterative planning with review loops |
| ask | anthropic/claude-sonnet-4-5 | opencode/kimi-k2.5-free | Multi-source research & synthesis |

**Subagents** (Lightweight models sufficient for information gathering):

| Subagent | Recommended | Minimum | Purpose |
|----------|-------------|---------|---------|
| review-plan | anthropic/claude-sonnet-4-5 | opencode/kimi-k2.5-free | Critical plan analysis (called by ultraplan) |
| explore-context | opencode/kimi-k2.5-free | opencode/kimi-k2.5-free | Project structure mapping |
| explore-code | opencode/kimi-k2.5-free | opencode/kimi-k2.5-free | Source code analysis |
| explore-deps | opencode/kimi-k2.5-free | opencode/kimi-k2.5-free | Dependency analysis |
| explore-tests | opencode/kimi-k2.5-free | opencode/kimi-k2.5-free | Test pattern discovery |

#### Validation

The plugin validates configured models against known providers:
- `opencode/*`
- `anthropic/*`
- `openai/*`
- `google/*`
- `mistral/*`
- `cohere/*`
- `ollama/*`

Invalid models automatically fall back to the default (`opencode/kimi-k2.5-free`).

### Context7 Integration

The plugin automatically detects libraries that benefit from Context7:

```typescript
// Libraries triggering "use context7"
["react", "django", "unity", "tensorflow", "docker", ...]
```

## 🔧 Development

### Project Structure

```
opencode-enhancer-plugin/
├── src/
│   └── index.ts          # Source TypeScript
├── dist/                 # Compiled output (published to npm)
│   ├── index.js
│   └── index.d.ts
├── package.json          # Package metadata
├── tsconfig.json         # TypeScript config
└── README.md             # This file
```

### Hooks

- **`config`** - Registers agents on startup
- **`tool.execute.before`** - Logs subagent calls
- **`message.updated`** - Appends Build mode hint
- **`message.completed`** - Extracts and stores TODOs
- **`stop.requested`** - Prevents stop when TODOs are open
- **`session.start`** - Manages todo store lifecycle
- **`session.end`** - Manages todo store lifecycle
- **`user.prompt.submitted`** - Auto-activates strategos mode on keywords

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Ideas for Contributions

- Add more tech stack detectors
- Improve Context7 heuristics
- Add support for additional intent types
- Enhance prompt templates

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for [OpenCode](https://opencode.ai)
- Inspired by the need for better context-aware AI assistance
- Thanks to the OpenCode community for feedback and ideas

---

<div align="center">

**[⬆ Back to Top](#-opencode-enhancer-plugin)**

Made with ❤️ for the OpenCode community

</div>