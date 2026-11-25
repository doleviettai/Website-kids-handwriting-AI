package com.example.backend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component @ConfigurationProperties(prefix="app.scoring") @Getter @Setter
public class ScoringProperties {
    private double shape=.3, similarity=.3, direction=.2, strokeOrder=.2;
    private String positiveFeedback="Bé đã hoàn thành bài viết! Mình cùng xem kết quả và tiếp tục luyện tập nhé.";
}
