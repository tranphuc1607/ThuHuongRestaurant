package com.example.authservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "auth") 
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Auth {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username; 

    @Column(nullable = false)
    private String password; 

    @Column(name = "role_name", nullable = false)
    private String role; 
    @Column(columnDefinition = "TEXT")
    private String refreshToken; 

    private boolean isExpired = false;
    
    private boolean isLocked = false;

    private boolean isEnabled = true; 
}