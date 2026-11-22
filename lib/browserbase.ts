/**
 * Browserbase Client - Cloud browser sessions for Research/Engineering bots
 *
 * Provides session pooling, concurrency limits, and high-level operations
 * for web scraping, sandbox code execution, and browser automation.
 */

import { createClient } from "@supabase/supabase-js"

const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY!
const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// =============================================================================
// TYPES
// =============================================================================

export interface BrowserbaseSession {
  id: string
  status: "initializing" | "running" | "completed" | "failed"
  connectUrl?: string
  debuggerUrl?: string
  createdAt: string
  expiresAt: string
}

export interface SessionPoolConfig {
  maxSessions: number
  sessionTTL: number // seconds
  idleTimeout: number // seconds
}

export interface BrowserAction {
  type: "navigate" | "click" | "type" | "screenshot" | "extract" | "execute_script"
  url?: string
  selector?: string
  text?: string
  script?: string
  waitFor?: string
}

export interface BrowserResult {
  success: boolean
  data?: any
  error?: string
  sessionId: string
}

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

const DEFAULT_POOL_CONFIG: SessionPoolConfig = {
  maxSessions: 10,
  sessionTTL: 30 * 60, // 30 minutes
  idleTimeout: 5 * 60, // 5 minutes
}

let sessionPool: Map<string, { session: BrowserbaseSession; lastUsed: number; inUse: boolean }> = new Map()

/**
 * Create a new Browserbase session
 */
export async function createBrowserbaseSession(
  config: Partial<SessionPoolConfig> = {}
): Promise<BrowserbaseSession> {
  const poolConfig = { ...DEFAULT_POOL_CONFIG, ...config }

  // Check pool capacity
  const activeSessions = Array.from(sessionPool.values()).filter(s => s.inUse).length
  if (activeSessions >= poolConfig.maxSessions) {
    // Try to reclaim idle sessions
    await reclaimIdleSessions(poolConfig.idleTimeout)

    const stillActive = Array.from(sessionPool.values()).filter(s => s.inUse).length
    if (stillActive >= poolConfig.maxSessions) {
      throw new Error("Browserbase session pool exhausted")
    }
  }

  // Create session via Browserbase API
  const response = await fetch("https://api.browserbase.com/v1/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${BROWSERBASE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: BROWSERBASE_PROJECT_ID,
      browserSettings: {
        blockAds: true,
        blockTrackers: true,
        viewport: { width: 1280, height: 720 },
      },
      timeout: poolConfig.sessionTTL,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Browserbase session creation failed: ${response.status} ${error}`)
  }

  const session = await response.json()

  const browserbaseSession: BrowserbaseSession = {
    id: session.id,
    status: "initializing",
    connectUrl: session.connectUrl,
    debuggerUrl: session.debuggerUrl,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + poolConfig.sessionTTL * 1000).toISOString(),
  }

  // Wait for session to be ready
  await waitForSessionReady(session.id)

  browserbaseSession.status = "running"

  // Add to pool
  sessionPool.set(session.id, {
    session: browserbaseSession,
    lastUsed: Date.now(),
    inUse: true,
  })

  // Track in Supabase for monitoring
  await supabase.from("browserbase_sessions").insert({
    session_id: session.id,
    workspace_id: "system", // Will be updated by caller
    status: "running",
    connect_url: session.connectUrl,
    debugger_url: session.debuggerUrl,
    expires_at: browserbaseSession.expiresAt,
  })

  return browserbaseSession
}

/**
 * Wait for session to be ready
 */
async function waitForSessionReady(sessionId: string, maxWait = 30000): Promise<void> {
  const start = Date.now()

  while (Date.now() - start < maxWait) {
    const response = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}`, {
      headers: { "Authorization": `Bearer ${BROWSERBASE_API_KEY}` },
    })

    if (response.ok) {
      const session = await response.json()
      if (session.status === "running") return
    }

    await new Promise(r => setTimeout(r, 1000))
  }

  throw new Error(`Session ${sessionId} failed to start within ${maxWait}ms`)
}

/**
 * Reclaim idle sessions
 */
async function reclaimIdleSessions(idleTimeout: number): Promise<void> {
  const now = Date.now()
  const toRemove: string[] = []

  for (const [id, entry] of sessionPool.entries()) {
    if (!entry.inUse && (now - entry.lastUsed) > idleTimeout * 1000) {
      await closeSession(id)
      toRemove.push(id)
    }
  }

  toRemove.forEach(id => sessionPool.delete(id))
}

/**
 * Get or create a session for a bot
 */
