package com.devcollab.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import java.util.List;

public class RoomDTOs {

    public record CreateRoomRequest(
        @NotBlank @Size(max=100) String title,
        String language,
        String codeContent
    ) {}

    public record JoinRoomRequest(@NotBlank String joinCode) {}

    public record UpdateCodeRequest(String codeContent) {}

    public record RoomResponse(
        String id,
        String title,
        String language,
        String codeContent,
        String joinCode,
        String status,
        String ownerUsername,
        LocalDateTime createdAt,
        // GitHub PR metadata (null if not imported from GitHub)
        String githubPrUrl,
        String githubRepo,
        Integer githubPrNumber,
        String githubPrStatus,
        String githubPrTitle,
        String githubPrAuthor
    ) {}

    public record RoomSummary(
        String id,
        String title,
        String language,
        String joinCode,
        String status,
        String ownerUsername,
        String role,
        LocalDateTime createdAt,
        // GitHub PR metadata
        String githubPrUrl,
        String githubPrStatus,
        String githubPrTitle,
        Integer githubPrNumber,
        String githubRepo
    ) {}

    public record MemberResponse(
        String userId,
        String username,
        String role,
        LocalDateTime joinedAt
    ) {}

    public record ChangeMemberRoleRequest(@NotBlank String role) {}
}
