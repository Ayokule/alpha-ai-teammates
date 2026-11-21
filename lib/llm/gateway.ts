/**
 * FreeLLM Gateway - OpenAI-compatible client for Alpha's FreeLLM instance
 *
 * All LLM calls route through this gateway. It uses the FreeLLM API
 * (your workplace instance at http://localhost:5173/v1) with an OpenAI-compatible client.
 *
 * Model routing per department:
 * - assistant: auto (router picks best)
 * - research: auto (router picks best for browsing)
 * - content: auto (router picks best for writing)
 * - engineering: auto (router picks best for coding)
 * - head: auto (router picks best for planning)
 */
import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai'

// Read from process.env - fails fast if missing
const FREE_LLMAPI_KEY = process.env.FREE_LLMAPI_KEY
const FREE_LLMAPI_BASE_URL = process.env.FREE_LLMAPI_URL || 'http://localhost:5173/v1'

if (!FREE_LLMAPI_KEY) {
  throw new Error(
    'FREE_LLMAPI_KEY is missing. Add it to your .env or platform env vars.'
  )
}

// Create OpenAI-compatible provider pointing to FreeLLM
export const freeLlmProvider = createOpenAI({
  baseURL: FREE_LLMAPI_BASE_URL,
  apiKey: FREE_LLMAPI_KEY,
})

/**
 * Model routing configuration per bot department.
 * Uses FreeLLM's auto-routing which picks the best available free model.
 * You can override specific departments to use particular models.
 */
export const MODEL_ROUTING = {
  // Assistant bots (email, calendar) - fast, cheap
  assistant: 'auto',
  // Research bots (web browsing) - balanced
  research: 'auto',
  // Content bots (writing) - good quality
  content: 'auto',
  // Engineering bots (coding) - capable coder models
  engineering: 'auto',
  // Head bot (planning) - best reasoning
  head: 'auto',
} as const

/**
 * Get the model for a specific department/bot role
 */
export function getModelForDepartment(department: keyof typeof MODEL_ROUTING) {
  return freeLlmProvider(MODEL_ROUTING[department])
}

/**
 * Get the model for a specific bot based on its department
 */
export function getModelForBot(bot: { department?: string }) {
  const dept = bot.department as keyof typeof MODEL_ROUTING | undefined
  if (dept && MODEL_ROUTING[dept]) {
    return freeLlmProvider(MODEL_ROUTING[dept])
  }
  return freeLlmProvider('auto')
}

/**
 * Helper: Create a model with specific parameters
 * Note: Options like temperature/maxTokens are passed at call time via generateText/streamText
 */
export function createModel(modelId: string) {
  return freeLlmProvider(modelId)
}

/**
 * Test the FreeLLM connection
 */
export async function testFreeLlmConnection(): Promise<{ ok: boolean; models?: string[]; error?: string }> {
  try {
    const response = await fetch(`${FREE_LLMAPI_BASE_URL}/models`, {
      headers: {
        Authorization: `Bearer ${FREE_LLMAPI_KEY}`,
      },
    })
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${await response.text()}` }
    }
    const data = await response.json()
    const modelNames = data.data?.map((m: any) => m.id) || []
    return { ok: true, models: modelNames }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
}

// Export provider type for convenience
export type { OpenAIProvider }