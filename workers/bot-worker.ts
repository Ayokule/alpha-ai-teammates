/**
 * Bot Worker - Processes tasks from QStash queue
 *
 * This worker runs as a standalone Node.js process that:
 * 1. Receives tasks via QStash HTTP webhook
 * 2. Executes bot logic using FreeLLM + tools
 * 3. Updates task status in Supabase
 * 4. Handles approvals and retries
 */

import { createClient } from "@supabase/supabase-js"
import { streamText, tool, CoreMessage } from "ai"
import { freeLlmProvider } from "../lib/llm/gateway"
import { Bot, Task } from "../types"
import { z } from "zod"
import {
  getSessionForBot,
  releaseSession,
  executeBrowserActions,
  researchWeb,
  executeCodeInSandbox,
  BrowserAction,
} from "../lib/browserbase"

// =============================================================================
// CONFIGURATION
// =============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const QSTASH_TOKEN = process.env.QSTASH_TOKEN!
const WORKER_PORT = process.env.WORKER_PORT || "3001"

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

// Placeholder tools - in production these would call Composio/Browserbase
const tools = {
  send_email: tool({
    description: "Send an email via Gmail",
    parameters: z.object({
      to: z.string(),
      subject: z.string(),
      body: z.string(),
    }),
    execute: async ({ to, subject, body }) => {
      console.log(`[send_email] To: ${to}, Subject: ${subject}`)
      // In production: call Composio Gmail API
      return { success: true, messageId: `msg_${Date.now()}` }
    },
  }),

  web_search: tool({
    description: "Search the web for information",
    parameters: z.object({
      query: z.string(),
      maxResults: z.number().optional(),
    }),
    execute: async ({ query, maxResults = 5 }) => {
      console.log(`[web_search] Query: ${query}`)
      // In production: call Browserbase
      return { results: [{ title: "Result", url: "https://example.com", snippet: "..." }] }
    },
  }),

  create_file: tool({
    description: "Create a file in the workspace",
    parameters: z.object({
      path: z.string(),
      content: z.string(),
    }),
    execute: async ({ path, content }) => {
      console.log(`[create_file] Path: ${path}`)
      return { success: true, path }
    },
  }),

  run_code: tool({
    description: "Run code in a sandbox",
    parameters: z.object({
      language: z.string(),
      code: z.string(),
    }),
    execute: async ({ language, code }) => {
      console.log(`[run_code] Language: ${language}`)
      // In production: call Browserbase sandbox
      return { output: "Code executed successfully", exitCode: 0 }
    },
  }),
}

// =============================================================================
// TASK PROCESSING
// =============================================================================

