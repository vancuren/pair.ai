import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Sends text and a base64 image to Gemini 2.5 Flash to get a text response.
 */
export async function generateAIResponse(
  userPrompt: string, 
  imageBase64: string
): Promise<string> {
  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: userPrompt },
          { 
            inlineData: { 
              mimeType: 'image/jpeg', 
              data: cleanBase64 
            } 
          }
        ]
      },
      config: {
        systemInstruction: "You are an expert pair programmer AI in a Google Meet call. You are looking at the user's screen. Keep your answers concise, helpful, and conversational. Do not output markdown code blocks unless necessary, but prefer natural language explanations first.",
      }
    });

    return response.text || "I didn't catch that context.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I encountered an error analyzing your screen.";
  }
}

/**
 * Converts text to speech using Gemini 2.5 Flash TTS.
 * Returns an AudioBuffer.
 */
export async function generateSpeech(text: string, audioContext: AudioContext): Promise<AudioBuffer | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Fenrir' }, // Deep, calm voice
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      console.warn("No audio data returned from Gemini TTS");
      return null;
    }

    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Decode the PCM data (assuming standard output from API, which wraps PCM in a way decodeAudioData handles or raw)
    // The Live API docs show manual decoding, but generateContent TTS usually returns a container format 
    // or we might need to handle raw PCM. The snippet uses decodeAudioData.
    // If raw PCM is returned without headers, we need manual decoding. 
    // However, the `generateContent` TTS usually returns a WAV/MP3 container wrapped in base64 if not specified otherwise, 
    // OR we use the decode logic from the system prompt if it's raw. 
    // The System Prompt example for TTS uses `decodeAudioData` on the blob. Let's trust standard `decodeAudioData`.
    
    return await audioContext.decodeAudioData(bytes.buffer);

  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}
