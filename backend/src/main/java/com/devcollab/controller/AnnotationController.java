package com.devcollab.controller;

import com.devcollab.dto.AnnotationDTOs.*;
import com.devcollab.service.AnnotationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@Slf4j
@RestController
@RequiredArgsConstructor
public class AnnotationController {

    private final AnnotationService annotationService;
    private final SimpMessagingTemplate messaging;

    // ── REST ──────────────────────────────────────────────────────────────────

    @GetMapping("/api/v1/rooms/{roomId}/annotations")
    public ResponseEntity<List<AnnotationResponse>> getAll(
            @PathVariable String roomId, Principal principal) {
        return ResponseEntity.ok(annotationService.getAll(roomId, principal.getName()));
    }

    @PatchMapping("/api/v1/annotations/{id}/status")
    public ResponseEntity<AnnotationResponse> updateStatus(
            @PathVariable String id,
            @Valid @RequestBody StatusUpdateRequest req,
            Principal principal) {
        AnnotationResponse updated = annotationService.updateStatus(id, req, principal.getName());
        messaging.convertAndSend("/topic/room/" + updated.roomId() + "/status", updated);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/api/v1/annotations/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id, Principal principal) {
        annotationService.deleteAnnotation(id, principal.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/v1/annotations/{id}/replies")
    public ResponseEntity<List<ReplyResponse>> getReplies(
            @PathVariable String id, Principal principal) {
        return ResponseEntity.ok(annotationService.getReplies(id, principal.getName()));
    }

    // ── WebSocket ─────────────────────────────────────────────────────────────

    /** New annotation — save to DB then broadcast to all room members */
    @MessageMapping("/room/{roomId}/annotate")
    public void handleAnnotation(
            @DestinationVariable String roomId,
            @Payload AnnotationRequest req,
            Principal principal) {

        if (principal == null) {
            log.error("[WS] handleAnnotation: unauthenticated — check ChannelInterceptor");
            return;
        }
        log.info("[WS] annotation from {} room {} line {}", principal.getName(), roomId, req.lineNumber());
        AnnotationResponse saved = annotationService.create(roomId, req, principal.getName());
        messaging.convertAndSend("/topic/room/" + roomId + "/annotations", saved);
    }

    /** Reply to annotation thread */
    @MessageMapping("/room/{roomId}/reply")
    public void handleReply(
            @DestinationVariable String roomId,
            @Payload ReplyRequest req,
            Principal principal) {

        if (principal == null) { log.error("[WS] handleReply: unauthenticated"); return; }
        log.info("[WS] reply from {} on annotation {}", principal.getName(), req.annotationId());
        ReplyResponse saved = annotationService.createReply(req.annotationId(), req, principal.getName());
        messaging.convertAndSend("/topic/room/" + roomId + "/replies", saved);
    }

    /**
     * Live code update — broadcast code changes to all room members in real time.
     * Also persists to DB so new joiners see the latest code.
     */
    @MessageMapping("/room/{roomId}/code-update")
    public void handleCodeUpdate(
            @DestinationVariable String roomId,
            @Payload CodeUpdateRequest req,
            Principal principal) {

        if (principal == null) { log.error("[WS] handleCodeUpdate: unauthenticated"); return; }
        log.debug("[WS] code update from {} room {}", principal.getName(), roomId);

        // Persist to DB so new joiners get the latest code
        annotationService.updateRoomCode(roomId, req.codeContent(), principal.getName());

        // Broadcast to everyone else in the room
        // Include sender username so frontend can skip re-applying its own update
        CodeUpdateBroadcast broadcast = new CodeUpdateBroadcast(
                roomId, req.codeContent(), principal.getName());
        messaging.convertAndSend("/topic/room/" + roomId + "/code", broadcast);
    }

    /** Presence heartbeat */
    @MessageMapping("/room/{roomId}/heartbeat")
    public void handleHeartbeat(
            @DestinationVariable String roomId,
            Principal principal) {

        if (principal == null) return;
        messaging.convertAndSend(
                "/topic/room/" + roomId + "/presence",
                new PresenceDTO(principal.getName(), "ONLINE", System.currentTimeMillis()));
    }
}
