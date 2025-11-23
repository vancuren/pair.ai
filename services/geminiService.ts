import { GoogleGenAI, Modality, FunctionDeclaration, Type } from "@google/genai";
import { ToolCallResponse } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define Tools
const listFilesTool: FunctionDeclaration = {
  name: "list_files",
  description: "Get a list of all file paths in the repository to understand the project structure.",
};

const readFileTool: FunctionDeclaration = {
  name: "read_file",
  description: "Read the content of a specific file from the repository.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: { type: Type.STRING, description: "The relative path of the file to read (e.g., src/App.tsx)" }
    },
    required: ["path"]
  }
};

const createPrTool: FunctionDeclaration = {
  name: "create_pull_request",
  description: "Create a pull request with code changes to a specific file.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: { type: Type.STRING, description: "The path of the file to modify" },
      content: { type: Type.STRING, description: "The full new content of the file" },
      description: { type: Type.STRING, description: "A short description of the change for the PR title" }
    },
    required: ["path", "content", "description"]
  }
};

/**
 * Determines if we are in Screen Share mode (Vision) or GitHub mode (Function Calling).
 */
export async function generateAIResponse(
  userPrompt: string, 
  imageBase64: string | null,
  isGitHubMode: boolean,
  fileContext?: string, // Previously read file content
  previousHistory: any[] = [] // Not fully implemented in this simple demo, but good for future
): Promise<ToolCallResponse> {
  try {
    const model = 'gemini-2.5-flash';
    
    // --- Screen Share Mode ---
    if (!isGitHubMode && imageBase64) {
       const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
       const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            { text: userPrompt },
            { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } }
          ]
        },
        config: {
          systemInstruction: "You are an expert pair programmer. You are looking at the user's screen. Keep answers concise.",
        }
      });
      return { functionCalls: [], text: response.text || "I didn't catch that." };
    }

    // --- GitHub Mode ---
    if (isGitHubMode) {
      // In a real app, we would manage full chat history here. 
      // For this demo, we pass the "File Context" if we just read a file.
      
      let promptText = userPrompt;
      if (fileContext) {
        promptText = `I have read the file. Here is the content:\n\n${fileContext}\n\nUser Request: ${userPrompt}`;
      }

      const response = await ai.models.generateContent({
        model,
        contents: { parts: [{ text: promptText }] },
        config: {
          systemInstruction: "You are a GitHub automation expert. You can list files, read files, and create PRs. If the user asks to fix something, first find the file, read it, then create a PR with the fix. Always be concise in your text responses.",
          tools: [{ functionDeclarations: [listFilesTool, readFileTool, createPrTool] }]
        }
      });

      const functionCalls = response.candidates?.[0]?.content?.parts
        ?.filter(p => p.functionCall)
        .map(p => ({
            name: p.functionCall!.name,
            args: p.functionCall!.args
        })) || [];

      const text = response.text || (functionCalls.length > 0 ? "Working on it..." : "I'm not sure what to do.");

      return { functionCalls, text };
    }

    // --- Text Only / Fallback ---
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [{ text: userPrompt }] }
    });
    return { functionCalls: [], text: response.text || "I didn't hear you." };

  } catch (error) {
    console.error("Gemini API Error:", error);
    return { functionCalls: [], text: "Sorry, I encountered an error." };
  }
}

// Helper to convert Base64 string to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to convert raw PCM 16-bit audio to Web Audio API AudioBuffer
// Gemini TTS uses 24kHz sample rate by default
function pcmToAudioBuffer(
  data: Uint8Array, 
  ctx: AudioContext, 
  sampleRate: number = 24000, 
  numChannels: number = 1
): AudioBuffer {
  // Create Int16 view of the data (PCM 16-bit)
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Normalize 16-bit integer (-32768 to 32767) to float (-1.0 to 1.0)
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export async function generateSpeech(text: string, audioContext: AudioContext): Promise<AudioBuffer | null> {
  try {
    // Truncate long code blocks for speech to avoid reading 100 lines of code
    const speakableText = text.replace(/```[\s\S]*?```/g, "I've provided the code in the chat.");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text: speakableText }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Fenrir' }, 
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;

    const uint8Array = base64ToUint8Array(base64Audio);
    
    // Decode raw PCM data manually because browser decodeAudioData expects file headers (WAV/MP3)
    return pcmToAudioBuffer(uint8Array, audioContext, 24000);

  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}