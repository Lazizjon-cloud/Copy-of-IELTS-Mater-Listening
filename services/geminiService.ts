
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TestData, QuestionType, TopicType, TestPart, Speaker, LevelType } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const generateTestContent = async (
  type: QuestionType = 'NOTE', 
  topic: TopicType = 'Random', 
  part: TestPart = 'PART_1',
  level: LevelType = 'OFFICIAL'
): Promise<TestData> => {
  const ai = getAI();
  
  const levelInstructions = {
    'A1-A2': 'Level: Elementary. Basic sentences, slow speech.',
    'B1-B2': 'Level: Intermediate. Standard pace, moderate paraphrasing.',
    'C1-C2': 'Level: Advanced. Fast pace, academic vocabulary.',
    'OFFICIAL': 'Level: Official IELTS standard complexity.'
  };

  const topicPrompt = topic === 'Random' ? `a realistic IELTS ${part.replace('_', ' ')} topic` : `the topic: ${topic}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a high-quality, NATURAL sounding IELTS Listening practice test for ${part}.
    Topic: ${topicPrompt}
    Complexity: ${levelInstructions[level]}
    Category: ${type}

    STRICT CATEGORY DEFINITIONS:
    1. SENTENCE (Sentence Completion): Standalone grammatical sentences with a gap. 
       - Instruction must be: "Complete the sentences below. Write NO MORE THAN TWO WORDS for each answer."
    2. NOTE (Note/Form Completion): Bullet points, lists, or form details (names, dates).
       - Instruction must be: "Complete the notes/form below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer."
    3. MCQ: Standard ABCD options.
       - Instruction must be: "Choose the correct letter, A, B, C, or D."
    4. MIXED: A combination of the above.
       - CRITICAL: You MUST provide a clear instruction string that specifies word limits for the completion parts (e.g., "For questions 1-5, complete the notes using NO MORE THAN TWO WORDS. For 6-10, choose the correct letter.")

    SCRIPT REQUIREMENTS:
    - Must sound like a natural conversation (Part 1/3) or talk (Part 2/4).
    - Include "distractors": speakers should correct themselves or change their minds (e.g., "I'll arrive on Tuesday... oh wait, I mean Wednesday").
    - Use two speakers for Part 1 & 3: one male (Sadachbia) and one female (Achernar).

    DATA STRUCTURE:
    - Exactly 10 questions.
    - "instruction" field MUST contain the word count limit clearly (e.g. "Write ONE WORD ONLY").`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          instruction: { type: Type.STRING, description: "Clear instruction including word limits (e.g. Write NO MORE THAN TWO WORDS)" },
          script: { type: Type.STRING },
          scriptSegments: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                speakerName: { type: Type.STRING },
                text: { type: Type.STRING },
                startTime: { type: Type.NUMBER },
                endTime: { type: Type.NUMBER }
              },
              required: ["speakerName", "text", "startTime", "endTime"]
            }
          },
          speakers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                gender: { type: Type.STRING, enum: ["male", "female"] },
                role: { type: Type.STRING }
              }
            }
          },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.INTEGER },
                type: { type: Type.STRING, enum: ["SENTENCE", "NOTE", "MCQ"] },
                label: { type: Type.STRING },
                prefix: { type: Type.STRING },
                suffix: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING },
                answerSentence: { type: Type.STRING },
                timestampSeconds: { type: Type.NUMBER },
                proofStart: { type: Type.NUMBER },
                proofEnd: { type: Type.NUMBER }
              },
              required: ["id", "type", "label", "answer", "answerSentence", "timestampSeconds", "proofStart", "proofEnd"]
            }
          }
        },
        required: ["title", "instruction", "script", "scriptSegments", "speakers", "questions"]
      }
    }
  });

  const parsed = JSON.parse(response.text);
  parsed.part = part;
  parsed.level = level;
  return parsed;
};

export const generateFullAudio = async (testData: TestData): Promise<{ buffer: AudioBuffer }> => {
  const ai = getAI();
  const speakerConfigs = testData.speakers.map((s) => ({
    speaker: s.name,
    voiceConfig: { prebuiltVoiceConfig: { voiceName: s.gender === 'male' ? 'Sadachbia' : 'Achernar' } }
  }));

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Act out this IELTS recording with a natural, professional tone. Include pauses where speakers correct themselves. Script:\n${testData.script}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        multiSpeakerVoiceConfig: { speakerVoiceConfigs: speakerConfigs }
      }
    }
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Audio synthesis failed");
  const sampleRate = 24000;
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
  const buffer = await decodeAudioData(decode(base64Audio), audioContext, sampleRate, 1);
  return { buffer };
};
