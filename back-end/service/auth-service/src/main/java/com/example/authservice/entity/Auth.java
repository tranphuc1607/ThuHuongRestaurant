package com.example.authservice.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.DynamicUpdate;

import java.util.UUID;

@Entity
@Table(name = "auth")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@DynamicUpdate
public class Auth {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(name = "role_name", nullable = false)
    private String role;

    @Column(columnDefinition = "TEXT")
    private String refreshToken;

    @Builder.Default
    private boolean isExpired = false;

    @Builder.Default
    private boolean isLocked = false;

    @Builder.Default
    private boolean isEnabled = true;
}
