// supabase.js
import { createClient } from "https://esm.sh/@supabase/supabase-js";

/* 
  ✅ Direct Supabase setup
  This method hardcodes the public anon key (safe to use on client side)
  and avoids the need for Netlify env injection issues.
*/

const SUPABASE_URL = "https://fvuytlbnwtfhwsigtvje.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2dXl0bGJud3RmaHdzaWd0dmplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MTM1OTgsImV4cCI6MjA3Nzk4OTU5OH0.BZlkHRbaft6iMWaO9yvXyYCoDtaZq0U_wmgEs6D2hPI";

// ✅ Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* 
  ✅ Session Checker
  Use this function on protected pages (dashboard, add.html, etc.)
  It ensures only logged-in users can access those pages.
*/
export async function checkSession() {
  const { data, error } = await supabase.auth.getSession();
  const session = data?.session;

  if (error) {
    console.error("Session check failed:", error.message);
    return;
  }

  if (session) {
    // Already logged in → prevent access to login/signup
    if (
      window.location.pathname.includes("login") ||
      window.location.pathname.includes("signup") ||
      window.location.pathname.includes("index")
    ) {
      window.location.href = "dashboard.html";
    }
  } else {
    // Not logged in → redirect to login page
    const publicPages = ["login", "signup", "index"];
    const isPublic = publicPages.some((p) =>
      window.location.pathname.includes(p)
    );
    if (!isPublic) {
      window.location.href = "login.html";
    }
  }
}
