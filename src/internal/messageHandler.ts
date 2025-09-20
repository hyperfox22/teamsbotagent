import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { teamsBot, teamsMessageBot } from "../teamsBot";
import { notificationApp } from "./initialize";

function logContext(context: Context, message: string, extra?: Record<string, any>) {
  context.log?.(message, extra || "");
  // Also mirror to console to surface in Azure logs reliably.
  console.log(`[messageHandler] ${message}`, extra || "");
}

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<any> {
  let status = 200;
  let return_body: unknown = null;
  const res = {
    status: (code: number) => {
      status = code;
      context.res.status = code;
    },
    send: (body: unknown) => {
      return_body = body;
    },
    setHeader: () => {},
    end: () => {},
  };
  try {
    logContext(context, "Incoming request", {
      method: req.method,
      url: req.url,
      hasBody: !!req.body,
      contentType: req.headers["content-type"],
    });

    await notificationApp.requestHandler(req, res, async (innerContext) => {
      try {
        await teamsBot.run(innerContext);
      } catch (e: any) {
        logContext(context, "teamsBot run error", { error: e?.message, stack: e?.stack });
      }
      try {
        await teamsMessageBot.run(innerContext as any);
      } catch (e: any) {
        logContext(context, "teamsMessageBot run error", { error: e?.message, stack: e?.stack });
      }
    });
  } catch (err: any) {
    status = 500;
    return_body = { error: err?.message || "Unhandled error" };
    logContext(context, "Top-level handler error", { error: err?.message, stack: err?.stack });
  } finally {
    logContext(context, "Request completed", { status });
  }
 
  context.res = {
    status,
    body: return_body,
  };
  return return_body;
};



export default httpTrigger;
