const token = localStorage.getItem("token");
if (!token) window.location.href = "/";

let userData = null;
let allRepos = [];
let currentRepo = null;
let currentFile = null;
let fileTree = [];
let currentFileManager = null;
let currentFileContent = null;
let currentFileType = null; // 'html', 'markdown', or null
let originalFileContent = null; // Store original content for edit mode
let isEditMode = false;

// Get file extension color
function getFileExtensionColor(filePath) {
  const extension = filePath.split(".").pop()?.toLowerCase() || "";
  const fileName = filePath.split("/").pop()?.toLowerCase() || "";

  // Color mapping based on file extensions
  const colorMap = {
    // JavaScript/TypeScript
    js: "#f1e05a",
    jsx: "#61dafb",
    ts: "#2b7489",
    tsx: "#2b7489",
    mjs: "#f1e05a",
    cjs: "#f1e05a",

    // Web
    html: "#e34c26",
    htm: "#e34c26",
    css: "#563d7c",
    scss: "#c6538c",
    sass: "#c6538c",
    less: "#1d365d",

    // Python
    py: "#3572A5",
    pyw: "#3572A5",
    pyc: "#3572A5",

    // Java
    java: "#b07219",
    class: "#b07219",
    jar: "#b07219",

    // C/C++
    c: "#555555",
    cpp: "#f34b7d",
    cc: "#f34b7d",
    cxx: "#f34b7d",
    h: "#555555",
    hpp: "#f34b7d",

    // Other languages
    go: "#00ADD8",
    rs: "#dea584",
    rb: "#701516",
    php: "#4F5D95",
    swift: "#fa7343",
    kt: "#A97BFF",
    scala: "#c22d40",
    clj: "#db5855",
    sh: "#89e051",
    bash: "#89e051",
    zsh: "#89e051",
    fish: "#89e051",
    ps1: "#012456",
    bat: "#c1f12e",
    cmd: "#c1f12e",

    // Data formats
    json: "#f1e05a",
    xml: "#e34c26",
    yaml: "#cb171e",
    yml: "#cb171e",
    toml: "#9c4221",
    ini: "#d1dbe0",
    csv: "#237346",

    // Markdown/Documentation
    md: "#083fa1",
    markdown: "#083fa1",
    txt: "#8b949e",
    rtf: "#8b949e",

    // Images
    png: "#8b949e",
    jpg: "#8b949e",
    jpeg: "#8b949e",
    gif: "#8b949e",
    svg: "#8b949e",
    webp: "#8b949e",
    ico: "#8b949e",

    // Config files
    config: "#8b949e",
    conf: "#8b949e",
    gitignore: "#8b949e",
    gitattributes: "#8b949e",
    editorconfig: "#8b949e",
    eslintrc: "#4b32c3",
    prettierrc: "#f7b93e",

    // Special files
    dockerfile: "#0db7ed",
    makefile: "#427819",
    cmake: "#064f8c",
    license: "#8b949e",
    readme: "#8b949e",
  };

  // Check for special file names (case-insensitive)
  if (fileName === "dockerfile") return "#0db7ed";
  if (fileName === "makefile") return "#427819";
  if (fileName.startsWith(".") && !extension) {
    // Hidden files without extension
    if (
      fileName === ".gitignore" ||
      fileName === ".gitattributes" ||
      fileName === ".editorconfig"
    ) {
      return "#8b949e";
    }
  }

  return colorMap[extension] || "#8b949e"; // Default gray color
}

// Check token permissions by testing access
async function checkTokenPermissions() {
  try {
    // Try to get user's own repos with full permissions
    const res = await fetch("https://api.github.com/user/repos?per_page=1", {
      headers: { Authorization: `token ${token}` },
    });

    if (!res.ok) {
      return { hasRepoAccess: false, hasDeleteAccess: false };
    }

    // Check if we can access repo management endpoints
    // We'll test delete permissions when user tries to delete
    // For now, just verify we have repo access
    const scopes = res.headers.get("X-OAuth-Scopes");
    const hasRepoAccess = res.ok;
    const hasDeleteAccess = scopes
      ? scopes.includes("delete_repo") || scopes.includes("repo")
      : true; // repo scope includes delete

    return { hasRepoAccess, hasDeleteAccess, scopes };
  } catch (error) {
    console.error("Error checking token permissions:", error);
    return { hasRepoAccess: false, hasDeleteAccess: false };
  }
}

// Load user data
async function loadUser() {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `token ${token}` },
    });

    if (!res.ok) throw new Error("Failed to load user");

    userData = await res.json();
    document.getElementById("username").textContent = userData.login || userData.name || "User";

    // Set avatar
    if (userData.avatar_url) {
      document.getElementById("avatarImg").src = userData.avatar_url;
      document.getElementById("avatarImg").alt = userData.login;
    }

    // Check token permissions after loading user
    const permissions = await checkTokenPermissions();
    if (!permissions.hasDeleteAccess) {
      // Show a warning notification
      setTimeout(() => {
        showNotification(
          "Your access token may not have delete permissions. Please use 'Re-authenticate' in Settings to refresh your permissions.",
          "warning",
          8000
        );
      }, 2000);
    }

    return userData;
  } catch (error) {
    console.error("Error loading user:", error);
    document.getElementById("username").textContent = "User";
    throw error;
  }
}

// Load repositories
async function loadRepos() {
  const container = document.getElementById("repoList");
  container.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <p>Loading repositories...</p>
    </div>
  `;

  try {
    const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
      headers: {
        Authorization: `token ${token}`,
      },
    });

    if (!res.ok) throw new Error("Failed to load repositories");

    allRepos = await res.json();
    displayRepos(allRepos);
    updateStats(allRepos);
  } catch (error) {
    console.error("Error loading repos:", error);
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 64px; color: var(--text-secondary);">
        <p>Failed to load repositories. Please try again.</p>
      </div>
    `;
  }
}

// Display repositories
function displayRepos(repos) {
  const container = document.getElementById("repoList");

  if (repos.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 64px; color: var(--text-secondary);">
        <p>No repositories found.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = repos.map((repo) => createRepoCard(repo)).join("");
}

// Create repository card
function createRepoCard(repo) {
  // Check if user can delete this repo (must be owner)
  const currentUser = userData?.login;
  const canDelete = currentUser && repo.owner && repo.owner.login === currentUser;

  const language = repo.language || "Unknown";
  const languageColors = {
    JavaScript: "#f1e05a",
    TypeScript: "#2b7489",
    Python: "#3572A5",
    Java: "#b07219",
    HTML: "#e34c26",
    CSS: "#563d7c",
    Ruby: "#701516",
    Go: "#00ADD8",
    Rust: "#dea584",
    PHP: "#4F5D95",
    "C++": "#f34b7d",
    C: "#555555",
    Unknown: "#8b949e",
  };

  const languageColor = languageColors[language] || languageColors["Unknown"];
  const description = repo.description || "No description provided";
  const visibility = repo.private ? "Private" : "Public";
  const website = repo.homepage && repo.homepage.trim() ? repo.homepage.trim() : null;

  return `
    <div class="repo-card" data-repo="${repo.name}">
      <div class="repo-header">
        <a href="${
          repo.html_url
        }" target="_blank" class="repo-name" onclick="event.stopPropagation()">
          ${repo.name}
        </a>
        <span class="repo-visibility">${visibility}</span>
      </div>
      <p class="repo-description">${description}</p>
      <div class="repo-meta">
        <span>
          <svg height="16" viewBox="0 0 16 16" width="16" fill="currentColor">
            <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"></path>
          </svg>
          ${repo.stargazers_count || 0}
        </span>
        <span>
          <svg height="16" viewBox="0 0 16 16" width="16" fill="currentColor">
            <path d="M5 5.372v.778c0 .445-.164.886-.46 1.228L2.8 10.4a.75.75 0 101.4.55l1.68-3.28H7.5v7.25a.75.75 0 001.5 0V8.45h1.32l1.68 3.28a.75.75 0 101.4-.55l-1.74-3.032A1.75 1.75 0 0011.5 6.15v-.778a2.75 2.75 0 10-5.5 0z"></path>
          </svg>
          ${repo.forks_count || 0}
        </span>
        <span>
          <svg height="16" viewBox="0 0 16 16" width="16" fill="currentColor">
            <path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75H9.5v-1.128a2.251 2.251 0 10-1.5 0V7.25H5.75a.75.75 0 01-.75-.75v-.878z"></path>
          </svg>
          ${language}
        </span>
      </div>
      <div class="repo-footer">
        <div class="repo-language">
          <span class="language-dot" style="background: ${languageColor}"></span>
          <span>${language}</span>
        </div>
        <div class="repo-actions">
          <button class="repo-btn" data-action="view" data-owner="${repo.owner.login}" data-repo="${
    repo.name
  }">View</button>
          <button class="repo-btn" data-action="add-files" data-owner="${
            repo.owner.login
          }" data-repo="${repo.name}">Add Files</button>
          <button class="repo-btn" data-action="commit" data-owner="${
            repo.owner.login
          }" data-repo="${repo.name}">Commit</button>
          ${
            website
              ? `<a href="${website}" target="_blank" class="repo-btn" onclick="event.stopPropagation()">Website</a>`
              : `<button class="repo-btn" data-action="set-website" data-owner="${repo.owner.login}" data-repo="${repo.name}">Set Website</button>`
          }
          ${
            canDelete
              ? `<button class="repo-btn danger" data-action="delete" data-owner="${repo.owner.login}" data-repo="${repo.name}" title="Delete Repository">
                  <svg height="16" viewBox="0 0 16 16" width="16" fill="currentColor" style="margin-right: 4px;">
                    <path d="M11 1.75V3h3.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H6V1.75C6 .784 6.784 0 7.75 0h2.5C11.216 0 12 .784 12 1.75zM4.496 6.675l.66 6.6a.25.25 0 00.249.225h5.19a.25.25 0 00.249-.225l.66-6.6a.75.75 0 00-1.492.075l-.26 2.6H6.256l-.26-2.6A.75.75 0 004.496 6.675zM8 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 5zm-2.25.75a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5zm4.5 0a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z"></path>
                  </svg>
                  Delete
                </button>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

// Update statistics
function updateStats(repos) {
  const repoCount = repos.length;
  const starCount = repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);

  document.getElementById("repoCount").textContent = repoCount;
  document.getElementById("starCount").textContent = starCount;
}

// Search functionality
document.getElementById("searchInput")?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  if (query === "") {
    displayRepos(allRepos);
    return;
  }

  const filtered = allRepos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(query) ||
      (repo.description && repo.description.toLowerCase().includes(query)) ||
      (repo.language && repo.language.toLowerCase().includes(query))
  );

  displayRepos(filtered);
});

// Code/Preview tab switching - Set up event listeners
function setupTabSwitching() {
  const codeTabBtn = document.getElementById("codeTabBtn");
  const previewTabBtn = document.getElementById("previewTabBtn");
  const pullRequestsTabBtn = document.getElementById("pullRequestsTabBtn");

  if (codeTabBtn && !codeTabBtn.hasAttribute("data-listener")) {
    codeTabBtn.setAttribute("data-listener", "true");
    codeTabBtn.addEventListener("click", () => {
      const codeView = document.getElementById("codeView");
      const previewView = document.getElementById("previewView");
      const pullRequestsView = document.getElementById("pullRequestsView");

      if (codeView) codeView.style.display = "flex";
      if (previewView) previewView.style.display = "none";
      if (pullRequestsView) pullRequestsView.style.display = "none";
      codeTabBtn.classList.add("active");
      if (previewTabBtn) previewTabBtn.classList.remove("active");
      if (pullRequestsTabBtn) pullRequestsTabBtn.classList.remove("active");
    });
  }

  if (previewTabBtn && !previewTabBtn.hasAttribute("data-listener")) {
    previewTabBtn.setAttribute("data-listener", "true");
    previewTabBtn.addEventListener("click", () => {
      const codeView = document.getElementById("codeView");
      const previewView = document.getElementById("previewView");
      const previewContainer = document.getElementById("previewContainer");

      console.log("Preview tab clicked", {
        codeView: !!codeView,
        previewView: !!previewView,
        previewContainer: !!previewContainer,
      });

      // Hide code view and show preview view
      const pullRequestsView = document.getElementById("pullRequestsView");
      if (codeView) {
        codeView.style.display = "none";
      }
      if (pullRequestsView) {
        pullRequestsView.style.display = "none";
      }
      if (previewView) {
        previewView.style.display = "flex";
        previewView.style.visibility = "visible";
        previewView.style.opacity = "1";
        console.log("Preview view displayed and made visible");
      }
      if (codeTabBtn) codeTabBtn.classList.remove("active");
      if (pullRequestsTabBtn) pullRequestsTabBtn.classList.remove("active");
      previewTabBtn.classList.add("active");

      // Force a reflow to ensure display changes take effect
      if (previewView) {
        previewView.offsetHeight; // Trigger reflow
      }

      // Load preview content when tab is clicked
      console.log("Preview tab clicked - checking content:", {
        hasContent: !!currentFileContent,
        type: currentFileType,
        path: currentFile?.path,
        contentLength: currentFileContent?.length,
      });

      if (currentFileContent && currentFileType) {
        console.log("Loading preview:", currentFileType, currentFile?.path);
        try {
          if (currentFileType === "html") {
            loadHTMLPreview(currentFileContent, currentFile?.path || "");
          } else if (currentFileType === "markdown") {
            loadPreview(currentFileContent);
          } else if (currentFileType === "image") {
            loadImagePreview(currentFileContent);
          }
        } catch (error) {
          console.error("Error loading preview:", error);
          if (previewContainer) {
            previewContainer.innerHTML = `
              <div class="empty-state">
                <p>Error loading preview: ${error.message}</p>
              </div>
            `;
          }
        }
      } else {
        console.log("No preview content available:", {
          currentFileContent: !!currentFileContent,
          currentFileType,
          currentFile: currentFile?.path,
        });
        if (previewContainer) {
          previewContainer.innerHTML = `
            <div class="empty-state">
              <p>No preview available for this file type</p>
              <p style="font-size: 12px; margin-top: 8px; color: var(--text-secondary);">
                Preview is only available for HTML, Markdown, and image files.
              </p>
            </div>
          `;
        }
      }
    });
  }

  if (pullRequestsTabBtn && !pullRequestsTabBtn.hasAttribute("data-listener")) {
    pullRequestsTabBtn.setAttribute("data-listener", "true");
    pullRequestsTabBtn.addEventListener("click", async () => {
      const codeView = document.getElementById("codeView");
      const previewView = document.getElementById("previewView");
      const pullRequestsView = document.getElementById("pullRequestsView");

      // Hide other views and show PR view
      if (codeView) codeView.style.display = "none";
      if (previewView) previewView.style.display = "none";
      if (pullRequestsView) pullRequestsView.style.display = "flex";

      // Update active tab
      if (codeTabBtn) codeTabBtn.classList.remove("active");
      if (previewTabBtn) previewTabBtn.classList.remove("active");
      pullRequestsTabBtn.classList.add("active");

      // Load pull requests if we have a current repo
      if (currentRepo) {
        await loadPullRequests(currentRepo.owner.login, currentRepo.name);
      }
    });
  }
}

