package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity @Table(name = "submission_errors")
@Getter @Setter @NoArgsConstructor
public class SubmissionError {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_id", nullable = false)
    private Submission submission;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "error_type_id", nullable = false)
    private ErrorType errorType;

    @Column(name = "segment_index")
    private Byte segmentIndex;

    @Column(name = "stroke_index")
    private Byte strokeIndex;
}
