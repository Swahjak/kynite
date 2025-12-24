import { test, expect } from "@playwright/test";

test.describe("Google Calendar Webhook", () => {
  const webhookUrl = "/api/webhooks/google-calendar";

  test("returns 400 for missing headers", async ({ request }) => {
    const response = await request.post(webhookUrl);
    expect(response.status()).toBe(400);
  });

  test("returns 200 for invalid token (security: no retry)", async ({
    request,
  }) => {
    const response = await request.post(webhookUrl, {
      headers: {
        "x-goog-channel-id": "invalid-channel-id",
        "x-goog-channel-token": "invalid-token",
        "x-goog-resource-state": "exists",
        "x-goog-message-number": "1",
      },
    });
    // Returns 200 to prevent Google from retrying invalid requests
    expect(response.status()).toBe(200);
  });

  test("GET endpoint returns 200 (verification support)", async ({
    request,
  }) => {
    const response = await request.get(webhookUrl);
    expect(response.status()).toBe(200);
  });
});
