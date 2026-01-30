export const EnhancerPlugin = async ({ client }) => {
    client.app.log({
        service: "enhancer",
        level: "info",
        message: "Enhancer plugin initialized"
    }).catch(() => { });
    return {
        config: async (input) => {
            if (!input.agent) {
                input.agent = {};
            }
            input.agent["explore-context"] = {
                mode: "subagent",
                hidden: true,
                model: "opencode/kimi-k2.5-free",
                prompt: `You are the UNIVERSAL CONTEXT DETECTIVE. Map the codebase and extract technical context.`,
                tools: {
                    list: true,
                    read: true,
                    grep: true,
                    bash: true
                }
            };
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
                prompt: `You are the CHIEF ARCHITECT (Enhancer). Translate user wishes into precise engineering specifications.`
            };
        },
        "tool.execute.before": async (input, output) => {
            if (input.tool === "task") {
                const args = output.args;
                if (args?.subagent_type === "explore-context") {
                    client.app.log({
                        service: "enhancer",
                        level: "debug",
                        message: "Calling explore-context subagent"
                    }).catch(() => { });
                }
            }
        },
        "message.updated": async (input, output) => {
            if (input.session?.agent?.name !== "enhancer") {
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