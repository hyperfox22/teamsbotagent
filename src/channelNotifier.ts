import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import * as ACData from "adaptivecards-templating";
import notificationTemplate from "./adaptiveCards/notification-default.json";
import { notificationApp } from "./internal/initialize";

interface ChannelNotificationRequest {
  teamId?: string;
  channelId?: string;           // Teams Thread ID format: 19%3Ad9a61a4b26b94940bb07e22e286e812f%40thread.tacv2
  channelUrl?: string;          // Full Teams URL - will extract channelId from this
  channelName?: string;         // Fallback - for convenience but not unique
  subject: string;
  body: {
    contentType: string;
    content: string;
  };
  incidentId?: string;
  createThread?: boolean;
}

// Helper function to extract channel ID from Teams URL
function extractChannelIdFromUrl(url: string): string | null {
  try {
    // Extract from URL like: https://teams.microsoft.com/l/channel/19%3Ad9a61a4b26b94940bb07e22e286e812f%40thread.tacv2/...
    const match = url.match(/\/channel\/([^\/]+)/);
    if (match && match[1]) {
      // Return the URL-decoded channel ID
      return decodeURIComponent(match[1]);
    }
  } catch (error) {
    // If URL parsing fails, return null
  }
  return null;
}

const channelNotifier: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  context.log("[channelNotifier] Raw request received", {
    method: req.method,
    headers: req.headers,
    rawBody: req.rawBody?.toString(),
    body: req.body,
    query: req.query
  });

  // Handle different ways the body might be sent
  let requestData: any;
  try {
    if (typeof req.body === 'string') {
      requestData = JSON.parse(req.body);
    } else {
      requestData = req.body || {};
    }
  } catch (parseError) {
    context.log.error("[channelNotifier] JSON parsing error:", parseError);
    context.res = {
      status: 400,
      body: { error: "Invalid JSON in request body", details: parseError }
    };
    return;
  }

  context.log("[channelNotifier] Parsed request data", JSON.stringify(requestData, null, 2));

  const { subject, body, teamId, channelId, channelUrl, channelName, incidentId, createThread } = requestData;

  // More flexible validation
  if (!subject) {
    context.log.error("[channelNotifier] Missing subject field");
    context.res = {
      status: 400,
      body: { 
        error: "Subject is required", 
        received: requestData
      }
    };
    return;
  }

  if (!body) {
    context.log.error("[channelNotifier] Missing body field");
    context.res = {
      status: 400,
      body: { 
        error: "Body is required", 
        received: requestData
      }
    };
    return;
  }

  context.log("[channelNotifier] Validation passed", {
    subject,
    hasBody: !!body,
    channelId,
    channelUrl,
    channelName
  });

  // Extract channel ID from URL if provided
  let targetChannelId = channelId;
  if (channelUrl && !targetChannelId) {
    targetChannelId = extractChannelIdFromUrl(channelUrl);
    context.log(`[channelNotifier] Extracted channel ID from URL: ${targetChannelId}`);
  }

  // Process the HTML content
  const htmlContent = body.contentType === 'html' ? body.content : (typeof body === 'string' ? body : body.content || '');
  const plainTextContent = (htmlContent || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]*>/g, '')
    .trim();

  const urlMatch = (htmlContent || '').match(/href=['"]([^'"]*)['"]/i);
  const actionUrl = urlMatch ? urlMatch[1] : '';

  const notificationData = {
    subject: subject,
    bodyContent: plainTextContent,
    actionTitle: actionUrl ? "View Details" : "Open HyperSOC",
    actionUrl: actionUrl || "https://socportal.hyperSOC.com"
  };

  context.log("[channelNotifier] Notification data prepared", notificationData);

  let successfulNotifications = 0;
  let failedNotifications = 0;
  const results: any[] = [];

  try {
    // Get all bot installations
    const pagedData = await notificationApp.notification.getPagedInstallations(100);
    const installations = pagedData.data;
    context.log(`[channelNotifier] Found ${installations.length} installations`);

    for (const target of installations) {
      try {
        const channels = await target.channels();
        context.log(`[channelNotifier] Processing ${channels.length} channels for installation`);

        for (const channel of channels) {
          const channelInfo = channel.info;
          context.log(`[channelNotifier] Checking channel: ${channelInfo?.name} (ID: ${channelInfo?.id})`);

          // Check if this is the target channel
          // Compare with the Thread ID (which is the unique channel identifier in Teams)
          const isTargetChannel = 
            (!teamId && !targetChannelId && !channelName) || // Send to all if no filter
            (targetChannelId && channelInfo?.id === targetChannelId) ||   // Primary: match by unique Thread ID
            (channelName && !targetChannelId && channelInfo?.name?.toLowerCase().includes(channelName.toLowerCase())); // Fallback: only if no channelId provided

          context.log(`[channelNotifier] Channel check: ${channelInfo?.name} (ID: ${channelInfo?.id}) - Target: ${targetChannelId} - Match: ${isTargetChannel}`);

          if (isTargetChannel) {
            try {
              context.log(`[channelNotifier] Sending notification to channel: ${channelInfo?.name}`);
              
              const cardTemplate = new ACData.Template(notificationTemplate);
              const card = cardTemplate.expand({ $root: notificationData });

              await channel.sendAdaptiveCard(card);
              successfulNotifications++;
              
              results.push({
                success: true,
                channelName: channelInfo?.name,
                channelId: channelInfo?.id,
                teamId: 'unknown' // TeamId not available in ChannelInfo
              });

              context.log(`[channelNotifier] Successfully sent to channel: ${channelInfo?.name}`);
            } catch (channelError: any) {
              failedNotifications++;
              context.log.error(`[channelNotifier] Failed to send to channel ${channelInfo?.name}:`, channelError.message);
              
              results.push({
                success: false,
                channelName: channelInfo?.name,
                channelId: channelInfo?.id,
                error: channelError.message
              });
            }
          }
        }
      } catch (installationError: any) {
        context.log.error(`[channelNotifier] Failed to process installation:`, installationError.message);
      }
    }

    const summary = {
      success: true,
      successfulNotifications,
      failedNotifications,
      totalChannelsChecked: results.length,
      results: results,
      notificationData
    };

    context.log(`[channelNotifier] Notification complete`, summary);

    context.res = {
      status: 200,
      body: summary
    };

  } catch (error: any) {
    context.log.error(`[channelNotifier] Critical error:`, error);
    context.res = {
      status: 500,
      body: { 
        error: "Failed to send notifications", 
        details: error.message,
        successfulNotifications,
        failedNotifications
      }
    };
  }
};

export default channelNotifier;