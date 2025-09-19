# Teams Bot Deployment Script
param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "westeurope"
)

Write-Host "🚀 Deploying Teams Bot to Azure..." -ForegroundColor Green

# Step 1: Create resource group if it doesn't exist
Write-Host "📁 Ensuring resource group exists..." -ForegroundColor Yellow
az group create --name $ResourceGroupName --location $Location

# Step 2: Deploy infrastructure
Write-Host "🏗️  Deploying infrastructure..." -ForegroundColor Yellow
$deploymentResult = az deployment group create `
    --resource-group $ResourceGroupName `
    --template-file "infra/azure.bicep" `
    --parameters "infra/azure.parameters.json" `
    --output json | ConvertFrom-Json

if (!$deploymentResult) {
    Write-Error "Infrastructure deployment failed!"
    exit 1
}

# Extract outputs
$functionAppName = $deploymentResult.properties.outputs.functionAppName.value
$botId = $deploymentResult.properties.outputs.botId.value

Write-Host "✅ Infrastructure deployed successfully!" -ForegroundColor Green
Write-Host "   Function App: $functionAppName" -ForegroundColor Cyan
Write-Host "   Bot ID: $botId" -ForegroundColor Cyan

# Step 3: Deploy function code
Write-Host "📦 Deploying function app code..." -ForegroundColor Yellow
az functionapp deployment source config-zip `
    --name $functionAppName `
    --resource-group $ResourceGroupName `
    --src "functionapp-prod.zip"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Function app deployment failed!"
    exit 1
}

Write-Host "✅ Function app code deployed successfully!" -ForegroundColor Green

# Step 4: Verify deployment
Write-Host "🔍 Verifying deployment..." -ForegroundColor Yellow
$healthUrl = "https://$functionAppName.azurewebsites.net/api/health"
Write-Host "   Health endpoint: $healthUrl" -ForegroundColor Cyan

try {
    $healthResponse = Invoke-RestMethod $healthUrl -TimeoutSec 30
    if ($healthResponse.status -eq "healthy") {
        Write-Host "✅ Health check passed!" -ForegroundColor Green
    } else {
        Write-Warning "Health check returned: $($healthResponse.status)"
        Write-Host "Health details:" -ForegroundColor Yellow
        $healthResponse | ConvertTo-Json -Depth 4
    }
} catch {
    Write-Warning "Health check failed (this might be normal during initial startup): $($_.Exception.Message)"
}

# Step 5: Show next steps
Write-Host "`n🎉 Deployment Complete!" -ForegroundColor Green
Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Upload teams-app-package.zip to Teams (Apps → Upload custom app)"
Write-Host "   2. Install and chat with your bot"
Write-Host "   3. Monitor logs: az webapp log tail --name $functionAppName --resource-group $ResourceGroupName"
Write-Host "`n🔗 Useful URLs:" -ForegroundColor Cyan
Write-Host "   Function App: https://portal.azure.com/#@/resource/subscriptions/<sub>/resourceGroups/$ResourceGroupName/providers/Microsoft.Web/sites/$functionAppName"
Write-Host "   Health Check: $healthUrl"
Write-Host "   Bot Messages: https://$functionAppName.azurewebsites.net/api/messages"