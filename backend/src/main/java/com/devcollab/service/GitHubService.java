package com.devcollab.service;

import com.devcollab.dto.GitHubDTOs.*;
import com.devcollab.security.JwtUtil;
import com.devcollab.dto.RoomDTOs.RoomResponse;
import com.devcollab.entity.*;
import com.devcollab.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GitHubService {

    private final UserRepository userRepo;
    private final ReviewRoomRepository roomRepo;
    private final RoomMemberRepository memberRepo;
    private final RoomService roomService;
    private final JwtUtil jwtUtil;
    private final RestTemplate restTemplate;

    @Value("${github.client-id}")
    private String clientId;

    @Value("${github.client-secret}")
    private String clientSecret;

    private static final String GH_API = "https://api.github.com";
    private static final String GH_TOKEN_URL = "https://github.com/login/oauth/access_token";

    // ── OAuth ─────────────────────────────────────────────────────────────────

    /** Exchange OAuth code for access token, store on user */
    @Transactional
    public GitHubConnectResponse handleOAuthCallback(String code, String username) {
        String accessToken = exchangeCodeForToken(code);
        GitHubUser ghUser = fetchGitHubUser(accessToken);

        User user = getUser(username);
        user.setGithubAccessToken(accessToken);
        user.setGithubUsername(ghUser.login());
        user.setGithubId(ghUser.id());
        userRepo.save(user);

        log.info("GitHub connected for user {} → github:{}", username, ghUser.login());
        return new GitHubConnectResponse(ghUser.login(), ghUser.id(), true);
    }

    /** Check if current user has GitHub connected */
    public boolean isConnected(String username) {
        User user = getUser(username);
        return user.getGithubAccessToken() != null && !user.getGithubAccessToken().isBlank();
    }

    /** Disconnect GitHub from user account */
    @Transactional
    public void disconnect(String username) {
        User user = getUser(username);
        user.setGithubAccessToken(null);
        user.setGithubUsername(null);
        user.setGithubId(null);
        userRepo.save(user);
    }


    /** Extract username from JWT token — used during OAuth callback */
    public String extractUsernameFromToken(String token) {
        return jwtUtil.extractUsername(token);
    }

    /** Get connected GitHub username for display */
    public String getGitHubUsername(String username) {
        try {
            User user = getUser(username);
            return user.getGithubUsername();
        } catch (Exception e) {
            return null;
        }
    }

    // ── Repos ─────────────────────────────────────────────────────────────────

    /** List repos the user has access to (owned + collaborator) */
    public List<GitHubRepo> listRepos(String username) {
        log.info("[GitHub] listRepos for user: {}", username);
        String token = requireToken(username);
        log.info("[GitHub] calling GitHub API /user/repos");
        List<Map<String, Object>> raw = ghGet(
                "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator",
                token, new ParameterizedTypeReference<>() {});
        log.info("[GitHub] got {} repos", raw != null ? raw.size() : 0);
        if (raw == null) return List.of();
        return raw.stream().map(this::mapRepo).collect(Collectors.toList());
    }

    // ── PRs ──────────────────────────────────────────────────────────────────

    /** List PRs for a repo (all states) */
    public List<GitHubPR> listPRs(String repo, String username) {
        String token = requireToken(username);
        List<Map<String, Object>> raw = ghGet(
                "/repos/" + repo + "/pulls?state=all&per_page=50&sort=updated",
                token, new ParameterizedTypeReference<>() {});
        return raw.stream().map(this::mapPR).collect(Collectors.toList());
    }

    /** List files changed in a PR */
    public List<GitHubPRFile> listPRFiles(String repo, int prNumber, String username) {
        String token = requireToken(username);
        List<Map<String, Object>> raw = ghGet(
                "/repos/" + repo + "/pulls/" + prNumber + "/files?per_page=100",
                token, new ParameterizedTypeReference<>() {});
        return raw.stream().map(this::mapFile).collect(Collectors.toList());
    }

    // ── Import PR into DevCollab Room ─────────────────────────────────────────

    @Transactional
    public GitHubPRImportResult importPR(ImportPRRequest req, String username) {
        String token = requireToken(username);

        // 1. Fetch PR details
        Map<String, Object> prData = ghGet(
                "/repos/" + req.repo() + "/pulls/" + req.prNumber(),
                token, new ParameterizedTypeReference<>() {});

        // 2. Fetch changed files
        List<GitHubPRFile> files = listPRFiles(req.repo(), req.prNumber(), username);
        if (files.isEmpty())
            throw new IllegalArgumentException("This PR has no changed files");

        // 3. Pick which file to load into editor
        GitHubPRFile targetFile = pickFile(files, req.filename());

        // 4. Fetch the actual file content from the head commit
        String headSha = extractStr(extractMap(prData, "head"), "sha");
        String fileContent = fetchFileContent(req.repo(), targetFile.filename(), headSha, token);

        // 5. Determine language from filename
        String language = detectLanguage(targetFile.filename());

        // 6. Build PR metadata
        String prTitle  = extractStr(prData, "title");
        String prHtmlUrl = extractStr(prData, "html_url");
        String prState  = extractStr(prData, "state");
        boolean merged  = Boolean.TRUE.equals(prData.get("merged"));
        String prStatus = merged ? "merged" : prState;
        String author   = extractStr(extractMap(prData, "user"), "login");

        // 7. Create room
        User owner = getUser(username);
        ReviewRoom room = ReviewRoom.builder()
                .title("PR #" + req.prNumber() + ": " + prTitle)
                .language(language)
                .codeContent(fileContent)
                .owner(owner)
                .joinCode(generateJoinCode())
                .githubPrUrl(prHtmlUrl)
                .githubRepo(req.repo())
                .githubPrNumber(req.prNumber())
                .githubPrStatus(prStatus)
                .githubPrTitle(prTitle)
                .githubPrAuthor(author)
                .build();
        ReviewRoom saved = roomRepo.save(room);
        memberRepo.save(RoomMember.builder()
                .room(saved).user(owner).role(RoomMember.Role.OWNER).build());

        log.info("Imported GitHub PR {}/{} #{} into room {}", req.repo(), req.prNumber(), saved.getId());

        return new GitHubPRImportResult(
                saved.getId(), saved.getJoinCode(),
                prTitle, prHtmlUrl, prStatus,
                req.repo(), req.prNumber(),
                files, fileContent, language
        );
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private String exchangeCodeForToken(String code) {
        RestTemplate rt = restTemplate;
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, String> body = Map.of(
                "client_id", clientId,
                "client_secret", clientSecret,
                "code", code
        );
        HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, headers);
        try {
            ResponseEntity<Map<String, Object>> resp = rt.exchange(
                    GH_TOKEN_URL, HttpMethod.POST, entity,
                    new ParameterizedTypeReference<>() {});

            Map<String, Object> result = resp.getBody();
            if (result == null || !result.containsKey("access_token")) {
                String error = result != null ? String.valueOf(result.get("error_description")) : "null response";
                log.error("[GitHub] Token exchange failed: {}", error);
                throw new IllegalStateException(
                    "GitHub OAuth failed: " + error +
                    ". Make sure client_id and client_secret are correct.");
            }
            return (String) result.get("access_token");
        } catch (HttpClientErrorException e) {
            log.error("[GitHub] Token exchange HTTP error: {}", e.getResponseBodyAsString());
            throw new IllegalStateException("GitHub OAuth error: " + e.getResponseBodyAsString());
        }
    }

    private GitHubUser fetchGitHubUser(String token) {
        Map<String, Object> data = ghGet("/user", token, new ParameterizedTypeReference<>() {});
        return new GitHubUser(
                extractStr(data, "login"),
                String.valueOf(data.get("id")),
                extractStr(data, "avatar_url"),
                extractStr(data, "name")
        );
    }

    private String fetchFileContent(String repo, String filename, String ref, String token) {
        try {
            Map<String, Object> data = ghGet(
                    "/repos/" + repo + "/contents/" + filename + "?ref=" + ref,
                    token, new ParameterizedTypeReference<>() {});
            String encoded = extractStr(data, "content");
            if (encoded == null || encoded.isBlank()) return "// File content unavailable\n";
            // GitHub returns base64 content with newlines
            String cleaned = encoded.replaceAll("\\s", "");
            return new String(Base64.getDecoder().decode(cleaned));
        } catch (Exception e) {
            log.warn("Could not fetch file content for {}: {}", filename, e.getMessage());
            return "// Could not load file content. View on GitHub: " +
                   "https://github.com/" + repo + "/blob/" + ref + "/" + filename + "\n";
        }
    }

    private <T> T ghGet(String path, String token, ParameterizedTypeReference<T> type) {
        RestTemplate rt = restTemplate;
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + token);
        headers.set("Accept", "application/vnd.github+json");
        headers.set("X-GitHub-Api-Version", "2022-11-28");
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        try {
            ResponseEntity<T> resp = rt.exchange(GH_API + path, HttpMethod.GET, entity, type);
            return resp.getBody();
        } catch (HttpClientErrorException e) {
            log.error("[GitHub] API error {} for path {}: {}", e.getStatusCode(), path, e.getResponseBodyAsString());
            if (e.getStatusCode().value() == 401) {
                throw new IllegalStateException(
                    "GitHub token expired or revoked. Please disconnect and reconnect your GitHub account.");
            }
            if (e.getStatusCode().value() == 403) {
                throw new IllegalStateException(
                    "GitHub access denied. Make sure your OAuth App has the 'repo' scope.");
            }
            if (e.getStatusCode().value() == 404) {
                throw new IllegalArgumentException(
                    "GitHub resource not found: " + path);
            }
            throw new IllegalStateException(
                "GitHub API error " + e.getStatusCode().value() + ": " + e.getResponseBodyAsString());
        } catch (RestClientException e) {
            log.error("[GitHub] Network error for path {}: {}", path, e.getMessage());
            throw new IllegalStateException("Failed to reach GitHub API. Check your internet connection.");
        }
    }

    private GitHubRepo mapRepo(Map<String, Object> r) {
        Map<String, Object> owner = extractMap(r, "owner");
        return new GitHubRepo(
                extractStr(r, "full_name"),
                extractStr(r, "name"),
                extractStr(owner, "login"),
                Boolean.TRUE.equals(r.get("private")),
                extractStr(r, "default_branch"),
                extractStr(r, "html_url")
        );
    }

    @SuppressWarnings("unchecked")
    private GitHubPR mapPR(Map<String, Object> p) {
        Map<String, Object> user = extractMap(p, "user");
        Map<String, Object> head = extractMap(p, "head");
        Map<String, Object> base = extractMap(p, "base");
        return new GitHubPR(
                (Integer) p.get("number"),
                extractStr(p, "title"),
                extractStr(p, "state"),
                Boolean.TRUE.equals(p.get("merged")),
                extractStr(user, "login"),
                extractStr(p, "html_url"),
                extractStr(head, "sha"),
                extractStr(head, "ref"),
                extractStr(base, "ref"),
                extractStr(p, "created_at"),
                extractStr(p, "updated_at")
        );
    }

    private GitHubPRFile mapFile(Map<String, Object> f) {
        return new GitHubPRFile(
                extractStr(f, "filename"),
                extractStr(f, "status"),
                f.get("additions") instanceof Integer i ? i : 0,
                f.get("deletions") instanceof Integer i ? i : 0,
                extractStr(f, "patch")
        );
    }

    private GitHubPRFile pickFile(List<GitHubPRFile> files, String requestedFilename) {
        if (requestedFilename != null && !requestedFilename.isBlank()) {
            return files.stream()
                    .filter(f -> f.filename().equals(requestedFilename))
                    .findFirst()
                    .orElse(files.get(0));
        }
        // prefer non-deleted files, then first modified, then anything
        return files.stream()
                .filter(f -> !"removed".equals(f.status()))
                .findFirst()
                .orElse(files.get(0));
    }

    private String detectLanguage(String filename) {
        if (filename == null) return "plaintext";
        String lower = filename.toLowerCase();
        if (lower.endsWith(".java"))       return "java";
        if (lower.endsWith(".js"))         return "javascript";
        if (lower.endsWith(".ts"))         return "typescript";
        if (lower.endsWith(".jsx"))        return "javascript";
        if (lower.endsWith(".tsx"))        return "typescript";
        if (lower.endsWith(".py"))         return "python";
        if (lower.endsWith(".go"))         return "go";
        if (lower.endsWith(".rs"))         return "rust";
        if (lower.endsWith(".cpp") || lower.endsWith(".cc")) return "cpp";
        if (lower.endsWith(".cs"))         return "csharp";
        if (lower.endsWith(".html"))       return "html";
        if (lower.endsWith(".css"))        return "css";
        if (lower.endsWith(".sql"))        return "sql";
        if (lower.endsWith(".json"))       return "json";
        if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
        if (lower.endsWith(".md"))         return "markdown";
        if (lower.endsWith(".sh"))         return "shell";
        if (lower.endsWith(".xml"))        return "xml";
        if (lower.endsWith(".kt"))         return "kotlin";
        if (lower.endsWith(".swift"))      return "swift";
        if (lower.endsWith(".php"))        return "php";
        if (lower.endsWith(".rb"))         return "ruby";
        return "plaintext";
    }

    private String generateJoinCode() {
        String code;
        do {
            code = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
        } while (roomRepo.findByJoinCode(code).isPresent());
        return code;
    }

    private User getUser(String username) {
        return userRepo.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
    }

    private String requireToken(String username) {
        User user = getUser(username);
        if (user.getGithubAccessToken() == null || user.getGithubAccessToken().isBlank())
            throw new IllegalStateException("GitHub not connected. Please connect your GitHub account first.");
        return user.getGithubAccessToken();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> extractMap(Map<String, Object> m, String key) {
        Object val = m != null ? m.get(key) : null;
        return val instanceof Map ? (Map<String, Object>) val : Collections.emptyMap();
    }

    private String extractStr(Map<String, Object> m, String key) {
        Object val = m != null ? m.get(key) : null;
        return val != null ? String.valueOf(val) : null;
    }
}
