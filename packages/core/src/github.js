const GITHUB_API = "https://api.github.com";
const PROXY = "https://proxy.writechoice.io";
const CLIENT_ID = import.meta.env?.VITE_GITHUB_CLIENT_ID ?? process.env.GITHUB_CLIENT_ID ?? "";

// GitHub's OAuth endpoints block browser CORS — route them through the proxy.
function proxied(url) {
  return `${PROXY}/${url}`;
}

function proxyHeaders() {
  return {
    Origin: typeof window !== "undefined" ? window.location.origin : "https://writechoice.io",
    "X-Requested-With": "XMLHttpRequest",
  };
}

/**
 * Start the GitHub Device Flow.
 * Returns { device_code, user_code, verification_uri, expires_in, interval }.
 */
export async function startDeviceFlow() {
  const res = await fetch(proxied("https://github.com/login/device/code"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      ...proxyHeaders(),
    },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: "repo" }).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Device flow failed (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Poll for a token after the user has approved on GitHub.
 * Resolves with the access token string, or rejects on error/expiry.
 * Transient network/proxy errors are logged but do NOT stop polling.
 */
export async function pollForToken(deviceCode, intervalSeconds = 5) {
  return new Promise((resolve, reject) => {
    let currentInterval = intervalSeconds * 1000

    const tick = async () => {
      console.log('[github] poll tick firing')
      try {
        const res = await fetch(proxied('https://github.com/login/oauth/access_token'), {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            ...proxyHeaders(),
          },
          body: new URLSearchParams({
            client_id: CLIENT_ID,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }).toString(),
        })

        const text = await res.text()
        console.log('[github] poll', res.status, text.slice(0, 300))

        let data
        try { data = JSON.parse(text) } catch {
          console.log('[github] poll: non-JSON response, retrying:', text.slice(0, 100))
          schedule()
          return
        }

        if (data.access_token) {
          resolve(data.access_token)
          return
        }
        if (data.error === 'expired_token' || data.error === 'access_denied') {
          reject(new Error(data.error))
          return
        }
        if (data.error === 'slow_down' && data.interval) {
          currentInterval = (data.interval + 5) * 1000
        }
        // authorization_pending or slow_down → keep going
        schedule()
      } catch (err) {
        console.warn('[github] poll: transient error, retrying', err.message)
        schedule()
      }
    }

    let timer
    function schedule() {
      timer = setTimeout(tick, currentInterval)
    }

    // Expose cancel via a non-standard property so callers can clean up
    const p = { cancel: () => clearTimeout(timer) }
    schedule()

    // Attach cancel to the promise for external cleanup
    Object.assign(resolve, { _timer: () => clearTimeout(timer) })
  })
}

/**
 * Authenticate with a Personal Access Token (simpler alternative to device flow).
 * Verifies the token works by fetching the user profile.
 */
export async function authenticateWithPAT(token) {
  return getAuthenticatedUser(token)
}

/**
 * Fetch the authenticated user's profile.
 */
export async function getAuthenticatedUser(token) {
  return githubFetch(token, "/user");
}

/**
 * List the user's repos (type=all, sorted by updated).
 */
export async function listRepos(token) {
  return githubFetch(token, "/user/repos?type=all&sort=updated&per_page=100");
}

/**
 * Read a file from a repo. Returns { content (decoded), sha }.
 */
export async function readFile(token, owner, repo, path) {
  const data = await githubFetch(token, `/repos/${owner}/${repo}/contents/${path}`);
  return {
    content: atob(data.content.replace(/\n/g, "")),
    sha: data.sha,
  };
}

/**
 * Write (create or update) a file in a repo.
 */
export async function writeFile(token, owner, repo, path, content, sha, message) {
  return githubFetch(token, `/repos/${owner}/${repo}/contents/${path}`, {
    method: sha ? "PUT" : "PUT",
    body: JSON.stringify({
      message: message ?? `chore: update ${path}`,
      content: btoa(unescape(encodeURIComponent(content))),
      sha,
    }),
  });
}

/**
 * Delete a file from a repo. Requires the current sha.
 */
export async function deleteFile(token, owner, repo, path, sha, message) {
  return githubFetch(token, `/repos/${owner}/${repo}/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({
      message: message ?? `chore: delete ${path}`,
      sha,
    }),
  })
}

/**
 * List files at a path in a repo.
 */
export async function listDirectory(token, owner, repo, path = "") {
  return githubFetch(token, `/repos/${owner}/${repo}/contents/${path}`);
}

async function githubFetch(token, path, options = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `GitHub API error ${res.status}`);
  }
  return res.json();
}
