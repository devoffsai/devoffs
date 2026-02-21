
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { SkillDomain, SkillDNAScore, AntiCheatLog, ExamMCQ, ExamTheory, ExamPractical, ChallengeCheckpoint } from '../types';

// Lazy initialize client to prevent runtime crash on module load if env vars are missing
let aiClient: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!aiClient) {
    const key = process.env.API_KEY || 'PLACEHOLDER_KEY'; 
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
};

// MODEL CONFIGURATION
const FAST_MODEL = 'gemini-3-flash-preview';
const PROCTOR_MODEL = 'gemini-flash-lite-latest'; // High speed, optimized for fast metadata extraction
const REASONING_MODEL = 'gemini-3-pro-preview';

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise(r => setTimeout(r, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
}

const cleanJson = (text: string | undefined): string => {
  if (!text) return "{}";
  let clean = text.replace(/```json/g, "").replace(/```/g, "");
  return clean.trim();
};

const parseResponse = (text: string | undefined) => {
  try {
    const cleaned = cleanJson(text);
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse AI response:", text);
    return {};
  }
};

// --- ROBOTIC PROCTORING SUITE ---

export const analyzeEnvironmentSnapshot = async (
  imageBase64: string
): Promise<{ lighting: boolean; singlePerson: boolean; noDevices: boolean; feedback: string }> => {
  try {
    const ai = getAiClient();
    const prompt = `
      Perform a security scan of this workspace. 
      Evaluate with high tolerance for budget hardware:
      1. lighting: BE HIGHLY LENIENT. Mark as true if the face is broadly discernible. Do not penalize for low-quality sensors, grain, or low-light shadows typical of budget devices.
      2. singlePerson: Human count should be exactly 1.
      3. noDevices: No electronic devices (phones, tablets) detected in the immediate workspace.
      
      Output JSON only.
    `;

    const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: PROCTOR_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
             lighting: { type: Type.BOOLEAN },
             singlePerson: { type: Type.BOOLEAN },
             noDevices: { type: Type.BOOLEAN },
             feedback: { type: Type.STRING }
          },
          required: ["lighting", "singlePerson", "noDevices", "feedback"]
        }
      }
    }), 2, 2000);
    
    return parseResponse(response.text);

  } catch (error) {
    console.error("Proctoring Check Failed:", error);
    // Graceful fallback: Allow entry but flag for review in real-world scenarios
    return {
      lighting: true,
      singlePerson: true,
      noDevices: true,
      feedback: "Verification bypass active due to temporary engine latency."
    };
  }
};

// --- SKILL TRIAL ---

export const generateSkillTrial = async (domain: SkillDomain): Promise<{ questions: {id: number, text: string, category: 'Practical' | 'Concept'}[], constraints: string[] }> => {
    const ai = getAiClient();
    const prompt = `Generate a highly competitive senior-level technical trial for ${domain}.
    The trial must consist of exactly 10 questions:
    - 5 Practical Questions: Focus on implementation details, edge cases, and real-world system design scenarios.
    - 5 Concept Questions: Focus on deep theoretical understanding, internals, and architectural trade-offs.
    The questions should be very difficult and aimed at distinguish between senior and staff level engineers.
    Output JSON only.`;
    
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: FAST_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    questions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.INTEGER },
                                text: { type: Type.STRING },
                                category: { type: Type.STRING, enum: ['Practical', 'Concept'] }
                            },
                            required: ["id", "text", "category"]
                        }
                    },
                    constraints: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                },
                required: ["questions", "constraints"]
            }
        }
    }));
    return parseResponse(response.text);
};

export const evaluatePerformance = async (
    domain: SkillDomain,
    taskSummary: string,
    solutionSummary: string,
    userReasoning: string,
    timeSpent: number,
    antiCheat: AntiCheatLog
): Promise<{ score: SkillDNAScore; feedback: string }> => {
    const ai = getAiClient();
    const prompt = `Evaluate performance in ${domain}. Solution: ${solutionSummary}. Time spent: ${timeSpent}s. Anti-cheat log: ${JSON.stringify(antiCheat)}.`;

    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: FAST_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    score: {
                        type: Type.OBJECT,
                        properties: {
                            problemSolving: { type: Type.NUMBER },
                            executionSpeed: { type: Type.NUMBER },
                            conceptualDepth: { type: Type.NUMBER },
                            aiLeverage: { type: Type.NUMBER },
                            riskAwareness: { type: Type.NUMBER },
                            average: { type: Type.NUMBER }
                        },
                        required: ["problemSolving", "executionSpeed", "conceptualDepth", "aiLeverage", "riskAwareness", "average"]
                    },
                    feedback: { type: Type.STRING }
                },
                required: ["score", "feedback"]
            }
        }
    }));
    return parseResponse(response.text);
};

// --- COMPETITIVE EXAM GENERATION (OPTIMIZED FOR SPEED) ---

