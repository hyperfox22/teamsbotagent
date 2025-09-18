import { AgentApplication, TurnContext } from "@microsoft/agents-hosting";
import { TeamsActivityHandler, TurnContext as BotTurnContext, MessageFactory } from "botbuilder";
import "botbuilder-core"
import { talkToAgent } from "./agentConnector";

export const teamsBot = new AgentApplication();

teamsBot.conversationUpdate("membersAdded", async (context: TurnContext) => {
  await context.sendActivity(
    "Welcome to the Notification Bot! I am designed to send you updates and alerts using Adaptive Cards triggered by HTTP post requests."
  );
});

class teamsMessageActivities extends TeamsActivityHandler {
  constructor() {
    super();

    // Handle messages
    this.onMessage(async (context: BotTurnContext, next) => {
      // Get the text the user typed
      let text = context.activity.text || "";

      // Remove the bot mention (if any)
      const mentions = BotTurnContext.getMentions(context.activity);
      if (mentions.length > 0) {
        mentions.forEach((mention) => {
          text = text.replace(mention.text, "").trim();
        });
      }

      // Echo back the message
      if (text) {
        const ai_response = await talkToAgent(text);
        await context.sendActivity(MessageFactory.text(`Azure Foundry AI Response: ${ai_response}`));
      } else {
        await context.sendActivity("Hi! Mention me with some text and I’ll echo it back.");
      }

      await next();
    });

  }
}

// Export instance
export const teamsMessageBot = new teamsMessageActivities();
