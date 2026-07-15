package com.devcollab.repository;

import com.devcollab.entity.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AnnotationReplyRepository extends JpaRepository<AnnotationReply, String> {
    List<AnnotationReply> findByAnnotationOrderByCreatedAtAsc(Annotation annotation);
}
