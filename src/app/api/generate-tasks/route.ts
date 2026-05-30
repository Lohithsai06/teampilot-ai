import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "edge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMemberInput {
  id: string;
  name: string;
  role: string;
}

interface PhaseInput {
  phaseNumber: number;
  title: string;
  description: string;
  objectives: string[];
  deliverables: string[];
}

interface TasksRequestBody {
  geminiApiKey?: string;
  openRouterApiKey?: string;
  preferredProvider?: "gemini" | "openrouter" | "none";
  fallbackProvider?: "gemini" | "openrouter" | "none";
  phase: PhaseInput;
  teamMembers: TeamMemberInput[];
  projectId: string;
}

// ─── System prompt for task generation ────────────────────────────────────────

function buildTasksPrompt(
  phase: PhaseInput,
  teamMembers: TeamMemberInput[],
  projectId: string
): string {
  const memberList = teamMembers
    .map((m) => `  - ${m.name} (${m.role}, id: ${m.id})`)
    .join("\n");

  const objectivesList = phase.objectives.map((o) => `  - ${o}`).join("\n");
  const deliverablesList = phase.deliverables.map((d) => `  - ${d}`).join("\n");

  return `You are TeamPilot PM Agent — an elite Technical Program Manager.

Your task is to generate a list of concrete engineering, design, or project tasks to implement a specific roadmap phase.

====================================================
PROJECT CONTEXT & PHASE DETAILS
====================================================

ProjectId: ${projectId}

Roadmap Phase Details:
- Phase Number: ${phase.phaseNumber}
- Title: ${phase.title}
- Description: ${phase.description}

Phase Objectives:
${objectivesList || "  None provided"}

Phase Deliverables:
${deliverablesList || "  None provided"}

Available Team Members:
${memberList || "  No team members"}

====================================================
INSTRUCTIONS
====================================================

Generate 4 to 8 realistic, concrete, actionable tasks that must be completed to deliver this phase successfully.

Assign each task to one of the available team members listed above.
- Tasks must be distributed intelligently among team members based on their roles.
- For each task, you must output their exact id, name, and role.
- Each task must have a priority ("high", "medium", or "low").
- All generated tasks must have status "todo".
- All generated tasks must have phase equal to ${phase.phaseNumber}.
- All generated tasks must have sprint equal to 1.

====================================================
RESPONSE FORMAT (CRITICAL)
====================================================

You MUST respond with ONLY valid JSON. No markdown, no explanation, no code blocks.

The JSON must follow this exact structure:

{
  "tasks": [
    {
      "projectId": "${projectId}",
      "title": "Setup Firebase Collections",
      "description": "Create Firestore collections and deploy security rules for authentication and project features.",
      "assignedTo": "member_user_id_here",
      "assignedToName": "Member Name",
      "assignedToRole": "leader",
      "priority": "high",
      "status": "todo",
      "phase": ${phase.phaseNumber},
      "sprint": 1,
      "createdBy": "pm-agent"
    }
  ]
}

IMPORTANT:
- Return ONLY the JSON object, nothing else
- Do NOT wrap in markdown code blocks
- Do NOT add any text before or after the JSON
- Ensure all fields are filled out correctly using the exact userId for assignedTo`;
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
            text: "Generate the phase tasks now. Return ONLY the JSON object.",
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
            "Generate the phase tasks now. Return ONLY the JSON object.",
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

function parseTasksResponse(raw: string): {
  tasks: Array<{
    projectId: string;
    title: string;
    description: string;
    assignedTo: string;
    assignedToName: string;
    assignedToRole: string;
    priority: "high" | "medium" | "low";
    status: "todo";
    phase: number;
    sprint: number;
    createdBy: string;
  }>;
} {
  try {
    return JSON.parse(raw);
  } catch {
    // Attempt parsing in case of markdown wrapping
  }

  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {}
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }

  throw new Error("Failed to parse AI tasks response as JSON");
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    console.log(`[generate-tasks] ── API request received ──`);

    const body: TasksRequestBody = await request.json();
    const {
      geminiApiKey,
      openRouterApiKey,
      preferredProvider,
      fallbackProvider,
      phase,
      teamMembers,
      projectId,
    } = body;

    if (!projectId || !phase || !teamMembers) {
      console.error(`[generate-tasks] ❌ Missing inputs`);
      return NextResponse.json(
        { error: "ProjectId, phase details, and teamMembers are required." },
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

    console.log(`[generate-tasks]   Resolved preferred: ${resolvedPreferred}`);
    console.log(`[generate-tasks]   Resolved fallback: ${resolvedFallback}`);

    const systemPrompt = buildTasksPrompt(phase, teamMembers, projectId);

    const attempts: { name: "gemini" | "openrouter"; key?: string }[] = [];
    attempts.push({
      name: resolvedPreferred,
      key: resolvedPreferred === "gemini" ? geminiApiKey : openRouterApiKey,
    });
    if (resolvedFallback !== resolvedPreferred) {
      attempts.push({
        name: resolvedFallback,
        key: resolvedFallback === "gemini" ? geminiApiKey : openRouterApiKey,
      });
    }

    let lastError: Error | null = null;
    let responseText = "";
    let usedProvider: "gemini" | "openrouter" | null = null;

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      console.log(`[generate-tasks]   Attempt ${i + 1}: ${attempt.name}`);

      if (!attempt.key) {
        const msg = `Missing API key for ${attempt.name}`;
        console.warn(`[generate-tasks]   ⚠️  ${msg}`);
        lastError = new Error(msg);
        continue;
      }

      try {
        console.log(`[generate-tasks]   Calling ${attempt.name}...`);
        if (attempt.name === "gemini") {
          responseText = await callGemini(attempt.key, systemPrompt);
        } else {
          responseText = await callOpenRouter(attempt.key, systemPrompt);
        }
        console.log(`[generate-tasks]   ✅ ${attempt.name} succeeded, got ${responseText.length} chars`);
        usedProvider = attempt.name;
        break;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[generate-tasks]   ❌ ${attempt.name} failed: ${errMsg}`);
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    if (!usedProvider || !responseText) {
      const errorMsg = lastError ? lastError.message : "Unknown error";
      console.error(`[generate-tasks] ❌ All providers failed: ${errorMsg}`);
      return NextResponse.json(
        {
          error: "Unable to generate tasks. Check API keys in Settings.",
          details: errorMsg,
        },
        { status: 502 }
      );
    }

    try {
      const parsed = parseTasksResponse(responseText);
      console.log(`[generate-tasks] ✅ Generated ${parsed.tasks.length} tasks via ${usedProvider}`);

      return NextResponse.json({
        tasks: parsed.tasks,
        provider: usedProvider,
      });
    } catch (parseErr) {
      const parseMsg = parseErr instanceof Error ? parseErr.message : "Unknown parse error";
      console.error(`[generate-tasks] ❌ Parse error: ${parseMsg}`);
      return NextResponse.json(
        {
          error: "Failed to parse AI response",
          details: parseMsg,
        },
        { status: 502 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[generate-tasks] ❌ API error:", message);
    return NextResponse.json(
      {
        error: "Failed to generate tasks.",
        details: message,
      },
      { status: 500 }
    );
  }
}
