package com.devcollab.dto;

import java.util.List;

public class GitHubDTOs {

    // GitHub OAuth callback result
    public record GitHubConnectResponse(
        String githubUsername,
        String githubId,
        boolean connected
    ) {}

    // GitHub repo summary
    public record GitHubRepo(
        String fullName,       // "owner/repo"
        String name,
        String ownerLogin,
        boolean isPrivate,
        String defaultBranch,
        String htmlUrl
    ) {}

    // GitHub PR summary (list view)
    public record GitHubPR(
        int number,
        String title,
        String state,          // open / closed
        boolean merged,
        String authorLogin,
        String htmlUrl,
        String headSha,
        String headRef,        // branch name
        String baseRef,
        String createdAt,
        String updatedAt
    ) {}

    // Single changed file inside a PR
    public record GitHubPRFile(
        String filename,
        String status,         // added / modified / removed
        int additions,
        int deletions,
        String patch           // unified diff patch
    ) {}

    // Full PR import result (returned after import)
    public record GitHubPRImportResult(
        String roomId,
        String roomJoinCode,
        String prTitle,
        String prUrl,
        String prStatus,
        String repo,
        int prNumber,
        List<GitHubPRFile> files,
        String importedFileContent,  // the content loaded into editor
        String language
    ) {}

    // Request to import a specific PR
    public record ImportPRRequest(
        String repo,           // "owner/repo"
        int prNumber,
        String filename        // which file to load (null = first changed file)
    ) {}

    // GitHub user profile (from /user endpoint)
    public record GitHubUser(
        String login,
        String id,
        String avatarUrl,
        String name
    ) {}
}
