package com.devcollab.service;

import com.devcollab.dto.AnnotationDTOs.*;
import com.devcollab.entity.*;
import com.devcollab.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnnotationService {

    private final AnnotationRepository annotationRepo;
    private final AnnotationReplyRepository replyRepo;
    private final ReviewRoomRepository roomRepo;
    private final UserRepository userRepo;
    private final RoomMemberRepository memberRepo;

    public List<AnnotationResponse> getAll(String roomId, String username) {
        ReviewRoom room = getRoom(roomId);
        User user = getUser(username);
        if (!memberRepo.existsByRoomAndUser(room, user))
            throw new SecurityException("Not a member");
        return annotationRepo.findByRoomOrderByCreatedAtAsc(room)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public AnnotationResponse create(String roomId, AnnotationRequest req, String authorUsername) {
        ReviewRoom room = getRoom(roomId);
        User user = getUser(authorUsername);
        RoomMember member = memberRepo.findByRoomAndUser(room, user)
                .orElseThrow(() -> new SecurityException("Not a member"));
        if (member.getRole() == RoomMember.Role.VIEWER)
            throw new SecurityException("Viewers cannot annotate");
        Annotation annotation = Annotation.builder()
                .room(room).author(user)
                .lineNumber(req.lineNumber())
                .comment(req.comment())
                .build();
        return toResponse(annotationRepo.save(annotation));
    }

    @Transactional
    public AnnotationResponse updateStatus(String id, StatusUpdateRequest req, String username) {
        Annotation annotation = getAnnotation(id);
        User user = getUser(username);
        RoomMember member = memberRepo.findByRoomAndUser(annotation.getRoom(), user)
                .orElseThrow(() -> new SecurityException("Not a member"));
        if (member.getRole() == RoomMember.Role.VIEWER)
            throw new SecurityException("Viewers cannot update status");
        annotation.setStatus(Annotation.AnnotationStatus.valueOf(req.status()));
        return toResponse(annotationRepo.save(annotation));
    }

    @Transactional
    public void deleteAnnotation(String id, String username) {
        Annotation annotation = getAnnotation(id);
        User user = getUser(username);
        if (!annotation.getAuthor().getUsername().equals(username)) {
            RoomMember member = memberRepo.findByRoomAndUser(annotation.getRoom(), user)
                    .orElseThrow(() -> new SecurityException("Not a member"));
            if (member.getRole() != RoomMember.Role.OWNER)
                throw new SecurityException("Can only delete your own annotations");
        }
        annotationRepo.delete(annotation);
    }

    @Transactional
    public ReplyResponse createReply(String annotationId, ReplyRequest req, String username) {
        Annotation annotation = getAnnotation(annotationId);
        User user = getUser(username);
        if (!memberRepo.existsByRoomAndUser(annotation.getRoom(), user))
            throw new SecurityException("Not a member");
        AnnotationReply reply = AnnotationReply.builder()
                .annotation(annotation).author(user)
                .content(req.content()).build();
        return toReplyResponse(replyRepo.save(reply));
    }

    public List<ReplyResponse> getReplies(String annotationId, String username) {
        Annotation annotation = getAnnotation(annotationId);
        User user = getUser(username);
        if (!memberRepo.existsByRoomAndUser(annotation.getRoom(), user))
            throw new SecurityException("Not a member");
        return replyRepo.findByAnnotationOrderByCreatedAtAsc(annotation)
                .stream().map(this::toReplyResponse).collect(Collectors.toList());
    }

    /** Called from WebSocket handler — persist latest code content to DB */
    @Transactional
    public void updateRoomCode(String roomId, String codeContent, String username) {
        ReviewRoom room = getRoom(roomId);
        User user = getUser(username);
        RoomMember member = memberRepo.findByRoomAndUser(room, user)
                .orElseThrow(() -> new SecurityException("Not a member"));
        if (member.getRole() == RoomMember.Role.VIEWER)
            return; // viewers cannot modify code — silently ignore
        room.setCodeContent(codeContent);
        roomRepo.save(room);
    }

    // helpers
    private AnnotationResponse toResponse(Annotation a) {
        List<ReplyResponse> replies = replyRepo.findByAnnotationOrderByCreatedAtAsc(a)
                .stream().map(this::toReplyResponse).collect(Collectors.toList());
        return new AnnotationResponse(a.getId(), a.getRoom().getId(),
                a.getAuthor().getUsername(), a.getLineNumber(),
                a.getComment(), a.getStatus().name(), replies, a.getCreatedAt());
    }

    private ReplyResponse toReplyResponse(AnnotationReply r) {
        return new ReplyResponse(r.getId(), r.getAnnotation().getId(),
                r.getAuthor().getUsername(), r.getContent(), r.getCreatedAt());
    }

    private ReviewRoom getRoom(String id) {
        return roomRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));
    }

    private User getUser(String username) {
        return userRepo.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
    }

    private Annotation getAnnotation(String id) {
        return annotationRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Annotation not found"));
    }
}
