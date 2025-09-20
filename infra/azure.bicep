// -----------------------------
// Naming & Environment Parameters
// -----------------------------
@description('Short organizational or solution prefix (e.g. acme)')
param prefix string

@description('Deployment environment moniker (e.g. dev, test, prod, play)')
param environment string

@description('Workload identifier segment (default: bot)')
@maxLength(10)
param workload string = 'bot'

@description('Optional instance/region code segment appended to name (e.g. weu, 01). Leave empty for none.')
@maxLength(8)
param instance string = ''

@description('Azure region for all regional resources')
param region string

// -----------------------------
// Functional Parameters
// -----------------------------
@description('Azure Functions SKU (e.g. B1, Y1 for consumption)')
param functionAppSKU string

@description('Bot display name shown in Teams.')
@maxLength(42)
param botDisplayName string

@description('Bot Service pricing SKU (default F0)')
param botServiceSku string = 'F0'

// -----------------------------
// AI Agent Parameters
// -----------------------------
@description('Azure AI Project connection string used by the Agent SDK')
@secure()
param aiProjectConnectionString string

@description('Azure AI Agent Id to invoke')
param aiAgentId string

// -----------------------------
// Tagging
// -----------------------------
@description('Common resource tags (e.g. {"env":"dev","owner":"team-x"})')
param tags object = {}

// -----------------------------
// Derived Naming
// -----------------------------
// Build base name sequentially ensuring no duplicate separators
var segPrefix = toLower(replace(prefix, ' ', ''))
var segEnv = toLower(environment)
var segWorkload = toLower(workload)
var segInstance = empty(instance) ? '' : toLower(instance)
var composed = empty(segInstance) ? '${segPrefix}-${segEnv}-${segWorkload}' : '${segPrefix}-${segEnv}-${segWorkload}-${segInstance}'
// Enforce maximum length 20
var truncated = substring(composed, 0, min(length(composed), 20))
// Ensure >=4 chars by padding from workload if truncated too short
var padded = length(truncated) < 4 ? substring('${truncated}${segWorkload}xxxx', 0, 4) : truncated
var resourceBaseName = padded

// Individual resource names (as variables to allow referencing computed base name)
var serverfarmsName = resourceBaseName
var functionAppName = resourceBaseName
var identityName = resourceBaseName

// Backwards compatibility note: previous template accepted resourceBaseName directly. Now it is computed.
// Region parameter drives all locations (Bot service remains global inside module).
var location = region

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
  tags: union(tags, {
    env: environment
    workload: workload
  })
}

// Compute resources for your Web App
resource serverfarm 'Microsoft.Web/serverfarms@2021-02-01' = {
  name: serverfarmsName
  location: location
  kind: 'functionapp'
  sku: {
    name: functionAppSKU
  }
  properties: {}
  tags: union(tags, {
    env: environment
    workload: workload
  })
}

// Azure Function that host your app
resource functionApp 'Microsoft.Web/sites@2021-02-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp'
  properties: {
    serverFarmId: serverfarm.id
    httpsOnly: true
    siteConfig: {
      alwaysOn: true
      appSettings: [
        // Runtime & platform
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~22'
        }
        // Identity exposure to app
        {
          name: 'clientId'
          value: identity.properties.clientId
        }
        {
          name: 'tenantId'
          value: identity.properties.tenantId
        }
        // AI Agent configuration
        {
          name: 'PROJECT_CONNECTION_STRING'
          value: aiProjectConnectionString
        }
        {
          name: 'AGENT_ID'
          value: aiAgentId
        }
        // Bot Framework authentication (using Managed Identity)
        {
          name: 'MicrosoftAppId'
          value: identity.properties.clientId
        }
        {
          name: 'MicrosoftAppType'
          value: 'UserAssignedMSI'
        }
        {
          name: 'MicrosoftAppTenantId'
          value: identity.properties.tenantId
        }
        // Operational flags
        {
          name: 'RUNNING_ON_AZURE'
          value: '1'
        }
        {
          name: 'SCM_ZIPDEPLOY_DONOT_PRESERVE_FILETIME'
          value: '1'
        }
      ]
      ftpsState: 'FtpsOnly'
    }
  }
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  tags: union(tags, {
    env: environment
    workload: workload
  })
}

// Register your web service as a bot with the Bot Framework
module azureBotRegistration './botRegistration/azurebot.bicep' = {
  name: 'Azure-Bot-registration'
  params: {
    resourceBaseName: resourceBaseName
    identityClientId: identity.properties.clientId
    identityResourceId: identity.id
    identityTenantId: identity.properties.tenantId
    botAppDomain: functionApp.properties.defaultHostName
    botDisplayName: botDisplayName
    botServiceSku: botServiceSku
    tags: union(tags, {
      env: environment
      workload: workload
    })
  }
}

output BOT_DOMAIN string = functionApp.properties.defaultHostName
output BOT_AZURE_FUNCTION_APP_RESOURCE_ID string = functionApp.id
output BOT_FUNCTION_ENDPOINT string = 'https://${functionApp.properties.defaultHostName}'
output BOT_ID string = identity.properties.clientId
output BOT_TENANT_ID string = identity.properties.tenantId
output MANAGED_IDENTITY_PRINCIPAL_ID string = identity.properties.principalId
output BASE_NAME string = resourceBaseName
