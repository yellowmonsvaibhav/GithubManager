const token = localStorage.getItem("token");

export async function getUser(token) {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `token ${token}` },
  });
  return res.json();
}

export async function getRepos(token) {
  const res = await fetch("https://api.github.com/user/repos", {
    headers: { Authorization: `token ${token}` },
  });
  return res.json();
}

export async function commitFile(token, username, repo, path, message, content) {
  const res = await fetch(`https://api.github.com/repos/${username}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      content: btoa(content),
    }),
  });
  return res.json();
}