async function processTask(task: Task) {
  console.log(`[Worker] Processing task ${task.id} for bot ${task.bot_id}`)

  // Get bot configuration
  const { data: bot, error: botError } = await supabase
    .from("bots")
    .select(`
      *,
      department:departments(*),
      tool_configs:bot_tool_configs(*)
    `)
    .eq("id", task.bot_id)
    .single()

  if (botError || !bot) {
    throw new Error(`Bot not found: ${task.bot_id}`)
  }

  // Check for pending approvals if blocking
  if (task.source === "approval_callback") {
    const { data: approval } = await supabase
      .from("approvals")
      .select("*")
      .eq("task_id", task.id)
      .single()

    if (approval && approval.status !== "approved") {
      throw new Error(`Approval not granted: ${approval.status}`)
    }
  }

  // Update task status to in_progress
  await supabase
    .from("tasks")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", task.id)

  try {
    // Build system prompt
    const toolNames = bot.tool_configs?.map((t: { toolkit: string }) => t.toolkit).join(", ") || "none"
    const systemPrompt = `${bot.instructions || "You are a helpful AI assistant."}

Available tools: ${toolNames}
Department: ${bot.department?.name || "General"}
Role: ${bot.role}
Current task: ${JSON.stringify(task.payload)}`

    // Get model for bot's department
    const deptName = bot.department?.name?.toLowerCase() || "assistant"
    const model = freeLlmProvider.chat(deptName)

    // Convert payload to messages
    const messages: CoreMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Execute this task: ${JSON.stringify(task.payload)}` }
    ]

    // Execute with tool calling
    const result = await streamText({
      model: model as any,
      system: systemPrompt,
      messages: messages.slice(1),
      tools: getBotTools(bot),
      maxSteps: 5,
      onError: (error) => {
        console.error(`[Worker] Stream error for task ${task.id}:`, error)
      },
    })

    // Wait for completion
    const fullResponse = await result.text
    const toolCalls = await result.toolCalls
    const toolResults = await result.toolResults

    // Update task with result
    await supabase
      .from("tasks")
      .update({
        status: "completed",
        result: { response: fullResponse, toolCalls, toolResults },
        completed_at: new Date().toISOString(),
      })
      .eq("id", task.id)

    console.log(`[Worker] Task ${task.id} completed successfully`)

    // Record usage
    await supabase.rpc("record_usage", {
      p_workspace_id: task.workspace_id,
      p_component: "ai_gateway",
      p_quantity: 1,
      p_cost_usd: 0.001,
      p_metadata: { bot_id: task.bot_id, task_id: task.id },
    })

  } catch (error) {
    console.error(`[Worker] Task ${task.id} failed:`, error)

    // Update task with error
    await supabase
      .from("tasks")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        completed_at: new Date().toISOString(),
      })
      .eq("id", task.id)

    // Check retry count
    const { data: currentTask } = await supabase
      .from("tasks")
      .select("max_retries")
      .eq("id", task.id)
      .single()

    if (currentTask && currentTask.max_retries > 0) {
      // Re-queue with decremented retries
      await supabase
        .from("tasks")
        .update({
          status: "pending",
          max_retries: currentTask.max_retries - 1,
        })
        .eq("id", task.id)

      // Re-publish to queue
      await publishToQueue(task.id, "background")
    } else {
      // Move to dead letter queue
      await supabase
        .from("dead_letter_tasks")
        .insert({
          original_task: task,
          error_message: error instanceof Error ? error.message : "Unknown error",
          attempt_count: 3,
        })
    }

    throw error
  }
}

function getBotTools(bot: Bot) {
  const botTools: Record<string, any> = {}

  // Map bot tool configs to available tools
  bot.tool_configs?.forEach((config: { toolkit: string }) => {
    switch (config.toolkit) {
      case "gmail":
        botTools.send_email = tool({
          description: "Send an email via Gmail (requires Composio OAuth)",
          parameters: z.object({
            to: z.string(),
            subject: z.string(),
            body: z.string(),
            cc: z.array(z.string()).optional(),
            bcc: z.array(z.string()).optional(),
          }),
          execute: async ({ to, subject, body, cc, bcc }) => {
            // This would call Composio Gmail API in production
            // For now, create an approval request
            console.log(`[gmail] Would send email to: ${to}`)
            return { success: true, messageId: `msg_${Date.now()}`, requiresApproval: true }
          },
        })
        break

      case "web_search":
        botTools.web_search = tool({
          description: "Search the web and extract information using Browserbase",
          parameters: z.object({
            query: z.string(),
            maxResults: z.number().optional(),
            extractContent: z.boolean().optional(),
          }),
          execute: async ({ query, maxResults = 5, extractContent = true }) => {
            // This would be called with bot context - for now return structured result
            console.log(`[web_search] Query: ${query}`)
            return {
              results: [
                { title: `Result for: ${query}`, url: "https://example.com", snippet: "Example snippet..." },
                { title: `More about ${query}`, url: "https://example.org", snippet: "More details..." },
              ],
              count: 2,
            }
          },
        })
        break

      case "filesystem":
        botTools.create_file = tool({
          description: "Create or write a file (sandboxed)",
          parameters: z.object({
            path: z.string(),
            content: z.string(),
            mode: z.enum(["write", "append"]).optional(),
          }),
          execute: async ({ path, content, mode = "write" }) => {
            console.log(`[filesystem] ${mode} file: ${path}`)
            // In production: use Browserbase to write to sandbox filesystem
            return { success: true, path, bytesWritten: content.length }
          },
        })
        break

      case "code_sandbox":
        botTools.run_code = tool({
          description: "Execute code in Browserbase sandbox",
          parameters: z.object({
            language: z.string(),
            code: z.string(),
            dependencies: z.array(z.string()).optional(),
            timeout: z.number().optional(),
          }),
          execute: async ({ language, code, dependencies, timeout = 30000 }) => {
            console.log(`[code_sandbox] ${language}: ${code.substring(0, 100)}...`)
            // In production: use Browserbase sandbox
            return {
              output: "Code executed successfully",
              exitCode: 0,
              duration: 100,
              stdout: "",
              stderr: "",
            }
          },
        })
        break

      case "browserbase":
        botTools.browser_navigate = tool({
          description: "Navigate browser to URL and extract content",
          parameters: z.object({
            url: z.string(),
            waitFor: z.enum(["load", "domcontentloaded", "networkidle"]).optional(),
            actions: z.array(z.object({
              type: z.enum(["click", "type", "scroll", "wait"]),
              selector: z.string().optional(),
              text: z.string().optional(),
            })).optional(),
          }),
          execute: async ({ url, waitFor = "networkidle", actions }) => {
            console.log(`[browserbase] Navigate: ${url}`)
            // In production: use Browserbase session
            return {
              success: true,
              url,
              title: "Page Title",
              content: "Page content extracted...",
            }
          },
        })

        botTools.browser_click = tool({
          description: "Click element in browser",
          parameters: z.object({
            selector: z.string(),
            waitForNavigation: z.boolean().optional(),
          }),
          execute: async ({ selector, waitForNavigation = false }) => {
            console.log(`[browserbase] Click: ${selector}`)
            return { success: true, clicked: selector }
          },
        })

        botTools.browser_type = tool({
          description: "Type text in browser",
          parameters: z.object({
            selector: z.string(),
            text: z.string(),
            delay: z.number().optional(),
          }),
          execute: async ({ selector, text, delay = 50 }) => {
            console.log(`[browserbase] Type in ${selector}: ${text}`)
            return { success: true, typed: text.length }
          },
        })

        botTools.browser_extract = tool({
          description: "Extract data from page",
          parameters: z.object({
            selector: z.string(),
            attribute: z.string().optional(),
          }),
          execute: async ({ selector, attribute = "textContent" }) => {
            console.log(`[browserbase] Extract ${attribute} from ${selector}`)
            return { data: "Extracted content...", selector, attribute }
          },
        })

        botTools.browser_screenshot = tool({
          description: "Take screenshot of current page",
          parameters: z.object({
            fullPage: z.boolean().optional(),
            selector: z.string().optional(),
          }),
          execute: async ({ fullPage = true, selector }) => {
            console.log(`[browserbase] Screenshot: ${fullPage ? "full" : selector || "viewport"}`)
            return { success: true, format: "png", data: "base64..." }
          },
        })

        botTools.browser_script = tool({
          description: "Execute JavaScript in browser context",
          parameters: z.object({
            script: z.string(),
            args: z.array(z.any()).optional(),
          }),
          execute: async ({ script, args }) => {
            console.log(`[browserbase] Execute script: ${script.substring(0, 100)}...`)
            return { result: "Script executed", returnValue: null }
          },
        })
        break
    }
  })

  return botTools
}

// =============================================================================
// QUEUE PUBLISHING
// =============================================================================

async function publishToQueue(taskId: string, priority: "urgent" | "scheduled" | "background" = "scheduled") {
  if (!QSTASH_TOKEN) {
    console.warn("QSTASH_TOKEN not set, skipping queue publish")
    return
  }

  try {
    const response = await fetch("https://qstash.upstash.io/v2/publish", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${QSTASH_TOKEN}`,
        "Content-Type": "application/json",
        "Upstash-Queue": priority,
      },
      body: JSON.stringify({ taskId }),
    })

    if (!response.ok) {
      throw new Error(`QStash publish failed: ${response.statusText}`)
    }
  } catch (error) {
    console.error("Failed to publish to queue:", error)
  }
}

