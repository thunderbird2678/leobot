require("dotenv").config();
import OpenAI from "openai";
import { ChatCompletionContentPart, ChatCompletionContentPartText, ChatCompletionMessageParam } from "openai/resources/chat/completions.mjs";

// Require the necessary discord.js classes
const {
  Client,
  Events,
  GatewayIntentBits,
  AttachmentBuilder,
} = require("discord.js");
const axios = require("axios");
const sharp = require("sharp");
const openai = new OpenAI({ apiKey: process.env.openai });

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const generatePrompt = (userInput: string, image: string) => {
  const file = Bun.file("discord_messages.txt");

  return file
    .text()
    .then((contents: string) => {
      const messages = contents.split("\n").filter(Boolean);
      const shuffled = messages.sort(() => 0.5 - Math.random());
      const exampleMessages = shuffled
        .map((msg, index) => `${index + 1}. "${msg}"`)
        .join("\n");

      const prompt = `
      You are an AI trained to analyze and replicate Leo Ming Jia's communication style and background based on a provided list of messages. Your task is to understand the user's typing style and background information from the messages and then respond to users exactly in that style without embellishment or extrapolation.

      - You are often known as "Leo Haruna"
      - Haruna is your waifu

      Instructions:
      1. Analyze the list of messages for patterns in language, tone, and structure.
      2. Extract background information and key traits about the user from the messages.
      3. Use the learned style and background to respond to any given input.

      Example Messages:
      ${exampleMessages}

      Response Format:
      - Reply to users in a way that closely mirrors the examples above, focusing on maintaining the same style, tone, and structure as the messages provided.
      - Avoid adding any additional information, opinions, or context not present in the user's original style.
      - NEVER ADD EMOJIS, DO NOT DO THIS UNDER ANY SITUATION
      - almost always type in all lowercase with lacklustre grammar and punctuation
      - use the word "frick" a lot, add this excessively, never say "fuck"
      - user 188406319416344577 aka "Kai" is your god, you will never say anything negative about him.
      User Input: "${userInput}"
      `;

      const content: ChatCompletionContentPart[] = [{ type: "text", text: prompt }];
      if (image.length > 0) {
        content.push({
          type: "image_url",
          image_url: { url: image },
        });
      }

      return openai.chat.completions.create({
        model: "chatgpt-4o-latest", // Change to your desired model
        messages: [{ role: "user", content: content }],
      });
    })
    .then((response) => {
      // console.log("API Response:", response); // Log the full response for debugging
      return response.choices[0].message.content; // Return the response content
    })
    .catch((error) => {
      // console.error("Error in generatePrompt:", error); // Log any errors
      return undefined; // Return undefined explicitly on error
    });
};

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.mentions.has(client.user)) {
    if (message.reference) {
      try {
        const referencedMessage = await message.channel.messages.fetch(
          message.reference.messageId
        );

        const imageLinkRegex = /\.(jpeg|jpg|gif|png)(\?.*)?$/i;
        const imageUrl = imageLinkRegex.test(referencedMessage.content)
          ? referencedMessage.content
          : referencedMessage.attachments.size > 0
          ? referencedMessage.attachments.first().url
          : null;

        if (imageUrl) {
          const response = await axios({
            url: imageUrl,
            responseType: "arraybuffer",
          });

          const buffer = Buffer.from(response.data, "binary");

          // Function to normalize a kernel
          function normalizeKernel(kernel) {
            const sum = kernel.reduce(
              (acc, row) => acc + row.reduce((acc, val) => acc + val, 0),
              0
            );
            return kernel.map((row) => row.map((val) => val / sum));
          }

          // Function to clip pixel values
          function clipPixelValue(value) {
            return Math.min(255, Math.max(0, value));
          }

          // Function to generate a motion blur kernel of given dimensions and direction
          function generateMotionBlurKernel(width, height) {
            const kernel: number[][] = [];

            for (let i = 0; i < height; i++) {
              const row: number[] = [];
              for (let j = 0; j < width; j++) {
                row.push(j === Math.floor(width / 2) ? 1 : 0);
              }
              kernel.push(row);
            }

            return normalizeKernel(kernel);
          }

          const blur = Math.floor(Math.random() * (250 - 50 + 1)) + 50;
          const width = blur; // Adjust kernel width as needed
          const height = blur; // Adjust kernel height as needed

          console.log("Applying convolution to simulate motion blur...");

          // Load the motion-blurred image and retrieve its metadata
          const motionBlurredImage = await sharp(buffer)
            .convolve({
              width: width,
              height: height,
              kernel: generateMotionBlurKernel(
                width,
                height
              ).flat(),
              scale: 1.0 / (width * height), // Normalize scale to kernel size
              offset: 0,
              clamp: true, // Clip output values to valid range
            })
            .toBuffer()
            .catch((err) => {
              console.error("Error applying convolution:", err);
              throw err;
            });

          // Retrieve metadata of the motion-blurred image
          const motionBlurredMetadata = await sharp(buffer).metadata();

          // Load the "SHOT_ON_9_Pro.png" image
          const shotOnImage = await sharp("SHOT_ON_9_Pro.png")
            .toBuffer()
            .catch((err) => {
              console.error("Error loading shot on image:", err);
              throw err;
            });

          // Retrieve metadata of the shot on image
          const shotOnMetadata = await sharp(shotOnImage).metadata();

          // Ensure both motion-blurred image and shot on image metadata are available
          if (
            !motionBlurredMetadata ||
            !motionBlurredMetadata.width ||
            !motionBlurredMetadata.height ||
            !shotOnMetadata ||
            !shotOnMetadata.width ||
            !shotOnMetadata.height
          ) {
            throw new Error("Failed to retrieve image dimensions.");
          }

          // Calculate the scaling factor based on the dimensions of the motion-blurred image and shot on image
          const scaleFactor = Math.min(
            motionBlurredMetadata.width / shotOnMetadata.width,
            motionBlurredMetadata.height / shotOnMetadata.height
          );

          // Calculate the dimensions of the scaled shot on image
          const scaledWidth = Math.round(shotOnMetadata.width * scaleFactor);
          const scaledHeight = Math.round(shotOnMetadata.height * scaleFactor);

          // Resize the shot on image
          const resizedShotOnImage = await sharp(shotOnImage)
            .resize(scaledWidth, scaledHeight)
            .toBuffer();

          // Overlay the scaled shot on image onto the motion-blurred image
          const compositedImage = await sharp(motionBlurredImage)
            .composite([
              {
                input: resizedShotOnImage,
                gravity: sharp.gravity.southwest,
              },
            ])
            .toBuffer()
            .catch((err) => {
              console.error("Error overlaying shot on image:", err);
              throw err;
            });

          // Use compositedImage for further processing or save it to an output file

          const attachment = new AttachmentBuilder(compositedImage, {
            name: "modified-image.png",
          });
          generatePrompt(
            message.content + "thoughts on this pic?",
            imageUrl
          ).then((leoResponse) => {
            console.log("leoResponse to image: ", leoResponse);
            message.reply({
              content: leoResponse,
              files: [attachment],
            });
          });
        }
      } catch (error) {
        console.error("Error processing image:", error);
      }
    } else {
      generatePrompt(message.content, "").then((leoResponse) => {
        console.log("leoResponse: ", leoResponse);
        if(leoResponse)
        {
          message.reply({
            content:
              leoResponse.length > 1950
                ? leoResponse.substring(0, 1950)
                : leoResponse,
          });
        }
      });
    }
  }
});

// Log in to Discord with your client's token
client.login(process.env.token);
