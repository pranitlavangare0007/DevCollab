package com.devcollab.service;

import com.devcollab.dto.RoomDTOs.*;
import com.devcollab.entity.*;
import com.devcollab.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoomService {

    private final ReviewRoomRepository roomRepo;
    private final RoomMemberRepository memberRepo;
    private final UserRepository userRepo;

    @Transactional
    public RoomResponse createRoom(CreateRoomRequest req, String username) {
        User owner = getUser(username);
        ReviewRoom room = ReviewRoom.builder()
                .title(req.title())
                .language(req.language() != null ? req.language() : "javascript")
                .codeContent(req.codeContent() != null ? req.codeContent() : "// Start coding here...\n")
                .owner(owner)
                .joinCode(generateJoinCode())
                .build();
        ReviewRoom saved = roomRepo.save(room);
        memberRepo.save(RoomMember.builder()
                .room(saved).user(owner).role(RoomMember.Role.OWNER).build());
        return toResponse(saved);
    }

    public RoomResponse getById(String id, String username) {
        ReviewRoom room = getRoom(id);
        User user = getUser(username);
        if (!memberRepo.existsByRoomAndUser(room, user))
            throw new SecurityException("Not a member of this room");
        return toResponse(room);
    }

    public List<RoomSummary> getMyRooms(String username) {
        User user = getUser(username);
        List<ReviewRoom> rooms = memberRepo.findRoomsByUser(user);
        return rooms.stream().map(r -> {
            RoomMember member = memberRepo.findByRoomAndUser(r, user).orElse(null);
            String role = member != null ? member.getRole().name() : "VIEWER";
            return toSummary(r, role);
        }).collect(Collectors.toList());
    }

    @Transactional
    public RoomResponse joinByCode(String joinCode, String username) {
        ReviewRoom room = roomRepo.findByJoinCode(joinCode)
                .orElseThrow(() -> new IllegalArgumentException("Invalid join code"));
        if (room.getStatus() == ReviewRoom.RoomStatus.ARCHIVED)
            throw new IllegalArgumentException("This room is archived");
        User user = getUser(username);
        if (!memberRepo.existsByRoomAndUser(room, user)) {
            memberRepo.save(RoomMember.builder()
                    .room(room).user(user).role(RoomMember.Role.REVIEWER).build());
        }
        return toResponse(room);
    }

    @Transactional
    public RoomResponse updateCode(String id, UpdateCodeRequest req, String username) {
        ReviewRoom room = getRoom(id);
        User user = getUser(username);
        RoomMember member = memberRepo.findByRoomAndUser(room, user)
                .orElseThrow(() -> new SecurityException("Not a member"));
        if (member.getRole() == RoomMember.Role.VIEWER)
            throw new SecurityException("Insufficient permissions");
        room.setCodeContent(req.codeContent());
        return toResponse(roomRepo.save(room));
    }

    @Transactional
    public void archiveRoom(String id, String username) {
        ReviewRoom room = getRoom(id);
        User user = getUser(username);
        RoomMember member = memberRepo.findByRoomAndUser(room, user)
                .orElseThrow(() -> new SecurityException("Not a member"));
        if (member.getRole() != RoomMember.Role.OWNER)
            throw new SecurityException("Only owner can archive");
        room.setStatus(ReviewRoom.RoomStatus.ARCHIVED);
        roomRepo.save(room);
    }

    public List<MemberResponse> getMembers(String id, String username) {
        ReviewRoom room = getRoom(id);
        User user = getUser(username);
        if (!memberRepo.existsByRoomAndUser(room, user))
            throw new SecurityException("Not a member");
        return memberRepo.findByRoom(room).stream()
                .map(m -> new MemberResponse(
                        m.getUser().getId(),
                        m.getUser().getUsername(),
                        m.getRole().name(),
                        m.getJoinedAt()))
                .collect(Collectors.toList());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    public ReviewRoom getRoom(String id) {
        return roomRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));
    }

    public User getUser(String username) {
        return userRepo.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
    }

    private String generateJoinCode() {
        String code;
        do {
            code = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
        } while (roomRepo.findByJoinCode(code).isPresent());
        return code;
    }

    public RoomResponse toResponse(ReviewRoom r) {
        return new RoomResponse(
                r.getId(), r.getTitle(), r.getLanguage(),
                r.getCodeContent(), r.getJoinCode(), r.getStatus().name(),
                r.getOwner().getUsername(), r.getCreatedAt(),
                r.getGithubPrUrl(), r.getGithubRepo(), r.getGithubPrNumber(),
                r.getGithubPrStatus(), r.getGithubPrTitle(), r.getGithubPrAuthor()
        );
    }

    private RoomSummary toSummary(ReviewRoom r, String role) {
        return new RoomSummary(
                r.getId(), r.getTitle(), r.getLanguage(),
                r.getJoinCode(), r.getStatus().name(),
                r.getOwner().getUsername(), role, r.getCreatedAt(),
                r.getGithubPrUrl(), r.getGithubPrStatus(),
                r.getGithubPrTitle(), r.getGithubPrNumber(), r.getGithubRepo()
        );
    }
}
