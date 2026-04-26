import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { AuthenticationError, getRequiredUser } from "@/lib/auth";
import {
  resolveStyleRuleValue,
  type SupportedStyleRuleValueType
} from "@/lib/domain/style-rules/semantic-matching";

export const dynamic = "force-dynamic";

const normalizeStyleRuleValueSchema = z.object({
  type: z.enum(["category", "colour", "colour_family", "occasion", "season"]),
  value: z.string().trim().min(1).max(200)
});

export async function POST(request: NextRequest) {
  try {
    await getRequiredUser();
    const body = await request.json();
    const input = normalizeStyleRuleValueSchema.parse(body) as {
      type: SupportedStyleRuleValueType;
      value: string;
    };

    const match = await resolveStyleRuleValue({
      type: input.type,
      input: input.value
    });

    return NextResponse.json({ match }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid normalization request." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to normalize style-rule value."
      },
      { status: 500 }
    );
  }
}
