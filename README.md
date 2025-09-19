# SOCBot - AI-Powered Security Operations Teams Bot

> **HyperSOC Project for Hackathon2025**  
> An intelligent Teams bot that integrates AI agents with security operations, providing both 1-1 personal notifications and targeted channel messaging for security teams.

## 🚀 Overview

SOCBot is a comprehensive Microsoft Teams notification and AI agent bot designed for security operations centers. It combines the power of Azure AI agents with Teams messaging to deliver intelligent security insights and notifications through multiple channels.

### ✨ Key Features

- **🤖 AI Agent Integration**: Powered by Azure AI Foundry with persistent conversation threads
- **📱 Dual Notification System**: Separate endpoints for personal 1-1 messages and targeted channel notifications  
- **🔒 Security-Focused**: Built for security operations with threat analysis capabilities
- **⚡ Multiple Triggers**: HTTP triggers, Logic Apps integration, and programmatic access
- **🎯 Smart Targeting**: Send notifications to specific channels, users, or broadcast to all installations
- **📊 Comprehensive Diagnostics**: Built-in health checks and installation monitoring
- **🔧 Parameterized Infrastructure**: Environment-specific deployments with Azure Bicep

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Logic Apps    │    │  External APIs  │    │   Timer/Cron    │
│   Workflows     │    │   & Webhooks    │    │   Schedules     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                 Azure Functions Host                        │
    │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
    │  │/api/        │ │/api/channel-│ │/api/diagnostics     │   │
    │  │notification │ │notification │ │/api/health          │   │
    │  │(1-1 msgs)   │ │(channels)   │ │/api/user-message    │   │
    │  └─────────────┘ └─────────────┘ └─────────────────────┘   │
    └─────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
    ┌─────────────────────────────────────────────────────────────┐
    │               Teams Bot Framework                           │
    │  ┌─────────────────┐    ┌─────────────────────────────┐    │
    │  │  Agent Connector│    │     Teams Installations     │    │
    │  │  (AI Foundry)   │    │  • Personal Chats          │    │
    │  │                 │    │  • Team Channels           │    │
    │  └─────────────────┘    └─────────────────────────────┘    │
    └─────────────────────────────────────────────────────────────┘
```

## 🔧 API Endpoints

### **1-1 Personal Notifications** (`POST /api/notification`)
```json
{
  "subject": "Security Alert",
  "body": {
    "contentType": "html", 
    "content": "Critical security incident detected"
  },
  "userName": "john.doe"  // Optional: adds @mention
}
```

### **Channel Notifications** (`POST /api/channel-notification`)
```json
{
  "channelUrl": "https://teams.microsoft.com/l/channel/19%3A...",
  "subject": "Team Alert",
  "body": {
    "contentType": "html",
    "content": "Security team notification"
  }
}
```

### **AI Agent Prompts** (Both endpoints support)
```json
{
  "prompt": "What are the top security threats this week?"
}
```

### **Diagnostics & Health**
- `GET /api/diagnostics` - Bot installation and channel access analysis
- `GET /api/health` - Environment validation and MSI token testing

## 🛠️ Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (versions 18, 20, 22)
- [Microsoft 365 account for development](https://docs.microsoft.com/microsoftteams/platform/toolkit/accounts)
- [Microsoft 365 Agents Toolkit](https://aka.ms/teams-toolkit) v5.0.0+
- Azure subscription for AI Foundry and Function Apps

### Local Development

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd teamsbotagent
   npm install
   ```

2. **Configure Environment**
   ```bash
   # Copy environment template
   cp env/.env.local.user.example env/.env.local.user
   
   # Update with your values:
   # - PROJECT_CONNECTION_STRING (Azure AI Foundry)
   # - AGENT_ID (AI Agent ID)
   # - MicrosoftAppId, MicrosoftAppPassword (Bot registration)
   ```

3. **Start Development Server**
   ```bash
   # Start local Functions host
   npm run dev
   
   # Or with TeamsFx debugging
   npm run dev:teamsfx
   ```

4. **Debug in Teams**
   - Press F5 in VS Code
   - Select "Debug in Teams (Edge/Chrome)"
   - Install the app when Teams launches

### Production Deployment

1. **Deploy Infrastructure**
   ```bash
   # Deploy Azure resources
   az deployment group create --resource-group <rg-name> \
     --template-file infra/azure.bicep \
     --parameters @infra/azure.parameters.json
   ```

2. **Deploy Function App**
   - Use `socagent-complete-endpoints.zip` (includes all endpoints)
   - Upload via Azure Portal or Azure CLI

3. **Deploy Teams App**
   - Use `socbot-fixed-manifest.zip` 
   - Upload via Teams Admin Center or direct installation

## 📁 Project Structure

### Core Application Files
```
├── src/
│   ├── httpTrigger.ts              # 1-1 personal notifications
│   ├── channelNotifier.ts          # Channel-specific messaging  
│   ├── agentConnector.ts           # AI agent integration
│   ├── teamsBot.ts                 # Teams bot message handling
│   ├── diagnostics.ts              # Health & installation checks
│   └── adaptiveCards/
│       └── notification-default.json
```

