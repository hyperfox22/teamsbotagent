"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ACData = __importStar(require("adaptivecards-templating"));
const notification_default_json_1 = __importDefault(require("./adaptiveCards/notification-default.json"));
const initialize_1 = require("./internal/initialize");
const agentConnector_1 = require("./agentConnector");
const httpTrigger = async function (context, req) {
    const { prompt } = req.body || {};
    const pageSize = 100;
    let continuationToken = undefined;
    do {
        const pagedData = await initialize_1.notificationApp.notification.getPagedInstallations(pageSize, continuationToken);
        const installations = pagedData.data;
        continuationToken = pagedData.continuationToken;
        const ai_response = await (0, agentConnector_1.talkToAgent)(prompt);
        for (const target of installations) {
            await target.sendAdaptiveCard(new ACData.Template(notification_default_json_1.default).expand({
                $root: {
                    title: "New Event Occurred!",
                    appName: "Contoso App Notification",
                    description: `AI response: ${ai_response}`,
                    notificationUrl: "https://aka.ms/teamsfx-notification-new",
                },
            }));
            const channels = await target.channels();
            for (const channel of channels) {
                await channel.sendAdaptiveCard(new ACData.Template(notification_default_json_1.default).expand({
                    $root: {
                        title: "New Event Occurred!",
                        appName: "Contoso App Notification",
                        description: `Prompt: ${ai_response}`,
                        notificationUrl: "https://aka.ms/teamsfx-notification-new",
                    },
                }));
            }
        }
    } while (continuationToken);
    context.res = {};
};
exports.default = httpTrigger;
//# sourceMappingURL=httpTrigger.js.map