package com.example.backend.service;

import com.example.backend.exception.ApiException;
import java.io.IOException;
import java.nio.file.*;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class HomeworkStorageService {
    private static final long MAX_BYTES = 10L * 1024 * 1024;
    private final Path rootDir;

    public HomeworkStorageService(@Value("${app.uploads.homework-dir:./uploads/homework}") String dir) {
        this.rootDir = Path.of(dir).toAbsolutePath().normalize();
    }

    public record StoredFile(String relativePath, String originalFilename, String contentType, long size) {}

    public StoredFile store(long batchId, long enrollmentId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Vui lòng chọn ảnh trang vở.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mỗi ảnh tối đa 10 MB.");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Không đọc được file ảnh tải lên.");
        }
        String ext = detectImageExtension(bytes);
        if (ext == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Chỉ hỗ trợ ảnh JPG hoặc PNG hợp lệ.");
        }
        String contentType = "png".equals(ext) ? "image/png" : "image/jpeg";
        String original = sanitizeFilename(file.getOriginalFilename(), ext);
        String relative = batchId + "/" + enrollmentId + "/" + UUID.randomUUID() + "." + ext;
        Path target = resolveSafe(relative);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, bytes, StandardOpenOption.CREATE_NEW);
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể lưu ảnh bài tập trên máy chủ.");
        }
        return new StoredFile(relative, original, contentType, bytes.length);
    }

    public byte[] load(String relativePath) {
        Path target = resolveSafe(relativePath);
        if (!Files.isRegularFile(target)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy file ảnh bài tập.");
        }
        try {
            return Files.readAllBytes(target);
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể đọc file ảnh bài tập.");
        }
    }

    public void deleteQuietly(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) return;
        try {
            Files.deleteIfExists(resolveSafe(relativePath));
        } catch (Exception ignored) {
            /* Best-effort disk cleanup. */
        }
    }

    private Path resolveSafe(String relativePath) {
        Path resolved = rootDir.resolve(relativePath).normalize();
        if (!resolved.startsWith(rootDir)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Đường dẫn file không hợp lệ.");
        }
        return resolved;
    }

    private String detectImageExtension(byte[] bytes) {
        if (bytes.length >= 8
                && (bytes[0] & 0xFF) == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47
                && bytes[4] == 0x0D && bytes[5] == 0x0A && bytes[6] == 0x1A && bytes[7] == 0x0A) {
            return "png";
        }
        if (bytes.length >= 3
                && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF) {
            return "jpg";
        }
        return null;
    }

    private String sanitizeFilename(String raw, String ext) {
        if (raw == null || raw.isBlank()) return "trang-vo." + ext;
        String base = Path.of(raw).getFileName().toString().replaceAll("[^\\p{L}\\p{N}._-]", "_");
        if (base.length() > 120) base = base.substring(0, 120);
        return base.isBlank() ? "trang-vo." + ext : base;
    }
}
