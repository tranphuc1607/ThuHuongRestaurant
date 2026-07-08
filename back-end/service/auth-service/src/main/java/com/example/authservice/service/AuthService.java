package com.example.authservice.service;

import com.example.authservice.entity.DTO.req.LoginRequest;
import com.example.authservice.entity.DTO.req.RegisterRequest;
import com.example.authservice.entity.DTO.res.LoginResponse;
import com.example.authservice.entity.Auth;
import com.example.authservice.repository.AuthRepository;
import com.example.authservice.util.SecurityUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.restaurant_common.util.exception.MessageException;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthRepository authRepository;
    private final SecurityUtil securityUtil;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.jwt.refresh-token-validity-in-seconds}")
    private long refreshTokenExpiration;

    @Value("${app.security.cookie.secure:false}")
    private boolean cookieSecure;

    @Value("${app.security.jwt.expiration}")
    private long accessTokenExpiration ;

    @Transactional
    public Map<String, Object> register(RegisterRequest registerDto) throws MessageException {
        if (authRepository.existsByUsername(registerDto.getUsername())) {
            throw new MessageException("Tên đăng nhập này đã có người sử dụng!");
        }
        Auth auth = new Auth();
        auth.setUsername(registerDto.getUsername());
        auth.setPassword(passwordEncoder.encode(registerDto.getPassword()));
        auth.setRole("ROLE_USER");
        auth.setEnabled(true);
        auth.setLocked(false);

        Auth savedAuth = authRepository.save(auth);
        return Map.of("id", savedAuth.getId(), "username", savedAuth.getUsername(), "role", savedAuth.getRole());
    }

    @Transactional
public ResponseEntity<LoginResponse> login(LoginRequest loginDto) throws MessageException {
    Auth auth = authRepository.findByUsername(loginDto.getUsername())
            .orElseThrow(() -> new MessageException("Tài khoản hoặc mật khẩu không chính xác"));

    if (!passwordEncoder.matches(loginDto.getPassword(), auth.getPassword())) {
        throw new MessageException("Tài khoản hoặc mật khẩu không chính xác");
    }

    if (auth.isLocked()) throw new MessageException("Tài khoản hiện đang bị khóa");


    String accessToken = securityUtil.createAccessToken(auth);
    String refreshToken = securityUtil.createRefreshToken(auth.getUsername());


    auth.setRefreshToken(refreshToken);
    authRepository.save(auth);

    ResponseCookie resCookie = createHttpOnlyCookie("refresh_token", refreshToken, refreshTokenExpiration);

    LoginResponse loginResponse = buildLoginResponse(accessToken, auth);

    return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, resCookie.toString())
            .body(loginResponse);
}

   @Transactional
public ResponseEntity<LoginResponse> refreshToken(String refreshToken) throws MessageException {
    if (refreshToken == null || refreshToken.isBlank()) {
        throw new MessageException("Phiên đăng nhập không tồn tại");
    }

    Jwt decodedToken;
    try {
        decodedToken = securityUtil.checkValidRefreshToken(refreshToken);
    } catch (RuntimeException e) {
        throw new MessageException(e.getMessage());
    }
    String username = decodedToken.getSubject();

    Auth auth = authRepository.findByUsernameAndRefreshToken(username, refreshToken)
            .orElseThrow(() -> new MessageException("Phiên đăng nhập đã hết hạn hoặc không hợp lệ"));

    String newAccessToken = securityUtil.createAccessToken(auth);
    String newRefreshToken = securityUtil.createRefreshToken(auth.getUsername());


    auth.setRefreshToken(newRefreshToken);
    authRepository.save(auth);

    ResponseCookie resCookie = createHttpOnlyCookie("refresh_token", newRefreshToken, refreshTokenExpiration);

    return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, resCookie.toString())
            .body(buildLoginResponse(newAccessToken, auth));
}
   @Transactional
public ResponseEntity<?> logout(String refreshToken) {
    if (refreshToken != null && !refreshToken.isBlank()) {
        authRepository.findByRefreshToken(refreshToken).ifPresent(auth -> {
            auth.setRefreshToken(null);
            authRepository.save(auth);
        });
    }

    ResponseCookie deleteCookie = createHttpOnlyCookie("refresh_token", "", 0);

    return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, deleteCookie.toString())
            .body(Map.of("message", "Đăng xuất thành công"));
}


    private ResponseCookie createHttpOnlyCookie(String name, String value, long duration) {
        return ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(cookieSecure) // false trên dev (HTTP), true trên prod (HTTPS)
                .path("/")
                .maxAge(duration)
                .sameSite("Lax")
                .build();
    }

    private LoginResponse buildLoginResponse(String accessToken, Auth auth) {
        return LoginResponse.builder()
                .accessToken(accessToken)
                .tokenType("Bearer")
                .expiresIn(accessTokenExpiration)
                .user(LoginResponse.UserInfo.builder()
                        .id(auth.getId())
                        .username(auth.getUsername())
                        .role(auth.getRole())
                        .build())
                .build();
    }
}