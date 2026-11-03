import PushNotifications from "@pusher/push-notifications-server";

type BeamsClient = InstanceType<typeof PushNotifications>;

let beamsClient: BeamsClient | null = null;

export function getBeamsClient(): BeamsClient {
  if (beamsClient) {
    return beamsClient;
  }

  const instanceId = process.env.PUSHER_BEAMS_INSTANCE_ID;
  const secretKey = process.env.PUSHER_BEAMS_PRIMARY_KEY;

  if (!instanceId || !secretKey) {
    throw new Error("PUSHER_BEAMS_INSTANCE_ID y PUSHER_BEAMS_PRIMARY_KEY son requeridos.");
  }

  beamsClient = new PushNotifications({ instanceId, secretKey });
  return beamsClient;
}
