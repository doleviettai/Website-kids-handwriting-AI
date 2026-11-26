package com.example.backend.repository;

import com.example.backend.entity.PracticePlanItem;
import com.example.backend.entity.PracticePlanItemId;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PracticePlanItemRepository extends JpaRepository<PracticePlanItem, PracticePlanItemId> {
    @Query("select pi from PracticePlanItem pi join fetch pi.item i left join fetch i.lesson where pi.plan.id in :planIds order by pi.plan.id asc, pi.sortOrder asc, i.id asc")
    List<PracticePlanItem> findWithItemByPlanIds(@Param("planIds") Collection<Long> planIds);

    void deleteByPlan_Id(Long planId);
}
