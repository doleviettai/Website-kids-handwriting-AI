package com.example.backend.entity;

import com.example.backend.entity.enums.ItemType;
import com.example.backend.entity.value.WritingTemplate;
import com.example.backend.util.VietnameseText;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "writing_items", uniqueConstraints = @UniqueConstraint(
        name = "uk_writing_items_type_text", columnNames = {"item_type", "text_value"}))
@Getter @Setter @NoArgsConstructor
public class WritingItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id")
    private Lesson lesson;

    @Enumerated(EnumType.STRING) @Column(name = "item_type", nullable = false)
    private ItemType itemType;

    @Column(name = "text_value", nullable = false, length = 255)
    private String textValue;

    private Byte difficulty = 1;

    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "template_json", columnDefinition = "json")
    private WritingTemplate templateJson;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    @PrePersist @PreUpdate
    private void normalize() { textValue = VietnameseText.nfc(textValue); }
}
