import { CLIENT_ID, BACKEND_URL } from "./config.js";

export function redirectToGitHub() {
  const url = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo,user&redirect_uri=${BACKEND_URL}/callback`;
  window.location.href = url;
}

export async function exchangeCodeForToken(code) {
  const res = await fetch(`${BACKEND_URL}/exchange?code=${code}`);
  const data = await res.json();
  if (data.access_token) {
    localStorage.setItem("token", data.access_token);
    return data.access_token;
  } else {
    throw new Error("Token exchange failed");
  }
}
