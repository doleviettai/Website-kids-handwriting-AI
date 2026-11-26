package com.example.backend.service;

import com.example.backend.dto.AccountDtos.*;
import com.example.backend.entity.User;
import com.example.backend.entity.enums.UserRole;
import com.example.backend.exception.ApiException;
import com.example.backend.repository.UserRepository;
import com.example.backend.util.VietnameseText;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class AccountService {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JwtService tokens;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) throw new ApiException(HttpStatus.CONFLICT, "Email này đã được đăng ký. Ba mẹ thử đăng nhập nhé.");
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mật khẩu tối đa 72 byte, ba mẹ chọn mật khẩu ngắn hơn nhé.");
        User user = new User();
        user.setEmail(email);
        user.setFullName(VietnameseText.nfc(request.fullName()).trim());
        user.setPasswordHash(passwords.encode(request.password()));
        user.setRole(UserRole.PARENT);
        users.saveAndFlush(user);
        return response(user);
    }

    @Transactional
    public AccountResponse createTeacher(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) throw new ApiException(HttpStatus.CONFLICT, "Email này đã tồn tại trong hệ thống.");
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mật khẩu tối đa 72 byte.");
        User user = new User();
        user.setEmail(email);
        user.setFullName(VietnameseText.nfc(request.fullName()).trim());
        user.setPasswordHash(passwords.encode(request.password()));
        user.setRole(UserRole.TEACHER);
        return AccountResponse.from(users.saveAndFlush(user));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Email hoặc mật khẩu chưa đúng.");
        User user = users.findByEmail(normalizeEmail(request.email())).orElse(null);
        // Always perform BCrypt verification, including an unknown email.
        String hash = user == null ? DUMMY_HASH : user.getPasswordHash();
        if (!passwords.matches(request.password(), hash) || user == null)
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Email hoặc mật khẩu chưa đúng.");
        return response(user);
    }

    @Transactional(readOnly = true)
    public User requireUser(long id) {
        return users.findById(id).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Tài khoản không còn tồn tại. Ba mẹ đăng nhập lại nhé."));
    }

    private AuthResponse response(User user) {
        return new AuthResponse(tokens.issue(user), JwtService.TTL_SECONDS, AccountResponse.from(user));
    }

    private String normalizeEmail(String email) { return VietnameseText.nfc(email).trim().toLowerCase(Locale.ROOT); }

    private static final String DUMMY_HASH = "$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
}
