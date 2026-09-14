import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

function sanitizeNextPath(next: string | null) {
  return next && next.startsWith("/") ? next : "/onboarding";
}

function buildSignInRedirectUrl(origin: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  return `${origin}/sign-in?${searchParams.toString()}`;
}

function buildSignupRedirectUrl(origin: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  return `${origin}/sign-up?${searchParams.toString()}`;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const isSignup = searchParams.get("flow") === "signup";
  const nextPath = sanitizeNextPath(searchParams.get("next"));
  const callbackError = searchParams.get("error_description") ?? searchParams.get("error");

  if (callbackError) {
    return NextResponse.redirect(
      isSignup
        ? buildSignupRedirectUrl(origin, { next: nextPath, error: callbackError, errorSource: "signup" })
        : buildSignInRedirectUrl(origin, { next: nextPath, error: callbackError })
    );
  }

  const response = NextResponse.redirect(`${origin}${nextPath}`);
  type ResponseCookieMutation = {
    name: string;
    value: string;
    options?: Parameters<typeof response.cookies.set>[2];
  };

  if (!code) {
    return response;
  }

  const env = getPublicEnv();
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookieValues: ResponseCookieMutation[]) {
          cookieValues.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  const { data: exchanged, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      isSignup
        ? buildSignupRedirectUrl(origin, { next: nextPath, error: error.message, errorSource: "signup" })
        : buildSignInRedirectUrl(origin, { next: nextPath, error: error.message })
    );
  }

  const metadata = exchanged.user?.user_metadata;
  if (metadata?.local_name || metadata?.suburb) {
    await supabase.from("profiles").upsert(
      {
        user_id: exchanged.user.id,
        local_name: typeof metadata.local_name === "string" ? metadata.local_name : null,
        suburb: typeof metadata.suburb === "string" ? metadata.suburb : null
      } as never,
      { onConflict: "user_id" }
    );
  }

  return response;
}
