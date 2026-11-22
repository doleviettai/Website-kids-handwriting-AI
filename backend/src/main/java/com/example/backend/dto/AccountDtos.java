package com.example.backend.dto;

import com.example.backend.entity.User;
import com.example.backend.entity.enums.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AccountDtos {
    private AccountDtos() { }

    public record RegisterRequest(
            @NotBlank(message = "Ba mẹ nhập email nhé.") @Email(message = "Email chưa đúng định dạng.") @Size(max = 255) String email,
            @NotBlank(message = "Ba mẹ nhập mật khẩu nhé.") @Size(min = 8, max = 72, message = "Mật khẩu cần từ 8 đến 72 ký tự.") String password,
            @NotBlank(message = "Ba mẹ nhập tên hiển thị nhé.") @Size(max = 100) String fullName) { }

    public record LoginRequest(
            @NotBlank @Email(message = "Email chưa đúng định dạng.") @Size(max = 255) String email,
            @NotBlank @Size(max = 72) String password) { }

    public record AccountResponse(Long id, String email, String fullName, UserRole role) {
        public static AccountResponse from(User user) {
            return new AccountResponse(user.getId(), user.getEmail(), user.getFullName(), user.getRole());
        }
    }

    public record AuthResponse(String accessToken, long expiresIn, AccountResponse user) { }
}
