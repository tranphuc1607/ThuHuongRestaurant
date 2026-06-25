package com.example.authservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.example.authservice.entity.Auth;
import java.util.Optional;

@Repository
public interface AuthRepository extends JpaRepository<Auth, Long> {

    Optional<Auth> findByUsername(String username);

    Optional<Auth> findByRefreshToken(String refreshToken);

    Optional<Auth> findByUsernameAndRefreshToken(String username, String refreshToken);

    boolean existsByUsername(String username);
}