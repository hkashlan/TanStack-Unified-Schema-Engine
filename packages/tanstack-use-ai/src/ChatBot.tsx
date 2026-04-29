/**
 * ChatBot — auto-generated AI chatbot component for tanstack-use.
 *
 * Responsibilities:
 *  - Calls `buildAITools(app, session)` on mount to get permission-scoped tools
 *  - Calls `buildSystemPrompt(app)` for the system message
 *  - Uses TanStack AI's `chat()` function with the developer-supplied adapter
 *  - Streams responses and renders them incrementally
 *  - Renders a floating chat panel that can be toggled open/closed
 *  - When a tool response includes a navigation target, calls the provided
 *    `navigate` function (or a no-op when absent)
 *
 * The AI provider adapter is developer-supplied — no LLM is hard-coded.
 * Pass any TanStack AI adapter (e.g. `openaiText("gpt-4o")`) as the `adapter`
 * prop.
 *
 * Requirements: 13.1, 13.5, 13.6, 13.7
 */

import { chat } from "@tanstack/ai";
import type { AIAdapter, ModelMessage, Tool } from "@tanstack/ai";
import type { App } from "@tanstack-use/core";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { buildAITools } from "./build-ai-tools.js";
import { buildSystemPrompt } from "./build-system-prompt.js";
import type { AIServerFunctions, AITools } from "./build-ai-tools.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single message in the chat UI. */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface ChatBotProps {
  /**
   * The App registry produced by `defineApp()`.
   * Used to derive AI tools and the system prompt.
   */
  app: App;
  /**
   * The current Better Auth session.
   * Used to scope AI tools to the session's permissions.
   */
  session: unknown;
  /**
   * A TanStack AI adapter (e.g. `openaiText("gpt-4o")`).
   * The framework does NOT hard-code a provider — the developer supplies this.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: AIAdapter<any, any, any, any, any, any>;
  /**
   * The model name to use with the adapter (e.g. "gpt-4o").
   */
  model: string;
  /**
   * The server functions produced by `createServerFunctions(app, db)`.
   * Required so that AI tool executors can call the correct data operations.
   */
  serverFns: AIServerFunctions;
  /**
   * Optional navigation callback. When a tool response includes a navigation
   * target, this function is called with the target path.
   * Typically wired to TanStack Router's `navigate()`.
   *
   * @example
   * import { useNavigate } from "@tanstack/react-router";
   * const navigate = useNavigate();
   * <ChatBot navigate={(to) => navigate({ to })} ... />
   */
  navigate?: (to: string) => void;
  /**
   * Optional CSS class name for the floating panel container.
   * Useful for positioning overrides.
   */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a simple unique ID for messages. */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Convert our internal `AITools` record to the `Tool[]` array expected by
 * TanStack AI's `chat()` function.
 */
function toolsToArray(tools: AITools): Tool[] {
  return Object.values(tools) as Tool[];
}

// ---------------------------------------------------------------------------
// ChatBot component
// ---------------------------------------------------------------------------

/**
 * A floating AI chatbot panel that auto-generates tools from the App registry.
 *
 * Usage:
 * ```tsx
 * import { ChatBot } from "@tanstack-use/ai";
 * import { openaiText } from "@tanstack/ai";
 * import { useNavigate } from "@tanstack/react-router";
 *
 * function App() {
 *   const navigate = useNavigate();
 *   return (
 *     <ChatBot
 *       app={app}
 *       session={session}
 *       adapter={openaiText("gpt-4o")}
 *       model="gpt-4o"
 *       serverFns={serverFns}
 *       navigate={(to) => navigate({ to })}
 *     />
 *   );
 * }
 * ```
 */
