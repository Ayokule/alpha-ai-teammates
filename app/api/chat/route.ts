import { createClient } from "@/lib/supabase/server"
import { streamText } from "ai"
import { freeLlmProvider } from "@/lib/llm/gateway"
import { Bot, Department } from "@/types"
import { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new Response("Unauthorized", { status: 401 })
    }

    const body = await request.json()
    const { messages, botId, threadId, workspaceId } = body

    if (!botId) {
      return new Response("Bot ID is required", { status: 400 })
    }

    // Get bot with department info
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select(`
        *,
        department:departments(*)
      `)
      .eq("id", botId)
      .single()

    if (botError || !bot) {
      return new Response("Bot not found", { status: 404 })
    }

    // Verify user has access to this workspace
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", bot.workspace_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return new Response("Forbidden", { status: 403 })
    }

    // Get or create thread
    let threadIdFinal = threadId
    if (!threadIdFinal) {
      const { data: thread, error: threadError } = await supabase
        .from("threads")
        .upsert({
          workspace_id: bot.workspace_id,
          bot_id: botId,
        }, { onConflict: "workspace_id,bot_id" })
        .select()
        .single()

      if (threadError) throw threadError
      threadIdFinal = thread.id
    }

    // Get bot's tool configs
    const { data: toolConfigs } = await supabase
      .from("bot_tool_configs")
      .select("*")
      .eq("bot_id", botId)
      .eq("is_active", true)

    // Build system prompt with tool awareness
    const toolNames = toolConfigs?.map(t => t.toolkit).join(", ") || "none"
    const systemPrompt = `${bot.instructions || "You are a helpful AI assistant."}

Available tools: ${toolNames}
Department: ${bot.department?.name || "General"}
Role: ${bot.role}`

    // Get model for this bot's department
    const deptName = bot.department?.name?.toLowerCase() || "assistant"
    const model = freeLlmProvider.chat(deptName) as any

    // Convert messages for AI SDK (last message is user, rest are history)
    const aiMessages = messages.map((m: any) => ({
      role: m.role === "bot" ? "assistant" : m.role,
      content: m.content,
    }))

    // Stream response
    const result = streamText({
      model,
      system: systemPrompt,
      messages: aiMessages,
      maxSteps: 3, // Allow tool calls
      onFinish: async ({ text, toolCalls, toolResults }) => {
        // Save assistant message
        await supabase.from("messages").insert({
          thread_id: threadIdFinal,
          user_id: user.id,
          role: "assistant",
          content: text,
          metadata: { toolCalls, toolResults },
        })

        // Update thread last_message_at
        await supabase
          .from("threads")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", threadIdFinal)
      },
    })

    // Save user message (last one)
    const lastUserMessage = messages[messages.length - 1]
    if (lastUserMessage?.role === "user") {
      await supabase.from("messages").insert({
        thread_id: threadIdFinal,
        user_id: user.id,
        role: "user",
        content: lastUserMessage.content,
      })
    }

    return result.toDataStreamResponse()
  } catch (error) {
    console.error("Chat API error:", error)
    return new Response("Internal server error", { status: 500 })
  }
}