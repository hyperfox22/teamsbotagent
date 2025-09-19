import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { ManagedIdentityCredential } from "@azure/identity";
import { AIProjectClient } from "@azure/ai-projects";

const healthTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  const start = Date.now();
  const result: any = {
    timestamp: new Date().toISOString(),
    status: "unknown",
    checks: {},
    environment: {},
    errors: []
  };

  try {
    // Check environment variables
    const envVars = {
      PROJECT_CONNECTION_STRING: process.env.PROJECT_CONNECTION_STRING,
      AGENT_ID: process.env.AGENT_ID,
      clientId: process.env.clientId,
      FUNCTIONS_WORKER_RUNTIME: process.env.FUNCTIONS_WORKER_RUNTIME,
      AzureWebJobsStorage: process.env.AzureWebJobsStorage ? "***set***" : undefined
    };

    result.environment = Object.fromEntries(
      Object.entries(envVars).map(([key, value]) => [
        key, 
        value ? (key.includes('CONNECTION_STRING') || key.includes('Storage') ? "***set***" : 
                 value.length > 10 ? `${value.substring(0, 4)}***${value.substring(value.length - 4)}` : 
                 "***set***") : 
                "MISSING"
      ])
    );

    const missingVars = Object.entries(envVars).filter(([_, value]) => !value).map(([key, _]) => key);
    result.checks.environmentVariables = {
      status: missingVars.length === 0 ? "pass" : "fail",
      missing: missingVars
    };

    // Test Managed Identity Token Acquisition
    if (process.env.clientId) {
      try {
        const credential = new ManagedIdentityCredential(process.env.clientId);
        const token = await credential.getToken("https://cognitiveservices.azure.com/.default");
        result.checks.managedIdentity = {
          status: "pass",
          hasToken: !!token,
          expiresOn: token?.expiresOnTimestamp
        };
      } catch (err: any) {
        result.checks.managedIdentity = {
          status: "fail",
          error: err?.message || "Token acquisition failed"
        };
        result.errors.push(`MSI token error: ${err?.message}`);
      }
    } else {
      result.checks.managedIdentity = {
        status: "skip",
        reason: "clientId not configured"
      };
    }

    // Test AI Project Connection & optional Agent existence
    if (process.env.PROJECT_CONNECTION_STRING && process.env.clientId) {
      try {
        const credential = new ManagedIdentityCredential(process.env.clientId);
        const aiClient = AIProjectClient.fromEndpoint(process.env.PROJECT_CONNECTION_STRING, credential);

        result.checks.aiProjectConnection = {
          status: "pass",
          note: "Client created successfully"
        };

        // Optional: verify agent exists if AGENT_ID defined (best-effort, non-fatal on error)
        if (process.env.AGENT_ID) {
          try {
            const abortController = new AbortController();
            const t = setTimeout(() => abortController.abort(), 6000); // 6s ceiling
            let agent: any = undefined;
            try {
              // Attempt known method names (SDK versions may differ)
              if (typeof (aiClient as any).agents?.getAgent === 'function') {
                agent = await (aiClient as any).agents.getAgent(process.env.AGENT_ID, { abortSignal: abortController.signal });
              } else if (typeof (aiClient as any).agents?.get === 'function') {
                agent = await (aiClient as any).agents.get(process.env.AGENT_ID, { abortSignal: abortController.signal });
              } else {
                result.checks.agentLookup = { status: "skip", reason: "No getAgent method in SDK version" };
              }
            } catch (fetchErr: any) {
              throw fetchErr;
            }
            if (agent) {
              result.checks.agentLookup = {
                status: "pass",
                returnedId: agent?.id,
                model: agent?.model || (agent as any)?.model,
              };
            }
            clearTimeout(t);
            result.checks.agentLookup = {
              status: agent ? "pass" : "fail",
              returnedId: agent?.id,
              model: (agent as any)?.model,
            };
          } catch (innerErr: any) {
            result.checks.agentLookup = {
              status: "warn",
              error: innerErr?.name === 'AbortError' ? 'agent lookup timed out' : (innerErr?.message || 'lookup failed')
            };
          }
        } else {
          result.checks.agentLookup = { status: "skip", reason: "AGENT_ID not set" };
        }
      } catch (err: any) {
        result.checks.aiProjectConnection = {
          status: "fail",
          error: err?.message || "Client creation failed"
        };
        result.errors.push(`AI Project connection error: ${err?.message}`);
      }
    } else {
      result.checks.aiProjectConnection = {
        status: "skip",
        reason: "PROJECT_CONNECTION_STRING or clientId missing"
      };
    }

    // Overall status
    const allChecks = Object.values(result.checks).filter((check: any) => check.status !== "skip");
    const failedChecks = allChecks.filter((check: any) => check.status === "fail");
    result.status = failedChecks.length === 0 ? "healthy" : "unhealthy";
    
  } catch (err: any) {
    result.status = "error";
    result.errors.push(`Health check error: ${err?.message}`);
  }

  result.durationMs = Date.now() - start;

  context.res = {
    status: result.status === "healthy" ? 200 : 500,
    headers: {
      "Content-Type": "application/json"
    },
    body: result
  };
};

export default healthTrigger;