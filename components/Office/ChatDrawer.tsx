"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useChat } from "@ai-sdk/react"
import { Bot, Department } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { X, Send, Loader2, Plus, MessageSquare, Bot as BotIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatDrawerProps {
  isOpen: boolean
  onClose: () => void
  bot: Bot & { department?: Department }
  workspaceId: string
  threadId?: string
  onAskHead?: (message: string) => Promise<void>
  onDelegateTask?: (task: string) => Promise<void>
}

export function ChatDrawer({ isOpen, onClose, bot, workspaceId, threadId, onAskHead, onDelegateTask }: ChatDrawerProps) {
  const [isNewChat, setIsNewChat] = useState(false)
  const [showThreadList, setShowThreadList] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [threadIdState, setThreadIdState] = useState<string | undefined>(threadId)

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    isLoading,
    status,
    error,
    stop,
    setMessages,
    reload,
    data,
  } = useChat({
    api: "/api/chat",
    id: threadIdState,
    initialMessages: [],
    body: { botId: bot.id, workspaceId },
    onFinish: (message, options: any) => {
      if (options.threadId && !threadIdState) {
        setThreadIdState(options.threadId)
      }
    },
    onError: (err) => {
      console.error("Chat error:", err)
    },
  })

  // Load thread messages when threadId changes
  useEffect(() => {
    if (threadIdState) {
      loadThread(threadIdState)
    }
  }, [threadIdState])

  const loadThread = async (id: string) => {
    try {
      const response = await fetch(`/api/threads/${id}`)
      if (response.ok) {
        const { messages: threadMessages } = await response.json()
        setMessages(threadMessages.map((m: any) => ({
          id: m.id,
          role: m.role === "bot" ? "assistant" : m.role,
          content: m.content,
          parts: [{ type: "text", text: m.content }],
        })))
      }
    } catch (err) {
      console.error("Failed to load thread:", err)
    }
  }

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    await handleSubmit(e)
  }

  const handleNewChat = () => {
    setThreadIdState(undefined)
    setMessages([])
    setIsNewChat(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-label="Chat with bot">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="flex-1 flex flex-col max-w-md bg-background border-l border-border animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent transition-colors" aria-label="Close chat">
              <X className="h-5 w-5" />
            </button>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
              style={{ backgroundColor: bot.avatar_color }}
            >
              {bot.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold">{bot.name}</h3>
              <p className="text-xs text-muted-foreground capitalize">{bot.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onDelegateTask && (bot.role === "lead" || bot.role === "worker") && (
              <button
                onClick={() => {
                  const task = prompt("Describe the task to delegate:")
                  if (task) onDelegateTask(task)
                }}
                className="p-2 rounded-lg hover:bg-accent transition-colors text-xs"
                aria-label="Delegate task"
                title="Delegate task to another bot"
              >
                <BotIcon className="h-5 w-5" />
              </button>
            )}
            {onAskHead && bot.role !== "head" && (
              <button
                onClick={() => {
                  const message = prompt("Ask the Head Bot:")
                  if (message) onAskHead(message)
                }}
                className="p-2 rounded-lg hover:bg-accent transition-colors text-xs"
                aria-label="Ask Head Bot"
                title="Ask Head Bot for guidance"
              >
                <BotIcon className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={() => setShowThreadList(!showThreadList)}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label={showThreadList ? "Close thread list" : "Open thread list"}
            >
              <MessageSquare className="h-5 w-5" />
            </button>
            <button
              onClick={handleNewChat}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label="New chat"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Thread list sidebar */}
        {showThreadList && (
          <div className="border-b border-border p-4 bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Chat History</h4>
              <button
                onClick={handleNewChat}
                className="text-xs text-primary hover:underline"
              >
                New Chat
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {/* TODO: Load thread list from API */}
              <p className="text-sm text-muted-foreground text-center py-4">
                Thread history coming soon
              </p>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          {messages.length === 0 && !isNewChat && (
            <div className="text-center text-muted-foreground py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Start a conversation with {bot.name}</p>
              <p className="text-xs mt-1">Role: {bot.role} • {bot.department?.name || "No department"}</p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                  style={{ backgroundColor: bot.avatar_color }}
                >
                  {bot.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-muted rounded-bl-none"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
              {message.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0" />
              )}
            </div>
          ))}

          {/* New chat divider */}
          {isNewChat && (
            <div className="relative my-4">
              <Separator />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                ── new chat · {new Date().toLocaleDateString()} ──
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                style={{ backgroundColor: bot.avatar_color }}
              >
                {bot.name.charAt(0).toUpperCase()}
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-none px-4 py-2">
                <div className="flex gap-1">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground self-center">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error display */}
        {error && (
          <div className="border-t border-border p-4 bg-destructive/10">
            <p className="text-sm text-destructive flex items-center gap-2">
              <span>Error:</span>
              <span>{error.message}</span>
              <button onClick={() => reload()} className="ml-auto text-xs underline hover:no-underline">
                Retry
              </button>
            </p>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSend} className="border-t border-border p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder={`Message ${bot.name}...`}
              disabled={isLoading}
              className="flex-1"
              aria-label="Chat input"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
            {isLoading && (
              <Button type="button" size="icon" variant="ghost" onClick={stop} aria-label="Stop generation">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Press Enter to send • Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  )
}