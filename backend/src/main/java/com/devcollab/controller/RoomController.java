package com.devcollab.controller;

import com.devcollab.dto.RoomDTOs.*;
import com.devcollab.service.RoomService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;

    @PostMapping
    public ResponseEntity<RoomResponse> create(@Valid @RequestBody CreateRoomRequest req,
                                               Principal principal) {
        return ResponseEntity.status(201).body(roomService.createRoom(req, principal.getName()));
    }

    @GetMapping
    public ResponseEntity<List<RoomSummary>> myRooms(Principal principal) {
        return ResponseEntity.ok(roomService.getMyRooms(principal.getName()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RoomResponse> get(@PathVariable String id, Principal principal) {
        return ResponseEntity.ok(roomService.getById(id, principal.getName()));
    }

    @PostMapping("/join")
    public ResponseEntity<RoomResponse> join(@Valid @RequestBody JoinRoomRequest req,
                                             Principal principal) {
        return ResponseEntity.ok(roomService.joinByCode(req.joinCode(), principal.getName()));
    }

    @PutMapping("/{id}/code")
    public ResponseEntity<RoomResponse> updateCode(@PathVariable String id,
                                                   @RequestBody UpdateCodeRequest req,
                                                   Principal principal) {
        return ResponseEntity.ok(roomService.updateCode(id, req, principal.getName()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> archive(@PathVariable String id, Principal principal) {
        roomService.archiveRoom(id, principal.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<MemberResponse>> members(@PathVariable String id,
                                                        Principal principal) {
        return ResponseEntity.ok(roomService.getMembers(id, principal.getName()));
    }
}
