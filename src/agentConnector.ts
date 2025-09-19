import { AIProjectClient } from "@azure/ai-projects";
import { ManagedIdentityCredential } from "@azure/identity";
import * as dotenv from "dotenv";

dotenv.config();

// Environment variables
const PROJECT_CONNECTION_STRING = process.env.PROJECT_CONNECTION_STRING || "";
const AGENT_ID = process.env.AGENT_ID || "";
const USERMSI_CLIENTID = process.env.clientId || ""; // Provided by TeamsFx / infrastructure as app setting

// Thread management with conversation tracking
const conversationThreads = new Map<string, { threadId: string, lastUsed: Date }>();
const THREAD_EXPIRY_MINUTES = 30; // Expire threads after 30 minutes of inactivity

interface AgentResult {
  success: boolean;
  message: string;
  error?: string;
  meta?: Record<string, any>;
}

function getOrCreateConversationId(userContext?: any): string {
  // Generate a simple conversation identifier
  // In a real bot, this could be based on Teams conversation ID, user ID, etc.
  return userContext?.conversationId || userContext?.channelId || 'default-conversation';
}

async function getOrCreateThread(aiClient: any, conversationId: string): Promise<string> {
  const now = new Date();
  const existingThread = conversationThreads.get(conversationId);
  
  // Check if we have a valid existing thread
  if (existingThread) {
    const minutesSinceLastUse = (now.getTime() - existingThread.lastUsed.getTime()) / (1000 * 60);
    if (minutesSinceLastUse < THREAD_EXPIRY_MINUTES) {
      console.log("[agentConnector] Reusing existing thread", { 
        conversationId, 
        threadId: existingThread.threadId,
        minutesSinceLastUse: Math.round(minutesSinceLastUse)
      });
      existingThread.lastUsed = now; // Update last used time
      return existingThread.threadId;
    } else {
      console.log("[agentConnector] Thread expired, creating new one", { 
        conversationId, 
        minutesSinceLastUse: Math.round(minutesSinceLastUse)
      });
      conversationThreads.delete(conversationId);
    }
  }
  
  // Create new thread
  console.log("[agentConnector] Creating new thread for conversation", { conversationId });
  const thread = await aiClient.agents.threads.create();
  conversationThreads.set(conversationId, { threadId: thread.id, lastUsed: now });
  
  return thread.id;
}

function redact(value: string | undefined): string {
  if (!value) return "<empty>";
  if (value.length <= 8) return "***"; // too short to safely show part
  return `${value.substring(0, 4)}***${value.substring(value.length - 4)}`;
}

function validateConfig(): string[] {
  const problems: string[] = [];
  if (!PROJECT_CONNECTION_STRING) problems.push("PROJECT_CONNECTION_STRING missing");
  if (!AGENT_ID) problems.push("AGENT_ID missing");
  if (!USERMSI_CLIENTID) problems.push("clientId (USER MSI) missing");
  return problems;
}

/**
 * Core function to talk to the AI Agent with conversation context management.
 */
export async function talkToAgent(userPrompt: string, userContext?: any): Promise<string> {
  const startTime = Date.now();
  const configIssues = validateConfig();
  if (configIssues.length) {
    console.error("[agentConnector] Configuration issues:", configIssues);
    return `Configuration error: ${configIssues.join(", ")}`;
  }

  const conversationId = getOrCreateConversationId(userContext);
  console.log("[agentConnector] Invoking agent", {
    endpoint: PROJECT_CONNECTION_STRING,
    agentId: redact(AGENT_ID),
    conversationId,
    userContext: userContext ? {
      userId: userContext.userId,
      userName: userContext.userName,
      isGroupConversation: userContext.isGroupConversation
    } : null,
    userPromptPreview: userPrompt.substring(0, 60),
  });

  try {
    const credential = new ManagedIdentityCredential(USERMSI_CLIENTID);
    const aiClient = AIProjectClient.fromEndpoint(PROJECT_CONNECTION_STRING, credential);

    // Get or create thread for this conversation
    const currentThreadId = await getOrCreateThread(aiClient, conversationId);
    console.log("[agentConnector] Using thread for conversation", { 
      conversationId, 
      threadId: currentThreadId 
    });

    // Enhanced user message with context
    let contextualPrompt = userPrompt;
    if (userContext?.userName && userContext.userName !== "User") {
      const contextInfo = userContext.isGroupConversation 
        ? `[User: ${userContext.userName} in group conversation]`
        : `[User: ${userContext.userName} in personal chat]`;
      contextualPrompt = `${contextInfo} ${userPrompt}`;
    }

    // Post user message
    console.log("[agentConnector] Posting user message to thread", { 
      threadId: currentThreadId,
      hasUserContext: !!userContext 
    });
    const userMessage = await aiClient.agents.messages.create(currentThreadId, "user", contextualPrompt);
    console.log("[agentConnector] User message posted", { messageId: userMessage.id });

    // Run agent with polling + basic timeout guard (in case library internal polling hangs)
    console.log("[agentConnector] Starting agent run...");
    const runPromise = aiClient.agents.runs.createAndPoll(currentThreadId, AGENT_ID, {
      pollingOptions: { intervalInMs: 1500 },
    });
    const timeoutPromise = new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error("Agent run timed out after 120s")), 120_000)
    );
    const runResult = await Promise.race([runPromise, timeoutPromise]);
    console.log("[agentConnector] Agent run completed", { 
      status: (runResult as any)?.status,
      runId: (runResult as any)?.id 
    });

    // Fetch messages AFTER run completion, get only the most recent ones
    console.log("[agentConnector] Fetching latest messages...");
    const messages = await aiClient.agents.messages.list(currentThreadId, { limit: 5 });
    
    let assistantText: string | null = null;
    let messageCount = 0;
    let assistantMessageCount = 0;
    
    // Messages are returned in reverse chronological order (newest first)
    // We want the most recent assistant message
    for await (const msg of messages) {
      messageCount++;
      console.log(`[agentConnector] Message ${messageCount}: role=${msg.role}, created=${msg.createdAt}, id=${msg.id}`);
      
      if (msg.role === "assistant" && msg.content?.length > 0) {
        assistantMessageCount++;
        if (!assistantText) { // Take the first (most recent) assistant message
          assistantText = msg.content
            .filter((c) => c.type === "text" && (c as any).text?.value)
            .map((c: any) => c.text.value)
            .join("\n");
          console.log("[agentConnector] Found latest assistant response", { 
            messageId: msg.id,
            contentLength: assistantText.length,
            preview: assistantText.substring(0, 100) + "..."
          });
        }
      }
    }
    
    console.log("[agentConnector] Message fetch summary", { 
      totalMessages: messageCount, 
      assistantMessages: assistantMessageCount,
      foundResponse: !!assistantText 
    });

    if (!assistantText) {
      console.warn("[agentConnector] No assistant response found for thread", { 
        threadId: currentThreadId,
        totalMessages: messageCount,
        assistantMessages: assistantMessageCount 
      });
      return "No assistant response found.";
    }

    const durationMs = Date.now() - startTime;
    console.log("[agentConnector] Success", { durationMs, chars: assistantText.length });
    return assistantText;
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    console.error("[agentConnector] Error invoking agent", {
      durationMs,
      error: err?.message || err,
      stack: err?.stack,
    });
    return `Agent error: ${err?.message || "Unknown error"}`;
  }
}