// Show repository code viewer - Make it globally accessible
window.showRepoPreview = async function (owner, repoName) {
  try {
    console.log("Opening repo preview:", owner, repoName);

    const modal = document.getElementById("repoModal");
    if (!modal) {
      console.error("Modal element not found");
      showNotification("Error: Modal not found. Please refresh the page.", "error");
      return;
    }

    const repo = allRepos.find((r) => r.name === repoName && r.owner.login === owner);

    if (!repo) {
      console.error("Repository not found:", owner, repoName);
      showNotification("Repository not found", "error");
      return;
    }

    currentRepo = repo;
    modal.classList.add("active");
    console.log("Modal opened");

    // Set header info
    document.getElementById("modalRepoOwner").textContent = owner;
    document.getElementById("modalRepoName").textContent = repoName;
    document.getElementById("modalRepoVisibility").textContent = repo.private
      ? "Private"
      : "Public";
    document.getElementById("modalRepoLink").href = repo.html_url;

    // Website buttons removed from header - functionality available via repo card

    // Store repo data for path resolution
    currentRepo = repo;

    // Ensure tab switching is set up
    setupTabSwitching();

    // Reset views
    const codeView = document.getElementById("codeView");
    const previewView = document.getElementById("previewView");
    const pullRequestsView = document.getElementById("pullRequestsView");
    const codeTabBtn = document.getElementById("codeTabBtn");
    const previewTabBtn = document.getElementById("previewTabBtn");
    const pullRequestsTabBtn = document.getElementById("pullRequestsTabBtn");
    const fileHeader = document.getElementById("fileHeader");

    if (codeView) codeView.style.display = "flex";
    if (previewView) previewView.style.display = "none";
    if (pullRequestsView) pullRequestsView.style.display = "none";
    if (codeTabBtn) codeTabBtn.classList.add("active");
    if (previewTabBtn) {
      previewTabBtn.classList.remove("active");
      previewTabBtn.style.display = "none"; // Hide initially, will show for markdown files
    }
    if (pullRequestsTabBtn) {
      pullRequestsTabBtn.classList.remove("active");
      pullRequestsTabBtn.style.display = "flex"; // Always show PR tab
    }
    if (fileHeader) fileHeader.style.display = "none";

    // Clear content
    document.getElementById("codeContainer").innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 16 16" fill="currentColor" width="64" height="64">
          <path d="M1.75 2.5a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V2.75a.25.25 0 00-.25-.25H1.75zM0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75zm9.22 3.72a.75.75 0 000 1.06L10.69 8 9.22 9.47a.75.75 0 101.06 1.06l2-2a.75.75 0 000-1.06l-2-2a.75.75 0 00-1.06 0zM6.78 6.53a.75.75 0 00-1.06-1.06l-2 2a.75.75 0 000 1.06l2 2a.75.75 0 001.06-1.06L5.31 8l1.47-1.47z"></path>
        </svg>
        <p>Select a file to view</p>
      </div>
    `;

    // Clear preview content
    const previewContainer = document.getElementById("previewContainer");
    if (previewContainer) {
      previewContainer.innerHTML = `
        <div class="empty-state">
          <p>Preview will appear here</p>
        </div>
      `;
    }

    // Reset file content tracking
    currentFileContent = null;
    currentFileType = null;

    // Load file tree
    await loadFileTree(owner, repoName);
  } catch (error) {
    console.error("Error in showRepoPreview:", error);
    showNotification("Error opening repository view: " + error.message, "error");
  }
};

// Load file tree
async function loadFileTree(owner, repo) {
  const container = document.getElementById("fileTreeContent");
  if (!container) {
    console.error("File tree container not found");
    return;
  }

  container.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
    </div>
  `;

  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Authorization: `token ${token}` },
    });

    if (!repoRes.ok) {
      throw new Error(`Failed to fetch repo: ${repoRes.status}`);
    }

    const repoData = await repoRes.json();
    const defaultBranch = repoData.default_branch || "main" || "master";

    // Update currentRepo with default branch if not set
    if (currentRepo && !currentRepo.default_branch) {
      currentRepo.default_branch = defaultBranch;
    }

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
      {
        headers: { Authorization: `token ${token}` },
      }
    );

    if (!res.ok) {
      // Try without recursive if it fails
      const res2 = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents?ref=${defaultBranch}`,
        {
          headers: { Authorization: `token ${token}` },
        }
      );

      if (res2.ok) {
        const contents = await res2.json();
        fileTree = contents;

        // Build hierarchical tree structure
        const treeHtml = buildFileTree(contents, owner, repo, defaultBranch);

        container.innerHTML = treeHtml || '<div class="empty-state"><p>No files found</p></div>';

        // Add click handlers for files
        document.querySelectorAll('.file-tree-item[data-type="file"]').forEach((item) => {
          item.addEventListener("click", (e) => {
            e.stopPropagation();
            const path = item.dataset.path;
            const sha = item.dataset.sha;
            const url = item.dataset.url;
            loadFileContent(owner, repo, path, sha, url);

            // Update active state
            document
              .querySelectorAll(".file-tree-item")
              .forEach((i) => i.classList.remove("active"));
            item.classList.add("active");
          });
        });

        // Add click handlers for folders
        document.querySelectorAll(".file-tree-folder").forEach((folder) => {
          folder.addEventListener("click", (e) => {
            e.stopPropagation();
            folder.classList.toggle("expanded");
            const children = folder.nextElementSibling;
            if (children && children.classList.contains("file-tree-children")) {
              children.style.display = children.style.display === "none" ? "block" : "none";
            }
          });
        });
        return;
      }
      throw new Error(`Failed to load file tree: ${res.status}`);
    }

    const data = await res.json();
    fileTree = data.tree || [];

    // Build hierarchical tree structure
    const treeHtml = buildFileTreeFromBlobs(fileTree, owner, repo, defaultBranch);

    container.innerHTML = treeHtml || '<div class="empty-state"><p>No files found</p></div>';

    // Add click handlers for files
    document.querySelectorAll('.file-tree-item[data-type="file"]').forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const path = item.dataset.path;
        const sha = item.dataset.sha;
        loadFileContent(owner, repo, path, sha);

        // Update active state
        document.querySelectorAll(".file-tree-item").forEach((i) => i.classList.remove("active"));
        item.classList.add("active");
      });
    });

    // Add click handlers for folders
    document.querySelectorAll(".file-tree-folder").forEach((folder) => {
      folder.addEventListener("click", (e) => {
        e.stopPropagation();
        folder.classList.toggle("expanded");
        const children = folder.nextElementSibling;
        if (children && children.classList.contains("file-tree-children")) {
          children.style.display = children.style.display === "none" ? "block" : "none";
        }
      });
    });
  } catch (error) {
    console.error("Error loading file tree:", error);
    container.innerHTML = `
      <div class="empty-state">
        <p>Failed to load files: ${error.message}</p>
        <p style="font-size: 12px; margin-top: 8px; color: var(--text-secondary);">Make sure you have access to this repository.</p>
      </div>
    `;
  }
}

// Build file tree from contents API (shows folders)
function buildFileTree(contents, owner, repo, defaultBranch) {
  const tree = {};

  // Organize files and folders
  contents.forEach((item) => {
    const parts = item.path.split("/");
    let current = tree;

    if (item.type === "dir") {
      // It's a folder
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = { type: "dir", children: {}, items: [] };
        }
        if (i === parts.length - 1) {
          current[part].items.push(item);
        }
        current = current[part].children;
      }
    } else {
      // It's a file
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = { type: "dir", children: {}, items: [] };
        }
        current = current[part].children;
      }
      const fileName = parts[parts.length - 1];
      if (!current[fileName]) {
        current[fileName] = { type: "file", item: item };
      }
    }
  });

  // Render tree
  function renderNode(node, path = "", level = 0) {
    let html = "";
    const entries = Object.entries(node).sort((a, b) => {
      // Folders first, then files
      if (a[1].type === "dir" && b[1].type !== "dir") return -1;
      if (a[1].type !== "dir" && b[1].type === "dir") return 1;
      return a[0].localeCompare(b[0]);
    });

    entries.forEach(([name, data]) => {
      const fullPath = path ? `${path}/${name}` : name;

      if (data.type === "dir") {
        html += `
          <div class="file-tree-folder" style="padding-left: ${level * 16}px;">
            <svg height="16" viewBox="0 0 16 16" width="16" fill="currentColor" style="margin-right: 4px;">
              <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1L5.6 1.35a.25.25 0 00-.2-.1H1.75z"></path>
            </svg>
            <span>${name}</span>
          </div>
          <div class="file-tree-children" style="display: none;">
            ${renderNode(data.children, fullPath, level + 1)}
            ${data.items
              .map((item) => {
                const isImage = /\.(jpg|jpeg|png|gif|svg|webp|avif)$/i.test(item.path);
                const imageUrl = isImage
                  ? `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${encodeURIComponent(
                      item.path
                    )}`
                  : item.download_url || item.git_url || "";
                const fileColor = getFileExtensionColor(item.path);
                return `
                <div class="file-tree-item" data-type="file" data-path="${item.path}" data-sha="${
                  item.sha
                }" data-url="${imageUrl}" style="padding-left: ${(level + 1) * 16}px;">
                  <svg height="16" viewBox="0 0 16 16" width="16" fill="${fileColor}" style="margin-right: 4px;">
                    <path d="M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06zM2.5 2.75V14.5h11V5.5H9.75a.25.25 0 01-.25-.25V2.5H2.5z"></path>
                  </svg>
                  <span>${item.name}</span>
                </div>
              `;
              })
              .join("")}
          </div>
        `;
      } else {
        const item = data.item;
        const isImage = /\.(jpg|jpeg|png|gif|svg|webp|avif)$/i.test(item.path);
        const imageUrl = isImage
          ? `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${encodeURIComponent(
              item.path
            )}`
          : item.download_url || item.git_url || "";
        const fileColor = getFileExtensionColor(item.path);
        html += `
          <div class="file-tree-item" data-type="file" data-path="${item.path}" data-sha="${
          item.sha
        }" data-url="${imageUrl}" style="padding-left: ${level * 16}px;">
            <svg height="16" viewBox="0 0 16 16" width="16" fill="${fileColor}" style="margin-right: 4px;">
              <path d="M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06zM2.5 2.75V14.5h11V5.5H9.75a.25.25 0 01-.25-.25V2.5H2.5z"></path>
            </svg>
            <span>${item.name || name}</span>
          </div>
        `;
      }
    });

    return html;
  }

  return renderNode(tree);
}

// Build file tree from git tree API (shows folders)
function buildFileTreeFromBlobs(blobs, owner, repo, defaultBranch) {
  const tree = {};

  // Organize files by path
  blobs.forEach((item) => {
    if (item.type === "tree") {
      // It's a folder (directory)
      const parts = item.path.split("/");
      let current = tree;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = { type: "dir", children: {}, items: [] };
        }
        if (i === parts.length - 1) {
          current[part].items.push(item);
        }
        current = current[part].children;
      }
    } else if (item.type === "blob") {
      // It's a file
      const parts = item.path.split("/");
      let current = tree;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = { type: "dir", children: {}, items: [] };
        }
        current = current[part].children;
      }
      const fileName = parts[parts.length - 1];
      current[fileName] = { type: "file", item: item };
    }
  });

  // Render tree
  function renderNode(node, path = "", level = 0) {
    let html = "";
    const entries = Object.entries(node).sort((a, b) => {
      // Folders first, then files
      if (a[1].type === "dir" && b[1].type !== "dir") return -1;
      if (a[1].type !== "dir" && b[1].type === "dir") return 1;
      return a[0].localeCompare(b[0]);
    });

    entries.forEach(([name, data]) => {
      const fullPath = path ? `${path}/${name}` : name;

      if (data.type === "dir") {
        html += `
          <div class="file-tree-folder" style="padding-left: ${level * 16}px;">
            <svg height="16" viewBox="0 0 16 16" width="16" fill="currentColor" style="margin-right: 4px;">
              <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1L5.6 1.35a.25.25 0 00-.2-.1H1.75z"></path>
            </svg>
            <span>${name}</span>
          </div>
          <div class="file-tree-children" style="display: none;">
            ${renderNode(data.children, fullPath, level + 1)}
            ${data.items
              .map((item) => {
                const isImage = /\.(jpg|jpeg|png|gif|svg|webp|avif)$/i.test(item.path);
                const imageUrl = isImage
                  ? `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${encodeURIComponent(
                      item.path
                    )}`
                  : "";
                const fileColor = getFileExtensionColor(item.path);
                return `
                <div class="file-tree-item" data-type="file" data-path="${item.path}" data-sha="${
                  item.sha
                }" data-url="${imageUrl}" style="padding-left: ${(level + 1) * 16}px;">
                  <svg height="16" viewBox="0 0 16 16" width="16" fill="${fileColor}" style="margin-right: 4px;">
                    <path d="M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06zM2.5 2.75V14.5h11V5.5H9.75a.25.25 0 01-.25-.25V2.5H2.5z"></path>
                  </svg>
                  <span>${item.path.split("/").pop()}</span>
                </div>
              `;
              })
              .join("")}
          </div>
        `;
      } else {
        const item = data.item;
        const isImage = /\.(jpg|jpeg|png|gif|svg|webp|avif)$/i.test(item.path);
        const imageUrl = isImage
          ? `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${encodeURIComponent(
              item.path
            )}`
          : "";
        const fileColor = getFileExtensionColor(item.path);
        html += `
          <div class="file-tree-item" data-type="file" data-path="${item.path}" data-sha="${
          item.sha
        }" data-url="${imageUrl}" style="padding-left: ${level * 16}px;">
            <svg height="16" viewBox="0 0 16 16" width="16" fill="${fileColor}" style="margin-right: 4px;">
              <path d="M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06zM2.5 2.75V14.5h11V5.5H9.75a.25.25 0 01-.25-.25V2.5H2.5z"></path>
            </svg>
            <span>${item.path.split("/").pop()}</span>
          </div>
        `;
      }
    });

    return html;
  }

  return renderNode(tree);
}

// Load file content
async function loadFileContent(owner, repo, path, sha, url) {
  currentFile = { path, sha };

  // Show file header
  const fileHeader = document.getElementById("fileHeader");
  const filePath = document.getElementById("filePath");
  const codeContainer = document.getElementById("codeContainer");

  if (!fileHeader || !filePath || !codeContainer) {
    console.error("Required elements not found");
    return;
  }

  fileHeader.style.display = "flex";
  filePath.textContent = path;

  // Clear preview container
  const previewContainer = document.getElementById("previewContainer");
  if (previewContainer) {
    previewContainer.innerHTML = `
      <div class="empty-state">
        <p>Preview will appear here</p>
      </div>
    `;
  }

  // Reset preview tracking
  currentFileContent = null;
  currentFileType = null;

  // Show loading
  codeContainer.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <p>Loading file...</p>
    </div>
  `;

  try {
    let res;

    // Try using contents API first (more reliable)
    if (url) {
      res = await fetch(url, {
        headers: { Authorization: `token ${token}` },
      });
    } else {
      // Fallback to blob API
      res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs/${sha}`, {
        headers: { Authorization: `token ${token}` },
      });
    }

    if (!res.ok) {
      // Try contents API as fallback
      const contentsRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
        {
          headers: { Authorization: `token ${token}` },
        }
      );

      if (contentsRes.ok) {
        const data = await contentsRes.json();
        if (data.content) {
          const content = atob(data.content.replace(/\s/g, ""));
          const fileName = path.split("/").pop();
          const isMarkdown = /\.(md|markdown)$/i.test(fileName);
          const isHTML = /\.(html|htm)$/i.test(fileName);
          const isImage = /\.(jpg|jpeg|png|gif|svg|webp|avif)$/i.test(fileName);

          // Handle image files
          if (isImage) {
            const imageUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${
              currentRepo?.default_branch || "main"
            }/${encodeURIComponent(path)}`;
            currentFileContent = imageUrl;
            currentFileType = "image";

            const previewTabBtn = document.getElementById("previewTabBtn");
            if (previewTabBtn) previewTabBtn.style.display = "flex";

            codeContainer.innerHTML = `
              <div class="empty-state">
                <p>Image file - switch to Preview tab to view</p>
              </div>
            `;

            const previewView = document.getElementById("previewView");
            const codeView = document.getElementById("codeView");
            const codeTabBtn = document.getElementById("codeTabBtn");

            const editBtn = document.getElementById("editFileBtn");
            const saveBtn = document.getElementById("saveFileBtn");
            const cancelBtn = document.getElementById("cancelEditBtn");
            const downloadBtn = document.getElementById("downloadFileBtn");
            const deleteBtn = document.getElementById("deleteFileBtn");
            if (editBtn && saveBtn && cancelBtn) {
              editBtn.style.display = "none";
              saveBtn.style.display = "none";
              cancelBtn.style.display = "none";
            }
            // Hide download/delete for images
            if (downloadBtn) downloadBtn.style.display = "none";
            if (deleteBtn) deleteBtn.style.display = "none";
            if (previewView && codeView && previewTabBtn && codeTabBtn) {
              codeView.style.display = "none";
              previewView.style.display = "flex";
              codeTabBtn.classList.remove("active");
              previewTabBtn.classList.add("active");
              loadImagePreview(imageUrl);
            }
            return;
          }

          // Store content and type for preview
          currentFileContent = content;
          currentFileType = isHTML ? "html" : isMarkdown ? "markdown" : null;
          originalFileContent = content;

          console.log("File loaded:", {
            fileName,
            isHTML,
            isMarkdown,
            hasContent: !!content,
            path,
          });

          const previewTabBtn = document.getElementById("previewTabBtn");
          const editBtn = document.getElementById("editFileBtn");
          const saveBtn = document.getElementById("saveFileBtn");
          const cancelBtn = document.getElementById("cancelEditBtn");
          const downloadBtn = document.getElementById("downloadFileBtn");
          const deleteBtn = document.getElementById("deleteFileBtn");
          if (isMarkdown || isHTML) {
            if (previewTabBtn) {
              previewTabBtn.style.display = "flex";
              console.log("Preview tab button shown");
            }
            if (editBtn && saveBtn && cancelBtn) {
              editBtn.style.display = "flex";
              saveBtn.style.display = "none";
              cancelBtn.style.display = "none";
            }
            // Show download and delete
            if (downloadBtn) downloadBtn.style.display = "flex";
            if (deleteBtn) deleteBtn.style.display = "flex";
          } else {
            if (previewTabBtn) previewTabBtn.style.display = "none";
            if (editBtn && saveBtn && cancelBtn) {
              editBtn.style.display = "flex";
              saveBtn.style.display = "none";
              cancelBtn.style.display = "none";
            }
            // Show download and delete
            if (downloadBtn) downloadBtn.style.display = "flex";
            if (deleteBtn) deleteBtn.style.display = "flex";
          }

          displayCode(content, fileName);
          return;
        }
      }
      throw new Error(`Failed to load file: ${res.status}`);
    }

    const data = await res.json();
    let content;

    if (data.content) {
      // Contents API response
      content = atob(data.content.replace(/\s/g, ""));
    } else if (data.encoding === "base64") {
      // Blob API response
      content = atob(data.content);
    } else {
      throw new Error("Unknown content encoding");
    }

    const fileName = path.split("/").pop();
    const isMarkdown = /\.(md|markdown)$/i.test(fileName);
    const isHTML = /\.(html|htm)$/i.test(fileName);
    const isImage = /\.(jpg|jpeg|png|gif|svg|webp|avif)$/i.test(fileName);

    // Handle image files - show preview instead of code
    if (isImage) {
      // Get the raw file URL for images - use provided URL or construct it
      const imageUrl =
        url ||
        `https://raw.githubusercontent.com/${owner}/${repo}/${
          currentRepo?.default_branch || "main"
        }/${encodeURIComponent(path)}`;

      // Store image URL for preview
      currentFileContent = imageUrl;
      currentFileType = "image";

      // Show preview tab for images
      const previewTabBtn = document.getElementById("previewTabBtn");
      if (previewTabBtn) {
        previewTabBtn.style.display = "flex";
      }

      // Hide edit controls for images
      const editBtn = document.getElementById("editFileBtn");
      const saveBtn = document.getElementById("saveFileBtn");
      const cancelBtn = document.getElementById("cancelEditBtn");
      if (editBtn && saveBtn && cancelBtn) {
        editBtn.style.display = "none";
        saveBtn.style.display = "none";
        cancelBtn.style.display = "none";
      }

      // Show image in preview, code view shows empty
      codeContainer.innerHTML = `
        <div class="empty-state">
          <p>Image file - switch to Preview tab to view</p>
        </div>
      `;

      // Auto-switch to preview tab for images
      const previewView = document.getElementById("previewView");
      const codeView = document.getElementById("codeView");
      const codeTabBtn = document.getElementById("codeTabBtn");
      if (previewView && codeView && previewTabBtn && codeTabBtn) {
        codeView.style.display = "none";
        previewView.style.display = "flex";
        codeTabBtn.classList.remove("active");
        previewTabBtn.classList.add("active");
        loadImagePreview(imageUrl);
      }
      return;
    }

    // Store content and type for preview
    currentFileContent = content;
    currentFileType = isHTML ? "html" : isMarkdown ? "markdown" : null;
    originalFileContent = content;

    console.log("File loaded (main path):", {
      fileName,
      isHTML,
      isMarkdown,
      hasContent: !!content,
      path,
    });

    // Show preview tab if markdown or HTML
    const previewTabBtn = document.getElementById("previewTabBtn");
    const editBtn = document.getElementById("editFileBtn");
    const saveBtn = document.getElementById("saveFileBtn");
    const cancelBtn = document.getElementById("cancelEditBtn");
    const downloadBtn = document.getElementById("downloadFileBtn");
    const deleteBtn = document.getElementById("deleteFileBtn");

    if (previewTabBtn) {
      if (isMarkdown || isHTML) {
        previewTabBtn.style.display = "flex";
        console.log("Preview tab button shown (main path)");
        if (editBtn && saveBtn && cancelBtn) {
          editBtn.style.display = "flex";
          saveBtn.style.display = "none";
          cancelBtn.style.display = "none";
        }
        // Show download and delete for all files
        if (downloadBtn) downloadBtn.style.display = "flex";
        if (deleteBtn) deleteBtn.style.display = "flex";
        // Don't load preview yet - wait for user to click Preview tab
      } else {
        previewTabBtn.style.display = "none";
        if (editBtn && saveBtn && cancelBtn) {
          editBtn.style.display = "flex";
          saveBtn.style.display = "none";
          cancelBtn.style.display = "none";
        }
        // Show download and delete for all files
        if (downloadBtn) downloadBtn.style.display = "flex";
        if (deleteBtn) deleteBtn.style.display = "flex";
        currentFileContent = null;
        currentFileType = null;
      }
    }

    // Show code
    displayCode(content, fileName);
  } catch (error) {
    console.error("Error loading file:", error);
    codeContainer.innerHTML = `
      <div class="empty-state">
        <p>Failed to load file: ${error.message}</p>
        <p style="font-size: 12px; margin-top: 8px; color: var(--text-secondary);">The file may be too large or you may not have access.</p>
      </div>
    `;
  }
}

