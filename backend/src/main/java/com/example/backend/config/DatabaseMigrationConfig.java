package com.example.backend.config;

import com.example.backend.migration.V2__SeedLearningContent;
import org.flywaydb.core.api.migration.JavaMigration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration(proxyBeanMethods = false)
public class DatabaseMigrationConfig {
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public JavaMigration learningContentMigration(Environment environment, PasswordEncoder passwordEncoder) {
        return new V2__SeedLearningContent(environment, passwordEncoder);
    }
}
