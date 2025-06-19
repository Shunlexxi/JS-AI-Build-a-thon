import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

// Get token from environment
const token = process.env["GITHUB_TOKEN"];
const endpoint = "https://models.github.ai/inference";
const model = "openai/gpt-4o-mini"; // Ensure this is a vision-capable model (multimodal )
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function main() {
  // Read image file as base64
  const imagePath = path.join(__dirname, "contoso_layout_sketch.jpg");
  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString("base64");

  const client = ModelClient(endpoint, new AzureKeyCredential(token));

  const response = await client.path("/chat/completions").post({
    body: {
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "write HTML and CSS code for a webpage based on the following hand-drawn sketch",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 1500,
      model: model,
    },
  });

  if (isUnexpected(response)) {
    throw response.body.error;
  }

  console.log(response.body.choices[0].message.content);
}

main().catch((err) => {
  console.error("The sample encountered an error:", err);
});
