package com.example.backend.repository;

import com.example.backend.entity.WritingItem;
import com.example.backend.entity.enums.ItemType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WritingItemRepository extends JpaRepository<WritingItem, Long> {
    List<WritingItem> findByLesson_IdOrderBySortOrderAscIdAsc(Long lessonId);
    Optional<WritingItem> findByItemTypeAndTextValue(ItemType itemType, String textValue);
    long countByItemType(ItemType itemType);
}
