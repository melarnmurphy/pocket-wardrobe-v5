import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthenticationError } from "@/lib/auth";
import { getRequiredMobileUser } from "@/lib/auth-mobile";
import { localWeatherLookupSchema } from "@/lib/domain/weather";
import { getLocalWeather, type WeatherSnapshotClient } from "@/lib/domain/weather/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getRequiredMobileUser(request);
    const searchParams = request.nextUrl.searchParams;
    const input = localWeatherLookupSchema.parse({
      location: searchParams.get("location") ?? undefined,
      latitude: searchParams.get("latitude") ?? undefined,
      longitude: searchParams.get("longitude") ?? undefined,
      weatherDate: searchParams.get("weather_date") ?? undefined,
      profileOverride: searchParams.get("profile_override") ?? undefined,
      provider: searchParams.get("provider") ?? undefined
    });

    const weather = await getLocalWeather(input, {
      supabase: supabase as unknown as WeatherSnapshotClient,
      userId: user.id
    });

    return NextResponse.json({ weather_context: weather }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid weather request." }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load local weather." },
      { status: 500 }
    );
  }
}
