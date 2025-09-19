"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationApp = void 0;
const teamsfx_1 = require("@microsoft/teamsfx");
var ConversationBot = teamsfx_1.AgentBuilderCloudAdapter.ConversationBot;
// Create bot.
exports.notificationApp = new ConversationBot({
    // Enable notification
    notification: {
        enabled: true,
    },
});
//# sourceMappingURL=initialize.js.map