// Display code
function displayCode(content, fileName) {
  const codeContainer = document.getElementById("codeContainer");
  if (!codeContainer) return;

  if (isEditMode) {
    // Show textarea for editing - don't escape, use raw content
    codeContainer.innerHTML = `
      <div class="code-block">
        <div class="code-header">
          <span class="code-filename">${fileName}</span>
        </div>
        <textarea id="fileEditor" class="file-editor" spellcheck="false">${content}</textarea>
      </div>
    `;

    // Focus the textarea
    setTimeout(() => {
      const editor = document.getElementById("fileEditor");
      if (editor) {
        editor.focus();
        // Set cursor to end
        editor.setSelectionRange(editor.value.length, editor.value.length);
      }
    }, 100);
  } else {
    // Show code view
    const lines = content.split("\n");
    const codeLines = lines
      .map((line, index) => {
        const escaped = line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

        return `
        <div class="code-line">
          <span class="line-number">${index + 1}</span>
          <span class="line-content">${escaped || " "}</span>
        </div>
      `;
      })
      .join("");

    codeContainer.innerHTML = `
      <div class="code-block">
        <div class="code-header">
          <span class="code-filename">${fileName}</span>
        </div>
        <div class="code-lines">${codeLines}</div>
      </div>
    `;
  }
}

