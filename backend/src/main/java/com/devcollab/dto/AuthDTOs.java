package com.devcollab.dto;

import jakarta.validation.constraints.*;

public class AuthDTOs {

    public record RegisterRequest(
        @NotBlank @Size(min=3, max=50) String username,
        @NotBlank @Email String email,
        @NotBlank @Size(min=6) String password
    ) {}

    public record LoginRequest(
        @NotBlank String username,
        @NotBlank String password
    ) {}

    public record AuthResponse(
        String token,
        String id,
        String username,
        String email
    ) {}
}
