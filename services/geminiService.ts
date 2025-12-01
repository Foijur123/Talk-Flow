import { GoogleGenAI } from "@google/genai";
import { Message } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export interface ChatCompletionRequest {
  history: Message[];
  newMessage: string;
  systemInstruction?: string;
}

export const streamChatResponse = async (
  request: ChatCompletionRequest,
  onChunk: (text: string) => void
): Promise<string> => {
  if (!apiKey) {
    onChunk("Error: API_KEY is missing. Please set it in your environment.");
    return "Error: API_KEY missing.";
  }

  try {
    const model = 'gemini-2.5-flash';
    
    // Transform internal message format to Gemini format
    // Filter out messages that might be invalid or empty if necessary
    const historyContents = request.history.map(msg => ({
      role: msg.senderId === 'user-me' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const chat = ai.chats.create({
      model: model,
      history: historyContents,
      config: {
        systemInstruction: request.systemInstruction || "You are a helpful assistant.",
      }
    });

    const result = await chat.sendMessageStream({
      message: request.newMessage
    });

    let fullText = '';
    for await (const chunk of result) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        onChunk(fullText);
      }
    }
    return fullText;

  } catch (error) {
    console.error("Gemini API Error:", error);
    const errorMessage = "Sorry, I encountered an error connecting to the server.";
    onChunk(errorMessage);
    return errorMessage;
  }
};