// Load HTML preview with proper relative path resolution
function loadHTMLPreview(content, filePath) {
  console.log("loadHTMLPreview called:", {
    filePath,
    hasContent: !!content,
    currentRepo,
    contentLength: content?.length,
  });
  const previewContainer = document.getElementById("previewContainer");
  if (!previewContainer) {
    console.error("Preview container not found!");
    return;
  }

  // Ensure preview view is visible
  const previewView = document.getElementById("previewView");
  if (previewView) {
    previewView.style.display = "flex";
  }

  // Show loading state
  previewContainer.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <p>Loading preview...</p>
    </div>
  `;

  // Get the base directory of the HTML file
  const pathParts = (filePath || "").split("/");
  pathParts.pop(); // Remove filename
  const baseDir = pathParts.join("/");
  const defaultBranch = currentRepo?.default_branch || "main";
  const owner = currentRepo?.owner?.login || "";
  const repoName = currentRepo?.name || "";

  // Build base URL for relative paths
  const baseUrl = currentRepo
    ? `https://raw.githubusercontent.com/${owner}/${repoName}/${defaultBranch}/${
        baseDir ? baseDir + "/" : ""
      }`
    : "";

  console.log("Base URL for relative paths:", baseUrl, { filePath, baseDir, defaultBranch });

  // Process HTML content to fix relative paths
  let processedContent = content || "";

  // Helper function to resolve relative paths
  function resolvePath(relativePath) {
    if (!relativePath || !baseUrl) return relativePath;

    // Clean the path
    relativePath = relativePath.trim();

    // Handle absolute paths (starting with /)
    if (relativePath.startsWith("/")) {
      const resolved = `https://raw.githubusercontent.com/${owner}/${repoName}/${defaultBranch}${relativePath}`;
      console.log(`Resolved absolute path: ${relativePath} -> ${resolved}`);
      return resolved;
    }

    // Handle parent directory paths (../)
    if (relativePath.startsWith("../")) {
      const currentParts = baseDir.split("/").filter((p) => p);
      const relativeParts = relativePath.split("/");
      let resolvedParts = [...currentParts];

      for (const part of relativeParts) {
        if (part === "..") {
          resolvedParts.pop();
        } else if (part !== "." && part !== "") {
          resolvedParts.push(part);
        }
      }

      const resolved = `https://raw.githubusercontent.com/${owner}/${repoName}/${defaultBranch}/${resolvedParts.join(
        "/"
      )}`;
      console.log(`Resolved parent path: ${relativePath} -> ${resolved}`);
      return resolved;
    }

    // Handle current directory paths (./)
    if (relativePath.startsWith("./")) {
      relativePath = relativePath.substring(2);
    }

    // Simple relative path - ensure proper URL encoding
    const resolved = baseUrl + encodeURI(relativePath).replace(/%2F/g, "/"); // Keep slashes unencoded
    console.log(`Resolved relative path: ${relativePath} -> ${resolved}`);
    return resolved;
  }

  // Fix relative CSS links - multiple patterns to catch all cases
  // Pattern 1: href="style.css" or href='style.css' (with quotes)
  processedContent = processedContent.replace(
    /(<link[^>]+href=["'])(?!https?:\/\/|#|\/|data:)([^"']+\.css[^"']*)(["'])/gi,
    (match, prefix, path, suffix) => {
      const fullUrl = resolvePath(path);
      console.log(`Resolved CSS (quoted): ${path} -> ${fullUrl}`);
      return prefix + fullUrl + suffix;
    }
  );

  // Pattern 2: href=style.css (no quotes) - less common but possible
  processedContent = processedContent.replace(
    /(<link[^>]+href=)(?!https?:\/\/|#|\/|data:|["'])([^\s>]+\.css[^\s>]*)(\s|>)/gi,
    (match, prefix, path, suffix) => {
      const fullUrl = resolvePath(path);
      console.log(`Resolved CSS (unquoted): ${path} -> ${fullUrl}`);
      return prefix + '"' + fullUrl + '"' + suffix;
    }
  );

  // Fix relative JS scripts - multiple patterns to catch all cases
  // Pattern 1: src="script.js" or src='script.js' (with quotes)
  processedContent = processedContent.replace(
    /(<script[^>]+src=["'])(?!https?:\/\/|#|\/|data:)([^"']+\.js[^"']*)(["'])/gi,
    (match, prefix, path, suffix) => {
      const fullUrl = resolvePath(path);
      console.log(`Resolved JS (quoted): ${path} -> ${fullUrl}`);
      return prefix + fullUrl + suffix;
    }
  );

  // Pattern 2: src=script.js (no quotes) - less common but possible
  processedContent = processedContent.replace(
    /(<script[^>]+src=)(?!https?:\/\/|#|\/|data:|["'])([^\s>]+\.js[^\s>]*)(\s|>)/gi,
    (match, prefix, path, suffix) => {
      const fullUrl = resolvePath(path);
      console.log(`Resolved JS (unquoted): ${path} -> ${fullUrl}`);
      return prefix + '"' + fullUrl + '"' + suffix;
    }
  );

  // Also handle CSS in style tags with @import
  processedContent = processedContent.replace(
    /(@import\s+)(["']?)(?!https?:\/\/|url\()([^"'\s;]+\.css[^"'\s;]*)\2/gi,
    (match, prefix, quote, path) => {
      const fullUrl = resolvePath(path);
      console.log(`Resolved CSS import: ${path} -> ${fullUrl}`);
      return prefix + (quote || '"') + fullUrl + (quote || '"');
    }
  );

  // Fix relative image sources - handle both quote types
  processedContent = processedContent.replace(
    /(<img[^>]+src=)(["']?)(?!https?:\/\/|#|\/|data:)([^"'\s>]+\.(jpg|jpeg|png|gif|svg|webp|avif)[^"'\s>]*)\2/gi,
    (match, prefix, quote, path) => {
      const fullUrl = resolvePath(path);
      console.log(`Resolved image: ${path} -> ${fullUrl}`);
      return prefix + (quote || '"') + fullUrl + (quote || '"');
    }
  );

  // Fix relative links in href attributes (for other resources)
  processedContent = processedContent.replace(
    /(<a[^>]+href=["'])(?!https?:\/\/|#|\/|mailto:|tel:)([^"']+)(["'])/gi,
    (match, prefix, path, suffix) => {
      // Only fix if it looks like a file path
      if (
        path.includes(".") ||
        path.startsWith("./") ||
        path.startsWith("../") ||
        path.startsWith("/")
      ) {
        const fullUrl = resolvePath(path);
        console.log(`Resolved link: ${path} -> ${fullUrl}`);
        return prefix + fullUrl + suffix;
      }
      return match;
    }
  );

  console.log("Content processed, checking for CSS/JS references...");

  // Extract all CSS and JS file URLs that need to be inlined
  const cssUrls = [];
  const jsUrls = [];

  // Find all CSS links - improved regex to catch all cases
  // First, let's see what the processed content actually contains
  const cssLinkMatches = processedContent.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi);
  console.log("All CSS link matches found:", cssLinkMatches);

  const cssLinkRegex = /<link[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let cssMatch;
  while ((cssMatch = cssLinkRegex.exec(processedContent)) !== null) {
    const url = cssMatch[1];
    console.log(
      "Found CSS URL candidate:",
      url,
      "startsWith http:",
      url?.startsWith("http"),
      "includes .css:",
      url?.includes(".css")
    );
    if (url && url.startsWith("http") && url.includes(".css")) {
      cssUrls.push(url);
      console.log("✅ Added CSS URL to inline list:", url);
    } else {
      console.log("❌ CSS URL not added - doesn't match criteria:", url);
    }
  }

  // Find all JS scripts - improved regex to catch all cases
  const jsScriptMatches = processedContent.match(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi);
  console.log("All JS script matches found:", jsScriptMatches);

  const jsScriptRegex = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let jsMatch;
  while ((jsMatch = jsScriptRegex.exec(processedContent)) !== null) {
    const url = jsMatch[1];
    console.log(
      "Found JS URL candidate:",
      url,
      "startsWith http:",
      url?.startsWith("http"),
      "includes .js:",
      url?.includes(".js")
    );
    if (url && url.startsWith("http") && url.includes(".js")) {
      jsUrls.push(url);
      console.log("✅ Added JS URL to inline list:", url);
    } else {
      console.log("❌ JS URL not added - doesn't match criteria:", url);
    }
  }

  console.log("CSS files to inline:", cssUrls);
  console.log("JS files to inline:", jsUrls);

  // If no resources to inline, use processed content directly
  if (cssUrls.length === 0 && jsUrls.length === 0) {
    console.log("No external resources to inline, using processed content directly");
  }

  // Function to fetch and inline resources
  async function inlineResources() {
    console.log(
      "inlineResources() called with",
      cssUrls.length,
      "CSS files and",
      jsUrls.length,
      "JS files"
    );
    let finalContent = processedContent;

    // Fetch and inline CSS files
    for (const cssUrl of cssUrls) {
      try {
        console.log(`Fetching CSS: ${cssUrl}`);
        const cssRes = await fetch(cssUrl, {
          headers: { Authorization: `token ${token}` },
        });
        if (cssRes.ok) {
          const cssContent = await cssRes.text();
          // Replace link tag with style tag
          finalContent = finalContent.replace(
            new RegExp(
              `<link[^>]+href=["']${cssUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
              "gi"
            ),
            `<style>${cssContent}</style>`
          );
          console.log(`Inlined CSS: ${cssUrl}`);
        } else {
          console.warn(`Failed to fetch CSS: ${cssUrl}`, cssRes.status);
        }
      } catch (error) {
        console.error(`Error fetching CSS ${cssUrl}:`, error);
      }
    }

    // Fetch and inline JS files
    for (const jsUrl of jsUrls) {
      try {
        console.log(`Fetching JS: ${jsUrl}`);
        const jsRes = await fetch(jsUrl, {
          headers: { Authorization: `token ${token}` },
        });
        if (jsRes.ok) {
          const jsContent = await jsRes.text();
          // Replace script src with inline script
          finalContent = finalContent.replace(
            new RegExp(
              `<script[^>]+src=["']${jsUrl.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
              )}["'][^>]*></script>`,
              "gi"
            ),
            `<script>${jsContent}</script>`
          );
          console.log(`Inlined JS: ${jsUrl}`);
        } else {
          console.warn(`Failed to fetch JS: ${jsUrl}`, jsRes.status);
        }
      } catch (error) {
        console.error(`Error fetching JS ${jsUrl}:`, error);
      }
    }

    console.log("inlineResources() completed, returning final content");
    return finalContent;
  }

  // Clear container first
  previewContainer.innerHTML = "";

  // Create wrapper
  const wrapper = document.createElement("div");
  wrapper.className = "preview-content html-preview";
  wrapper.style.cssText = "width: 100%; height: 100%; min-height: 400px;";

  // Create iframe - allow loading external resources
  const iframe = document.createElement("iframe");
  iframe.id = "htmlPreviewFrame";
  // Allow same-origin, scripts, forms, popups, and top-level navigation for external resources
  // Note: We need to allow top-level navigation to load external CSS/JS from raw.githubusercontent.com
  iframe.sandbox =
    "allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation";
  iframe.setAttribute("allow", "same-origin");
  iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
  iframe.style.cssText =
    "width: 100%; min-height: 400px; border: none; background: white; display: block;";

  wrapper.appendChild(iframe);
  previewContainer.appendChild(wrapper);

  console.log("Preview container updated, iframe added");

  // If no resources to inline, use processed content directly
  if (cssUrls.length === 0 && jsUrls.length === 0) {
    console.log("No external resources to inline, using processed content directly");
    // Still need to wait for iframe, then use processed content
    setTimeout(() => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(processedContent);
          iframeDoc.close();
          console.log("Iframe content set (no inlining needed), length:", processedContent.length);
        }
      } catch (e) {
        console.error("Error setting iframe content (no inlining):", e);
      }
    }, 100);
    return; // Exit early if no resources to inline
  }

  // Fetch and inline resources, then set iframe content
  inlineResources()
    .then((finalContent) => {
      // Wait a bit for iframe to be ready
      setTimeout(() => {
        try {
          // Use document.write instead of srcdoc - it allows better resource loading
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          if (iframeDoc) {
            iframeDoc.open();
            iframeDoc.write(finalContent);
            iframeDoc.close();
            console.log("Iframe content set via document.write, length:", finalContent.length);

            console.log("Resources inlined successfully");
          } else {
            // Fallback: use srcdoc
            if (iframe.srcdoc !== undefined) {
              iframe.srcdoc = finalContent;
              console.log("Iframe content set via srcdoc (fallback), length:", finalContent.length);
            } else {
              // Last resort: use blob URL
              const blob = new Blob([finalContent], { type: "text/html" });
              const blobUrl = URL.createObjectURL(blob);
              iframe.src = blobUrl;
              console.log("Iframe content set via blob URL");
            }
          }
        } catch (e) {
          console.error("Error setting iframe content:", e);
          previewContainer.innerHTML = `
          <div class="empty-state">
            <p>Error loading preview: ${e.message}</p>
            <p style="font-size: 12px; margin-top: 8px;">Check console for details</p>
            <pre style="text-align: left; margin-top: 16px; font-size: 12px; color: var(--text-secondary);">${
              e.stack || ""
            }</pre>
          </div>
        `;
          return;
        }
      }, 100);
    })
    .catch((error) => {
      console.error("Error inlining resources:", error);
      // Fallback: try to load without inlining
      setTimeout(() => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          if (iframeDoc) {
            iframeDoc.open();
            iframeDoc.write(processedContent);
            iframeDoc.close();
            console.log("Fallback: Iframe content set without inlining");
          }
        } catch (e) {
          console.error("Fallback also failed:", e);
        }
      }, 100);
    });

  // Adjust iframe height to content after load
  iframe.onload = () => {
    console.log("Iframe onload event fired");
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (iframeDoc && iframeDoc.body) {
        const height = iframeDoc.body.scrollHeight || iframeDoc.documentElement.scrollHeight;
        if (height > 0) {
          iframe.style.height = Math.max(height, 400) + "px";
          console.log("Iframe height set to:", iframe.style.height);
        } else {
          iframe.style.height = "600px";
        }
      }
    } catch (e) {
      console.log("Could not adjust iframe height (CORS or sandbox restriction):", e);
      iframe.style.height = "600px";
    }
  };

  // Also try to adjust height after a delay in case onload doesn't fire
  setTimeout(() => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (iframeDoc && iframeDoc.body) {
        const height = iframeDoc.body.scrollHeight || iframeDoc.documentElement.scrollHeight;
        if (height > 0) {
          iframe.style.height = Math.max(height, 400) + "px";
          console.log("Iframe height adjusted via timeout:", iframe.style.height);
        }
      }
    } catch (e) {
      console.log("Could not adjust iframe height via timeout:", e);
    }
  }, 1000);
}

// Load image preview
function loadImagePreview(imageUrl) {
  const previewContainer = document.getElementById("previewContainer");
  if (!previewContainer) return;

  previewContainer.innerHTML = `
    <div class="preview-content" style="text-align: center; padding: 24px; background: var(--bg-primary);">
      <img src="${imageUrl}" alt="Preview" style="max-width: 100%; max-height: 80vh; border-radius: 8px; box-shadow: var(--shadow-lg);" 
           onerror="this.parentElement.innerHTML='<div class=\\'empty-state\\'><p>Failed to load image</p></div>'">
    </div>
  `;
}

// Load markdown preview
function loadPreview(content) {
  // Enhanced markdown to HTML converter
  let html = content
    // Headers
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    // Code blocks (must be before inline code)
    .replace(/```(\w+)?\n([\s\S]*?)```/gim, (match, lang, code) => {
      return `<pre><code class="language-${lang || ""}">${escapeHtml(code.trim())}</code></pre>`;
    })
    // Inline code
    .replace(/`([^`]+)`/gim, "<code>$1</code>")
    // Bold
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.*?)\*/gim, "<em>$1</em>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Lists
    .replace(/^\* (.*$)/gim, "<li>$1</li>")
    .replace(/^\d+\. (.*$)/gim, "<li>$1</li>")
    // Wrap consecutive list items in ul
    .replace(/(<li>.*<\/li>\n?)+/gim, (match) => {
      return "<ul>" + match + "</ul>";
    })
    // Line breaks
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  // Wrap in paragraph tags
  html = "<p>" + html + "</p>";

  const previewContainer = document.getElementById("previewContainer");
  if (previewContainer) {
    previewContainer.innerHTML = `
      <div class="preview-content">${html}</div>
    `;
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Initialize tab switching when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupTabSwitching);
} else {
  setupTabSwitching();
}

// Tree toggle
document.getElementById("treeToggle")?.addEventListener("click", () => {
  const sidebar = document.getElementById("fileTreeSidebar");
  const toggle = document.getElementById("treeToggle");
  sidebar.classList.toggle("collapsed");
  toggle.textContent = sidebar.classList.contains("collapsed") ? "+" : "−";
});

// Create folder button in file tree
document.getElementById("createFolderInTreeBtn")?.addEventListener("click", () => {
  if (!currentRepo) {
    showNotification("Please open a repository first", "error");
    return;
  }

  // Open file manager with folder tab active
  window.openFileManager(currentRepo.owner.login, currentRepo.name);

  // Switch to folder tab
  setTimeout(() => {
    const folderTab = document.querySelector('.fm-tab-btn[data-tab="folder"]');
    const folderContent = document.getElementById("fm-folder");
    if (folderTab && folderContent) {
      document.querySelectorAll(".fm-tab-btn").forEach((btn) => btn.classList.remove("active"));
      document
        .querySelectorAll(".fm-tab-content")
        .forEach((content) => content.classList.remove("active"));
      folderTab.classList.add("active");
      folderContent.classList.add("active");
    }
  }, 100);
});

// Close modal
document.getElementById("closeModal")?.addEventListener("click", () => {
  document.getElementById("repoModal").classList.remove("active");
});

document.getElementById("repoModal")?.addEventListener("click", (e) => {
  if (e.target.id === "repoModal") {
    document.getElementById("repoModal").classList.remove("active");
  }
});

// Open file manager modal
window.openFileManager = function (owner, repo, filePath = null) {
  currentFileManager = { owner, repo, filePath };
  const modal = document.getElementById("fileManagerModal");
  if (!modal) {
    console.error("File manager modal not found");
    return;
  }

  // Ensure file manager modal appears on top
  modal.style.zIndex = "3000";
  modal.classList.add("active");

  // Bring to front by appending to body (ensures it's last in DOM order)
  document.body.appendChild(modal);

  // Set title
  const titleEl = document.getElementById("fileManagerTitle");
  if (titleEl) titleEl.textContent = `Add Files to ${repo}`;

  // Reset forms
  const createForm = document.getElementById("createFileForm");
  const uploadForm = document.getElementById("uploadFileForm");
  const codebaseForm = document.getElementById("codebaseForm");
  const folderForm = document.getElementById("createFolderForm");
  if (createForm) createForm.reset();
  if (uploadForm) uploadForm.reset();
  if (codebaseForm) codebaseForm.reset();
  if (folderForm) folderForm.reset();

  // If file path provided, pre-fill it
  if (filePath) {
    const filePathInput = document.getElementById("filePath");
    const uploadPathInput = document.getElementById("uploadPath");
    if (filePathInput) filePathInput.value = filePath;
    if (uploadPathInput) uploadPathInput.value = filePath;
  }

  // Reset to first tab
  setupFileManagerTabs();
  document.querySelectorAll(".fm-tab-btn").forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll(".fm-tab-content")
    .forEach((content) => content.classList.remove("active"));
  const createTab = document.querySelector('.fm-tab-btn[data-tab="create"]');
  const createContent = document.getElementById("fm-create");
  if (createTab) createTab.classList.add("active");
  if (createContent) createContent.classList.add("active");
};

// Delete Repository Function
async function deleteRepository(owner, repo) {
  console.log("deleteRepository called with:", owner, repo);

  // Check if showConfirm exists
  if (typeof showConfirm !== "function") {
    console.error("showConfirm function not found!");
    showNotification("Error: Confirmation modal not available", "error");
    return;
  }

  // First check if user has permission to delete
  try {
    const currentUser = userData?.login || (await loadUser()).login;
    const repoInfoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Authorization: `token ${token}` },
    });

    if (repoInfoRes.ok) {
      const repoInfo = await repoInfoRes.json();

      // Check ownership
      if (
        repoInfo.owner &&
        repoInfo.owner.login !== currentUser &&
        repoInfo.owner.type !== "Organization"
      ) {
        showNotification(
          `You can only delete repositories you own. This repository belongs to "${repoInfo.owner.login}".`,
          "error"
        );
        return;
      }

      // For organization repos, check if user has admin access
      if (repoInfo.owner && repoInfo.owner.type === "Organization") {
        // Check user's permission level in the organization
        try {
          const orgMembershipRes = await fetch(
            `https://api.github.com/orgs/${owner}/memberships/${currentUser}`,
            {
              headers: { Authorization: `token ${token}` },
            }
          );

          if (orgMembershipRes.ok) {
            const membership = await orgMembershipRes.json();
            if (membership.role !== "admin" && membership.role !== "owner") {
              showNotification(
                `This repository belongs to the "${owner}" organization. You need to be an organization owner or admin to delete it.`,
                "error"
              );
              return;
            }
          }
        } catch (e) {
          console.log("Could not check org membership, proceeding with delete attempt");
        }
      }
    }
  } catch (e) {
    console.error("Error checking repository permissions:", e);
    // Continue with delete attempt anyway
  }

  // Show confirmation modal
  showConfirm(
    "Delete Repository",
    `Are you sure you want to delete "${repo}"? This action cannot be undone and will permanently delete the repository and all its contents.`,
    async () => {
      console.log("Delete confirmed for:", owner, repo);
      try {
        console.log("Sending DELETE request to:", `https://api.github.com/repos/${owner}/${repo}`);

        // Use Bearer token format (GitHub accepts both, but Bearer is more standard)
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json",
          },
        });

        console.log("Delete response status:", res.status, res.statusText);

        // GitHub returns 204 No Content for successful DELETE operations
        // Note: res.ok is false for 204, so we check status directly
        if (res.status === 204) {
          console.log("Repository deleted successfully (204)");

          // Immediately remove from allRepos array and re-render
          allRepos = allRepos.filter(
            (r) => !(r.name === repo && r.owner && r.owner.login === owner)
          );
          displayRepos(allRepos);
          updateStats(allRepos);

          // Also try to remove the card directly for smooth animation
          const repoCard = document.querySelector(`.repo-card[data-repo="${CSS.escape(repo)}"]`);
          if (repoCard) {
            repoCard.style.transition = "opacity 0.2s, transform 0.2s";
            repoCard.style.opacity = "0";
            repoCard.style.transform = "scale(0.95)";
            setTimeout(() => {
              if (repoCard.parentNode) {
                repoCard.remove();
              }
            }, 200);
          }

          showNotification(`✅ Repository "${repo}" deleted successfully!`, "success");

          // Close repository modal if it's open
          const repoModal = document.getElementById("repoModal");
          if (repoModal && repoModal.classList.contains("active")) {
            repoModal.classList.remove("active");
          }

          // Refresh repository list from GitHub after a short delay
          setTimeout(async () => {
            await loadRepos();
          }, 1000);
          return;
        }

        // Handle errors
        let errorMessage = "Failed to delete repository";
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
          console.error("Delete error:", errorData);
        } catch (e) {
          console.error("Could not parse error response");
        }

        if (res.status === 404) {
          showNotification("Repository not found or already deleted", "error");
        } else if (res.status === 403) {
          // Provide more helpful error message
          let helpfulMessage = "You don't have permission to delete this repository.";

          // Check if it's an organization repo
          try {
            const repoInfo = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
              headers: { Authorization: `token ${token}` },
            }).then((r) => (r.ok ? r.json() : null));

            if (repoInfo && repoInfo.owner && repoInfo.owner.type === "Organization") {
              helpfulMessage = `This repository belongs to the "${owner}" organization. You need to be an organization owner or have admin permissions to delete it. If you're a member, contact an organization owner.`;
            } else if (repoInfo && repoInfo.owner) {
              const currentUser = userData?.login;
              if (currentUser && repoInfo.owner.login !== currentUser) {
                helpfulMessage = `This repository belongs to "${repoInfo.owner.login}". You can only delete repositories you own.`;
              } else {
                // User owns the repo but still getting 403 - likely token permission issue
                helpfulMessage =
                  "Your access token may not have delete permissions. Please use 'Re-authenticate' in Settings to refresh your permissions, or sign out and sign in again. Make sure to grant all requested permissions when authorizing.";
              }
            } else {
              // Generic case - suggest re-authentication
              helpfulMessage =
                "Your access token may not have delete permissions. Please use 'Re-authenticate' in Settings to refresh your permissions, or sign out and sign in again.";
            }
          } catch (e) {
            console.error("Error checking repo info:", e);
          }

          showNotification(helpfulMessage, "error");
        } else {
          showNotification(`Error: ${errorMessage} (Status: ${res.status})`, "error");
        }
      } catch (error) {
        console.error("Error deleting repository:", error);
        showNotification(`❌ Error deleting repository: ${error.message}`, "error");
      }
    }
  );
}

