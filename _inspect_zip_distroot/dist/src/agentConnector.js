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
Object.defineProperty(exports, "__esModule", { value: true });
exports.talkToAgent = void 0;
const ai_projects_1 = require("@azure/ai-projects");
const identity_1 = require("@azure/identity");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const PROJECT_CONNECTION_STRING = process.env.PROJECT_CONNECTION_STRING || "";
const AGENT_ID = process.env.AGENT_ID || "";
const USERMSI_CLIENTID = process.env.clientId || "";
let conversationThreadId = null;
async function talkToAgent(userPrompt) {
    var _a;
    const credential = new identity_1.ManagedIdentityCredential(USERMSI_CLIENTID);
    const aiClient = ai_projects_1.AIProjectClient.fromEndpoint(PROJECT_CONNECTION_STRING, credential);
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
        if (msg.role === "assistant" && ((_a = msg.content) === null || _a === void 0 ? void 0 : _a.length) > 0) {
            return msg.content
                .filter((c) => { var _a; return c.type === "text" && ((_a = c.text) === null || _a === void 0 ? void 0 : _a.value); })
                .map((c) => c.text.value)
                .join("\n");
        }
    }
    return "No assistant response found.";
}
exports.talkToAgent = talkToAgent;
//# sourceMappingURL=agentConnector.js.map