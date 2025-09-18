import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import * as ACData from "adaptivecards-templating";
import notificationTemplate from "./adaptiveCards/notification-default.json";
import { notificationApp } from "./internal/initialize";
import { talkToAgent } from "./agentConnector";

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {

  const { prompt } = req.body || {};

  const pageSize = 100;
  let continuationToken: string | undefined = undefined;
  do {
    const pagedData = await notificationApp.notification.getPagedInstallations(
      pageSize,
      continuationToken
    );
    const installations = pagedData.data;
    continuationToken = pagedData.continuationToken;

    const ai_response = await talkToAgent(prompt);
    for (const target of installations) {
      await target.sendAdaptiveCard(
        new ACData.Template(notificationTemplate).expand({
          $root: {
            title: "New Event Occurred!",
            appName: "Contoso App Notification",
            description: `AI response: ${ai_response}`,
            notificationUrl: "https://aka.ms/teamsfx-notification-new",
          },
        })
      );

      const channels = await target.channels();
        for (const channel of channels) {
          await channel.sendAdaptiveCard(new ACData.Template(notificationTemplate).expand({
          $root: {
            title: "New Event Occurred!",
            appName: "Contoso App Notification",
            description: `Prompt: ${ai_response}`,
            notificationUrl: "https://aka.ms/teamsfx-notification-new",
          },
        }));
        }

    }
  } while (continuationToken);

  context.res = {};
};

export default httpTrigger;
