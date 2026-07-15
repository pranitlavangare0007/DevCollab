package com.devcollab.repository;

import com.devcollab.entity.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AnnotationRepository extends JpaRepository<Annotation, String> {
    List<Annotation> findByRoomOrderByCreatedAtAsc(ReviewRoom room);
}
