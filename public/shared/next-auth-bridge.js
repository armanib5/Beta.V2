/* Bridges a real, logged-in vendor session from the Next.js app into
   these legacy static pages. The Next.js app (@/lib/supabase/client)
   uses @supabase/ssr, which stores the session in a cookie
   (sb-<project-ref>-auth-token) - not localStorage. A plain supabase-js
   client instantiated on a static page only ever checks localStorage by
   default, so it NEVER sees that a vendor is actually logged in, no
   matter how they signed in - this is why /pins/ showed a login gate to
   already-logged-in vendors before this existed. Reads the same cookie
   @supabase/ssr writes directly ("base64-" + base64(JSON session)),
   without needing the @supabase/ssr package on these pages at all. */
function readNextAuthSession() {
  var match = document.cookie.match(/(?:^|; )sb-[^=]+-auth-token=([^;]+)/);
  if (!match) return null;
  try {
    var raw = decodeURIComponent(match[1]);
    var jsonStr = raw.indexOf("base64-") === 0 ? atob(raw.slice(7)) : raw;
    var parsed = JSON.parse(jsonStr);
    if (!parsed || !parsed.access_token || !parsed.user || !parsed.user.id) return null;
    if (parsed.expires_at && parsed.expires_at * 1000 < Date.now()) return null;
    return { accessToken: parsed.access_token, userId: parsed.user.id };
  } catch (e) {
    return null;
  }
}