// Commit change - Opens file manager instead of alert
async function commitChange(owner, repo) {
  window.openFileManager(owner, repo);
}

// Commit from modal - Opens file manager
window.commitChangeFromModal = function () {
  if (currentRepo) {
    window.openFileManager(currentRepo.owner.login, currentRepo.name, currentFile?.path || null);
  }
};

// Commit button in code viewer
document.getElementById("commitFromViewerBtn")?.addEventListener("click", () => {
  if (currentRepo) {
    window.openFileManager(currentRepo.owner.login, currentRepo.name, currentFile?.path || null);
  }
});

// Commit button in header
document.getElementById("commitBtn")?.addEventListener("click", () => {
  if (currentRepo) {
    window.openFileManager(currentRepo.owner.login, currentRepo.name, currentFile?.path || null);
  }
});

document.getElementById("setWebsiteBtn")?.addEventListener("click", () => {
  if (!currentRepo) return;
  openSetWebsiteModal(currentRepo.owner.login, currentRepo.name);
});

let pendingWebsiteRepo = null;

function openSetWebsiteModal(owner, repo) {
  pendingWebsiteRepo = { owner, repo };
  const modal = document.getElementById("setWebsiteModal");
  const input = document.getElementById("websiteUrlInput");
  if (!modal || !input) return;
  input.value = "";
  if (
    currentRepo &&
    currentRepo.owner?.login === owner &&
    currentRepo.name === repo &&
    currentRepo.homepage
  ) {
    input.value = currentRepo.homepage;
  }
  modal.classList.add("active");
}

document.getElementById("closeSetWebsiteModal")?.addEventListener("click", () => {
  document.getElementById("setWebsiteModal")?.classList.remove("active");
});

document.getElementById("cancelSetWebsite")?.addEventListener("click", () => {
  document.getElementById("setWebsiteModal")?.classList.remove("active");
});

// Commit Message Modal
let pendingSaveOperation = null;

function openCommitMessageModal(defaultMessage) {
  const modal = document.getElementById("commitMessageModal");
  const input = document.getElementById("commitMessageInput");
  if (!modal || !input) return;
  input.value = defaultMessage || "";
  modal.classList.add("active");
  // Focus the input after modal opens
  setTimeout(() => input.focus(), 100);
}

document.getElementById("closeCommitMessageModal")?.addEventListener("click", () => {
  document.getElementById("commitMessageModal")?.classList.remove("active");
  pendingSaveOperation = null;
});

document.getElementById("cancelCommitMessage")?.addEventListener("click", () => {
  document.getElementById("commitMessageModal")?.classList.remove("active");
  pendingSaveOperation = null;
  // Reset save button
  const saveBtn = document.getElementById("saveFileBtn");
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.innerHTML = `<svg height="16" viewBox="0 0 16 16" width="16" fill="currentColor" style="margin-right: 4px;"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"></path></svg>Save`;
  }
});

document.getElementById("commitMessageModal")?.addEventListener("click", (e) => {
  if (e.target.id === "commitMessageModal") {
    document.getElementById("commitMessageModal")?.classList.remove("active");
    pendingSaveOperation = null;
    // Reset save button
    const saveBtn = document.getElementById("saveFileBtn");
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<svg height="16" viewBox="0 0 16 16" width="16" fill="currentColor" style="margin-right: 4px;"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"></path></svg>Save`;
    }
  }
});

document.getElementById("commitMessageForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Check if this is a delete operation first
  if (pendingDeleteOperation) {
    const commitMessage = document.getElementById("commitMessageInput").value.trim();
    if (!commitMessage) {
      showNotification("Please enter a commit message", "error");
      return;
    }

    // Close modal
    document.getElementById("commitMessageModal")?.classList.remove("active");
    const { fileName, filePath, sha } = pendingDeleteOperation;
    pendingDeleteOperation = null;

    // Show loading
    const deleteBtn = document.getElementById("deleteFileBtn");
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.innerHTML = `<svg height="16" viewBox="0 0 16 16" width="16" fill="currentColor" style="margin-right: 4px;"><path d="M11 1.75V3h3.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H6V1.75C6 .784 6.784 0 7.75 0h2.5C11.216 0 12 .784 12 1.75zM4.496 6.675l.66 6.6a.25.25 0 00.249.225h5.19a.25.25 0 00.249-.225l.66-6.6a.75.75 0 00-1.492.075l-.26 2.6H6.256l-.26-2.6A.75.75 0 004.496 6.675zM8 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 5zm-2.25.75a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5zm4.5 0a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z"></path></svg>Deleting...`;
    }

    try {
      const owner = currentRepo.owner.login;
      const repo = currentRepo.name;

      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `token ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: commitMessage,
            sha: sha,
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to delete file");
      }

      showNotification("File deleted successfully!", "success");

      // Clear current file
      currentFile = null;
      currentFileContent = null;
      originalFileContent = null;

      // Hide file header
      const fileHeader = document.getElementById("fileHeader");
      if (fileHeader) fileHeader.style.display = "none";

      // Clear code container
      const codeContainer = document.getElementById("codeContainer");
      if (codeContainer) {
        codeContainer.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 16 16" fill="currentColor" width="64" height="64">
              <path d="M1.75 2.5a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V2.75a.25.25 0 00-.25-.25H1.75zM0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75zm9.22 3.72a.75.75 0 000 1.06L10.69 8 9.22 9.47a.75.75 0 101.06 1.06l2-2a.75.75 0 000-1.06l-2-2a.75.75 0 00-1.06 0zM6.78 6.53a.75.75 0 00-1.06-1.06l-2 2a.75.75 0 000 1.06l2 2a.75.75 0 001.06-1.06L5.31 8l1.47-1.47z"></path>
            </svg>
            <p>Select a file to view</p>
          </div>
        `;
      }

      // Reload file tree to reflect changes
      if (currentRepo) {
        await loadFileTree(currentRepo.owner.login, currentRepo.name);
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      showNotification(`Failed to delete file: ${error.message}`, "error");
    } finally {
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = `<svg height="16" viewBox="0 0 16 16" width="16" fill="currentColor" style="margin-right: 4px;"><path d="M11 1.75V3h3.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H6V1.75C6 .784 6.784 0 7.75 0h2.5C11.216 0 12 .784 12 1.75zM4.496 6.675l.66 6.6a.25.25 0 00.249.225h5.19a.25.25 0 00.249-.225l.66-6.6a.75.75 0 00-1.492.075l-.26 2.6H6.256l-.26-2.6A.75.75 0 004.496 6.675zM8 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 5zm-2.25.75a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5zm4.5 0a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z"></path></svg>Delete`;
      }
    }
    return; // Don't continue to save handler
  }

  if (!pendingSaveOperation) return;

  const commitMessage = document.getElementById("commitMessageInput").value.trim();
  if (!commitMessage) {
    showNotification("Please enter a commit message", "error");
    return;
  }

  const { newContent, fileName, saveBtn } = pendingSaveOperation;

  // Close modal
  document.getElementById("commitMessageModal")?.classList.remove("active");
  pendingSaveOperation = null;

  // Show loading
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<svg height="16" viewBox="0 0 16 16" width="16" fill="currentColor" style="margin-right: 4px;"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"></path></svg>Saving...`;
  }

  try {
    // Encode content to base64
    const encodedContent = btoa(unescape(encodeURIComponent(newContent)));

    // Update file via GitHub API
    const owner = currentRepo.owner.login;
    const repo = currentRepo.name;
    const filePath = currentFile.path;

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: commitMessage,
          content: encodedContent,
          sha: currentFile.sha, // Required for updating existing files
        }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || "Failed to save file");
    }

    const data = await res.json();

    // Update current file SHA
    currentFile.sha = data.content.sha;
    originalFileContent = newContent;
    currentFileContent = newContent;

    // Exit edit mode
    isEditMode = false;
    const editBtn = document.getElementById("editFileBtn");
    const cancelBtn = document.getElementById("cancelEditBtn");

    if (editBtn && cancelBtn) {
      editBtn.style.display = "flex";
      saveBtn.style.display = "none";
      cancelBtn.style.display = "none";
    }

    // Refresh the display
    displayCode(newContent, fileName);

    // Show success notification
    showNotification("File saved successfully!", "success");

    // Reload file tree to reflect changes
    if (currentRepo) {
      loadFileTree(currentRepo.owner.login, currentRepo.name);
    }
  } catch (error) {
    console.error("Error saving file:", error);
    showNotification(`Failed to save file: ${error.message}`, "error");
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<svg height="16" viewBox="0 0 16 16" width="16" fill="currentColor" style="margin-right: 4px;"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"></path></svg>Save`;
    }
  }
});

document.getElementById("setWebsiteForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!pendingWebsiteRepo) return;
  const url = document.getElementById("websiteUrlInput").value.trim();
  const valid = /^https?:\/\/.+/i.test(url);
  if (!valid) {
    showNotification("Please enter a valid URL starting with http:// or https://", "error");
    return;
  }
  const { owner, repo } = pendingWebsiteRepo;
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      method: "PATCH",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify({ homepage: url }),
    });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.message || "Failed to set website");
    }
    showNotification("Website set successfully", "success");
    document.getElementById("setWebsiteModal")?.classList.remove("active");
    if (currentRepo) {
      currentRepo.homepage = url;
      const goBtn = document.getElementById("goToWebsiteBtn");
      const setBtn = document.getElementById("setWebsiteBtn");
      if (goBtn) {
        goBtn.href = url;
        goBtn.style.display = "flex";
      }
      if (setBtn) setBtn.style.display = "none";
    }
    loadRepos();
  } catch (err) {
    showNotification("Error setting website: " + err.message, "error");
    console.error(err);
  }
});

// Create Repository Modal
document.getElementById("newRepoBtn")?.addEventListener("click", () => {
  document.getElementById("createRepoModal").classList.add("active");
  document.getElementById("repoName").focus();
});

document.getElementById("closeCreateModal")?.addEventListener("click", () => {
  document.getElementById("createRepoModal").classList.remove("active");
});

document.getElementById("cancelCreateRepo")?.addEventListener("click", () => {
  document.getElementById("createRepoModal").classList.remove("active");
  document.getElementById("createRepoForm").reset();
});

