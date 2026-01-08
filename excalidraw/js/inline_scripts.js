try {
        function setTheme(theme) {
          if (theme === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        }

        function getTheme() {
          const theme = window.localStorage.getItem("excalidraw-theme");

          if (theme && theme === "system") {
            return window.matchMedia("(prefers-color-scheme: dark)").matches
              ? "dark"
              : "light";
          } else {
            return theme || "light";
          }
        }

        setTheme(getTheme());
      } catch (e) {
        console.error("Error setting dark mode", e);
      }

// Redirect Excalidraw+ users which have auto-redirect enabled.
      //
      // Redirect only the bare root path, so link/room/library urls are not
      // redirected.
      //
      // Putting into index.html for best performance (can't redirect on server
      // due to location.hash checks).
      if (
        window.location.pathname === "/" &&
        !window.location.hash &&
        !window.location.search &&
        // if its present redirect
        document.cookie.includes("excplus-autoredirect=true")
      ) {
        window.location.href = "https://app.excalidraw.com";
      }

// point into our CDN in prod, fallback to root (excalidraw.com) domain in case of issues
        window.EXCALIDRAW_ASSET_PATH = [
          "https://excalidraw.nyc3.cdn.digitaloceanspaces.com/oss/",
          "/",
        ];

// setting this so that libraries installation reuses this window tab.
      window.name = "_excalidraw";

// need to load this script dynamically bcs. of iframe embed tracking
      var scriptEle = document.createElement("script");
      scriptEle.setAttribute(
        "src",
        "https://scripts.simpleanalyticscdn.com/latest.js",
      );
      scriptEle.setAttribute("type", "text/javascript");
      scriptEle.setAttribute("defer", true);
      scriptEle.setAttribute("async", true);
      // if iframe
      if (window.self !== window.top) {
        scriptEle.setAttribute("data-auto-collect", true);
      }

      document.body.appendChild(scriptEle);

      // if iframe
      if (window.self !== window.top) {
        scriptEle.addEventListener("load", () => {
          if (window.sa_pageview) {
            window.window.sa_event(action, {
              category: "iframe",
              label: "embed",
              value: window.location.pathname,
            });
          }
        });
      }