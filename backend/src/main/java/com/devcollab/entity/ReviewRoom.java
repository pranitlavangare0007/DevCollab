package com.devcollab.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "review_rooms")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReviewRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(length = 30)
    private String language;

    @Column(columnDefinition = "TEXT")
    private String codeContent;

    @Column(unique = true, length = 8)
    private String joinCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private RoomStatus status = RoomStatus.ACTIVE;

    // ── GitHub PR metadata ─────────────────────────────────────────────────────
    @Column(length = 255)
    private String githubPrUrl;

    @Column(length = 100)
    private String githubRepo;      // e.g. "owner/repo"

    private Integer githubPrNumber;

    @Column(length = 20)
    private String githubPrStatus;  // open / closed / merged

    @Column(length = 255)
    private String githubPrTitle;

    @Column(length = 100)
    private String githubPrAuthor;

    // ── Timestamps ─────────────────────────────────────────────────────────────
    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public enum RoomStatus { ACTIVE, ARCHIVED }
}
