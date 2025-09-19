import { AgentApplication } from "@microsoft/agents-hosting";
import { TeamsActivityHandler } from "botbuilder";
import "botbuilder-core";
export declare const teamsBot: AgentApplication<import("@microsoft/agents-hosting").TurnState<import("@microsoft/agents-hosting").DefaultConversationState, import("@microsoft/agents-hosting").DefaultUserState, import("@microsoft/agents-hosting").DefaultTempState, import("@microsoft/agents-hosting").DefaultSSOState>>;
declare class teamsMessageActivities extends TeamsActivityHandler {
    constructor();
}
export declare const teamsMessageBot: teamsMessageActivities;
export {};
