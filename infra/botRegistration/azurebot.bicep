@description('Base name used for resources in the bot registration module')
param resourceBaseName string

@maxLength(42)
param botDisplayName string

param botServiceName string = resourceBaseName
param botServiceSku string = 'F0'
param identityResourceId string
param identityClientId string
param identityTenantId string
param botAppDomain string
@description('Common tags to apply to bot resources')
param tags object = {}

// Register your web service as a bot with the Bot Framework
resource botService 'Microsoft.BotService/botServices@2021-03-01' = {
  name: botServiceName
  kind: 'azurebot'
  location: 'global'
  properties: {
    displayName: botDisplayName
    endpoint: 'https://${botAppDomain}/api/messages'
    msaAppId: identityClientId
    msaAppMSIResourceId: identityResourceId
    msaAppTenantId: identityTenantId
    msaAppType: 'UserAssignedMSI'
  }
  sku: {
    name: botServiceSku
  }
  tags: tags
}

// Connect the bot service to Microsoft Teams
resource botServiceMsTeamsChannel 'Microsoft.BotService/botServices/channels@2021-03-01' = {
  parent: botService
  location: 'global'
  name: 'MsTeamsChannel'
  properties: {
    channelName: 'MsTeamsChannel'
  }
}
