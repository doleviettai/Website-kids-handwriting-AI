package com.example.backend.migration;

import java.nio.charset.StandardCharsets;
import java.sql.PreparedStatement;
import java.text.Normalizer;
import java.util.Locale;
import java.util.zip.CRC32;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.springframework.core.env.Environment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.security.crypto.password.PasswordEncoder;

/** V2 seed reads admin credentials from configuration, never from committed SQL. */
public class V2__SeedLearningContent extends BaseJavaMigration {
    private static final String SEED_RESOURCE = "db/seed/learning-content.sql";
    private final Environment environment;
    private final PasswordEncoder passwordEncoder;

    public V2__SeedLearningContent(Environment environment, PasswordEncoder passwordEncoder) {
        this.environment = environment;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public Integer getChecksum() {
        try (var input = new ClassPathResource(SEED_RESOURCE).getInputStream()) {
            CRC32 checksum = new CRC32();
            checksum.update("V2-admin-seed-v1".getBytes(StandardCharsets.UTF_8));
            checksum.update(input.readAllBytes());
            return (int) checksum.getValue();
        } catch (Exception exception) {
            throw new IllegalStateException("Không đọc được dữ liệu seed V2.", exception);
        }
    }

    @Override
    public void migrate(Context context) throws Exception {
        String email = Normalizer.normalize(environment.getProperty("app.bootstrap.admin.email", ""),
                Normalizer.Form.NFC).trim().toLowerCase(Locale.ROOT);
        String password = environment.getProperty("app.bootstrap.admin.password", "");
        if (!email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+") || email.length() > 255) {
            throw new IllegalStateException("Cần cấu hình ADMIN_EMAIL hợp lệ trước khi seed V2.");
        }
        if (password.length() < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72
                || password.equals("CHANGE_ME")) {
            throw new IllegalStateException("Cần cấu hình ADMIN_PASSWORD (ít nhất 12 ký tự, tối đa 72 byte) trước khi seed V2.");
        }
        String hash = passwordEncoder.encode(password);
        ScriptUtils.executeSqlScript(context.getConnection(),
                new EncodedResource(new ClassPathResource(SEED_RESOURCE), StandardCharsets.UTF_8));
        try (PreparedStatement insert = context.getConnection().prepareStatement(
                "INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, 'ADMIN')")) {
            insert.setString(1, email);
            insert.setString(2, hash);
            insert.setString(3, "Quản trị NétXinh");
            insert.executeUpdate();
        }
    }
}
