package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "practice_plan_items")
@Getter @Setter @NoArgsConstructor
public class PracticePlanItem {
    @EmbeddedId
    private PracticePlanItemId id = new PracticePlanItemId();

    @MapsId("planId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plan_id", nullable = false)
    private PracticePlan plan;

    @MapsId("itemId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", nullable = false)
    private WritingItem item;

    @Column(nullable = false)
    private Byte repetitions;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;
}

