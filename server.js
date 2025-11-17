import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.static("public"));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.get("/callback", async (req, res) => {
  const code = req.query.code;

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const tokenData = await tokenResponse.json();

  // Save user info in Supabase
  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `token ${tokenData.access_token}` },
  });
  const user = await userRes.json();

  await supabase.from("users").upsert({
    username: user.login,
    github_id: user.id,
    token: tokenData.access_token,
  });

  res.redirect(`/dashboard.html#${tokenData.access_token}`);
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
