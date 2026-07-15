package com.devcollab.repository;

import com.devcollab.entity.ReviewRoom;
import com.devcollab.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ReviewRoomRepository extends JpaRepository<ReviewRoom, String> {
    Optional<ReviewRoom> findByJoinCode(String joinCode);
    List<ReviewRoom> findByOwnerOrderByCreatedAtDesc(User owner);
}
