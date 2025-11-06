// login.js
import { supabase } from "./supabase.js";

// 🧠 Auto-redirect if user is already logged in
(async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) console.warn("Session check error:", error.message);
  if (data?.user) {
    // Already logged in — redirect immediately
    window.location.href = "dashboard.html";
  }
})();

// 🧾 Handle login form
const form = document.getElementById("loginForm");
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  // ✅ Try logging in
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    alert("❌ Login failed: " + error.message);
    console.error("Login error:", error);
    return;
  }

  if (data?.session) {
    alert("✅ Welcome back!");
    window.location.href = "dashboard.html";
  } else {
    alert("⚠️ Unexpected login state. Please try again.");
  }
});
