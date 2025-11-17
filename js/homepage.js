// Parallax effect
document.addEventListener("DOMContentLoaded", () => {
  const parallaxSections = document.querySelectorAll(".parallax-section");

  window.addEventListener("scroll", () => {
    const scrolled = window.pageYOffset;

    parallaxSections.forEach((section) => {
      const speed = section.dataset.speed || 0.5;
      const yPos = -(scrolled * speed);
      const background = section.querySelector(".hero-background");

      if (background) {
        background.style.transform = `translateY(${yPos}px)`;
      }
    });
  });

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });

  // Intersection Observer for fade-in animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  }, observerOptions);

  document.querySelectorAll(".feature-card, .why-item").forEach((el) => {
    observer.observe(el);
  });

  // Navbar scroll effect
  let lastScroll = 0;
  const navbar = document.querySelector(".navbar");

  window.addEventListener("scroll", () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
      navbar.style.background = "rgba(13, 17, 23, 0.95)";
      navbar.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
    } else {
      navbar.style.background = "rgba(13, 17, 23, 0.8)";
      navbar.style.boxShadow = "none";
    }

    lastScroll = currentScroll;
  });

  // Login button handlers - Open GitHub authorization in new tab
  const loginButtons = document.querySelectorAll("#loginBtn, #heroLoginBtn");
  loginButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();

      // Build GitHub OAuth URL
      const clientId = "Ov23lihC3y93z52VK93G";
      const redirectUri = encodeURIComponent("http://localhost:3000/callback");
      const scope = encodeURIComponent("repo user delete_repo");
      const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${redirectUri}`;

      console.log("Opening GitHub authorization:", authUrl);

      // Open in new tab - this will show GitHub's authorization page
      const authTab = window.open(authUrl, "_blank", "noopener,noreferrer");

      if (!authTab) {
        alert("Please allow popups for this site to authorize with GitHub");
        return;
      }

      // Listen for message from the callback tab
      const messageListener = (event) => {
        // Security: Only accept messages from same origin
        if (event.origin !== window.location.origin && event.origin !== "http://localhost:3000") {
          return;
        }

        if (event.data && event.data.type === "GITHUB_AUTH_SUCCESS") {
          // Store token
          localStorage.setItem("token", event.data.token);

          // Remove listener
          window.removeEventListener("message", messageListener);
          clearInterval(checkToken);

          // Redirect to dashboard
          window.location.href = "dashboard.html";
        }
      };

      window.addEventListener("message", messageListener);

      // Also check localStorage periodically in case message doesn't work
      const checkToken = setInterval(() => {
        const token = localStorage.getItem("token");
        if (token && !window.location.href.includes("dashboard.html")) {
          clearInterval(checkToken);
          window.removeEventListener("message", messageListener);
          window.location.href = "dashboard.html";
        }
      }, 1000);

      // Stop checking after 5 minutes
      setTimeout(() => {
        clearInterval(checkToken);
        window.removeEventListener("message", messageListener);
      }, 300000);
    });
  });

  // Stagger animation for feature cards
  const featureCards = document.querySelectorAll(".feature-card");
  featureCards.forEach((card, index) => {
    card.style.transitionDelay = `${index * 0.1}s`;
  });
});
