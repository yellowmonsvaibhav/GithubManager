// exchange.js
import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve favicon explicitly (before static middleware to ensure it's matched)
// Also serve at root for browser default requests
app.get("/favicon.ico", (req, res) => {
  res.type("image/png");
  res.sendFile(path.join(__dirname, "css", "favicon.png"));
});

app.get("/favicon.png", (req, res) => {
  res.type("image/png");
  res.sendFile(path.join(__dirname, "css", "favicon.png"));
});

// Serve only public assets to avoid exposing secrets
app.use(express.static(path.join(__dirname, "public")));
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "js")));

// Explicitly handle root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Serve dashboard
app.get("/dashboard.html", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

app.get("/exchange", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: "Missing code" });

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error) throw new Error(tokenData.error_description);

    res.json({ access_token: tokenData.access_token });
  } catch (err) {
    res.status(500).json({ error: "Error exchanging code: " + err.message });
  }
});

// Serve callback.html for OAuth redirect
app.get("/callback", (req, res) => {
  res.sendFile(path.join(__dirname, "callback.html"));
});

// Serve service worker
app.get("/service-worker.js", (req, res) => {
  res.type("application/javascript");
  res.sendFile(path.join(__dirname, "service-worker.js"));
});

// Serve manifest.json
app.get("/manifest.json", (req, res) => {
  res.type("application/manifest+json");
  res.sendFile(path.join(__dirname, "manifest.json"));
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
