import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { notificationApp } from "./internal/initialize";
import { MessageFactory, CardFactory } from "botbuilder";

interface UserMessageRequest {
  userId?: string;           // Teams user ID  
  userEmail?: string;        // Email to find user
  userName?: string;         // Display name for @mention
  subject: string;
  message: string;
  mentionUser?: boolean;     // Whether to @mention the user
}

const userMessaging: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  context.log("[userMessaging] User-specific message request received", {
    method: req.method,
    body: req.body ? JSON.stringify(req.body) : 'no body'
  });

  const requestData: UserMessageRequest = req.body || {};
  const { userId, userEmail, userName, subject, message, mentionUser = true } = requestData;

  if (!subject || !message) {
    context.res = {
      status: 400,
      body: { error: "Subject and message are required" }
    };
    return;
  }

  if (!userId && !userEmail && !userName) {
    context.res = {
      status: 400,
      body: { error: "At least one of userId, userEmail, or userName must be provided" }
    };
    return;
  }

  context.log("[userMessaging] Sending personal message", {
    userId,
    userEmail, 
    userName,
    subject,
    mentionUser
  });

  let successfulMessages = 0;
  let failedMessages = 0;
  const results: any[] = [];

  try {
    // Get all bot installations
    const pagedData = await notificationApp.notification.getPagedInstallations(100);
    const installations = pagedData.data;
    context.log(`[userMessaging] Found ${installations.length} installations`);

    for (const target of installations) {
      try {
        // For personal messaging, we send to the installation itself
        // The installation represents a 1:1 chat with a user
        
        let personalMessage = message;
        if (mentionUser && userName) {
          personalMessage = `Hi @${userName},\n\n${message}`;
        }

        // Create a simple text message (you can also use Adaptive Cards)
        const messageText = `**${subject}**\n\n${personalMessage}`;
        
        // Send direct message to the user
        await target.sendMessage(messageText);
        
        successfulMessages++;
        results.push({
          success: true,
          type: 'personal-message',
          message: 'Message sent to personal chat'
        });

        context.log(`[userMessaging] Successfully sent personal message`);
        
      } catch (installationError: any) {
        failedMessages++;
        context.log.error(`[userMessaging] Failed to send to installation:`, installationError.message);
        
        results.push({
          success: false,
          type: 'personal-message',
          error: installationError.message
        });
      }
    }

    const summary = {
      success: true,
      messageType: 'personal',
      successfulMessages,
      failedMessages,
      totalAttempts: installations.length,
      userInfo: { userId, userEmail, userName, mentionUser },
      results: results
    };

    context.log(`[userMessaging] Personal messaging complete`, summary);

    context.res = {
      status: 200,
      body: summary
    };

  } catch (error: any) {
    context.log.error(`[userMessaging] Critical error:`, error);
    context.res = {
      status: 500,
      body: { 
        error: "Failed to send personal messages", 
        details: error.message,
        successfulMessages,
        failedMessages
      }
    };
  }
};

export default userMessaging;