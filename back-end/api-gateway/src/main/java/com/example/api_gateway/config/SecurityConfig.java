package com.example.api_gateway.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.access.hierarchicalroles.RoleHierarchyImpl;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import java.util.Base64;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverterAdapter;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsConfigurationSource;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Value("${app.security.jwt.secret}")
    private String jwtKey;

    @Value("${app.security.public-urls}")
    private String[] publicUrls;

    @Bean
    public RoleHierarchy roleHierarchy() {
        RoleHierarchyImpl hierarchy = new RoleHierarchyImpl();
        hierarchy.setHierarchy("ROLE_ADMIN > ROLE_EMPLOYEE");
        return hierarchy;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://103.82.22.19"
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true); // cần cho HttpOnly refresh_token cookie
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

 @Bean
public SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http) {
    http
        .cors(cors -> cors.configurationSource(corsConfigurationSource()))
        .csrf(csrf -> csrf.disable())
        .authorizeExchange(exchanges -> exchanges
            .pathMatchers(HttpMethod.POST, "/api/v1/bookings").permitAll()
            .pathMatchers(HttpMethod.GET, "/api/v1/bookings/*").permitAll()
            .pathMatchers(HttpMethod.GET, "/api/v1/bookings/history").permitAll()
            .pathMatchers(HttpMethod.PATCH, "/api/v1/bookings/cancel/*").permitAll()
            .pathMatchers(HttpMethod.PATCH, "/api/v1/bookings/switch-payment/*").permitAll()
            .pathMatchers(HttpMethod.PUT, "/api/v1/bookings/by-code/**").permitAll()
            .pathMatchers(HttpMethod.GET, "/api/v1/orders/table/**").permitAll()
            .pathMatchers(HttpMethod.POST, "/api/v1/payments/customer-request").permitAll()
            .pathMatchers(HttpMethod.GET, "/api/v1/payments/customer-status/**").permitAll()
            .pathMatchers(HttpMethod.POST, "/api/v1/payments/webhook/**").permitAll()
            // verify endpoint: nhân viên bấm nút check-in/out trong Telegram (không có JWT)
            .pathMatchers(HttpMethod.GET, "/api/v1/hr/verify").permitAll()
            // face-checkin: kiosk nhận dạng khuôn mặt (không có JWT)
            .pathMatchers(HttpMethod.POST, "/api/v1/hr/face-checkin").permitAll()
            // face-descriptors: kiosk tải descriptor khi khởi động (không có JWT)
            .pathMatchers(HttpMethod.GET, "/api/v1/hr/employees/face-descriptors").permitAll()
            .pathMatchers(publicUrls).permitAll()
            .anyExchange().authenticated()
        )
        .oauth2ResourceServer(oauth2 -> oauth2
            .jwt(jwt -> jwt
                .jwtDecoder(jwtDecoder()) 
                .jwtAuthenticationConverter(jwtAuthenticationConverter()) 
            )
        );

    return http.build();
}

    @Bean
public Converter<Jwt, Mono<AbstractAuthenticationToken>> jwtAuthenticationConverter() {
    JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
    converter.setJwtGrantedAuthoritiesConverter(jwt -> {
        List<String> roles = jwt.getClaimAsStringList("roles");
        if (roles == null) roles = List.of();
        return roles.stream()
                .map(role -> new SimpleGrantedAuthority(role.startsWith("ROLE_") ? role : "ROLE_" + role))
                .collect(Collectors.toList());
    });
    return new ReactiveJwtAuthenticationConverterAdapter(converter);
}
    @Bean
public ReactiveJwtDecoder jwtDecoder() {
    byte[] keyBytes = Base64.getDecoder().decode(jwtKey);
    
    SecretKey secretKey = new SecretKeySpec(keyBytes, 0, keyBytes.length, "HmacSHA512");
    
    return NimbusReactiveJwtDecoder.withSecretKey(secretKey)
            .macAlgorithm(MacAlgorithm.HS512) 
            .build();
}
}