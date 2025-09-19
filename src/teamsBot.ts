import { AgentApplication, TurnContext } from "@microsoft/agents-hosting";
import { TeamsActivityHandler, TurnContext as BotTurnContext, MessageFactory } from "botbuilder";
import "botbuilder-core"
import { talkToAgent } from "./agentConnector";

export const teamsBot = new AgentApplication();

teamsBot.conversationUpdate("membersAdded", async (context: TurnContext) => {
  await context.sendActivity(
    "Welcome to HyperSOC AI Assistant! I'm your intelligent security operations companion, powered by advanced AI agents that help analyze threats, investigate incidents, and provide security insights. Ask me anything about your security posture or threat landscape."
  );
});

class teamsMessageActivities extends TeamsActivityHandler {
  constructor() {
    super();

    // Handle messages
    this.onMessage(async (context: BotTurnContext, next) => {
      try {
        // Get the text the user typed
        let text = context.activity.text || "";

        // Remove the bot mention (if any)
        const mentions = BotTurnContext.getMentions(context.activity);
        if (mentions.length > 0) {
          mentions.forEach((mention) => {
            text = text.replace(mention.text, "").trim();
          });
        }

        // Get user info for mentioning back
        const userName = context.activity.from?.name || "User";
        const userId = context.activity.from?.id;
        
        // Check if this is a group/channel conversation
        const isGroupConversation = context.activity.conversation?.conversationType !== 'personal';
        
        if (text && text.trim().length > 0) {
          console.log(`[teamsBot] Processing message: "${text}" from user: ${userName}`);
          
          try {
            // Prepare conversation context for the agent
            const userContext = {
              conversationId: context.activity.conversation?.id,
              channelId: context.activity.channelId,
              userId: userId,
              userName: userName,
              isGroupConversation: isGroupConversation
            };
            
            const ai_response = await talkToAgent(text, userContext);
            console.log(`[teamsBot] AI response received: "${ai_response}"`);
            
            // Format response based on conversation type
            let messageActivity;
            if (isGroupConversation && userId && userName !== "User") {
              // Group/channel: mention the user
              const fullResponse = `<at>${userName}</at> ${ai_response}`;
              messageActivity = MessageFactory.text(fullResponse);
              messageActivity.entities = [
                {
                  type: "mention",
                  text: `<at>${userName}</at>`,
                  mentioned: {
                    id: userId,
                    name: userName
                  }
                }
              ];
            } else {
              // Personal chat: no mention needed
              messageActivity = MessageFactory.text(ai_response);
            }
            await context.sendActivity(messageActivity);
          } catch (aiError: any) {
            console.error(`[teamsBot] AI agent error: ${aiError?.message}`);
            const errorMsg = isGroupConversation && userId && userName !== "User" 
              ? `<at>${userName}</at> I'm having trouble connecting to the AI service right now. Please try again later. Error: ${aiError?.message || 'Unknown error'}`
              : `I'm having trouble connecting to the AI service right now. Please try again later. Error: ${aiError?.message || 'Unknown error'}`;
            await context.sendActivity(MessageFactory.text(errorMsg));
          }
        } else {
          const helpMsg = isGroupConversation && userId && userName !== "User"
            ? `<at>${userName}</at> Hi! Please ask me a question about security operations and I'll help you with AI-powered insights.`
            : "Hi! Please ask me a question about security operations and I'll help you with AI-powered insights.";
          await context.sendActivity(MessageFactory.text(helpMsg));
        }
      } catch (error: any) {
        console.error(`[teamsBot] Message handling error: ${error?.message}`, error);
        await context.sendActivity(MessageFactory.text("Sorry, I encountered an error processing your message. Please try again."));
      }

      await next();
    });

  }
}

// Export instance
export const teamsMessageBot = new teamsMessageActivities();