document.getElementById("createRepoModal")?.addEventListener("click", (e) => {
  if (e.target.id === "createRepoModal") {
    document.getElementById("createRepoModal").classList.remove("active");
    document.getElementById("createRepoForm").reset();
  }
});

// Create Repository Form Submit
document.getElementById("createRepoForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);
  const repoName = formData.get("repoName");
  const description = formData.get("repoDescription") || "";
  const visibility = formData.get("visibility");
  const addReadme = formData.get("addReadme") === "on";

  if (!repoName) {
    showNotification("Repository name is required", "error");
    return;
  }

  const createBtn = document.querySelector("#createRepoForm .create-btn");
  const originalText = createBtn.textContent;
  createBtn.textContent = "Creating...";
  createBtn.disabled = true;

  try {
    const repoData = {
      name: repoName,
      description: description,
      private: visibility === "private",
      auto_init: addReadme,
    };

    const res = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify(repoData),
    });

    if (res.ok) {
      const newRepo = await res.json();
      showNotification(`✅ Repository "${repoName}" created successfully!`, "success");
      document.getElementById("createRepoModal").classList.remove("active");
      document.getElementById("createRepoForm").reset();

      // Refresh repository list
      loadRepos();

      // Optionally open the new repository
      showConfirm("Repository Created", "Would you like to view the new repository?", () => {
        window.showRepoPreview(newRepo.owner.login, newRepo.name);
      });
    } else {
      const error = await res.json();
      throw new Error(error.message || "Failed to create repository");
    }
  } catch (err) {
    showNotification("❌ Error creating repository: " + err.message, "error");
    console.error(err);
  } finally {
    createBtn.textContent = originalText;
    createBtn.disabled = false;
  }
});

// Event delegation for repository buttons - Set up once
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".repo-btn[data-action]");
  if (!btn) return;

  e.stopPropagation();
  const action = btn.dataset.action;
  const owner = btn.dataset.owner;
  const repo = btn.dataset.repo;

  console.log("Repo button clicked:", action, owner, repo);

  if (action === "view") {
    window.showRepoPreview(owner, repo);
  } else if (action === "add-files") {
    window.openFileManager(owner, repo);
  } else if (action === "commit") {
    commitChange(owner, repo);
  } else if (action === "set-website") {
    openSetWebsiteModal(owner, repo);
  } else if (action === "delete") {
    console.log("Delete action triggered for:", owner, repo);
    deleteRepository(owner, repo);
  }
});

// File Manager Modal Functionality
// Tab switching - Set up when DOM is ready
function setupFileManagerTabs() {
  document.querySelectorAll(".fm-tab-btn").forEach((btn) => {
    if (!btn.hasAttribute("data-listener")) {
      btn.setAttribute("data-listener", "true");
      btn.addEventListener("click", () => {
        const tabName = btn.dataset.tab;
        document.querySelectorAll(".fm-tab-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".fm-tab-content").forEach((c) => c.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`fm-${tabName}`).classList.add("active");
      });
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupFileManagerTabs);
} else {
  setupFileManagerTabs();
}

// Close file manager modal
document.getElementById("closeFileManager")?.addEventListener("click", () => {
  document.getElementById("fileManagerModal").classList.remove("active");
});

document.getElementById("cancelFileManager")?.addEventListener("click", () => {
  document.getElementById("fileManagerModal").classList.remove("active");
});

document.getElementById("cancelUpload")?.addEventListener("click", () => {
  document.getElementById("fileManagerModal").classList.remove("active");
});

document.getElementById("cancelCodebase")?.addEventListener("click", () => {
  document.getElementById("fileManagerModal").classList.remove("active");
});

document.getElementById("cancelFolder")?.addEventListener("click", () => {
  document.getElementById("fileManagerModal").classList.remove("active");
});

document.getElementById("fileManagerModal")?.addEventListener("click", (e) => {
  if (e.target.id === "fileManagerModal") {
    e.stopPropagation(); // Prevent event from bubbling to repo modal
    document.getElementById("fileManagerModal").classList.remove("active");
  }
});

// File upload area
const fileUploadArea = document.getElementById("fileUploadArea");
const fileInput = document.getElementById("fileInput");
const selectedFileName = document.getElementById("selectedFileName");

fileUploadArea?.addEventListener("click", () => {
  fileInput?.click();
});

fileInput?.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedFileName.textContent = `Selected: ${file.name}`;
    selectedFileName.style.display = "block";
    // Auto-fill path if empty
    if (!document.getElementById("uploadPath").value) {
      document.getElementById("uploadPath").value = file.name;
    }
  }
});

// Enhanced Drag and Drop
let dragCounter = 0;

fileUploadArea?.addEventListener("dragenter", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter++;
  if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
    fileUploadArea.classList.add("drag-over");
    fileUploadArea.style.borderColor = "var(--secondary-color)";
    fileUploadArea.style.backgroundColor = "var(--bg-secondary)";
    fileUploadArea.style.transform = "scale(1.02)";
  }
});

fileUploadArea?.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
    fileUploadArea.classList.add("drag-over");
    fileUploadArea.style.borderColor = "var(--secondary-color)";
    fileUploadArea.style.backgroundColor = "var(--bg-secondary)";
  }
});

fileUploadArea?.addEventListener("dragleave", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter--;
  if (dragCounter === 0) {
    fileUploadArea.classList.remove("drag-over");
    fileUploadArea.style.borderColor = "var(--border-color)";
    fileUploadArea.style.backgroundColor = "transparent";
    fileUploadArea.style.transform = "scale(1)";
  }
});

fileUploadArea?.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter = 0;

  // Reset visual state
  fileUploadArea.classList.remove("drag-over");
  fileUploadArea.style.borderColor = "var(--border-color)";
  fileUploadArea.style.backgroundColor = "transparent";
  fileUploadArea.style.transform = "scale(1)";

  const files = e.dataTransfer.files;
  if (files && files.length > 0) {
    const file = files[0];

    // Create a new FileList-like object
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    // Show file info
    const fileSize = (file.size / 1024).toFixed(2);
    selectedFileName.textContent = `Selected: ${file.name} (${fileSize} KB)`;
    selectedFileName.style.display = "block";
    selectedFileName.style.color = "var(--text-primary)";

    // Auto-fill path if empty
    const uploadPathInput = document.getElementById("uploadPath");
    if (uploadPathInput && !uploadPathInput.value) {
      uploadPathInput.value = file.name;
    }

    // Visual feedback
    showNotification(`📁 File "${file.name}" ready to upload`, "success", 2000);
  }
});

// Add file button for codebase
document.getElementById("addFileBtn")?.addEventListener("click", () => {
  const list = document.getElementById("codebaseFilesList");
  const newItem = document.createElement("div");
  newItem.className = "codebase-file-item";
  newItem.innerHTML = `
    <input type="text" class="codebase-path" placeholder="path/to/file.js" />
    <textarea class="codebase-content" placeholder="File content..." rows="5"></textarea>
    <button type="button" class="remove-file-btn">&times;</button>
  `;
  list.appendChild(newItem);

  // Add remove functionality
  newItem.querySelector(".remove-file-btn").addEventListener("click", () => {
    if (list.children.length > 1) {
      newItem.remove();
    }
  });
});

// Remove file buttons
document.querySelectorAll(".remove-file-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const list = document.getElementById("codebaseFilesList");
    if (list.children.length > 1) {
      e.target.closest(".codebase-file-item").remove();
    }
  });
});

// Create File Form
document.getElementById("createFileForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentFileManager) return;

  const formData = new FormData(e.target);
  const filePath = formData.get("filePath");
  const content = formData.get("fileContent");
  const message = formData.get("commitMessage");

  if (!filePath || !content || !message) {
    showNotification("Please fill all required fields", "error");
    return;
  }

  const submitBtn = e.target.querySelector("button[type='submit']");
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Creating...";
  submitBtn.disabled = true;

  try {
    const { owner, repo } = currentFileManager;
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Authorization: `token ${token}` },
    });
    const repoData = await repoRes.json();
    const defaultBranch = repoData.default_branch || "main";

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          content: btoa(content),
          branch: defaultBranch,
        }),
      }
    );

    if (res.ok) {
      showNotification("✅ File created successfully!", "success");
      document.getElementById("fileManagerModal").classList.remove("active");
      e.target.reset();
      // Refresh if viewing this repo
      if (currentRepo && currentRepo.name === repo) {
        await loadFileTree(owner, repo);
      }
    } else {
      const error = await res.json();
      throw new Error(error.message || "Failed to create file");
    }
  } catch (err) {
    showNotification("❌ Error: " + err.message, "error");
    console.error(err);
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

// Upload File Form
document.getElementById("uploadFileForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentFileManager) return;

  const formData = new FormData(e.target);
  const filePath = formData.get("uploadPath");
  const message = formData.get("uploadCommitMessage");
  const file = fileInput.files[0];

  if (!filePath || !message || !file) {
    showNotification("Please fill all required fields and select a file", "error");
    return;
  }

  const submitBtn = e.target.querySelector("button[type='submit']");
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Uploading...";
  submitBtn.disabled = true;

  try {
    const { owner, repo } = currentFileManager;
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const content = event.target.result;
        const base64Content = btoa(content);

        const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { Authorization: `token ${token}` },
        });
        const repoData = await repoRes.json();
        const defaultBranch = repoData.default_branch || "main";

        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`,
          {
            method: "PUT",
            headers: {
              Authorization: `token ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message,
              content: base64Content,
              branch: defaultBranch,
            }),
          }
        );

        if (res.ok) {
          showNotification("✅ File uploaded successfully!", "success");
          document.getElementById("fileManagerModal").classList.remove("active");
          e.target.reset();
          selectedFileName.textContent = "";
          selectedFileName.style.display = "none";
          // Refresh if viewing this repo
          if (currentRepo && currentRepo.name === repo) {
            await loadFileTree(owner, repo);
          }
        } else {
          const error = await res.json();
          throw new Error(error.message || "Failed to upload file");
        }
      } catch (err) {
        showNotification("❌ Error: " + err.message, "error");
        console.error(err);
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    };

    reader.readAsText(file);
  } catch (err) {
    showNotification("❌ Error: " + err.message, "error");
    console.error(err);
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

// Codebase Form
document.getElementById("codebaseForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentFileManager) return;

  const message = document.getElementById("codebaseCommitMessage").value;
  if (!message) {
    showNotification("Please enter a commit message", "error");
    return;
  }

  const fileItems = document.querySelectorAll(".codebase-file-item");
  const files = [];

  fileItems.forEach((item) => {
    const path = item.querySelector(".codebase-path").value;
    const content = item.querySelector(".codebase-content").value;
    if (path && content) {
      files.push({ path, content });
    }
  });

  if (files.length === 0) {
    showNotification("Please add at least one file", "error");
    return;
  }

  const submitBtn = e.target.querySelector("button[type='submit']");
  const originalText = submitBtn.textContent;
  submitBtn.textContent = `Adding ${files.length} files...`;
  submitBtn.disabled = true;

  try {
    const { owner, repo } = currentFileManager;
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Authorization: `token ${token}` },
    });
    const repoData = await repoRes.json();
    const defaultBranch = repoData.default_branch || "main";

    // Create files sequentially
    let successCount = 0;
    for (const file of files) {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(file.path)}`,
          {
            method: "PUT",
            headers: {
              Authorization: `token ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: `${message} - ${file.path}`,
              content: btoa(file.content),
              branch: defaultBranch,
            }),
          }
        );

        if (res.ok) {
          successCount++;
        }
      } catch (err) {
        console.error(`Error creating ${file.path}:`, err);
      }
    }

    if (successCount === files.length) {
      showNotification(`✅ Successfully added ${successCount} files!`, "success");
      document.getElementById("fileManagerModal").classList.remove("active");
      e.target.reset();
      // Reset codebase list
      const list = document.getElementById("codebaseFilesList");
      list.innerHTML = `
        <div class="codebase-file-item">
          <input type="text" class="codebase-path" placeholder="path/to/file.js" />
          <textarea class="codebase-content" placeholder="File content..." rows="5"></textarea>
          <button type="button" class="remove-file-btn">&times;</button>
        </div>
      `;
      // Refresh if viewing this repo
      if (currentRepo && currentRepo.name === repo) {
        await loadFileTree(owner, repo);
      }
    } else {
      showNotification(`⚠️ Added ${successCount} of ${files.length} files`, "warning");
    }
  } catch (err) {
    showNotification("❌ Error: " + err.message, "error");
    console.error(err);
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

// Create Folder Form
document.getElementById("createFolderForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentFileManager) return;

  const formData = new FormData(e.target);
  const folderPath = formData.get("folderPath").trim();
  const addGitkeep = formData.get("addGitkeep") === "on";
  const message = formData.get("folderCommitMessage");

  if (!folderPath || !message) {
    showNotification("Please fill all required fields", "error");
    return;
  }

  const submitBtn = e.target.querySelector("button[type='submit']");
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Creating...";
  submitBtn.disabled = true;

  try {
    const { owner, repo } = currentFileManager;
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Authorization: `token ${token}` },
    });
    const repoData = await repoRes.json();
    const defaultBranch = repoData.default_branch || "main";

    // Normalize folder path (remove leading/trailing slashes, ensure it ends with /)
    let normalizedPath = folderPath.replace(/^\/+|\/+$/g, "");
    if (!normalizedPath) {
      throw new Error("Invalid folder path");
    }

    // Create the .gitkeep file path
    const gitkeepPath = normalizedPath + "/.gitkeep";
    const fileContent = addGitkeep ? "# This file ensures the folder is tracked by Git" : "";

    // If gitkeep is enabled, create the .gitkeep file
    if (addGitkeep) {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(gitkeepPath)}`,
        {
          method: "PUT",
          headers: {
            Authorization: `token ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `${message} - Create folder: ${normalizedPath}`,
            content: btoa(fileContent),
            branch: defaultBranch,
          }),
        }
      );

      if (res.ok) {
        showNotification(`✅ Folder "${normalizedPath}" created successfully!`, "success");
        document.getElementById("fileManagerModal").classList.remove("active");
        e.target.reset();
        // Refresh if viewing this repo
        if (currentRepo && currentRepo.name === repo) {
          await loadFileTree(owner, repo);
        }
      } else {
        const error = await res.json();
        // If file already exists, that's okay - folder structure might already be there
        if (error.message && error.message.includes("already exists")) {
          showNotification(`ℹ️ Folder structure "${normalizedPath}" already exists`, "info");
          document.getElementById("fileManagerModal").classList.remove("active");
          e.target.reset();
          if (currentRepo && currentRepo.name === repo) {
            await loadFileTree(owner, repo);
          }
        } else {
          throw new Error(error.message || "Failed to create folder");
        }
      }
    } else {
      // If gitkeep is disabled, just show a message
      showNotification(
        "⚠️ Note: GitHub doesn't support empty folders. Consider adding a .gitkeep file to track the folder.",
        "warning"
      );
      document.getElementById("fileManagerModal").classList.remove("active");
      e.target.reset();
    }
  } catch (err) {
    showNotification("❌ Error: " + err.message, "error");
    console.error(err);
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

// Custom Confirmation Modal
let confirmCallback = null;

function showConfirm(title, message, onConfirm) {
  const modal = document.getElementById("confirmModal");
  const titleEl = document.getElementById("confirmTitle");
  const messageEl = document.getElementById("confirmMessage");

  if (modal && titleEl && messageEl) {
    titleEl.textContent = title || "Confirm Action";
    messageEl.textContent = message || "Are you sure you want to proceed?";
    confirmCallback = onConfirm;
    modal.classList.add("active");
  }
}

// Close confirmation modal
document.getElementById("closeConfirmModal")?.addEventListener("click", () => {
  document.getElementById("confirmModal")?.classList.remove("active");
  confirmCallback = null;
});

document.getElementById("cancelConfirmBtn")?.addEventListener("click", () => {
  document.getElementById("confirmModal")?.classList.remove("active");
  confirmCallback = null;
});

document.getElementById("confirmBtn")?.addEventListener("click", () => {
  if (confirmCallback) {
    confirmCallback();
    confirmCallback = null;
  }
  document.getElementById("confirmModal")?.classList.remove("active");
});

document.getElementById("confirmModal")?.addEventListener("click", (e) => {
  if (e.target.id === "confirmModal") {
    document.getElementById("confirmModal")?.classList.remove("active");
    confirmCallback = null;
  }
});

// Custom Alert Modal (for simple messages)
function showAlert(title, message) {
  showConfirm(title, message, () => {
    // Just close on confirm for alerts
  });
}

// Notification system
function showNotification(message, type = "info", duration = 3000) {
  // Remove existing notifications
  const existing = document.querySelector(".notification");
  if (existing) existing.remove();

  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add("show");
  }, 10);

  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

