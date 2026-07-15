package com.devcollab.repository;

import com.devcollab.entity.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface RoomMemberRepository extends JpaRepository<RoomMember, String> {
    List<RoomMember> findByRoom(ReviewRoom room);
    Optional<RoomMember> findByRoomAndUser(ReviewRoom room, User user);
    boolean existsByRoomAndUser(ReviewRoom room, User user);

    @Query("SELECT rm.room FROM RoomMember rm WHERE rm.user = :user ORDER BY rm.joinedAt DESC")
    List<ReviewRoom> findRoomsByUser(User user);
}
