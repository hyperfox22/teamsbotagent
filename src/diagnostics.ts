import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { notificationApp } from "./internal/initialize";

const diagnostics: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  context.log("[diagnostics] Bot installation diagnostic started");

  try {
    const results = {
      timestamp: new Date().toISOString(),
      botInstallations: [],
      totalInstallations: 0,
      totalChannels: 0,
      installationDetails: []
    };

    // Get all bot installations
    const pagedData = await notificationApp.notification.getPagedInstallations(100);
    const installations = pagedData.data;
    results.totalInstallations = installations.length;

    context.log(`[diagnostics] Found ${installations.length} bot installations`);

    for (let i = 0; i < installations.length; i++) {
      const target = installations[i];
      const installationInfo: any = {
        index: i,
        type: 'unknown',
        channels: [],
        error: null
      };

      try {
        // Try to get channels for this installation
        const channels = await target.channels();
        installationInfo.channelCount = channels.length;
        results.totalChannels += channels.length;
        
        context.log(`[diagnostics] Installation ${i}: Found ${channels.length} channels`);
        
        for (const channel of channels) {
          const channelInfo = channel.info;
          installationInfo.channels.push({
            id: channelInfo?.id,
            name: channelInfo?.name,
            type: channelInfo?.type
          });
        }
        
        installationInfo.type = 'team-installation';
      } catch (channelError: any) {
        context.log(`[diagnostics] Installation ${i}: No channels (likely personal chat)`, channelError.message);
        installationInfo.type = 'personal-chat';
        installationInfo.error = channelError.message;
        installationInfo.channelCount = 0;
      }

      results.installationDetails.push(installationInfo);
    }

    context.log("[diagnostics] Diagnostic complete", results);

    context.res = {
      status: 200,
      body: results
    };

  } catch (error: any) {
    context.log.error("[diagnostics] Critical error:", error);
    context.res = {
      status: 500,
      body: { 
        error: "Diagnostic failed", 
        details: error.message,
        timestamp: new Date().toISOString()
      }
    };
  }
};

export default diagnostics;