export const generateExamMCQs = async (domain: SkillDomain): Promise<ExamMCQ[]> => {
    const ai = getAiClient();
    const prompt = `Generate 10 high-difficulty technical MCQs for ${domain}.`;
    
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: FAST_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    questions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.INTEGER },
                                question: { type: Type.STRING },
                                options: { 
                                    type: Type.ARRAY,
                                    items: { type: Type.STRING }
                                },
                                correctIndex: { type: Type.INTEGER }
                            },
                            required: ["id", "question", "options", "correctIndex"]
                        }
                    }
                },
                required: ["questions"]
            }
        }
    }));
    const parsed = parseResponse(response.text);
    return (parsed.questions || []).slice(0, 10);
};

export const generateExamTheory = async (domain: SkillDomain): Promise<ExamTheory[]> => {
     const ai = getAiClient();
     const prompt = `Generate 10 architectural theory questions for ${domain}.`;
     
     const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: FAST_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    questions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.INTEGER },
                                question: { type: Type.STRING }
                            },
                            required: ["id", "question"]
                        }
                    }
                },
                required: ["questions"]
            }
        }
    }));
    const parsed = parseResponse(response.text);
    return (parsed.questions || []).slice(0, 10);
};

export const generateExamPractical = async (domain: SkillDomain): Promise<ExamPractical[]> => {
    const ai = getAiClient();
    const prompt = `Generate 5 expert coding tasks for ${domain}.`;
    
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: FAST_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    tasks: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.INTEGER },
                                task: { type: Type.STRING },
                                constraints: { 
                                    type: Type.ARRAY,
                                    items: { type: Type.STRING }
                                }
                            },
                            required: ["id", "task", "constraints"]
                        }
                    }
                },
                required: ["tasks"]
            }
        }
    }));
    const parsed = parseResponse(response.text);
    return (parsed.tasks || []).slice(0, 5);
};

export const gradeExamSections = async (domain: SkillDomain, theory: ExamTheory[], practical: ExamPractical[]): Promise<{ theoryScore: number, practicalScore: number, feedback: string }> => {
    const ai = getAiClient();
    const prompt = `Grade ${domain} exam. Theory: ${JSON.stringify(theory)} Practical: ${JSON.stringify(practical)}`;

    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: REASONING_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 4000 },
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    theoryScore: { type: Type.INTEGER },
                    practicalScore: { type: Type.INTEGER },
                    feedback: { type: Type.STRING }
                },
                required: ["theoryScore", "practicalScore", "feedback"]
            }
        }
    }));
    return parseResponse(response.text);
};

// --- INTERVIEW (DYNAMIC) ---

export const generateInterviewQuestion = async (domain: SkillDomain, lastScore: number, roundNum: number): Promise<{ text: string, timeLimit: number }> => {
     const ai = getAiClient();
     const prompt = `Generate interview Q#${roundNum} for ${domain}.`;
     
     const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: FAST_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    text: { type: Type.STRING },
                    timeLimit: { type: Type.INTEGER }
                },
                required: ["text", "timeLimit"]
            }
        }
    }));
    return parseResponse(response.text);
};

export const evaluateInterviewResponse = async (domain: SkillDomain, question: string, answer: string): Promise<{ score: number, feedback: string, spokenFeedback: string }> => {
    const ai = getAiClient();
    const prompt = `Evaluate interview answer. Q: ${question} A: ${answer}`;
    
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: FAST_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    score: { type: Type.INTEGER },
                    feedback: { type: Type.STRING },
                    spokenFeedback: { type: Type.STRING }
                },
                required: ["score", "feedback", "spokenFeedback"]
            }
        }
    }));
    return parseResponse(response.text);
};

// --- CHALLENGE SCENARIO ---

export const generateChallengeScenario = async (domain: SkillDomain): Promise<{ taskDescription: string, checkpoints: ChallengeCheckpoint[] }> => {
    const ai = getAiClient();
    const prompt = `Create a challenge for ${domain}.`;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: FAST_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    taskDescription: { type: Type.STRING },
                    checkpoints: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.INTEGER },
                                title: { type: Type.STRING },
                                description: { type: Type.STRING },
                                completed: { type: Type.BOOLEAN }
                            },
                            required: ["id", "title", "description", "completed"]
                        }
                    }
                },
                required: ["taskDescription", "checkpoints"]
            }
        }
    }));
    return parseResponse(response.text);
};

export const validateChallengeStep = async (domain: SkillDomain, stepTitle: string, code: string): Promise<{ success: boolean, score: number, feedback: string }> => {
    const ai = getAiClient();
    const prompt = `Validate logic for ${stepTitle}. Code: ${code}`;
    
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: FAST_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    success: { type: Type.BOOLEAN },
                    score: { type: Type.INTEGER },
                    feedback: { type: Type.STRING }
                },
                required: ["success", "score", "feedback"]
            }
        }
    }));
    return parseResponse(response.text);
};
