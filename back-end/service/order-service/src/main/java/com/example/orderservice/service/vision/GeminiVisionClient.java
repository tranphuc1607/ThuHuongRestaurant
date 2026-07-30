package com.example.orderservice.service.vision;

import com.example.restaurant_common.util.exception.MessageException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Gọi Gemini API (vision + structured output). Chỉ lo phần truyền tải — không biết gì về hoá đơn.
 *
 * <p>Dùng structured output gốc của Gemini ({@code responseMimeType} + {@code responseSchema})
 * nên đầu ra luôn là JSON đúng schema; không cần cắt chuỗi tìm dấu ngoặc như cách cũ.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GeminiVisionClient {

    private static final String BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${gemini.api.key:}")
    private String apiKey;

    @Value("${gemini.model:gemini-3.5-flash-lite}")
    private String model;

    /**
     * Ngân sách token "suy nghĩ". Để mặc định, model đốt gấp ~29 lần số token suy nghĩ so với câu
     * trả lời (đo được 3173 vs 109) và đó là phần lớn thời gian chờ. Trích xuất theo schema cố định
     * gần như không cần suy luận nhiều, nên siết lại. Đặt 0 sẽ bị API từ chối (HTTP 400) —
     * dòng model này bắt buộc phải suy nghĩ ít nhất một chút. Đặt -1 để trả về mặc định của Google.
     */
    @Value("${gemini.thinking-budget:128}")
    private int thinkingBudget;

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public String modelName() {
        return model;
    }

    /**
     * @param prompt      phần chỉ dẫn dạng text
     * @param imagesBase64 các ảnh (nhiều trang của cùng một hoá đơn), đã encode base64
     * @param mimeType    kiểu ảnh, ví dụ image/jpeg
     * @param responseSchema schema JSON mà model buộc phải tuân theo
     * @return chuỗi JSON model trả về
     */
    public String generateJson(String prompt, List<String> imagesBase64, String mimeType,
                              Map<String, Object> responseSchema) throws MessageException {
        if (!isConfigured()) {
            throw new MessageException("Chưa cấu hình Gemini API key trên server");
        }

        List<Object> parts = new ArrayList<>();
        parts.add(Map.of("text", prompt));
        for (String img : imagesBase64) {
            parts.add(Map.of("inline_data", Map.of("mime_type", mimeType, "data", img)));
        }

        Map<String, Object> generationConfig = new LinkedHashMap<>();
        generationConfig.put("temperature", 0);
        generationConfig.put("responseMimeType", "application/json");
        generationConfig.put("responseSchema", responseSchema);
        if (thinkingBudget >= 0) {
            generationConfig.put("thinkingConfig", Map.of("thinkingBudget", thinkingBudget));
        }

        Map<String, Object> body = Map.of(
                "contents", List.of(Map.of("role", "user", "parts", parts)),
                "generationConfig", generationConfig
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-goog-api-key", apiKey);

        String url = BASE_URL + model + ":generateContent";
        String rawBody;
        long startedAt = System.currentTimeMillis();
        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.POST, new HttpEntity<>(body, headers), String.class);
            rawBody = response.getBody();
            logUsage(rawBody, System.currentTimeMillis() - startedAt);
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            String errBody = e.getResponseBodyAsString();
            log.error("[ReceiptScan] Gemini model={} tra loi HTTP {}: {}", model, status, errBody);
            if (status == 429) {
                throw new MessageException("Đã hết lượt quét miễn phí trong ngày, vui lòng thử lại sau");
            }
            if (status == 400 && errBody != null && errBody.contains("API key")) {
                throw new MessageException("Gemini API key không hợp lệ — vui lòng kiểm tra cấu hình");
            }
            throw new MessageException("Lỗi AI (" + status + "): " + truncate(errBody, 150));
        } catch (RestClientException e) {
            log.error("[ReceiptScan] Khong goi duoc Gemini model={}", model, e);
            throw new MessageException("Lỗi kết nối AI: " + e.getMessage());
        }

        return extractText(rawBody);
    }

    /**
     * Ghi lại thời gian và token đã dùng. {@code thoughts} là thứ cần theo dõi: nó phình lên là
     * thời gian chờ phình theo, và đó là dấu hiệu cần siết {@code gemini.thinking-budget}.
     */
    private void logUsage(String rawBody, long elapsedMs) {
        try {
            JsonNode usage = objectMapper.readTree(rawBody).path("usageMetadata");
            log.info("[ReceiptScan] Gemini model={} {} ms (budget={}) — prompt={} thoughts={} output={}",
                    model, elapsedMs, thinkingBudget,
                    usage.path("promptTokenCount").asInt(),
                    usage.path("thoughtsTokenCount").asInt(),
                    usage.path("candidatesTokenCount").asInt());
        } catch (Exception e) {
            log.info("[ReceiptScan] Gemini model={} {} ms (khong doc duoc usageMetadata)", model, elapsedMs);
        }
    }

    /**
     * Gom mọi part dạng text của candidate đầu tiên. Model có tư duy (thinking) có thể trả về
     * nhiều part, nên không thể chỉ lấy {@code parts[0]}.
     */
    private String extractText(String rawBody) throws MessageException {
        if (rawBody == null || rawBody.isBlank()) {
            log.error("[ReceiptScan] Gemini tra ve body rong (model={})", model);
            throw new MessageException("AI không trả về dữ liệu, vui lòng thử lại");
        }
        try {
            JsonNode root = objectMapper.readTree(rawBody);

            JsonNode blockReason = root.path("promptFeedback").path("blockReason");
            if (!blockReason.isMissingNode() && !blockReason.asText("").isBlank()) {
                log.error("[ReceiptScan] Gemini chan yeu cau: {}", blockReason.asText());
                throw new MessageException("AI từ chối xử lý ảnh này, vui lòng thử ảnh khác");
            }

            JsonNode candidate = root.path("candidates").path(0);
            String finishReason = candidate.path("finishReason").asText("");
            StringBuilder sb = new StringBuilder();
            for (JsonNode part : candidate.path("content").path("parts")) {
                JsonNode text = part.path("text");
                if (!text.isMissingNode() && !text.isNull()) sb.append(text.asText());
            }
            String out = sb.toString().trim();

            if (out.isBlank()) {
                // MAX_TOKENS thường nghĩa là hoá đơn quá dài so với giới hạn output
                log.error("[ReceiptScan] Gemini khong co text (model={}, finishReason={}), raw={}",
                        model, finishReason, truncate(rawBody, 500));
                if ("MAX_TOKENS".equals(finishReason)) {
                    throw new MessageException("Hoá đơn quá dài, vui lòng quét ít trang hơn mỗi lần");
                }
                throw new MessageException("AI không trả về dữ liệu hợp lệ, vui lòng thử lại");
            }
            return out;
        } catch (MessageException e) {
            throw e;
        } catch (Exception e) {
            log.error("[ReceiptScan] Khong doc duoc phan hoi Gemini: {}", truncate(rawBody, 500), e);
            throw new MessageException("AI không trả về dữ liệu hợp lệ, vui lòng thử lại");
        }
    }

    private String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }
}
