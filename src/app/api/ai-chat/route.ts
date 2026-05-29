import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "edge";

interface ChatRequestBody {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  geminiApiKey?: string;
  openRouterApiKey?: string;
  preferredProvider?: "gemini" | "openrouter" | "none";
  fallbackProvider?: "gemini" | "openrouter" | "none";
  systemPrompt: string;
  apiKey?: string;
  provider?: "gemini" | "openrouter";
}

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
  });

  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: m.content }],
    }));

  const result = await model.generateContent({
    contents,
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    },
  });

  const text = result.response.text();
  if (!text) {
    throw new Error("Empty response from Gemini");
  }
  return text;
}

async function callOpenRouter(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const openRouterMessages = [
    { role: "system", content: systemPrompt },
    ...messages.filter((m) => m.role !== "system"),
  ];

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://teampilot-ai.web.app",
      "X-Title": "TeamPilot AI",
    },
    body: JSON.stringify({
      model: "openrouter/free",
      messages: openRouterMessages,
      temperature: 0.7,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text =
    data?.choices?.[0]?.message?.content ||
    "I apologize, I was unable to generate a response. Please try again.";
  return text;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json();
    const {
      messages,
      geminiApiKey,
      openRouterApiKey,
      preferredProvider,
      fallbackProvider,
      systemPrompt,
      apiKey,
      provider,
    } = body;

    // Resolve keys and providers
    const resolvedGeminiKey = geminiApiKey || (provider === "gemini" ? apiKey : undefined);
    const resolvedOpenRouterKey = openRouterApiKey || (provider === "openrouter" ? apiKey : undefined);
    const resolvedPreferred = preferredProvider || provider || "gemini";

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided." },
        { status: 400 }
      );
    }

    // Determine the sequence of providers to try
    const attempts: { name: "gemini" | "openrouter"; key?: string }[] = [];

    if (resolvedPreferred === "gemini") {
      attempts.push({ name: "gemini", key: resolvedGeminiKey });
      attempts.push({ name: "openrouter", key: resolvedOpenRouterKey });
    } else if (resolvedPreferred === "openrouter") {
      attempts.push({ name: "openrouter", key: resolvedOpenRouterKey });
      attempts.push({ name: "gemini", key: resolvedGeminiKey });
    } else {
      attempts.push({ name: "gemini", key: resolvedGeminiKey });
      attempts.push({ name: "openrouter", key: resolvedOpenRouterKey });
    }

    let lastError: Error | null = null;
    let responseText = "";
    let usedProvider: "gemini" | "openrouter" | null = null;

    for (const attempt of attempts) {
      if (!attempt.key) {
        lastError = new Error(`Missing API key for ${attempt.name}`);
        continue;
      }

      try {
        if (attempt.name === "gemini") {
          responseText = await callGemini(attempt.key, systemPrompt, messages);
        } else {
          responseText = await callOpenRouter(attempt.key, systemPrompt, messages);
        }
        usedProvider = attempt.name;
        break; // Success!
      } catch (err) {
        console.warn(`Attempt with ${attempt.name} failed:`, err);
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    if (usedProvider && responseText) {
      return NextResponse.json({
        response: responseText,
        provider: usedProvider,
      });
    }

    // Both failed
    const errorMsg = lastError ? lastError.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Unable to connect to AI provider. Check API keys in Settings.",
        details: errorMsg,
      },
      { status: 502 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("AI Chat API error:", message);
    return NextResponse.json(
      { error: "Unable to connect to AI provider. Check API keys in Settings.", details: message },
      { status: 500 }
    );
  }
}
