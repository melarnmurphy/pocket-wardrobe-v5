import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthenticationError, getRequiredUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { localWeatherLookupSchema } from "@/lib/domain/weather";
import { getLocalWeather } from "@/lib/domain/weather/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getRequiredUser();
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const input = localWeatherLookupSchema.parse({
      location: searchParams.get("location") ?? undefined,
      latitude: searchParams.get("latitude") ?? undefined,
      longitude: searchParams.get("longitude") ?? undefined,
      profileOverride: searchParams.get("profile_override") ?? undefined,
      provider: searchParams.get("provider") ?? undefined
    });

    const weather = await getLocalWeather(
      input,
      {
        supabase,
        userId: user?.id ?? null
      }
    );

    return NextResponse.json(
      {
        provider: weather.provider,
        provider_note:
          weather.provider === "weatherapi"
            ? "WeatherAPI is the default free-plan provider when a WeatherAPI key is configured."
            : "Open-Meteo is active as a fallback/dev provider. Review quota and commercial terms before production launch.",
        weather_context: weather
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid weather request." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load local weather."
      },
      { status: 500 }
    );
  }
}
