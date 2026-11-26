package com.example.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class HomeworkPublishScheduler {
    private final HomeworkService homeworkService;

    @Scheduled(fixedDelay = 60000)
    public void publishScheduledGrades() {
        try {
            int sent = homeworkService.publishDueScheduled();
            if (sent > 0) {
                log.info("Published {} scheduled homework grade notification(s).", sent);
            }
        } catch (Exception ex) {
            log.warn("Failed to run scheduled homework grade publisher: {}", ex.getMessage());
        }
    }
}
