## Quick orientation — what this project is

This repo is a Teams notification bot built with the Microsoft 365 Agents / TeamsFx SDK and hosted as Azure Functions. Key responsibilities:
- receive triggers (HTTP or Timer) in `src/*Trigger.ts` (see `src/httpTrigger.ts`)
- call an AI agent (see `src/agentConnector.ts`) and use the response in Adaptive Cards (`src/adaptiveCards/notification-default.json`)
- host bot endpoints via Azure Functions (bindings in `messageHandler/function.json` and `notifyHttpTrigger/function.json`) and TeamsFx adapter (`src/internal/initialize.ts`).

## Big-picture architecture
- Triggers: HTTP/Timer Azure Functions under root (files named `*Trigger.ts`) invoke the notification flow (`src/httpTrigger.ts`).
- Notification service: `notificationApp` (from `src/internal/initialize.ts`) manages installations and sending adaptive cards.
- Bot handlers: `teamsBot` (agent-hosting handlers) and `teamsMessageBot` (a `TeamsActivityHandler` class in `src/teamsBot.ts`) are wired in `src/internal/messageHandler.ts`.
- AI integration: `src/agentConnector.ts` uses `@azure/ai-projects` + `ManagedIdentityCredential` to run an Agent and returns text used in cards/messages.

Read these files first for context: `README.md`, `package.json`, `src/httpTrigger.ts`, `src/agentConnector.ts`, `src/teamsBot.ts`, `src/internal/*`.

## Developer workflows (run/build/debug)
- Local dev server (Azure Functions + Teams Toolkit):
  - npm run dev  -> starts Functions host (port 3978) using `func start` (TypeScript worker). See `package.json`.
  - npm run dev:teamsfx and related `dev:teamsfx:*` scripts use `env-cmd` to load `.localConfigs` env files when running via Teams Toolkit.
- Build: `npm run build` (runs `tsc` and copies `src/adaptiveCards` to `dist/src`).
- Watch/compile: `npm run watch` or `npm run watch:teamsfx`.
- Storage emulator (Azurite): `npm run prepare-storage:teamsfx` starts Azurite using the `_storage_emulator` folder.

Debug tips
- Port: local Functions default port = 3978 (matches Teams debug experience). Use VS Code Teams Toolkit F5 (`Debug in Teams (Edge/Chrome)`) or attach the debugger to the TypeScript worker (inspect port 9239 used in `dev` script).
- Env files: local secrets and values live in `env/` and `.localConfigs` (scripts use `env-cmd -f .localConfigs`). When running via Teams Toolkit follow its local env wiring.

## Project-specific conventions & patterns
- Function binding naming: a function implementation file `src/<name>Trigger.ts` is paired with `/<name>Trigger/function.json` in the repo root. Edit both when adding a trigger.
- Adaptive cards: templates live under `src/adaptiveCards/` and are copied to `dist/src` by the build step — changes to JSON require rebuild to appear in `dist`.
- Agent usage: `talkToAgent(prompt)` in `src/agentConnector.ts` creates/uses a single conversation thread (`conversationThreadId`) and polls `agents.runs.createAndPoll`. Treat the returned string as the assistant summary (the calling code concatenates it into card `description`).
- Two bot entry points: `teamsBot` for agent-hosting conversation events and `teamsMessageBot` (an instance of `TeamsActivityHandler`) for message handling and echoes.

## Integration points & env vars
- Azure/Agent config (in `src/agentConnector.ts`):
  - PROJECT_CONNECTION_STRING -> AI Project endpoint (used with `AIProjectClient.fromEndpoint`)
  - AGENT_ID -> agent id passed to runs.createAndPoll
  - clientId (ENV key `clientId`) -> user MSI client id for `ManagedIdentityCredential`
- Functions runtime config: `local.settings.json` controls Function app settings locally.
- Teams app manifest and packaging: `appPackage/` and `m365agents.yml` / `m365agents.local.yml` control TeamsFx lifecycle and local overrides — change only when modifying packaging or deployment.

## Where to change common scenarios (examples)
- To change what the HTTP trigger sends: edit `src/httpTrigger.ts` (it calls `notificationApp.notification.getPagedInstallations` and `target.sendAdaptiveCard(...)`).
- To change card layout: edit `src/adaptiveCards/notification-default.json` and rebuild.
- To modify AI prompt flow: edit `src/agentConnector.ts` (note the function polls runs and then reads assistant messages).
- To add a new Azure Function trigger: add `src/myNewTrigger.ts` and a corresponding `myNewTrigger/function.json` binding file.

## Quick safety notes
- Do not commit secrets — check `.gitignore` and local env files under `env/` and `.localConfigs`.
- `m365agents.local.yml` is used for local debugging; prefer editing local override for experimentation.
