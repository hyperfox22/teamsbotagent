import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import * as ACData from "adaptivecards-templating";
import notificationTemplate from "./adaptiveCards/notification-default.json";
import { notificationApp } from "./internal/initialize";
import { talkToAgent } from "./agentConnector";

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  context.log("[httpTrigger] 1-1 Notification request received", {
    method: req.method,
    body: req.body ? JSON.stringify(req.body) : 'no body'
  });

  const { 
    subject, 
    body, 
    prompt, 
    userId, 
    userEmail, 
    userName
  } = req.body || {};

  // Prepare notification data
  let notificationData;
  
  if (subject && body) {
    // Structured format
    context.log("[httpTrigger] Processing structured notification", { subject });
    const htmlContent = body.contentType === 'html' ? body.content : (typeof body === 'string' ? body : body.content || '');
    const plainTextContent = (htmlContent || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
      .replace(/<[^>]*>/g, '')
      .trim();
    
    const urlMatch = (htmlContent || '').match(/href=['"]([^'"]*)['"]/i);
    const actionUrl = urlMatch ? urlMatch[1] : '';
    
    notificationData = {
      subject: subject,
      bodyContent: plainTextContent,
      actionTitle: actionUrl ? "View Details" : "Open HyperSOC",
      actionUrl: actionUrl || "https://socportal.hyperSOC.com"
    };
  } else if (prompt) {
    // AI agent prompt
    context.log("[httpTrigger] Processing prompt notification", { prompt });
    const ai_response = await talkToAgent(prompt);
    notificationData = {
      subject: "AI Agent Response",
      bodyContent: ai_response,
      actionTitle: "Learn More",
      actionUrl: "https://socportal.hyperSOC.com"
    };
  } else {
    context.log.error("[httpTrigger] Invalid request body - missing subject/body or prompt");
    context.res = {
      status: 400,
      body: { error: "Either 'subject' and 'body' or 'prompt' must be provided" }
    };
    return;
  }

  // Add user mention if specified
  if (userName) {
    notificationData.subject = `@${userName} ${notificationData.subject}`;
    notificationData.bodyContent = `Hi @${userName},\n\n${notificationData.bodyContent}`;
  }

  context.log("[httpTrigger] Sending to personal installations only");

  const pageSize = 100;
  let continuationToken: string | undefined = undefined;
  let totalInstallations = 0;
  let successfulNotifications = 0;
  let failedNotifications = 0;
  
  context.log(`[httpTrigger] Starting 1-1 notification process`);

  do {
    const pagedData = await notificationApp.notification.getPagedInstallations(
      pageSize,
      continuationToken
    );
    const installations = pagedData.data;
    continuationToken = pagedData.continuationToken;
    totalInstallations += installations.length;

    context.log(`[httpTrigger] Processing ${installations.length} installations for 1-1 messaging`);

    for (const target of installations) {
      context.log(`[httpTrigger] Processing installation type: ${target.type}`);
      
      // Send to personal installations only (1-1 chats)
      try {        
        await target.sendAdaptiveCard(
          new ACData.Template(notificationTemplate).expand({
            $root: notificationData
          })
        );
        successfulNotifications++;
        context.log(`[httpTrigger] Successfully sent 1-1 notification to installation (${target.type})`);
      } catch (error) {
        failedNotifications++;
        context.log.error(`[httpTrigger] Failed to send 1-1 notification:`, error.message);
      }
    }
  } while (continuationToken);

  const summary = {
    notificationType: '1-1',
    totalInstallations,
    successfulNotifications,
    failedNotifications,
    userInfo: { userId, userEmail, userName },
    notificationData
  };

  context.log(`[httpTrigger] 1-1 Notification complete`, summary);

  context.res = {
    status: 200,
    body: summary
  };
};

export default httpTrigger;
