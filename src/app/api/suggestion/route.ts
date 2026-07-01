import { generateText, Output } from "ai";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";

// Simple rate limiter for Gemini free tier (5 requests/minute)
let requestTimes: number[] = [];

function getDelayMs(): number {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  
  // Remove old requests outside the 1-minute window
  requestTimes = requestTimes.filter(time => time > oneMinuteAgo);
  
  if (requestTimes.length >= 5) {
    // If we have 5 requests, wait until the oldest one is outside the window
    return requestTimes[0] + 60000 - now;
  }
  
  return 0;
}

async function waitForRateLimit(): Promise<void> {
  const delay = getDelayMs();
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  requestTimes.push(Date.now());
}

const suggestionSchema = z.object({
  suggestion: z
    .string()
    .describe(
      "The code to insert at cursor, or empty string if no completion needed"
    ),
});

const SUGGESTION_PROMPT = `You are a code suggestion assistant.

<context>
<file_name>{fileName}</file_name>
<previous_lines>
{previousLines}
</previous_lines>
<current_line number="{lineNumber}">{currentLine}</current_line>
<before_cursor>{textBeforeCursor}</before_cursor>
<after_cursor>{textAfterCursor}</after_cursor>
<next_lines>
{nextLines}
</next_lines>
<full_code>
{code}
</full_code>
</context>

<instructions>
Follow these steps IN ORDER:

1. First, look at next_lines. If next_lines contains ANY code, check if it continues from where the cursor is. If it does, return empty string immediately - the code is already written.

2. Check if before_cursor ends with a complete statement (;, }, )). If yes, stop immediately and return an entirely empty response.

3. Only if steps 1 and 2 don't apply: suggest what should be typed at the cursor position, using context from full_code.

CRITICAL: Your suggestion is inserted immediately after the cursor, so never suggest code that is already in the file. Do not wrap your response in markdown code blocks. If no suggestion is needed, return absolutely nothing.
</instructions>`;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 },
      );
    }

    const {
      fileName,
      code,
      currentLine,
      previousLines,
      textBeforeCursor,
      textAfterCursor,
      nextLines,
      lineNumber,
    } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "Code is required" },
        { status: 400 }
      );
    }

    const prompt = SUGGESTION_PROMPT
      .replace("{fileName}", fileName)
      .replace("{code}", code)
      .replace("{currentLine}", currentLine)
      .replace("{previousLines}", previousLines || "")
      .replace("{textBeforeCursor}", textBeforeCursor)
      .replace("{textAfterCursor}", textAfterCursor)
      .replace("{nextLines}", nextLines || "")
      .replace("{lineNumber}", lineNumber.toString());

    const { output } = await generateText({
      model: google("gemini-2.5-flash"),
      //model: anthropic('claude-3-haiku-20240307'),
      output: Output.object({ schema: suggestionSchema }),
      prompt,
    });

    return NextResponse.json({ suggestion: output.suggestion })
  } catch (error) {
    console.error("Suggestion error: ", error);
    return NextResponse.json(
      { error: "Failed to generate suggestion" },
      { status: 500 },
    );
  }
}