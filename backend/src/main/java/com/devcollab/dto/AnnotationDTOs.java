package com.devcollab.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import java.util.List;

public class AnnotationDTOs {

    public record AnnotationRequest(
        @NotNull Integer lineNumber,
        @NotBlank @Size(max=2000) String comment
    ) {}

    public record AnnotationResponse(
        String id,
        String roomId,
        String authorUsername,
        Integer lineNumber,
        String comment,
        String status,
        List<ReplyResponse> replies,
        LocalDateTime createdAt
    ) {}

    public record StatusUpdateRequest(@NotBlank String status) {}

    public record ReplyRequest(
        @NotBlank String annotationId,
        @NotBlank @Size(max=2000) String content
    ) {}

    public record ReplyResponse(
        String id,
        String annotationId,
        String authorUsername,
        String content,
        LocalDateTime createdAt
    ) {}

    public record PresenceDTO(
        String username,
        String status,
        long timestamp
    ) {}

    /** Sent by client when code changes in the editor */
    public record CodeUpdateRequest(
        @NotNull String codeContent
    ) {}

    /** Broadcast to all room members when code changes */
    public record CodeUpdateBroadcast(
        String roomId,
        String codeContent,
        String updatedBy   // so receiver can skip re-applying their own edit
    ) {}
}
