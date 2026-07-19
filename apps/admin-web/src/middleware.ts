import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value }) => res.cookies.set(name, value)),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isDashboard = !req.nextUrl.pathname.startsWith("/login")
    && !req.nextUrl.pathname.startsWith("/api");

  if (!user && isDashboard) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (user && isDashboard) {
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    // Dashboard admin HANYA untuk owner/admin — kasir ditolak:
    if (!profile || !["owner", "admin"].includes(profile.role)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login?error=forbidden", req.url));
    }
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
