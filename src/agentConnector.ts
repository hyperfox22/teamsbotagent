import { AIProjectClient } from "@azure/ai-projects";
import { ManagedIdentityCredential } from "@azure/identity";
import * as dotenv from "dotenv";

dotenv.config();

const PROJECT_CONNECTION_STRING = process.env.PROJECT_CONNECTION_STRING || "";
const AGENT_ID = process.env.AGENT_ID || "";
const USERMSI_CLIENTID = process.env.clientId || "";

let conversationThreadId: string | null = null;

export async function talkToAgent(userPrompt: string): Promise<string> {
  const credential = new ManagedIdentityCredential(USERMSI_CLIENTID);
  const aiClient = AIProjectClient.fromEndpoint(PROJECT_CONNECTION_STRING, credential);

  // Reuse the same thread if it exists
  if (!conversationThreadId) {
    const thread = await aiClient.agents.threads.create();
    conversationThreadId = thread.id;
  }

  // Send user message
  await aiClient.agents.messages.create(conversationThreadId, "user", userPrompt);

  // Run the agent
  await aiClient.agents.runs.createAndPoll(conversationThreadId, AGENT_ID, {
    pollingOptions: { intervalInMs: 1500 },
  });

  // Fetch all messages so far
  const messages = await aiClient.agents.messages.list(conversationThreadId);

  for await (const msg of messages) {
    if (msg.role === "assistant" && msg.content?.length > 0) {
      return msg.content
        .filter((c) => c.type === "text" && (c as any).text?.value)
        .map((c: any) => c.text.value)
        .join("\n");
    }
  }

  return "No assistant response found.";
}