export async function getSessionForBot(
  botId: string,
  workspaceId: string
): Promise<BrowserbaseSession> {
  // Check for existing session for this bot
  const { data: existing } = await supabase
    .from("browserbase_sessions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("bot_id", botId)
    .in("status", ["initializing", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (existing && existing.connect_url) {
    // Reuse existing session
    const poolEntry = sessionPool.get(existing.session_id)
    if (poolEntry) {
      poolEntry.inUse = true
      poolEntry.lastUsed = Date.now()
      return poolEntry.session
    }

    // Rehydrate from DB
    const session: BrowserbaseSession = {
      id: existing.session_id,
      status: existing.status as any,
      connectUrl: existing.connect_url,
      debuggerUrl: existing.debugger_url,
      createdAt: existing.created_at,
      expiresAt: existing.expires_at,
    }

    sessionPool.set(existing.session_id, {
      session,
      lastUsed: Date.now(),
      inUse: true,
    })

    return session
  }

  // Create new session
  const session = await createBrowserbaseSession()

  // Update with bot/workspace info
  await supabase
    .from("browserbase_sessions")
    .update({ workspace_id: workspaceId, bot_id: botId })
    .eq("session_id", session.id)

  return session
}

/**
 * Release a session back to pool
 */
export async function releaseSession(sessionId: string): Promise<void> {
  const entry = sessionPool.get(sessionId)
  if (entry) {
    entry.inUse = false
    entry.lastUsed = Date.now()
  }
}

/**
 * Close a session
 */
export async function closeSession(sessionId: string): Promise<void> {
  try {
    await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${BROWSERBASE_API_KEY}` },
    })
  } catch (error) {
    console.error(`Failed to close session ${sessionId}:`, error)
  }

  sessionPool.delete(sessionId)

  await supabase
    .from("browserbase_sessions")
    .update({ status: "completed" })
    .eq("session_id", sessionId)
}

/**
 * Execute browser actions in a session
 */
export async function executeBrowserActions(
  sessionId: string,
  actions: BrowserAction[]
): Promise<BrowserResult[]> {
  const results: BrowserResult[] = []

  for (const action of actions) {
    try {
      const result = await executeSingleAction(sessionId, action)
      results.push({ success: true, data: result, sessionId })
    } catch (error) {
      results.push({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        sessionId
      })

      // Stop on failure for critical actions
      if (action.type === "navigate") break
    }
  }

  return results
}

/**
 * Execute a single browser action via CDP
 */
async function executeSingleAction(
  sessionId: string,
  action: BrowserAction
): Promise<any> {
  // In production, this would use CDP (Chrome DevTools Protocol) via the connectUrl
  // For now, we'll use the Browserbase REST API where available

  const baseUrl = `https://api.browserbase.com/v1/sessions/${sessionId}`

  switch (action.type) {
    case "navigate":
      if (!action.url) throw new Error("URL required for navigate")
      const navResponse = await fetch(`${baseUrl}/navigate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${BROWSERBASE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: action.url, waitFor: action.waitFor || "networkidle" }),
      })
      if (!navResponse.ok) throw new Error(`Navigation failed: ${await navResponse.text()}`)
      return await navResponse.json()

    case "click":
      if (!action.selector) throw new Error("Selector required for click")
      const clickResponse = await fetch(`${baseUrl}/click`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${BROWSERBASE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ selector: action.selector }),
      })
      if (!clickResponse.ok) throw new Error(`Click failed: ${await clickResponse.text()}`)
      return await clickResponse.json()

    case "type":
      if (!action.selector || !action.text) throw new Error("Selector and text required for type")
      const typeResponse = await fetch(`${baseUrl}/type`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${BROWSERBASE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ selector: action.selector, text: action.text }),
      })
      if (!typeResponse.ok) throw new Error(`Type failed: ${await typeResponse.text()}`)
      return await typeResponse.json()

    case "screenshot":
      const screenshotResponse = await fetch(`${baseUrl}/screenshot`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${BROWSERBASE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fullPage: true }),
      })
      if (!screenshotResponse.ok) throw new Error(`Screenshot failed: ${await screenshotResponse.text()}`)
      const blob = await screenshotResponse.blob()
      return { data: await blob.arrayBuffer(), mimeType: "image/png" }

    case "extract":
      if (!action.selector) throw new Error("Selector required for extract")
      const extractResponse = await fetch(`${baseUrl}/extract`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${BROWSERBASE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ selector: action.selector }),
      })
      if (!extractResponse.ok) throw new Error(`Extract failed: ${await extractResponse.text()}`)
      return await extractResponse.json()

    case "execute_script":
      if (!action.script) throw new Error("Script required for execute_script")
      const scriptResponse = await fetch(`${baseUrl}/script`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${BROWSERBASE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ script: action.script }),
      })
      if (!scriptResponse.ok) throw new Error(`Script execution failed: ${await scriptResponse.text()}`)
      return await scriptResponse.json()

    default:
      throw new Error(`Unknown action type: ${action.type}`)
  }
}

// =============================================================================
// HIGH-LEVEL OPERATIONS FOR RESEARCH/ENGINEERING BOTS
// =============================================================================

/**
 * Research bot: Search and extract information from web
 */
export async function researchWeb(
  botId: string,
  workspaceId: string,
  query: string,
  maxResults = 5
): Promise<{ results: Array<{ title: string; url: string; snippet: string }> }> {
  const session = await getSessionForBot(botId, workspaceId)

  try {
    // Navigate to search engine
    await executeSingleAction(session.id, {
      type: "navigate",
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      waitFor: "networkidle",
    })

    // Extract results
    const results = await executeSingleAction(session.id, {
      type: "extract",
      selector: "div.g",
    })

    // Process and limit results
    const processed = (results.data || [])
      .slice(0, maxResults)
      .map((r: any) => ({
        title: r.title || "",
        url: r.url || "",
        snippet: r.snippet || r.description || "",
      }))

    await releaseSession(session.id)
    return { results: processed }
  } catch (error) {
    await releaseSession(session.id)
    throw error
  }
}

/**
 * Engineering bot: Execute code in sandbox
 */
export async function executeCodeInSandbox(
  botId: string,
  workspaceId: string,
  language: string,
  code: string,
  dependencies?: string[]
): Promise<{ output: string; exitCode: number; duration: number }> {
  const session = await getSessionForBot(botId, workspaceId)

  try {
    // Navigate to a code execution environment (e.g., Replit, CodeSandbox, or custom)
    // For now, we'll use a simple approach with a code execution service
    const actions: BrowserAction[] = [
      { type: "navigate", url: "https://replit.com/languages/nodejs", waitFor: "networkidle" },
      { type: "type", selector: "textarea", text: code },
      { type: "click", selector: "button:has-text('Run')" },
      { type: "extract", selector: ".output, .console-output, [data-testid='output']" },
    ]

    const results = await executeBrowserActions(session.id, actions)
    const output = results[3]?.data?.text || "No output captured"

    await releaseSession(session.id)
    return { output, exitCode: 0, duration: 0 }
  } catch (error) {
    await releaseSession(session.id)
    throw error
  }
}

/**
 * Research bot: Monitor price changes
 */
export async function monitorPrice(
  botId: string,
  workspaceId: string,
  url: string,
  priceSelector: string
): Promise<{ price: string; currency: string; timestamp: string }> {
  const session = await getSessionForBot(botId, workspaceId)

  try {
    await executeSingleAction(session.id, {
      type: "navigate",
      url,
      waitFor: "networkidle",
    })

    const result = await executeSingleAction(session.id, {
      type: "extract",
      selector: priceSelector,
    })

    await releaseSession(session.id)

    return {
      price: result.data?.text || result.data?.price || "N/A",
      currency: "USD",
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    await releaseSession(session.id)
    throw error
  }
}

/**
 * Engineering bot: Create file in repository
 */
export async function createFileInRepo(
  botId: string,
  workspaceId: string,
  repoUrl: string,
  filePath: string,
  content: string,
  commitMessage: string
): Promise<{ success: boolean; commitUrl?: string }> {
  const session = await getSessionForBot(botId, workspaceId)

  try {
    // Navigate to GitHub/GitLab file editor
    const actions: BrowserAction[] = [
      { type: "navigate", url: `${repoUrl}/new/${filePath}`, waitFor: "networkidle" },
      { type: "type", selector: "textarea, [data-testid='file-editor']", text: content },
      { type: "type", selector: "input[name='commit_message']", text: commitMessage },
      { type: "click", selector: "button:has-text('Commit'), button:has-text('Propose')" },
      { type: "extract", selector: "a[href*='commit'], .commit-link" },
    ]

    const results = await executeBrowserActions(session.id, actions)
    const commitUrl = results[4]?.data?.href

    await releaseSession(session.id)
    return { success: true, commitUrl }
  } catch (error) {
    await releaseSession(session.id)
    throw error
  }
}

// =============================================================================
// CLEANUP & MONITORING
// =============================================================================

/**
 * Clean up expired sessions (run periodically via cron)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const now = new Date()
  let cleaned = 0

  // Clean up pool
  for (const [id, entry] of sessionPool.entries()) {
    if (new Date(entry.session.expiresAt) < now) {
      await closeSession(id)
      cleaned++
    }
  }

  // Clean up database
  const { error } = await supabase
    .from("browserbase_sessions")
    .update({ status: "expired" })
    .lt("expires_at", now.toISOString())
    .in("status", ["initializing", "running"])

  if (error) console.error("DB cleanup error:", error)

  return cleaned
}

/**
 * Get pool statistics
 */
export function getPoolStats() {
  const sessions = Array.from(sessionPool.values())
  return {
    total: sessions.length,
    inUse: sessions.filter(s => s.inUse).length,
    idle: sessions.filter(s => !s.inUse).length,
    maxSessions: DEFAULT_POOL_CONFIG.maxSessions,
  }
}