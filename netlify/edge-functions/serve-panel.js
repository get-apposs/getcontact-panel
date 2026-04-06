export default async function handler(request, context) {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing env vars");
    return new Response("Configuration error", { status: 500 });
  }

  try {
    const url = new URL("/index.html", request.url);
    const fileResponse = await fetch(url.toString());

    if (!fileResponse.ok) {
      console.error("Could not fetch index.html:", fileResponse.status);
      return new Response("Not Found", { status: 404 });
    }

    const raw = await fileResponse.text();

    const html = raw
      .replace(/%%SUPABASE_URL%%/g, supabaseUrl)
      .replace(/%%SUPABASE_ANON_KEY%%/g, supabaseAnonKey);

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    });
  } catch (err) {
    console.error("serve-panel error:", err.message);
    return new Response("Server error", { status: 500 });
  }
}

export const config = {
  path: "/",
};
