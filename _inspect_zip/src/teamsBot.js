"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teamsMessageBot = exports.teamsBot = void 0;
const agents_hosting_1 = require("@microsoft/agents-hosting");
const botbuilder_1 = require("botbuilder");
require("botbuilder-core");
const agentConnector_1 = require("./agentConnector");
exports.teamsBot = new agents_hosting_1.AgentApplication();
exports.teamsBot.conversationUpdate("membersAdded", async (context) => {
    await context.sendActivity("Welcome to the Notification Bot! I am designed to send you updates and alerts using Adaptive Cards triggered by HTTP post requests.");
});
class teamsMessageActivities extends botbuilder_1.TeamsActivityHandler {
    constructor() {
        super();
        // Handle messages
        this.onMessage(async (context, next) => {
            // Get the text the user typed
            let text = context.activity.text || "";
            // Remove the bot mention (if any)
            const mentions = botbuilder_1.TurnContext.getMentions(context.activity);
            if (mentions.length > 0) {
                mentions.forEach((mention) => {
                    text = text.replace(mention.text, "").trim();
                });
            }
            // Echo back the message
            if (text) {
                const ai_response = await (0, agentConnector_1.talkToAgent)(text);
                await context.sendActivity(botbuilder_1.MessageFactory.text(`Azure Foundry AI Response: ${ai_response}`));
            }
            else {
                await context.sendActivity("Hi! Mention me with some text and I’ll echo it back.");
            }
            await next();
        });
    }
}
// Export instance
exports.teamsMessageBot = new teamsMessageActivities();
//# sourceMappingURL=teamsBot.js.map