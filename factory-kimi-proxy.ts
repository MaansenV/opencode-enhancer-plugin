/**
 * Factory-to-Kimi Proxy
 * Converts Anthropic-style requests from Factory to OpenAI format for Kimi
 * Usage: bun run factory-kimi-proxy.ts
 */

const KIMI_API_KEY = "sk-kimi-Rqsr9OjMKB8yrmvHPfdfkvRetR81bZdpi7hZSYttXxUcM0D5JBli109yQ5MgMH8k";
const KIMI_BASE_URL = "https://api.kimi.com/coding/v1";
const PROXY_PORT = 8320;

// Simple HTTP server
const server = Bun.serve({
  port: PROXY_PORT,
  async fetch(request) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Models endpoint - return Kimi models
    if (url.pathname === "/v1/models" || url.pathname === "/models") {
      return new Response(JSON.stringify({
        object: "list",
        data: [
          {
            id: "kimi-for-coding",
            object: "model",
            created: 1700000000,
            owned_by: "kimi",
          },
          {
            id: "kimi-k2",
            object: "model",
            created: 1700000000,
            owned_by: "kimi",
          },
        ],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle /v1/messages (Anthropic format from Factory)
    if (url.pathname === "/v1/messages" || url.pathname === "/v1/v1/messages") {
      try {
        const body = await request.json();
        const isStreaming = body.stream === true;
        console.log(`[Factory Request] streaming=${isStreaming}`, JSON.stringify(body, null, 2).substring(0, 300));

        // Convert Anthropic format to OpenAI format
        const openaiBody = convertAnthropicToOpenAI(body, isStreaming);
        console.log("[Kimi Request]", JSON.stringify(openaiBody, null, 2).substring(0, 300));

        // Send to Kimi
        const kimiResponse = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${KIMI_API_KEY}`,
            "Content-Type": "application/json",
            "User-Agent": "claude-code/2.0",
            "Host": "api.kimi.com",
            "Accept": isStreaming ? "text/event-stream" : "application/json",
          },
          body: JSON.stringify(openaiBody),
        });

        if (!kimiResponse.ok) {
          const error = await kimiResponse.text();
          console.error("[Kimi Error]", error);
          return new Response(error, { 
            status: kimiResponse.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Handle streaming response
        if (isStreaming && kimiResponse.body) {
          return handleStreamingResponse(kimiResponse.body, body, corsHeaders);
        }

        // Handle non-streaming response
        const kimiData = await kimiResponse.json();
        console.log("[Kimi Response]", JSON.stringify(kimiData, null, 2).substring(0, 300));

        // Convert OpenAI response back to Anthropic format
        const anthropicResponse = convertOpenAIToAnthropic(kimiData, body);
        
        return new Response(JSON.stringify(anthropicResponse), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } catch (error: any) {
        console.error("[Error]", error);
        return new Response(JSON.stringify({ 
          error: { message: error.message, type: "proxy_error" } 
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Pass through other requests to Kimi
    try {
      const targetUrl = `${KIMI_BASE_URL}${url.pathname.replace("/v1", "")}${url.search}`;
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          "Authorization": `Bearer ${KIMI_API_KEY}`,
          "Content-Type": "application/json",
          "User-Agent": "claude-code/2.0",
          "Host": "api.kimi.com",
        },
        body: request.body,
      });

      return new Response(response.body, {
        status: response.status,
        headers: { ...corsHeaders, ...Object.fromEntries(response.headers) },
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
});

function handleStreamingResponse(kimiBody: ReadableStream, originalBody: any, corsHeaders: any): Response {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const reader = kimiBody.getReader();
      let buffer = "";
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                // Send final message_stop event
                const stopEvent = {
                  type: "message_stop",
                };
                controller.enqueue(encoder.encode(`event: message_stop\ndata: ${JSON.stringify(stopEvent)}\n\n`));
                continue;
              }
              
              try {
                const chunk = JSON.parse(data);
                const anthropicChunk = convertOpenAIStreamChunkToAnthropic(chunk, originalBody);
                if (anthropicChunk) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(anthropicChunk)}\n\n`));
                }
              } catch (e) {
                console.error("[Parse Error]", e, line);
              }
            }
          }
        }
        
        // Handle remaining buffer
        if (buffer.startsWith("data: ")) {
          const data = buffer.slice(6);
          if (data !== "[DONE]") {
            try {
              const chunk = JSON.parse(data);
              const anthropicChunk = convertOpenAIStreamChunkToAnthropic(chunk, originalBody);
              if (anthropicChunk) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(anthropicChunk)}\n\n`));
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
        
        // Send message_stop at the end
        const stopEvent = { type: "message_stop" };
        controller.enqueue(encoder.encode(`event: message_stop\ndata: ${JSON.stringify(stopEvent)}\n\n`));
        
      } catch (error) {
        console.error("[Stream Error]", error);
      } finally {
        controller.close();
      }
    },
  });
  
  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

function convertOpenAIStreamChunkToAnthropic(chunk: any, originalBody: any): any | null {
  const choice = chunk.choices?.[0];
  if (!choice) return null;
  
  const delta = choice.delta;
  if (!delta) return null;
  
  // Handle content
  if (delta.content) {
    return {
      type: "content_block_delta",
      index: 0,
      delta: {
        type: "text_delta",
        text: delta.content,
      },
    };
  }
  
  // Handle start of stream
  if (choice.index === 0 && !delta.content && !choice.finish_reason) {
    return {
      type: "message_start",
      message: {
        id: chunk.id || `msg_${Date.now()}`,
        type: "message",
        role: "assistant",
        model: originalBody.model,
        content: [],
        stop_reason: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      },
    };
  }
  
  // Handle finish
  if (choice.finish_reason) {
    return {
      type: "message_delta",
      delta: {
        stop_reason: choice.finish_reason === "stop" ? "end_turn" : null,
        stop_sequence: null,
      },
      usage: {
        output_tokens: chunk.usage?.completion_tokens || 0,
      },
    };
  }
  
  return null;
}

function convertAnthropicToOpenAI(anthropicBody: any, stream: boolean = false) {
  const messages: any[] = [];
  
  // Convert system message
  if (anthropicBody.system) {
    messages.push({
      role: "system",
      content: typeof anthropicBody.system === "string" 
        ? anthropicBody.system 
        : anthropicBody.system.map((s: any) => s.text).join("\n"),
    });
  }

  // Convert messages
  for (const msg of anthropicBody.messages || []) {
    const content = typeof msg.content === "string" 
      ? msg.content 
      : msg.content.map((c: any) => c.text || c.source?.data || "").join("");
    
    messages.push({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: content,
    });
  }

  return {
    model: anthropicBody.model || "kimi-for-coding",
    messages: messages,
    max_tokens: anthropicBody.max_tokens || 8192,
    temperature: anthropicBody.temperature ?? 0.7,
    top_p: anthropicBody.top_p ?? 1,
    stream: stream,
  };
}

function convertOpenAIToAnthropic(openaiData: any, originalBody: any) {
  const choice = openaiData.choices?.[0];
  const content = choice?.message?.content || "";

  return {
    id: `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    model: originalBody.model,
    content: [{ type: "text", text: content }],
    stop_reason: choice?.finish_reason === "stop" ? "end_turn" : null,
    usage: {
      input_tokens: openaiData.usage?.prompt_tokens || 0,
      output_tokens: openaiData.usage?.completion_tokens || 0,
    },
  };
}

console.log(`🚀 Factory-to-Kimi Proxy running on http://localhost:${PROXY_PORT}`);
console.log(`📍 Endpoints:`);
console.log(`   - POST http://localhost:${PROXY_PORT}/v1/messages (Anthropic format)`);
console.log(`   - GET  http://localhost:${PROXY_PORT}/v1/models`);
console.log(`   - GET  http://localhost:${PROXY_PORT}/health`);
console.log(`\n⚙️  Configure Factory settings.json:`);
console.log(`   "baseUrl": "http://localhost:${PROXY_PORT}",`);
console.log(`   "provider": "anthropic"`);