export function ChatBot({
  app,
  session,
  adapter,
  model,
  serverFns,
  navigate,
  className,
}: ChatBotProps): React.ReactElement {
  // -------------------------------------------------------------------------
  // Panel open/closed state
  // -------------------------------------------------------------------------

  const [isOpen, setIsOpen] = useState(false);

  // -------------------------------------------------------------------------
  // Tools and system prompt — derived on mount
  // -------------------------------------------------------------------------

  const [tools, setTools] = useState<AITools>({});
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [toolsReady, setToolsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initTools() {
      try {
        const [builtTools, prompt] = await Promise.all([
          buildAITools(app, session, serverFns),
          Promise.resolve(buildSystemPrompt(app)),
        ]);
        if (!cancelled) {
          setTools(builtTools);
          setSystemPrompt(prompt);
          setToolsReady(true);
        }
      } catch {
        if (!cancelled) {
          setToolsReady(true); // Still allow chat even if tool build fails
        }
      }
    }

    void initTools();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app, session, serverFns]);

  // -------------------------------------------------------------------------
  // Chat messages state
  // -------------------------------------------------------------------------

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Ref to the current streaming abort controller
  const abortControllerRef = useRef<AbortController | null>(null);

  // Ref to the messages list for auto-scroll
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // -------------------------------------------------------------------------
  // Convert internal messages to TanStack AI ModelMessage format
  // -------------------------------------------------------------------------

  function toModelMessages(chatMessages: ChatMessage[]): ModelMessage[] {
    return chatMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  // -------------------------------------------------------------------------
  // Send a message and stream the response
  // -------------------------------------------------------------------------

  const sendMessage = useCallback(
    async (userText: string) => {
      if (!userText.trim() || isStreaming) return;

      setStreamError(null);

      // Add user message
      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: userText.trim(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInputValue("");

      // Prepare assistant message placeholder for streaming
      const assistantId = generateId();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
      };

      setMessages([...updatedMessages, assistantMessage]);
      setIsStreaming(true);

      // Create abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const toolArray = toolsToArray(tools);

        const stream = chat({
          adapter,
          model,
          messages: toModelMessages(updatedMessages),
          systemPrompts: systemPrompt ? [systemPrompt] : [],
          tools: toolArray.length > 0 ? toolArray : undefined,
          abortController,
        });

        let accumulatedContent = "";

        for await (const chunk of stream) {
          if (abortController.signal.aborted) break;

          if (chunk.type === "content") {
            accumulatedContent += chunk.delta;

            // Update the assistant message with accumulated content
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: accumulatedContent }
                  : m,
              ),
            );
          } else if (chunk.type === "tool_result") {
            // Check if the tool result contains a navigation target
            // Navigation targets are encoded as JSON: { navigate: "/path" }
            try {
              const result = JSON.parse(chunk.content) as unknown;
              if (
                result !== null &&
                typeof result === "object" &&
                "navigate" in result &&
                typeof (result as { navigate: unknown }).navigate === "string"
              ) {
                navigate?.((result as { navigate: string }).navigate);
              }
            } catch {
              // Not JSON or no navigation target — ignore
            }
          } else if (chunk.type === "error") {
            setStreamError(chunk.error.message);
            break;
          }
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          const message =
            err instanceof Error ? err.message : "An error occurred";
          setStreamError(message);
          // Remove the empty assistant message on error
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, isStreaming, tools, adapter, model, systemPrompt, navigate],
  );

  // -------------------------------------------------------------------------
  // Handle form submission
  // -------------------------------------------------------------------------

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(inputValue);
  }

  // -------------------------------------------------------------------------
  // Handle stopping an in-progress stream
  // -------------------------------------------------------------------------

  function handleStop() {
    abortControllerRef.current?.abort();
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      data-testid="chatbot-container"
      className={className}
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "0.5rem",
      }}
    >
      {/* Chat panel — shown when open */}
      {isOpen && (
        <div
          data-testid="chatbot-panel"
          role="dialog"
          aria-label="AI Assistant"
          aria-modal="false"
          style={{
            width: "22rem",
            maxHeight: "32rem",
            display: "flex",
            flexDirection: "column",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            boxShadow:
              "0 10px 25px -5px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "0.75rem 1rem",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#f9fafb",
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: "0.875rem",
                color: "#111827",
              }}
            >
              AI Assistant
            </span>
            <button
              data-testid="chatbot-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#6b7280",
                fontSize: "1rem",
                lineHeight: 1,
                padding: "0.25rem",
              }}
            >
              ✕
            </button>
          </div>

          {/* Messages area */}
          <div
            data-testid="chatbot-messages"
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {!toolsReady && (
              <div
                data-testid="chatbot-loading"
                style={{
                  color: "#6b7280",
                  fontSize: "0.8125rem",
                  textAlign: "center",
                }}
              >
                Initialising…
              </div>
            )}

            {messages.length === 0 && toolsReady && (
              <div
                data-testid="chatbot-empty"
                style={{
                  color: "#9ca3af",
                  fontSize: "0.8125rem",
                  textAlign: "center",
                }}
              >
                How can I help you?
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                data-testid={`chatbot-message-${message.role}`}
                style={{
                  alignSelf:
                    message.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  padding: "0.5rem 0.75rem",
                  borderRadius:
                    message.role === "user"
                      ? "1rem 1rem 0.25rem 1rem"
                      : "1rem 1rem 1rem 0.25rem",
                  background: message.role === "user" ? "#3b82f6" : "#f3f4f6",
                  color: message.role === "user" ? "#fff" : "#111827",
                  fontSize: "0.875rem",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {message.content}
                {message.role === "assistant" &&
                  isStreaming &&
                  message === messages[messages.length - 1] && (
                    <span
                      data-testid="chatbot-cursor"
                      aria-hidden="true"
                      style={{ display: "inline-block", marginLeft: "2px" }}
                    >
                      ▋
                    </span>
                  )}
              </div>
            ))}

            {streamError && (
              <div
                data-testid="chatbot-error"
                role="alert"
                style={{
                  color: "#ef4444",
                  fontSize: "0.8125rem",
                  padding: "0.5rem",
                  background: "#fef2f2",
                  borderRadius: "0.5rem",
                }}
              >
                {streamError}
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <form
            data-testid="chatbot-form"
            onSubmit={handleSubmit}
            style={{
              padding: "0.75rem",
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              gap: "0.5rem",
              background: "#fff",
            }}
          >
            <input
              data-testid="chatbot-input"
              type="text"
              value={inputValue}
              onChange={(e) =>
                setInputValue(
                  (e.nativeEvent.target as unknown as { value: string }).value,
                )
              }
              placeholder="Ask anything…"
              disabled={isStreaming || !toolsReady}
              aria-label="Chat message input"
              style={{
                flex: 1,
                padding: "0.5rem 0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                outline: "none",
                background: isStreaming || !toolsReady ? "#f9fafb" : "#fff",
              }}
            />

            {isStreaming ? (
              <button
                type="button"
                data-testid="chatbot-stop"
                onClick={handleStop}
                aria-label="Stop generating"
                style={{
                  padding: "0.5rem 0.75rem",
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                data-testid="chatbot-send"
                disabled={!inputValue.trim() || !toolsReady}
                aria-label="Send message"
                style={{
                  padding: "0.5rem 0.75rem",
                  background:
                    !inputValue.trim() || !toolsReady ? "#d1d5db" : "#3b82f6",
                  color: "#fff",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor:
                    !inputValue.trim() || !toolsReady
                      ? "not-allowed"
                      : "pointer",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                Send
              </button>
            )}
          </form>
        </div>
      )}

      {/* Toggle button */}
      <button
        data-testid="chatbot-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
        aria-expanded={isOpen}
        style={{
          width: "3.5rem",
          height: "3.5rem",
          borderRadius: "50%",
          background: "#3b82f6",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          fontSize: "1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(59,130,246,0.4)",
          transition: "transform 0.15s ease",
        }}
      >
        {isOpen ? "✕" : "💬"}
      </button>
    </div>
  );
}
