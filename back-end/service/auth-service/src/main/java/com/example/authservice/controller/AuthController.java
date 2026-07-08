package com.example.authservice.controller;

import com.example.authservice.entity.DTO.req.LoginRequest;
import com.example.authservice.entity.DTO.req.RegisterRequest;
import com.example.authservice.entity.DTO.res.LoginResponse;
import com.example.authservice.service.AuthService;
import com.example.restaurant_common.util.exception.MessageException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest registerDto) throws MessageException {
        return ResponseEntity.ok(authService.register(registerDto));
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest loginDto) throws MessageException {
        return authService.login(loginDto);
    }

    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refreshToken(
            @CookieValue(name = "refresh_token") String refreshToken) throws MessageException {
        return authService.refreshToken(refreshToken);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(
            @CookieValue(name = "refresh_token", required = false) String refreshToken) throws MessageException {
        return authService.logout(refreshToken);
    }
}