import { AgentBuilderCloudAdapter } from "@microsoft/teamsfx";
import ConversationBot = AgentBuilderCloudAdapter.ConversationBot;

console.log("[initialize] Bot Framework Configuration:");
console.log("MicrosoftAppId:", process.env.MicrosoftAppId ? "SET" : "MISSING");
console.log("MicrosoftAppPassword:", process.env.MicrosoftAppPassword ? "SET" : "MISSING");
console.log("MicrosoftAppType:", process.env.MicrosoftAppType || "MISSING");
console.log("MicrosoftAppTenantId:", process.env.MicrosoftAppTenantId ? "SET" : "MISSING");

// Create bot.
export const notificationApp = new ConversationBot({
  // Enable notification
  notification: {
    enabled: true,
  },
});
