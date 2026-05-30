import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "edge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoadmapRequestBody {
  geminiApiKey?: string;
  openRouterApiKey?: string;
  preferredProvider?: "gemini" | "openrouter" | "none";
  fallbackProvider?: "gemini" | "openrouter" | "none";
  projectContext: {
    projectName: string;
    projectDescription: string;
    teamMembers: { name: string; role: string }[];
    leaderName: string;
    projectCode: string;
  };
}

// ─── System prompt for roadmap generation ─────────────────────────────────────

function buildRoadmapPrompt(context: RoadmapRequestBody["projectContext"]): string {
  const memberList = context.teamMembers
    .map((m) => `  - ${m.name} (${m.role})`)
    .join("\n");

  return `You are TeamPilot PM Agent — an elite Technical Program Manager.

Your task is to generate a structured project execution roadmap.

====================================================
PROJECT CONTEXT
====================================================

Project Name: ${context.projectName}
Project Description: ${context.projectDescription || "Not provided"}
Project Code: ${context.projectCode}
Leader: ${context.leaderName}

Team Members:
${memberList || "  No members yet"}

====================================================
INSTRUCTIONS
====================================================

Generate a comprehensive project execution roadmap with 4-6 phases.

Each phase must include:
- phaseNumber (integer, starting from 1)
- title (short phase name)
- description (1-2 sentence description)
- objectives (array of 3-5 specific objectives)
- deliverables (array of 3-5 concrete deliverables)
- estimatedDuration (human readable, e.g. "2 weeks")
- dependencies (array of dependency descriptions, empty for phase 1)
- risks (array of 1-3 potential risks)

Also provide a projectSummary (2-3 sentence overview of the project).

====================================================
RESPONSE FORMAT (CRITICAL)
====================================================

You MUST respond with ONLY valid JSON. No markdown, no explanation, no code blocks.

The JSON must follow this exact structure:

{
  "projectSummary": "Brief project overview...",
  "phases": [
    {
      "phaseNumber": 1,
      "title": "Project Foundation",
      "description": "...",
      "objectives": ["...", "..."],
      "deliverables": ["...", "..."],
      "estimatedDuration": "1 week",
      "dependencies": [],
      "risks": ["..."]
    }
  ]
}

IMPORTANT:
- Return ONLY the JSON object, nothing else
- Do NOT wrap in markdown code blocks
- Do NOT add any text before or after the JSON
- Ensure all arrays contain strings only
- Generate realistic, actionable phases for this specific project
- Phase titles should follow this general pattern: Foundation → Core Features → Advanced Features → Testing & QA → Deployment & Launch
- Adapt the phases to match the project's actual needs`;
}

// ─── AI Provider calls ────────────────────────────────────────────────────────

async function callGemini(
  apiKey: string,
  systemPrompt: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "Generate the project execution roadmap now. Return ONLY the JSON object.",
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
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
  systemPrompt: string
): Promise<string> {
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
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            "Generate the project execution roadmap now. Return ONLY the JSON object.",
        },
      ],
      temperature: 0.4,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text =
    data?.choices?.[0]?.message?.content || "";

  if (!text) {
    throw new Error("Empty response from OpenRouter");
  }

  return text;
}

// ─── Parse AI response ────────────────────────────────────────────────────────

function parseRoadmapResponse(raw: string): {
  projectSummary: string;
  phases: Array<{
    phaseNumber: number;
    title: string;
    description: string;
    objectives: string[];
    deliverables: string[];
    estimatedDuration: string;
    dependencies: string[];
    risks: string[];
  }>;
} {
  // Try direct JSON parse
  try {
    return JSON.parse(raw);
  } catch {
    // Attempt to extract JSON from markdown code blocks or surrounding text
  }

  // Try extracting from code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // fall through
    }
  }

  // Try extracting any JSON object
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // fall through
    }
  }

  throw new Error("Failed to parse AI roadmap response as JSON");
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: RoadmapRequestBody = await request.json();
    const {
      geminiApiKey,
      openRouterApiKey,
      preferredProvider,
      fallbackProvider,
      projectContext,
    } = body;

    if (!projectContext?.projectName) {
      return NextResponse.json(
        { error: "Project context is required." },
        { status: 400 }
      );
    }

    const resolvedPreferred =
      preferredProvider && preferredProvider !== "none"
        ? preferredProvider
        : "gemini";
    const resolvedFallback =
      fallbackProvider && fallbackProvider !== "none"
        ? fallbackProvider
        : "openrouter";

    const systemPrompt = buildRoadmapPrompt(projectContext);

    // Build provider attempt sequence
    const attempts: { name: "gemini" | "openrouter"; key?: string }[] = [];
    attempts.push({
      name: resolvedPreferred,
      key:
        resolvedPreferred === "gemini" ? geminiApiKey : openRouterApiKey,
    });
    if (resolvedFallback !== resolvedPreferred) {
      attempts.push({
        name: resolvedFallback,
        key:
          resolvedFallback === "gemini" ? geminiApiKey : openRouterApiKey,
      });
    }

    let lastError: Error | null = null;
    let responseText = "";
    let usedProvider: "gemini" | "openrouter" | null = null;

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];

      if (!attempt.key) {
        lastError = new Error(`Missing API key for ${attempt.name}`);
        continue;
      }

      try {
        if (attempt.name === "gemini") {
          responseText = await callGemini(attempt.key, systemPrompt);
        } else {
          responseText = await callOpenRouter(attempt.key, systemPrompt);
        }
        usedProvider = attempt.name;
        break;
      } catch (err) {
        console.error(`[generate-roadmap] Provider ${attempt.name} failed:`, err);
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    if (!usedProvider || !responseText) {
      const errorMsg = lastError ? lastError.message : "Unknown error";
      return NextResponse.json(
        {
          error:
            "Unable to generate roadmap. Check API keys in Settings.",
          details: errorMsg,
        },
        { status: 502 }
      );
    }

    // Parse the structured response
    const parsed = parseRoadmapResponse(responseText);

    console.log(
      `[generate-roadmap] Generated ${parsed.phases.length} phases via ${usedProvider}`
    );

    return NextResponse.json({
      projectSummary: parsed.projectSummary,
      phases: parsed.phases,
      provider: usedProvider,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[generate-roadmap] API error:", message);
    return NextResponse.json(
      {
        error: "Failed to generate roadmap.",
        details: message,
      },
      { status: 500 }
    );
  }
}
