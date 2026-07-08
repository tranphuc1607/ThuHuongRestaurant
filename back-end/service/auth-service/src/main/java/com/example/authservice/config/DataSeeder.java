package com.example.authservice.config;

import com.example.authservice.entity.Auth;
import com.example.authservice.repository.AuthRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements ApplicationRunner {

    private final AuthRepository authRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(ApplicationArguments args) {
        seedAdmin();
        seedEmployee();
    }

    private void seedAdmin() {
        if (authRepository.existsByUsername("admin")) return;
        Auth admin = Auth.builder()
                .username("admin")
                .password(passwordEncoder.encode("123456"))
                .role("ROLE_ADMIN")
                .isEnabled(true)
                .isLocked(false)
                .build();
        authRepository.save(admin);
        log.info("[Seed] Tạo tài khoản admin — username: admin / password: 123456");
    }

    private void seedEmployee() {
        if (authRepository.existsByUsername("nhanvien")) return;
        Auth emp = Auth.builder()
                .username("nhanvien")
                .password(passwordEncoder.encode("123456"))
                .role("ROLE_EMPLOYEE")
                .isEnabled(true)
                .isLocked(false)
                .build();
        authRepository.save(emp);
        log.info("[Seed] Tạo tài khoản nhân viên — username: nhanvien / password: 123456");
    }
}
