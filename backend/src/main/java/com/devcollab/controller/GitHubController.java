package com.devcollab.controller;

import com.devcollab.dto.GitHubDTOs.*;
import com.devcollab.service.GitHubService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/github")
@RequiredArgsConstructor
public class GitHubController {

    private final GitHubService gitHubService;

    @Value("${github.client-id}")
    private String clientId;

    @Value("${cors.allowed-origins}")
    private String allowedOrigins;

    // ─────────────────────────────────────────────────────────────────────────
    // OAuth
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/auth-url")
    public ResponseEntity<Map<String, String>> getAuthUrl() {

        String url = "https://github.com/login/oauth/authorize"
                + "?client_id=" + clientId
                + "&scope=repo,read:user"
                + "&state=devcollab";

        return ResponseEntity.ok(Map.of("url", url));
    }

    /**
     * GitHub redirects here after authorization.
     *
     * state now contains the DevCollab JWT.
     */
    @GetMapping("/callback")
    public void callback(
            @RequestParam String code,
            @RequestParam String state,
            HttpServletResponse response) throws IOException {

        String frontendUrl = allowedOrigins.split(",")[0].trim();

        try {

            // state contains our JWT
            String username = gitHubService.extractUsernameFromToken(state);

            log.info("[GitHub] OAuth callback for user {}", username);

            gitHubService.handleOAuthCallback(code, username);

            response.sendRedirect(frontendUrl + "?github=connected");

        } catch (Exception e) {

            log.error("[GitHub] OAuth callback failed", e);

            String reason = URLEncoder.encode(
                    e.getMessage() == null ? "unknown" : e.getMessage(),
                    StandardCharsets.UTF_8);

            response.sendRedirect(frontendUrl + "?github=error&reason=" + reason);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Status
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status(Principal principal) {

        boolean connected = gitHubService.isConnected(principal.getName());
        String githubUsername = gitHubService.getGitHubUsername(principal.getName());

        return ResponseEntity.ok(Map.of(
                "connected", connected,
                "githubUsername", githubUsername == null ? "" : githubUsername
        ));
    }

    @DeleteMapping("/disconnect")
    public ResponseEntity<Void> disconnect(Principal principal) {

        gitHubService.disconnect(principal.getName());

        return ResponseEntity.noContent().build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Debug
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/ping")
    public ResponseEntity<Map<String, String>> ping(Principal principal) {

        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "user", principal.getName(),
                "message", "Backend reachable and JWT valid"
        ));
    }

    @GetMapping("/token-check")
    public ResponseEntity<Map<String, Object>> tokenCheck(Principal principal) {

        return ResponseEntity.ok(Map.of(
                "connected", gitHubService.isConnected(principal.getName()),
                "githubUsername",
                gitHubService.getGitHubUsername(principal.getName()) == null
                        ? "not set"
                        : gitHubService.getGitHubUsername(principal.getName()),
                "devCollabUser", principal.getName()
        ));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Repositories
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/repos")
    public ResponseEntity<List<GitHubRepo>> listRepos(Principal principal) {

        return ResponseEntity.ok(
                gitHubService.listRepos(principal.getName()));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pull Requests
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/repos/{owner}/{repo}/pulls")
    public ResponseEntity<List<GitHubPR>> listPRs(
            @PathVariable String owner,
            @PathVariable String repo,
            Principal principal) {

        return ResponseEntity.ok(
                gitHubService.listPRs(owner + "/" + repo, principal.getName()));
    }

    @GetMapping("/repos/{owner}/{repo}/pulls/{prNumber}/files")
    public ResponseEntity<List<GitHubPRFile>> listPRFiles(
            @PathVariable String owner,
            @PathVariable String repo,
            @PathVariable int prNumber,
            Principal principal) {

        return ResponseEntity.ok(
                gitHubService.listPRFiles(owner + "/" + repo, prNumber, principal.getName()));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Import PR
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping("/import-pr")
    public ResponseEntity<GitHubPRImportResult> importPR(
            @RequestBody ImportPRRequest req,
            Principal principal) {

        return ResponseEntity.status(201)
                .body(gitHubService.importPR(req, principal.getName()));
    }
}