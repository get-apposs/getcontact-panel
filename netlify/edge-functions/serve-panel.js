import { readFile } from "node:fs/promises";
import { join } from "node:path";

export default async function handler(request, context) {
  // Tylko GET
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl     = Deno.env.get("SUPABASE_URL")      || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  // Zabezpieczenie — nie serwuj jeśli zmienne nie są ustawione
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing env vars: SUPABASE_URL or SUPABASE_ANON_KEY");
    return new Response("Configuration error", { status: 500 });
  }

  try {
    // Odczyt pliku HTML
    const filePath = join(Deno.cwd(), "panel", "index.html");
    const raw = await readFile(filePath, "utf-8");

    // Podmiana placeholderów
    const html = raw
      .replace(/%%SUPABASE_URL%%/g,      supabaseUrl)
      .replace(/%%SUPABASE_ANON_KEY%%/g, supabaseAnonKey);

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store", // ✅ nie cachuj — zawiera wstrzyknięte dane
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    });
  } catch (err) {
    console.error("serve-panel error:", err);
    return new Response("Not Found", { status: 404 });
  }
}

export const config = {
  path: "/",  // serwuje panel pod /
};