// Pull Requests Functionality
async function loadPullRequests(owner, repo) {
  const prContainer = document.getElementById("prContainer");
  if (!prContainer) return;

  // Show loading state
  prContainer.innerHTML = `
    <div class="empty-state">
      <div class="spinner"></div>
      <p>Loading pull requests...</p>
    </div>
  `;

  try {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("No authentication token found");
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=100`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Repository not found or you don't have access");
      } else if (response.status === 403) {
        throw new Error("Access denied. Please check your permissions.");
      }
      throw new Error(`Failed to load pull requests: ${response.statusText}`);
    }

    const pullRequests = await response.json();
    displayPullRequests(pullRequests);
  } catch (error) {
    console.error("Error loading pull requests:", error);
    prContainer.innerHTML = `
      <div class="pr-empty">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.5 3.25a2.25 2.25 0 113 2.122.75.75 0 10-.896.515 3.5 3.5 0 00-1.854-1.854.75.75 0 00-.515.896A2.25 2.25 0 011.5 3.25zm7.5 0a2.25 2.25 0 113 2.122.75.75 0 10-.896.515 3.5 3.5 0 00-1.854-1.854.75.75 0 00-.515.896A2.25 2.25 0 019 3.25zm-3.75 0a2.25 2.25 0 00-2.122 3.75.75.75 0 00.515.896 3.5 3.5 0 001.854-1.854.75.75 0 00.896-.515A2.25 2.25 0 015.25 3.25zm7.5 0a2.25 2.25 0 00-2.122 3.75.75.75 0 00.515.896 3.5 3.5 0 001.854-1.854.75.75 0 00.896-.515A2.25 2.25 0 0112.75 3.25zM1.5 7.25a2.25 2.25 0 113 2.122.75.75 0 10-.896.515 3.5 3.5 0 00-1.854-1.854.75.75 0 00-.515.896A2.25 2.25 0 011.5 7.25zm7.5 0a2.25 2.25 0 113 2.122.75.75 0 10-.896.515 3.5 3.5 0 00-1.854-1.854.75.75 0 00-.515.896A2.25 2.25 0 019 7.25zm-3.75 0a2.25 2.25 0 00-2.122 3.75.75.75 0 00.515.896 3.5 3.5 0 001.854-1.854.75.75 0 00.896-.515A2.25 2.25 0 015.25 7.25zm7.5 0a2.25 2.25 0 00-2.122 3.75.75.75 0 00.515.896 3.5 3.5 0 001.854-1.854.75.75 0 00.896-.515A2.25 2.25 0 0112.75 7.25z"></path>
        </svg>
        <p>Error loading pull requests</p>
        <p style="font-size: 14px; margin-top: 8px; color: var(--text-secondary);">${error.message}</p>
      </div>
    `;
  }
}

function displayPullRequests(pullRequests) {
  const prContainer = document.getElementById("prContainer");
  if (!prContainer) return;

  if (!pullRequests || pullRequests.length === 0) {
    prContainer.innerHTML = `
      <div class="pr-empty">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.5 3.25a2.25 2.25 0 113 2.122.75.75 0 10-.896.515 3.5 3.5 0 00-1.854-1.854.75.75 0 00-.515.896A2.25 2.25 0 011.5 3.25zm7.5 0a2.25 2.25 0 113 2.122.75.75 0 10-.896.515 3.5 3.5 0 00-1.854-1.854.75.75 0 00-.515.896A2.25 2.25 0 019 3.25zm-3.75 0a2.25 2.25 0 00-2.122 3.75.75.75 0 00.515.896 3.5 3.5 0 001.854-1.854.75.75 0 00.896-.515A2.25 2.25 0 015.25 3.25zm7.5 0a2.25 2.25 0 00-2.122 3.75.75.75 0 00.515.896 3.5 3.5 0 001.854-1.854.75.75 0 00.896-.515A2.25 2.25 0 0112.75 3.25zM1.5 7.25a2.25 2.25 0 113 2.122.75.75 0 10-.896.515 3.5 3.5 0 00-1.854-1.854.75.75 0 00-.515.896A2.25 2.25 0 011.5 7.25zm7.5 0a2.25 2.25 0 113 2.122.75.75 0 10-.896.515 3.5 3.5 0 00-1.854-1.854.75.75 0 00-.515.896A2.25 2.25 0 019 7.25zm-3.75 0a2.25 2.25 0 00-2.122 3.75.75.75 0 00.515.896 3.5 3.5 0 001.854-1.854.75.75 0 00.896-.515A2.25 2.25 0 015.25 7.25zm7.5 0a2.25 2.25 0 00-2.122 3.75.75.75 0 00.515.896 3.5 3.5 0 001.854-1.854.75.75 0 00.896-.515A2.25 2.25 0 0112.75 7.25z"></path>
        </svg>
        <p>No pull requests found</p>
        <p style="font-size: 14px; margin-top: 8px; color: var(--text-secondary);">This repository doesn't have any pull requests yet.</p>
      </div>
    `;
    return;
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  };

  const getStatusClass = (pr) => {
    if (pr.draft) return "draft";
    if (pr.merged_at) return "merged";
    if (pr.state === "closed") return "closed";
    return "open";
  };

  const getStatusText = (pr) => {
    if (pr.draft) return "Draft";
    if (pr.merged_at) return "Merged";
    if (pr.state === "closed") return "Closed";
    return "Open";
  };

  const prListHTML = pullRequests
    .map(
      (pr) => `
    <div class="pr-item" onclick="window.open('${pr.html_url}', '_blank')">
      <div class="pr-header">
        <div class="pr-title-section">
          <div class="pr-title">
            <a href="${pr.html_url}" target="_blank" onclick="event.stopPropagation()">
              ${pr.title}
            </a>
            <span class="pr-number">#${pr.number}</span>
          </div>
          <div class="pr-meta">
            <div class="pr-author">
              <img src="${pr.user.avatar_url}" alt="${pr.user.login}" />
              <span>${pr.user.login}</span>
            </div>
            <span>•</span>
            <span>${formatDate(pr.created_at)}</span>
            ${pr.updated_at !== pr.created_at ? `<span>•</span><span>Updated ${formatDate(pr.updated_at)}</span>` : ""}
          </div>
          <div class="pr-branch-info">
            <span>${pr.head.ref}</span>
            <svg height="12" viewBox="0 0 16 16" width="12" fill="currentColor">
              <path d="M9.5 3.25a2.25 2.25 0 11 3 2.122.5.5 0 10 1-.498A3.25 3.25 0 108.5 2.5a.5.5 0 001 1.75zM4.25 9a2.25 2.25 0 11 3 2.122.5.5 0 10 1-.498A3.25 3.25 0 103.25 7.5a.5.5 0 001 1.75zM13.5 12.75a2.25 2.25 0 11-3-2.122.5.5 0 00-1 .498A3.25 3.25 0 1014.75 14.5a.5.5 0 00-1-1.75z"></path>
            </svg>
            <span>${pr.base.ref}</span>
          </div>
        </div>
        <div class="pr-status ${getStatusClass(pr)}">
          ${getStatusText(pr)}
        </div>
      </div>
      ${pr.body ? `<div class="pr-description">${pr.body.replace(/\n/g, " ").substring(0, 200)}${pr.body.length > 200 ? "..." : ""}</div>` : ""}
      <div class="pr-stats">
        <div class="pr-stat-item">
          <svg height="14" viewBox="0 0 16 16" width="14" fill="currentColor">
            <path d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"></path>
            <path fill-rule="evenodd" d="M1.38 8.43a.75.75 0 011.25-.87l.62-.36.03-.02a5.25 5.25 0 017.22 7.22l.02.03.36.62a.75.75 0 11-1.25.87l-.36-.62-.02-.03A5.25 5.25 0 013.4 6.8l-.03-.02-.62-.36a.75.75 0 01-.37-.99zm2.85-4.9a6.75 6.75 0 019.23 9.23l.03.03.62.36a.75.75 0 11-.87 1.25l-.62-.36-.03-.03a6.75 6.75 0 01-9.23-9.23l-.03-.03-.62-.36a.75.75 0 01.87-1.25l.62.36.03.03z"></path>
          </svg>
          <span>${pr.comments || 0} comments</span>
        </div>
        ${pr.requested_reviewers && pr.requested_reviewers.length > 0 ? `
        <div class="pr-stat-item">
          <svg height="14" viewBox="0 0 16 16" width="14" fill="currentColor">
            <path d="M10.53 5.47a.75.75 0 010 1.06L8.56 8.44a.75.75 0 01-1.06 0L5.47 6.53a.75.75 0 011.06-1.06l1.48 1.48 1.97-1.97a.75.75 0 011.06 0z"></path>
            <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1L5.6 1.35a.25.25 0 00-.2-.1H1.75zM0 2.75C0 1.784.784 1 1.75 1h3.5c.085 0 .17.014.25.04L7.5 3.5h6.75c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0114.25 16H1.75A1.75 1.75 0 010 14.25V2.75z"></path>
          </svg>
          <span>${pr.requested_reviewers.length} review${pr.requested_reviewers.length > 1 ? "s" : ""}</span>
        </div>
        ` : ""}
        ${pr.labels && pr.labels.length > 0 ? `
        <div class="pr-stat-item">
          <svg height="14" viewBox="0 0 16 16" width="14" fill="currentColor">
            <path d="M2.5 7.775V2.75a.25.25 0 01.25-.25h5.025a.25.25 0 01.177.073l6.25 6.25a.25.25 0 010 .354l-5.025 5.025a.25.25 0 01-.354 0l-6.25-6.25a.25.25 0 01-.073-.177zm-1.5 0V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 010 2.474l-5.026 5.026a1.75 1.75 0 01-2.474 0l-6.25-6.25A1.75 1.75 0 011 7.775zM6 5a1 1 0 100 2 1 1 0 000-2z"></path>
          </svg>
          <span>${pr.labels.length} label${pr.labels.length > 1 ? "s" : ""}</span>
        </div>
        ` : ""}
      </div>
    </div>
  `
    )
    .join("");

  prContainer.innerHTML = `<div class="pr-list">${prListHTML}</div>`;
}

// Profile and Settings Functionality - Optimized for instant display
function showProfile() {
  const modal = document.getElementById("profileModal");
  if (!modal) return;

  // Show modal instantly, load data in background if needed
  modal.classList.add("active");

  if (!userData) {
    // Load in background without blocking UI
    loadUser().then(() => {
      if (userData) {
        // Update profile data
        const avatar = document.getElementById("profileAvatar");
        const name = document.getElementById("profileName");
        const username = document.getElementById("profileUsername");
        const githubLink = document.getElementById("profileGithubLink");
        const bio = document.getElementById("profileBio");
        const location = document.getElementById("profileLocation");
        const company = document.getElementById("profileCompany");
        const website = document.getElementById("profileWebsite");
        const reposCount = document.getElementById("profileReposCount");
        const followersCount = document.getElementById("profileFollowersCount");
        const followingCount = document.getElementById("profileFollowingCount");

        if (avatar) avatar.src = userData.avatar_url || "";
        if (name) name.textContent = userData.name || userData.login || "User";
        if (username) username.textContent = `@${userData.login}`;
        if (githubLink)
          githubLink.href = userData.html_url || `https://github.com/${userData.login}`;
        if (bio) bio.textContent = userData.bio || "No bio available";
        if (location) location.textContent = userData.location || "Not specified";
        if (company) company.textContent = userData.company || "Not specified";
        if (website) website.textContent = userData.blog || "Not specified";
        if (reposCount) reposCount.textContent = userData.public_repos || 0;
        if (followersCount) followersCount.textContent = userData.followers || 0;
        if (followingCount) followingCount.textContent = userData.following || 0;
      }
    });
    return;
  }

  // Populate profile data instantly
  const avatar = document.getElementById("profileAvatar");
  const name = document.getElementById("profileName");
  const username = document.getElementById("profileUsername");
  const githubLink = document.getElementById("profileGithubLink");
  const bio = document.getElementById("profileBio");
  const location = document.getElementById("profileLocation");
  const company = document.getElementById("profileCompany");
  const website = document.getElementById("profileWebsite");
  const reposCount = document.getElementById("profileReposCount");
  const followersCount = document.getElementById("profileFollowersCount");
  const followingCount = document.getElementById("profileFollowingCount");

  if (avatar) avatar.src = userData.avatar_url || "";
  if (name) name.textContent = userData.name || userData.login || "User";
  if (username) username.textContent = `@${userData.login}`;
  if (githubLink) githubLink.href = userData.html_url || `https://github.com/${userData.login}`;
  if (bio) bio.textContent = userData.bio || "No bio available";
  if (location) location.textContent = userData.location || "Not specified";
  if (company) company.textContent = userData.company || "Not specified";
  if (website) website.textContent = userData.blog || "Not specified";
  if (reposCount) reposCount.textContent = userData.public_repos || 0;
  if (followersCount) followersCount.textContent = userData.followers || 0;
  if (followingCount) followingCount.textContent = userData.following || 0;
}

