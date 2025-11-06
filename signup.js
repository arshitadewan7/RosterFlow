// signup.js
import { supabase } from "./supabase.js";

const form = document.getElementById("signupForm");

// 🧠 Redirect if already logged in
(async () => {
  const { data } = await supabase.auth.getUser();
  if (data.user) window.location.href = "dashboard.html";
})();

// 🧾 Handle signup
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    alert("Signup failed: " + error.message);
  } else {
    alert("Signup successful! Redirecting...");
    window.location.href = "dashboard.html"; // ✅ auto login redirect
  }
});

import { supabase } from "./supabase.js";

// Google Sign Up / Sign In
const googleBtn = document.getElementById("googleSignupBtn");
if (googleBtn) {
  googleBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/dashboard.html",
      },
    });
    if (error) alert("Google sign-in failed: " + error.message);
  });
}
