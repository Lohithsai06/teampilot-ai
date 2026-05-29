import { NextRequest, NextResponse } from "next/server";

// ─── TeamPilot AI Chat API Route ──────────────────────────────────────────────
// Proxies chat requests to Gemini or OpenRouter based on user's AI settings.
// The API key is sent from the client (stored in Firestore per-user).

export const runtime = "edge";

interface ChatRequestBody {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  provider: "gemini" | "openrouter";
  apiKey: string;
  systemPrompt: string;
}

// ─── Gemini API ───────────────────────────────────────────────────────────────

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  // Convert messages to Gemini format
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "I apologize, I was unable to generate a response. Please try again.";
  return text;
}

// ─── OpenRouter API ───────────────────────────────────────────────────────────

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
      model: "google/gemini-2.0-flash-exp:free",
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

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json();
    const { messages, provider, apiKey, systemPrompt } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: "No API key provided. Configure your AI provider in Settings." },
        { status: 400 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided." },
        { status: 400 }
      );
    }

    let response: string;

    if (provider === "gemini") {
      response = await callGemini(apiKey, systemPrompt, messages);
    } else if (provider === "openrouter") {
      response = await callOpenRouter(apiKey, systemPrompt, messages);
    } else {
      return NextResponse.json(
        { error: `Unknown provider: ${provider}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ response });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("AI Chat API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