function showSettings() {
  const modal = document.getElementById("settingsModal");
  if (!modal) return;

  // Show modal instantly
  modal.classList.add("active");

  if (!userData) {
    // Load in background without blocking UI
    loadUser().then(() => {
      if (userData) {
        const usernameInput = document.getElementById("settingsUsername");
        const emailInput = document.getElementById("settingsEmail");
        if (usernameInput) usernameInput.value = userData.login || "";
        if (emailInput) emailInput.value = userData.email || "Private";
      }
    });
  } else {
    // Populate settings data instantly
    const usernameInput = document.getElementById("settingsUsername");
    const emailInput = document.getElementById("settingsEmail");
    if (usernameInput) usernameInput.value = userData.login || "";
    if (emailInput) emailInput.value = userData.email || "Private";
  }

  // Load saved theme preference (always instant)
  const savedTheme = localStorage.getItem("theme") || "dark";
  const themeSelect = document.getElementById("themeSelect");
  if (themeSelect) themeSelect.value = savedTheme;
}

// Sidebar navigation - Optimized for instant switching
document.querySelectorAll(".sidebar-menu a").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const href = link.getAttribute("href");

    // Instant UI update - no delays
    document.querySelectorAll(".sidebar-menu li").forEach((li) => {
      li.classList.remove("active");
    });
    link.parentElement.classList.add("active");

    // Close any open modals immediately
    document.querySelectorAll(".modal.active").forEach((modal) => {
      if (modal.id !== "profileModal" && modal.id !== "settingsModal") {
        modal.classList.remove("active");
      }
    });

    // Instant switching
    if (href === "#profile") {
      // Close settings if open
      document.getElementById("settingsModal")?.classList.remove("active");
      // Show profile instantly
      showProfile();
    } else if (href === "#settings") {
      // Close profile if open
      document.getElementById("profileModal")?.classList.remove("active");
      // Show settings instantly
      showSettings();
    } else if (href === "#repos") {
      // Close all modals
      document.querySelectorAll(".modal.active").forEach((modal) => {
        modal.classList.remove("active");
      });
      // Show repositories instantly
      const main = document.querySelector(".dashboard-main");
      if (main) {
        main.style.display = "block";
        // Force immediate render
        main.offsetHeight;
      }
    }
  });
});

// Close profile modal
document.getElementById("closeProfile")?.addEventListener("click", () => {
  document.getElementById("profileModal").classList.remove("active");
});

// Close settings modal
document.getElementById("closeSettings")?.addEventListener("click", () => {
  document.getElementById("settingsModal").classList.remove("active");
});

// Close modals when clicking outside
document.getElementById("profileModal")?.addEventListener("click", (e) => {
  if (e.target.id === "profileModal") {
    document.getElementById("profileModal").classList.remove("active");
  }
});

document.getElementById("settingsModal")?.addEventListener("click", (e) => {
  if (e.target.id === "settingsModal") {
    document.getElementById("settingsModal").classList.remove("active");
  }
});

// Function to apply theme
function applyTheme(theme) {
  // Remove all theme classes first
  document.body.classList.remove("light-theme", "dark-theme");

  if (theme === "light") {
    document.body.classList.add("light-theme");
  } else if (theme === "dark") {
    document.body.classList.add("dark-theme");
  } else {
    // Auto - use system preference
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      document.body.classList.add("light-theme");
    } else {
      document.body.classList.add("dark-theme");
    }

    // Listen for system theme changes (only add listener once)
    if (window.matchMedia && !window.themeListenerAdded) {
      window.themeListenerAdded = true;
      window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (e) => {
        if (localStorage.getItem("theme") === "auto") {
          if (e.matches) {
            document.body.classList.remove("dark-theme");
            document.body.classList.add("light-theme");
          } else {
            document.body.classList.remove("light-theme");
            document.body.classList.add("dark-theme");
          }
        }
      });
    }
  }
}

// Theme selector
document.getElementById("themeSelect")?.addEventListener("change", (e) => {
  const theme = e.target.value;
  localStorage.setItem("theme", theme);
  applyTheme(theme);
  showNotification("Theme updated", "success");
});

// Re-authenticate functionality
document.getElementById("reAuthBtn")?.addEventListener("click", () => {
  showConfirm(
    "Re-authenticate",
    "This will sign you out and redirect you to GitHub to grant updated permissions. Continue?",
    () => {
      // Clear current token
      localStorage.removeItem("token");

      // Build GitHub OAuth URL with updated scopes
      const clientId = "Ov23lihC3y93z52VK93G";
      const redirectUri = encodeURIComponent("http://localhost:3000/callback");
      const scope = encodeURIComponent("repo user delete_repo");
      const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${redirectUri}`;

      // Redirect to GitHub OAuth
      window.location.href = authUrl;
    }
  );
});

// Logout functionality
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  showConfirm("Sign Out", "Are you sure you want to sign out?", () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  });
});

// User avatar click - show profile
document.getElementById("userAvatar")?.addEventListener("click", () => {
  showProfile();
});

// PWA Install functionality
let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  // Show the install button
  const installBtn = document.getElementById("installBtn");
  if (installBtn) {
    installBtn.style.display = "flex";
  }
});

// Install button click handler
document.getElementById("installBtn")?.addEventListener("click", async () => {
  if (!deferredPrompt) {
    showNotification("App installation is not available", "info");
    return;
  }

  // Show the install prompt
  deferredPrompt.prompt();

  // Wait for the user to respond to the prompt
  const { outcome } = await deferredPrompt.userChoice;

  if (outcome === "accepted") {
    showNotification("✅ App installed successfully!", "success");
    const installBtn = document.getElementById("installBtn");
    if (installBtn) {
      installBtn.style.display = "none";
    }
  } else {
    showNotification("App installation cancelled", "info");
  }

  // Clear the deferredPrompt
  deferredPrompt = null;
});

// Check if app is already installed
window.addEventListener("appinstalled", () => {
  console.log("PWA was installed");
  const installBtn = document.getElementById("installBtn");
  if (installBtn) {
    installBtn.style.display = "none";
  }
  deferredPrompt = null;
});

// Service Worker Registration
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        console.log("ServiceWorker registered successfully:", registration.scope);
      })
      .catch((error) => {
        console.log("ServiceWorker registration failed:", error);
      });
  });
}

// Global Drag and Drop Functionality
let pendingDragFiles = null;
let globalDragCounter = 0;

// Show drag drop modal with repository list
function showDragDropModal(files) {
  pendingDragFiles = files;
  const modal = document.getElementById("globalDragDropModal");
  const fileInfo = document.getElementById("dragDropFileInfo");
  const repoList = document.getElementById("dragDropRepoList");

  if (!modal || !fileInfo || !repoList) return;

  // Show file info
  if (files.length === 1) {
    const file = files[0];
    const fileSize = (file.size / 1024).toFixed(2);
    fileInfo.textContent = `File: ${file.name} (${fileSize} KB)`;
  } else {
    fileInfo.textContent = `${files.length} files selected`;
  }

  // Populate repository list
  if (allRepos.length === 0) {
    repoList.innerHTML = `
      <div style="text-align: center; padding: 32px; color: var(--text-secondary);">
        <p>No repositories found. Please create a repository first.</p>
      </div>
    `;
  } else {
    repoList.innerHTML = allRepos
      .map(
        (repo) => `
      <div class="repo-select-item" data-owner="${repo.owner.login}" data-repo="${repo.name}">
        <div class="repo-select-info">
          <h3>${repo.name}</h3>
          <p>${repo.description || "No description"}</p>
          <span class="repo-badge ${repo.private ? "private" : "public"}">${
          repo.private ? "Private" : "Public"
        }</span>
        </div>
        <svg height="20" viewBox="0 0 16 16" width="20" fill="currentColor">
          <path d="M8.22 2.97a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06l2.97-2.97H3.75a.75.75 0 010-1.5h7.44L8.22 4.03a.75.75 0 010-1.06z"></path>
        </svg>
      </div>
    `
      )
      .join("");
  }

  // Add click handlers to repo items
  repoList.querySelectorAll(".repo-select-item").forEach((item) => {
    item.addEventListener("click", () => {
      const owner = item.dataset.owner;
      const repo = item.dataset.repo;

      // Close drag drop modal
      modal.classList.remove("active");

      // Open file manager with the first file
      if (pendingDragFiles && pendingDragFiles.length > 0) {
        const file = pendingDragFiles[0];
        window.openFileManager(owner, repo);

        // Set the file in the file input
        setTimeout(() => {
          const fileInput = document.getElementById("fileInput");
          const uploadPathInput = document.getElementById("uploadPath");
          const selectedFileName = document.getElementById("selectedFileName");

          if (fileInput && file) {
            // Create a new FileList-like object
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;

            // Show file info
            const fileSize = (file.size / 1024).toFixed(2);
            if (selectedFileName) {
              selectedFileName.textContent = `Selected: ${file.name} (${fileSize} KB)`;
              selectedFileName.style.display = "block";
            }

            // Auto-fill path
            if (uploadPathInput && !uploadPathInput.value) {
              uploadPathInput.value = file.name;
            }

            // Switch to upload tab
            const uploadTab = document.querySelector('.fm-tab-btn[data-tab="upload"]');
            const uploadContent = document.getElementById("fm-upload");
            if (uploadTab) uploadTab.click();
          }
        }, 100);
      }

      pendingDragFiles = null;
    });
  });

  modal.classList.add("active");
}

// Global drag and drop handlers
document.addEventListener("dragenter", (e) => {
  // Ignore if dragging inside file upload area or other modals
  if (
    e.target.closest("#fileUploadArea") ||
    e.target.closest(".modal") ||
    e.target.closest("#fileManagerModal")
  ) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();
  globalDragCounter++;

  if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
    // Check if it's files being dragged
    const hasFiles = Array.from(e.dataTransfer.items).some((item) => item.kind === "file");
    if (hasFiles) {
      document.body.classList.add("drag-active");
    }
  }
});

document.addEventListener("dragover", (e) => {
  // Ignore if dragging inside file upload area or other modals
  if (
    e.target.closest("#fileUploadArea") ||
    e.target.closest(".modal") ||
    e.target.closest("#fileManagerModal")
  ) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
    const hasFiles = Array.from(e.dataTransfer.items).some((item) => item.kind === "file");
    if (hasFiles) {
      document.body.classList.add("drag-active");
    }
  }
});

document.addEventListener("dragleave", (e) => {
  // Ignore if leaving to go into file upload area or modals
  if (
    e.target.closest("#fileUploadArea") ||
    e.target.closest(".modal") ||
    e.target.closest("#fileManagerModal")
  ) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();
  globalDragCounter--;

  if (globalDragCounter === 0) {
    document.body.classList.remove("drag-active");
  }
});

document.addEventListener("drop", (e) => {
  // Ignore if dropping inside file upload area or other modals
  if (
    e.target.closest("#fileUploadArea") ||
    e.target.closest(".modal") ||
    e.target.closest("#fileManagerModal")
  ) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();
  globalDragCounter = 0;
  document.body.classList.remove("drag-active");

  const files = e.dataTransfer.files;
  if (files && files.length > 0) {
    // Convert FileList to Array
    const fileArray = Array.from(files);
    showDragDropModal(fileArray);
  }
});

// Close drag drop modal
document.getElementById("closeDragDropModal")?.addEventListener("click", () => {
  document.getElementById("globalDragDropModal")?.classList.remove("active");
  pendingDragFiles = null;
});

document.getElementById("globalDragDropModal")?.addEventListener("click", (e) => {
  if (e.target.id === "globalDragDropModal") {
    document.getElementById("globalDragDropModal")?.classList.remove("active");
    pendingDragFiles = null;
  }
});

// Initialize
loadUser();
loadRepos();

// Add smooth scroll behavior
document.documentElement.style.scrollBehavior = "smooth";

// Load saved theme on page load
const savedTheme = localStorage.getItem("theme") || "dark";
applyTheme(savedTheme);

// Edit File Functionality
document.getElementById("editFileBtn")?.addEventListener("click", () => {
  if (!currentFile || !originalFileContent) return;

  isEditMode = true;
  const editBtn = document.getElementById("editFileBtn");
  const saveBtn = document.getElementById("saveFileBtn");
  const cancelBtn = document.getElementById("cancelEditBtn");

  if (editBtn && saveBtn && cancelBtn) {
    editBtn.style.display = "none";
    saveBtn.style.display = "flex";
    cancelBtn.style.display = "flex";
  }

  // Switch to code view if on preview
  const codeView = document.getElementById("codeView");
  const previewView = document.getElementById("previewView");
  const codeTabBtn = document.getElementById("codeTabBtn");
  const previewTabBtn = document.getElementById("previewTabBtn");

  if (codeView && previewView && codeTabBtn && previewTabBtn) {
    codeView.style.display = "block";
    previewView.style.display = "none";
    codeTabBtn.classList.add("active");
    previewTabBtn.classList.remove("active");
  }

  // Show editor
  const fileName = currentFile.path.split("/").pop();
  displayCode(originalFileContent, fileName);
});

// Cancel Edit
document.getElementById("cancelEditBtn")?.addEventListener("click", () => {
  isEditMode = false;
  const editBtn = document.getElementById("editFileBtn");
  const saveBtn = document.getElementById("saveFileBtn");
  const cancelBtn = document.getElementById("cancelEditBtn");

  if (editBtn && saveBtn && cancelBtn) {
    editBtn.style.display = "flex";
    saveBtn.style.display = "none";
    cancelBtn.style.display = "none";
  }

  // Restore original content
  if (currentFile && originalFileContent) {
    const fileName = currentFile.path.split("/").pop();
    displayCode(originalFileContent, fileName);
  }
});

// Save File
document.getElementById("saveFileBtn")?.addEventListener("click", () => {
  if (!currentFile || !currentRepo) return;

  const editor = document.getElementById("fileEditor");
  if (!editor) return;

  const newContent = editor.value;
  const fileName = currentFile.path.split("/").pop();
  const saveBtn = document.getElementById("saveFileBtn");

  // Store the save operation data
  pendingSaveOperation = {
    newContent,
    fileName,
    saveBtn,
  };

  // Open commit message modal
  openCommitMessageModal(`Update ${fileName}`);
});

// Download File Functionality
document.getElementById("downloadFileBtn")?.addEventListener("click", async () => {
  if (!currentFile || !currentRepo) return;

  try {
    const owner = currentRepo.owner.login;
    const repo = currentRepo.name;
    const filePath = currentFile.path;
    const defaultBranch = currentRepo.default_branch || "main";

    // Get the raw file URL
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${encodeURIComponent(
      filePath
    )}`;

    // Fetch the file content
    const res = await fetch(rawUrl, {
      headers: { Authorization: `token ${token}` },
    });

    if (!res.ok) {
      throw new Error("Failed to download file");
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filePath.split("/").pop();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showNotification("File downloaded successfully!", "success");
  } catch (error) {
    console.error("Error downloading file:", error);
    showNotification(`Failed to download file: ${error.message}`, "error");
  }
});

// Delete File Functionality
let pendingDeleteOperation = null;

document.getElementById("deleteFileBtn")?.addEventListener("click", async () => {
  if (!currentFile || !currentRepo) return;

  const fileName = currentFile.path.split("/").pop();

  // Store delete operation
  pendingDeleteOperation = {
    fileName,
    filePath: currentFile.path,
    sha: currentFile.sha,
  };

  // Open commit message modal for delete
  openCommitMessageModal(`Delete ${fileName}`);
});
