import "dotenv/config";
import { ResendProvider } from "./providers/resend";
import { EmailClient } from "./providers/client";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  throw new Error("RESEND_API_KEY is missing");
}

const provider = new ResendProvider(apiKey);
const emailClient = new EmailClient(provider);

async function main() {
  const sendResponse = await emailClient.send({
    from: "Acme <onboarding@resend.dev>",
    to: ["delivered@resend.dev"],
    subject: "Hello World",
    html: "<strong>It works!</strong>",
  });

  console.log("send", sendResponse);
}

main().catch((error: unknown) => {
  console.error("Failed to send email", error);
  process.exitCode = 1;
});
