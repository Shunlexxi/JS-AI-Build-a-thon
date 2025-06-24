import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const pdfPath = path.join(projectRoot, 'data/FAQs.pdf'); // PDF file name

const client = new ModelClient(
  process.env.AZURE_INFERENCE_SDK_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_INFERENCE_SDK_KEY)
);

let pdfText = null; 
let pdfChunks = []; 
const CHUNK_SIZE = 800; 

async function loadPDF() {
  if (pdfText) return pdfText;

  if (!fs.existsSync(pdfPath)) return "PDF not found.";

  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer); 
  pdfText = data.text;
  let currentChunk = ""; 
  const words = pdfText.split(/\s+/); 

  for (const word of words) {
    if ((currentChunk + " " + word).length <= CHUNK_SIZE) {
      currentChunk += (currentChunk ? " " : "") + word;
    } else {
      pdfChunks.push(currentChunk);
      currentChunk = word;
    }
  }
  if (currentChunk) pdfChunks.push(currentChunk);
  return pdfText;
}

function retrieveRelevantContent(query) {
  const queryTerms = query.toLowerCase().split(/\s+/) // Converts query to relevant search terms
    .filter(term => term.length > 3)
    .map(term => term.replace(/[.,?!;:()"']/g, ""));

  if (queryTerms.length === 0) return [];
  const scoredChunks = pdfChunks.map(chunk => {
    const chunkLower = chunk.toLowerCase(); 
    let score = 0; 
    for (const term of queryTerms) {
      const regex = new RegExp(term, 'gi');
      const matches = chunkLower.match(regex);
      if (matches) score += matches.length;
    }
    return { chunk, score };
  });
  return scoredChunks
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.chunk);
}

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  const useRAG = req.body.useRAG === undefined ? true : req.body.useRAG; 
  let messages = [];
  let sources = [];
  if (useRAG) {
    await loadPDF();
    sources = retrieveRelevantContent(userMessage);
    if (sources.length > 0) {
      messages.push({ 
        role: "system", 
        content: `You are a helpful assistant answering questions about the company based on its employee handbook.
Use ONLY the following information from the handbook to answer the user's question.
If you can't find relevant information in the provided context, say "Sorry, I don't have information about that." Do not answer from general knowledge.
--- EMPLOYEE HANDBOOK EXCERPTS ---
${sources.join('\n\n')}
--- END OF EXCERPTS ---`
      });
    } else {
      messages.push({
        role: "system",
        content: `You are a helpful assistant answering questions about the company based on its employee handbook.
No relevant information was found in the provided handbook for this question.
If you can't find relevant information in the provided context, say "Sorry, I don't have information about that." Do not answer from general knowledge.`
      });
    }
  } else {
    messages.push({
      role: "system",
      content: "You are a helpful assistant."
    });
  }
  messages.push({ role: "user", content: userMessage });

  try {
    const response = await client.path("chat/completions").post({
      body: {
        messages,
        max_tokens: 4096,
        temperature: 1,
        top_p: 1,
        model: "gpt-4o",
      },
    });
    if (isUnexpected(response)) throw new Error(response.body.error || "Model API error");
    res.json({
      reply: response.body.choices[0].message.content,
      sources: useRAG ? sources : []
    });
  } catch (err) {
    res.status(500).json({ error: "Model call failed", message: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`AI API server running on port ${PORT}`);
});

// API Call (Simulate an AI response placeholder for future integration)
async function _apiCall(message) {
  const res = await fetch("http://localhost:3001/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      message,
      useRAG: this.ragEnabled 
    }),
  });
  const data = await res.json();
  return data;
}

// Handle sending a message and receiving a response
async function _sendMessage() {
  if (!this.inputMessage.trim() || this.isLoading) return;
  
  // Add user's message to the chat
  const userMessage = {
    role: 'user',
    content: this.inputMessage
  };
  
  this.messages = [...this.messages, userMessage];
  const userQuery = this.inputMessage;
  this.inputMessage = '';
  this.isLoading = true;
  
  try {
    const aiResponse = await this._apiCall(userQuery);

    // Add AI's response to the chat, including sources if present
    this.messages = [
      ...this.messages,
      { 
        role: 'assistant', 
        content: aiResponse.reply, 
        sources: aiResponse.sources && aiResponse.sources.length > 0 ? aiResponse.sources : undefined 
      }
    ];
  } catch (error) {
    // Handle errors gracefully
    console.error('Error calling model:', error);
    this.messages = [
      ...this.messages,
      { role: 'assistant', content: 'Sorry, something went wrong.' }
    ];
  } finally {
    this.isLoading = false;
  }
}