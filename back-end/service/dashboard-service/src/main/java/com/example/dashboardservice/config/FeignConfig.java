package com.example.dashboardservice.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import feign.RequestInterceptor;
import feign.codec.Decoder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.io.InputStream;

@Configuration
public class FeignConfig {

    @Bean
    public RequestInterceptor authorizationInterceptor() {
        return requestTemplate -> {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                String auth = attrs.getRequest().getHeader("Authorization");
                if (auth != null) {
                    requestTemplate.header("Authorization", auth);
                }
            }
        };
    }

    // Unwrap FormRestResponse: extract "data" field trước khi deserialize vào DTO
    @Bean
    public Decoder feignDecoder(ObjectMapper objectMapper) {
        return (response, type) -> {
            if (response.body() == null) return null;
            try (InputStream is = response.body().asInputStream()) {
                JsonNode root = objectMapper.readTree(is);
                JsonNode data = root.path("data");
                if (!data.isMissingNode() && !data.isNull()) {
                    return objectMapper.convertValue(data, objectMapper.constructType(type));
                }
                return objectMapper.convertValue(root, objectMapper.constructType(type));
            }
        };
    }
}