### Function Configurations
```
├── messageHandler/function.json     # Teams bot protocol
├── notifyHttpTrigger/function.json  # 1-1 notifications
├── channelNotifier/function.json    # Channel notifications
├── healthTrigger/function.json      # Health diagnostics
└── host.json                       # Azure Functions runtime
```

### Infrastructure & Deployment
```
├── infra/
│   ├── azure.bicep                 # Main infrastructure
│   ├── azure.parameters.json       # Environment parameters
│   └── botRegistration/
├── appPackage/
│   ├── manifest.json               # Teams app manifest
│   ├── bot.png                     # Custom bot icon
│   └── outline.png
```

## 🤖 AI Agent Features

### **Persistent Conversations**
- Thread management with 30-minute expiry
- User context preservation across interactions
- Enhanced prompts with user identity and conversation type

### **Security Intelligence**
- Threat analysis and recommendations
- Security operations guidance
- Integration with security data sources

### **User Mentions in Group Chats**
- Automatic @mention of users who interact with bot in channels
- Context-aware responses based on conversation type

## 🎯 Advanced Features

### **Teams Channel Integration**
- **URL Parsing**: Extract channel IDs from Teams URLs
- **Thread Targeting**: Send messages to specific conversation threads
- **Permission Management**: Handle channel access and bot permissions

### **Logic Apps Integration**
- **JSON Parsing**: Robust handling of Logic Apps payloads
- **Error Recovery**: Graceful degradation with detailed error messages
- **Webhook Support**: Direct integration with external monitoring systems

### **Diagnostic Capabilities**
- **Installation Analysis**: Check bot installations and permissions
- **Channel Discovery**: Enumerate accessible channels and their status
- **Health Monitoring**: Environment validation and dependency checks
- **Token Testing**: Managed Identity credential validation

## 🔒 Security & Authentication

### **Managed Identity**
- Single User-Assigned Managed Identity (UAMI) pattern
- Seamless Azure AI Foundry authentication
- No stored credentials or connection strings

### **Bot Framework Security**
- Microsoft App ID/Password authentication
- Teams-specific scopes: personal, team, groupChat
- Secure message handling and validation

## 🌍 Multi-Environment Support

### **Environment Parameters**
```json
{
  "prefix": "socai",
  "environment": "prod|dev",
  "workload": "bot", 
  "instance": "eus|weu",
  "region": "eastus|westeurope",
  "aiProjectConnectionString": "...",
  "aiAgentId": "asst_..."
}
```

### **Dynamic Resource Naming**
- Consistent naming: `{prefix}-{environment}-{workload}-{instance}`
- Environment-specific tagging
- Region-aware deployments

## 📊 Monitoring & Diagnostics

### **Built-in Health Checks**
- Environment variable validation
- AI agent connectivity testing  
- Teams installation verification
- Managed Identity token validation

### **Logging & Telemetry**
- Structured logging with context
- Request/response tracking
- Error categorization and reporting
- Performance monitoring

## 🔧 Customization Guide

### **Adding New Notification Types**
1. Create new trigger function in `src/`
2. Add function.json configuration
3. Register route in Azure Functions
4. Update deployment packages

### **Extending AI Capabilities**
1. Modify `agentConnector.ts` for new AI features
2. Update conversation thread management
3. Enhance user context handling
4. Add new prompt templates

### **Custom Adaptive Cards**
1. Design cards using [Adaptive Card Designer](https://adaptivecards.io/designer/)
2. Add templates to `src/adaptiveCards/`
3. Create data models for card binding
4. Update notification logic

## 🚀 Deployment Packages

### **Production Ready**
- **`socagent-complete-endpoints.zip`** (97MB) - Complete Function App
- **`socbot-fixed-manifest.zip`** (20KB) - Teams App with fixed manifest

### **Deployment Methods**
1. **Azure Portal**: Direct zip upload to Function App
2. **Azure CLI**: Automated deployment scripts
3. **CI/CD Pipelines**: GitHub Actions integration
4. **Teams Admin**: Teams app package deployment

## 🏆 Hackathon Project Details

**Project**: HyperSOC - AI-Enhanced Security Operations  
**Developer**: Ferdi Tancio  
**Event**: Hackathon2025  
**Focus**: Intelligent security operations with AI-powered Teams integration

### **Key Innovations**
- Separated notification architecture for different use cases
- Persistent AI conversation threads with context preservation
- Logic Apps integration for automated security workflows
- Comprehensive diagnostic capabilities for operational excellence

## 📚 Additional Resources

- [Microsoft 365 Agents Toolkit Documentation](https://docs.microsoft.com/microsoftteams/platform/toolkit/teams-toolkit-fundamentals)
- [Azure AI Foundry Documentation](https://learn.microsoft.com/en-us/azure/ai-services/)
- [Teams Bot Framework](https://docs.microsoft.com/en-us/microsoftteams/platform/bots/what-are-bots)
- [Adaptive Cards Documentation](https://adaptivecards.io/)
- [Azure Functions Documentation](https://docs.microsoft.com/en-us/azure/azure-functions/)

## 🤝 Contributing

This project is part of Hackathon2025. For questions or collaboration opportunities, please reach out through the hackathon platform.

---

**Built with ❤️ for security operations teams using Microsoft 365 Agents Toolkit, Azure AI, and Teams Platform.**
