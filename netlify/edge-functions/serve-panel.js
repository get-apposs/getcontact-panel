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
    const response = await context.next();

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return response;
    }

    const raw = await response.text();

    const html = raw
      .replace(/%%SUPABASE_URL%%/g, supabaseUrl)
      .replace(/%%SUPABASE_ANON_KEY%%/g, supabaseAnonKey);

    const headers = new Headers(response.headers);
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("Cache-Control", "no-store");
    headers.set("X-Frame-Options", "DENY");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    return new Response(html, {
      status: 200,
      headers
    });
  } catch (err) {
    console.error("serve-panel error:", err.message);
    return new Response("Server error", { status: 500 });
  }
}

export const config = {
  path: "/*",
};