// =============================================================================
// HTTP SERVER (for QStash webhooks)
// =============================================================================

import { createServer } from "http"
import { parse } from "url"

const server = createServer(async (req, res) => {
  const parsedUrl = parse(req.url || "", true)
  const path = parsedUrl.pathname

  // Health check
  if (path === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }))
    return
  }

  // QStash webhook for task processing
  if (path === "/api/tasks/execute" && req.method === "POST") {
    let body = ""
    for await (const chunk of req) {
      body += chunk
    }

    try {
      const { taskId } = JSON.parse(body)

      if (!taskId) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "taskId required" }))
        return
      }

      // Get task from database
      const { data: task, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .single()

      if (error || !task) {
        res.writeHead(404, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Task not found" }))
        return
      }

      // Process task asynchronously
      processTask(task).catch(console.error)

      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ accepted: true }))
    } catch (error) {
      console.error("Webhook error:", error)
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Internal server error" }))
    }
    return
  }

  // Task creation endpoint (called from main app)
  if (path === "/api/tasks/create" && req.method === "POST") {
    let body = ""
    for await (const chunk of req) {
      body += chunk
    }

    try {
      const { taskId } = JSON.parse(body)
      await publishToQueue(taskId)
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ queued: true }))
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Failed to queue task" }))
    }
    return
  }

  res.writeHead(404)
  res.end("Not found")
})

server.listen(WORKER_PORT, () => {
  console.log(`[Bot Worker] Running on port ${WORKER_PORT}`)
  console.log(`[Bot Worker] Health: http://localhost:${WORKER_PORT}/health`)
  console.log(`[Bot Worker] Webhook: http://localhost:${WORKER_PORT}/api/tasks/execute`)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Bot Worker] Shutting down...")
  server.close()
  process.exit(0)
})