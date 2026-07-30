package com.example.orderservice.service;

import com.example.orderservice.client.ProductServiceClient;
import com.example.orderservice.entity.DTO.req.ScanFeedbackRequest;
import com.example.orderservice.entity.DTO.req.ScanReceiptRequest;
import com.example.orderservice.entity.DTO.res.MatchCandidate;
import com.example.orderservice.entity.DTO.res.ReceiptScanResponse;
import com.example.orderservice.entity.DTO.res.ScannedItemResponse;
import com.example.orderservice.entity.ReceiptScanAlias;
import com.example.orderservice.repository.ReceiptScanAliasRepository;
import com.example.orderservice.service.vision.GeminiVisionClient;
import com.example.orderservice.util.VietnameseTextMatcher;
import com.example.restaurant_common.util.exception.MessageException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * "Quét hoá đơn": đọc ảnh hoá đơn viết tay bằng AI vision rồi khớp từng dòng với sản phẩm thật.
 *
 * <p>Hoá đơn của nhà hàng dùng <b>mẫu in sẵn có bảng cột cố định</b>
 * ({@code STT | Tên hàng | SL | ĐVT | Đơn giá | Thành tiền}), nên ngoài tên món còn đọc được
 * giá và thành tiền. Hai thứ đó cho hai tín hiệu rất mạnh mà OCR giấy trắng không có:
 * <ul>
 *   <li><b>Khớp theo giá</b> — các món có giá gần như không trùng nhau, nên giá gần như là khoá
 *       định danh; đọc nhoè tên món vẫn khớp đúng.</li>
 *   <li><b>Kiểm tra số học</b> — {@code SL × Đơn giá = Thành tiền} và tổng các dòng phải bằng
 *       TỔNG CỘNG. Đây là kiểm tra tất định, bắt được lỗi mà bản thân AI không biết là mình sai.</li>
 * </ul>
 *
 * <p>Chỉ phân tích — KHÔNG tạo order/item. Client tự gọi {@code POST /orders} +
 * {@code POST /orders/{id}/items} (với {@code skipInventoryDeduction=true}) sau khi nhân viên xác nhận.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReceiptScanService {

    private final ProductServiceClient productServiceClient;
    private final GeminiVisionClient geminiClient;
    private final ReceiptScanAliasRepository aliasRepository;
    private final ObjectMapper objectMapper;

    /** Giá đọc được lệch quá mức này so với DB thì coi là không khớp (đồng). */
    private static final double PRICE_TOLERANCE = 500.0;
    /** Lệch tiền quá mức này thì cảnh báo phép tính (đồng) — nới nhẹ để bỏ qua làm tròn. */
    private static final double TOTAL_TOLERANCE = 1000.0;
    /** Số bí danh nạp vào prompt — giới hạn để không phình context. */
    private static final int MAX_ALIASES_IN_PROMPT = 60;
    /** Khớp đúng bí danh đã học là tín hiệu rất mạnh. */
    private static final int ALIAS_SCORE_BONUS = 90;

    private record CatalogItem(
            int index, UUID id, String name, String category,
            String saleUnit, Double price, String description) {}

    public ReceiptScanResponse scan(ScanReceiptRequest req) throws MessageException {
        long t0 = System.currentTimeMillis();
        List<CatalogItem> catalog = loadCatalog();
        if (catalog.isEmpty()) {
            throw new MessageException("Danh sách sản phẩm trống, không thể quét hoá đơn");
        }

        // Bí danh đã học từ chính nhân viên ở đây — thứ không model nào biết trước
        Map<String, UUID> aliases = loadAliases();
        long prepMs = System.currentTimeMillis() - t0;

        boolean multiPage = req.getImagesBase64().size() > 1;
        String prompt = buildPrompt(catalog, multiPage, aliases, catalogById(catalog));
        String mimeType = (req.getMimeType() == null || req.getMimeType().isBlank())
                ? "image/jpeg" : req.getMimeType();

        String json = geminiClient.generateJson(prompt, req.getImagesBase64(), mimeType, buildSchema());

        JsonNode root;
        try {
            root = objectMapper.readTree(json);
        } catch (Exception e) {
            log.error("[ReceiptScan] JSON khong hop le tu model={}: {}", geminiClient.modelName(), json, e);
            throw new MessageException("AI không trả về dữ liệu hợp lệ, vui lòng thử lại");
        }

        List<String> warnings = new ArrayList<>();

        CatalogItem beer = findBeer(catalog);
        List<Integer> beerRounds = readBeerRounds(root.path("beerCells"), beer, warnings);

        List<ScannedItemResponse> items = new ArrayList<>();
        for (JsonNode node : root.path("items")) {
            ScannedItemResponse item = resolveItem(node, catalog, aliases);
            if (item == null) continue;

            // Nhân viên thường tự cộng các ô ở hàng Bia rồi ghi TỔNG vào một dòng của bảng món.
            // Giữ cả hai là tính bia hai lần. Bỏ dòng trong bảng, giữ các ô — vì các ô mới là từng
            // lần khách gọi. Nhưng nếu hai con số lệch nhau thì phải nói ra: nhân viên cộng nhầm,
            // hoặc AI đọc sót một ô. Con số trong bảng mới là cái đã dùng để tính tiền.
            if (beer != null && !beerRounds.isEmpty() && beer.id().equals(item.getProductId())) {
                int cellSum = beerRounds.stream().mapToInt(Integer::intValue).sum();
                int written = item.getQuantity() == null ? 0 : item.getQuantity();
                if (written > 0 && written != cellSum) {
                    warnings.add(String.format(
                            "Hàng Bia cộng lại được %d cốc nhưng bảng món ghi %d — kiểm tra lại các ô bia.",
                            cellSum, written));
                }
                log.info("[ReceiptScan] Bo dong bia trong bang mon (ghi {}), giu {} o bia (tong {})",
                        written, beerRounds.size(), cellSum);
                continue;
            }
            items.add(item);
        }

        Double grandTotal = readMoney(root.path("grandTotal"));
        double itemsTotal = items.stream()
                .map(ScannedItemResponse::getLineTotal)
                .filter(java.util.Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .sum();
        double beerTotal = (beer == null || beer.price() == null) ? 0
                : beerRounds.stream().mapToInt(Integer::intValue).sum() * beer.price();
        double computedTotal = itemsTotal + beerTotal;

        // Không rõ nhân viên có cộng tiền bia vào TỔNG CỘNG hay không, nên chấp nhận cả hai cách.
        // Chỉ cảnh báo khi lệch với CẢ HAI — nếu không sẽ cảnh báo sai ở mọi hoá đơn có bia,
        // riết rồi nhân viên bỏ qua cảnh báo thật.
        if (grandTotal != null && computedTotal > 0
                && Math.abs(grandTotal - computedTotal) > TOTAL_TOLERANCE
                && Math.abs(grandTotal - itemsTotal) > TOTAL_TOLERANCE) {
            warnings.add(String.format(
                    "Tổng cộng trên hoá đơn (%,.0fđ) lệch với tổng tính được (%,.0fđ) — có thể sót dòng hoặc đọc sai số.",
                    grandTotal, computedTotal));
        }

        log.info("[ReceiptScan] model={} trang={} doc duoc {} dong + {} dot bia, tin cay cao {} dong "
                        + "(chuan bi {} ms, tong {} ms)",
                geminiClient.modelName(), req.getImagesBase64().size(), items.size(), beerRounds.size(),
                items.stream().filter(i -> "high".equals(i.getConfidence())).count(),
                prepMs, System.currentTimeMillis() - t0);

        return ReceiptScanResponse.builder()
                .items(items)
                .beerRounds(beerRounds)
                .beerProductId(beer == null ? null : beer.id())
                .beerProductName(beer == null ? null : beer.name())
                .beerUnitPrice(beer == null ? null : beer.price())
                .tableLabel(textOrNull(root.path("tableLabel")))
                .grandTotal(grandTotal)
                .computedTotal(computedTotal > 0 ? computedTotal : null)
                .warnings(warnings)
                .model(geminiClient.modelName())
                .build();
    }

    // ── Bí danh đã học ──────────────────────────────────────────────────────

    /** @return map chữ-viết-tay-đã-chuẩn-hoá → productId, lấy các bí danh dùng nhiều nhất */
    private Map<String, UUID> loadAliases() {
        try {
            Map<String, UUID> map = new LinkedHashMap<>();
            for (ReceiptScanAlias a : aliasRepository.findTopUsed(PageRequest.of(0, MAX_ALIASES_IN_PROMPT))) {
                // Một chữ viết có thể từng được gán cho nhiều món; giữ cái nhiều lượt nhất (đã sort)
                map.putIfAbsent(a.getNormalizedText(), a.getProductId());
            }
            return map;
        } catch (Exception e) {
            // Bí danh chỉ là tăng cường — hỏng thì vẫn quét được như thường
            log.warn("[ReceiptScan] Khong tai duoc bi danh da hoc: {}", e.getMessage());
            return Map.of();
        }
    }

    /**
     * Ghi nhận nhân viên đã chốt dòng chữ này là món nào. Gọi sau khi họ xác nhận ở màn hình duyệt.
     * Lỗi ở đây không được làm hỏng luồng tạo đơn nên chỉ log.
     */
    @Transactional
    public int recordFeedback(ScanFeedbackRequest req) {
        int saved = 0;
        for (ScanFeedbackRequest.Item item : req.getItems()) {
            if (item == null || item.getProductId() == null) continue;
            String normalized = VietnameseTextMatcher.normalize(item.getRawText());
            if (normalized.isBlank() || normalized.length() > 200) continue;
            try {
                ReceiptScanAlias alias = aliasRepository
                        .findByNormalizedTextAndProductId(normalized, item.getProductId())
                        .orElse(null);
                if (alias == null) {
                    aliasRepository.save(ReceiptScanAlias.builder()
                            .normalizedText(normalized)
                            .productId(item.getProductId())
                            .hitCount(1)
                            .build());
                } else {
                    alias.setHitCount(alias.getHitCount() + 1);
                    aliasRepository.save(alias);
                }
                saved++;
            } catch (Exception e) {
                log.warn("[ReceiptScan] Khong luu duoc bi danh '{}': {}", normalized, e.getMessage());
            }
        }
        log.info("[ReceiptScan] Da ghi nhan {} bi danh tu nhan vien", saved);
        return saved;
    }

    // ── Danh mục ────────────────────────────────────────────────────────────

    private Map<UUID, CatalogItem> catalogById(List<CatalogItem> catalog) {
        Map<UUID, CatalogItem> map = new HashMap<>();
        for (CatalogItem c : catalog) map.put(c.id(), c);
        return map;
    }

    private List<CatalogItem> loadCatalog() throws MessageException {
        Map<String, Object> response;
        try {
            response = productServiceClient.getAvailableProducts("AVAILABLE", 200);
        } catch (Exception e) {
            log.error("[ReceiptScan] Khong tai duoc danh sach san pham", e);
            throw new MessageException("Không thể tải danh sách sản phẩm");
        }
        Object data = response.get("data");
        if (!(data instanceof Map<?, ?> dataMap) || !(dataMap.get("content") instanceof List<?> products)) {
            throw new MessageException("Không thể tải danh sách sản phẩm");
        }

        List<CatalogItem> catalog = new ArrayList<>();
        int index = 1;
        for (Object o : products) {
            if (!(o instanceof Map<?, ?> p)) continue;
            UUID id;
            try {
                id = UUID.fromString(String.valueOf(p.get("id")));
            } catch (IllegalArgumentException e) {
                continue;
            }
            catalog.add(new CatalogItem(
                    index++,
                    id,
                    String.valueOf(p.get("name")),
                    String.valueOf(p.get("category")),
                    p.get("saleUnit") == null ? "PORTION" : String.valueOf(p.get("saleUnit")),
                    p.get("price") instanceof Number n ? n.doubleValue() : null,
                    p.get("description") == null ? null : String.valueOf(p.get("description"))
            ));
        }
        return catalog;
    }

    // ── Prompt ──────────────────────────────────────────────────────────────

    private String buildPrompt(List<CatalogItem> catalog, boolean multiPage,
                              Map<String, UUID> aliases, Map<UUID, CatalogItem> byId) {
        StringBuilder menu = new StringBuilder();
        for (CatalogItem c : catalog) {
            menu.append(c.index()).append(" | ").append(c.name())
                .append(" | ").append(c.price() == null ? "?" : String.format("%.0f", c.price()))
                .append(" | ").append(c.saleUnit())
                .append(" | ").append(c.description() == null ? "" : c.description())
                .append('\n');
        }

        // Cách viết tắt thật mà nhân viên ở đây hay dùng, học được từ các lần quét trước
        StringBuilder aliasBlock = new StringBuilder();
        for (Map.Entry<String, UUID> e : aliases.entrySet()) {
            CatalogItem c = byId.get(e.getValue());
            if (c != null) {
                aliasBlock.append("  \"").append(e.getKey()).append("\" → ").append(c.index())
                          .append(" (").append(c.name()).append(")\n");
            }
        }
        String aliasNote = aliasBlock.isEmpty() ? "" : """

               CÁCH VIẾT NHÂN VIÊN Ở ĐÂY HAY DÙNG (đã được xác nhận trước đó, ưu tiên tin):
               %s""".formatted(aliasBlock);

        String pageNote = multiPage
                ? """
                  Có NHIỀU ảnh kèm theo: đây là các tờ nối tiếp của CÙNG MỘT hoá đơn (viết hết tờ này
                  sang tờ khác). Đọc tất cả theo đúng thứ tự, gộp thành MỘT danh sách chung, không lặp
                  lại dòng đã đọc ở tờ trước. Chỉ tờ cuối cùng mới có TỔNG CỘNG.

                  """
                : "";

        return """
               Bạn đọc hoá đơn viết tay của nhà hàng Việt Nam.

               %sHOÁ ĐƠN DÙNG MẪU IN SẴN, phần chữ in là cố định, phần viết tay là nội dung cần đọc.

               BỐ CỤC TỜ HOÁ ĐƠN, từ trên xuống:
               1. Đầu tờ: tên nhà hàng, địa chỉ, số tài khoản, số điện thoại — TOÀN BỘ LÀ CHỮ IN.
               2. Các ô "Tên khách hàng", "Bàn số" (bên phải), "Địa chỉ", "ĐT".
               3. HÀNG BIA: một hàng có nhãn "Bia" ở ô đầu tiên bên trái, bên phải là NHIỀU Ô NHỎ
                  để trống (xếp thành một hoặc hai dãy). Mỗi lần khách gọi thêm bia, nhân viên ghi
                  số cốc vào MỘT ô. Ví dụ các ô lần lượt ghi "4", "6", "2" nghĩa là ba lần gọi:
                  4 cốc, rồi 6 cốc, rồi 2 cốc.
               4. BẢNG MÓN, các cột theo thứ tự trái sang phải:
                     STT | Tên hàng | SL | ĐVT | Đơn giá | Thành tiền
                  (mẫu in sẵn 10 dòng, thường chỉ vài dòng có chữ)
               5. Dòng TỔNG CỘNG, rồi dòng "Thành tiền (viết bằng chữ)".
               6. Cuối tờ: lời chúc, ngày tháng, chữ ký — bỏ qua hết.

               ĐỌC HÀNG BIA (trả vào beerCells):
               - Đọc lần lượt trái sang phải, dãy trên trước dãy dưới.
               - BỎ QUA ô trống. Chỉ lấy ô có số.
               - Giữ nguyên từng ô thành một phần tử riêng, theo đúng thứ tự đã ghi.
                 TUYỆT ĐỐI KHÔNG cộng gộp các ô lại thành một số.
               - Nếu hàng Bia trống hết thì trả beerCells là mảng rỗng.
               - Bia đã ghi ở hàng này thì KHÔNG lặp lại trong bảng món bên dưới.

               ĐỌC BẢNG MÓN:
               - Chỉ đọc các dòng CÓ chữ viết tay. Bỏ qua dòng trống dù vẫn có số thứ tự in sẵn.
               - Đọc từng cột đúng vị trí của nó. SL là số lượng, Đơn giá là giá một đơn vị,
                 Thành tiền là tiền của cả dòng.
               - Tiền ghi theo kiểu Việt Nam, dấu chấm ngăn hàng nghìn: "85.000" nghĩa là 85000.
                 Trả về số nguyên đồng, không có dấu phân cách.
               - Nếu một ô bị bỏ trống hoặc không đọc được thì để null, KHÔNG được đoán bừa.
               - Đọc ô "Bàn số" nếu có, trả nguyên văn (ví dụ "5").

               KHÔNG NHẦM CHỮ IN THÀNH DỮ LIỆU. Mấy số in sẵn ở đầu tờ rất dễ bị đọc nhầm thành
               tiền hoặc thành món — bỏ qua hết: "Số TK: 8838445399", "ĐT/Zalo: 0974.516.229"
               (số điện thoại có dấu chấm, trông y hệt cách ghi tiền), địa chỉ "Số 60TT6.3",
               "Ngân hàng: BIDV", "HỘ KINH DOANH NHÀ HÀNG THU HƯƠNG", "HOÁ ĐƠN THANH TOÁN".

               THỰC ĐƠN (số thứ tự | tên | giá | đơn vị | mô tả):
               %s%s
               KHỚP MÓN:
               - Với mỗi dòng, chọn số thứ tự món phù hợp nhất trong thực đơn trên, trả vào productIndex.
               - Cột "Đơn giá" là manh mối rất mạnh: giá viết tay thường trùng đúng giá trong thực đơn.
                 Nếu tên viết khó đọc nhưng giá khớp một món, hãy ưu tiên món đó.
               - So cả cách viết tắt và cách viết thường ngày của người Việt.
               - Nếu không món nào hợp thì để productIndex = null.

               ĐỘ TIN CẬY (confidence) cho từng dòng:
               - "high": chắc chắn, ví dụ tên khớp rõ và giá cũng khớp.
               - "low": chỉ khớp một phần, hoặc tên khớp nhưng giá lệch, hoặc bạn phải đoán.
               - "none": không tìm được món phù hợp (productIndex phải là null).

               Luôn trả rawText là nguyên văn chữ viết tay ở cột Tên hàng, kể cả khi không khớp được món.
               """.formatted(pageNote, menu, aliasNote);
    }

    /** Schema ràng buộc đầu ra — nhờ đó không cần dò tìm dấu ngoặc trong text như cách cũ. */
    private Map<String, Object> buildSchema() {
        Map<String, Object> itemProps = new LinkedHashMap<>();
        itemProps.put("rowNumber", nullable("INTEGER"));
        itemProps.put("rawText", Map.of("type", "STRING"));
        itemProps.put("productIndex", nullable("INTEGER"));
        itemProps.put("quantity", nullable("INTEGER"));
        itemProps.put("rawUnit", nullable("STRING"));
        itemProps.put("unitPrice", nullable("NUMBER"));
        itemProps.put("lineTotal", nullable("NUMBER"));
        itemProps.put("confidence", Map.of("type", "STRING", "enum", List.of("high", "low", "none")));

        Map<String, Object> item = Map.of(
                "type", "OBJECT",
                "properties", itemProps,
                "propertyOrdering", List.of("rowNumber", "rawText", "productIndex", "quantity",
                        "rawUnit", "unitPrice", "lineTotal", "confidence"),
                "required", List.of("rawText", "confidence")
        );

        Map<String, Object> props = new LinkedHashMap<>();
        props.put("tableLabel", nullable("STRING"));
        // Từng ô trong hàng "Bia", giữ nguyên thứ tự — mỗi ô là một đợt khách gọi
        props.put("beerCells", Map.of("type", "ARRAY", "items", Map.of("type", "INTEGER")));
        props.put("items", Map.of("type", "ARRAY", "items", item));
        props.put("grandTotal", nullable("NUMBER"));

        return Map.of(
                "type", "OBJECT",
                "properties", props,
                "propertyOrdering", List.of("tableLabel", "beerCells", "items", "grandTotal"),
                "required", List.of("items")
        );
    }

    private Map<String, Object> nullable(String type) {
        return Map.of("type", type, "nullable", true);
    }

    // ── Khớp món + kiểm tra ─────────────────────────────────────────────────

    private ScannedItemResponse resolveItem(JsonNode node, List<CatalogItem> catalog, Map<String, UUID> aliases) {
        String rawText = textOrNull(node.path("rawText"));
        Integer rowNumber = node.path("rowNumber").isNumber() ? node.path("rowNumber").asInt() : null;
        Integer quantity = node.path("quantity").isNumber() ? node.path("quantity").asInt() : null;
        Double unitPrice = readMoney(node.path("unitPrice"));
        Double lineTotal = readMoney(node.path("lineTotal"));
        String rawUnit = textOrNull(node.path("rawUnit"));

        // Dòng trống hoàn toàn thì bỏ qua thay vì tạo món rác
        if ((rawText == null || rawText.isBlank()) && quantity == null && lineTotal == null) {
            return null;
        }

        // Khi bảng bị đọc lệch cột, chữ ở cột ĐVT ("phần", "đĩa", "ly"...) có thể lọt sang thành
        // một dòng món riêng. Dòng như vậy không có tiền và không khớp món nào — bỏ đi cho đỡ nhiễu,
        // vì để lại thì nhân viên vẫn phải tự xoá.
        if (isUnitWordOnly(rawText) && unitPrice == null && lineTotal == null) {
            log.debug("[ReceiptScan] Bo dong nhieu do lech cot: '{}'", rawText);
            return null;
        }

        CatalogItem aiPick = null;
        if (node.path("productIndex").isNumber()) {
            int idx = node.path("productIndex").asInt();
            if (idx >= 1 && idx <= catalog.size()) {
                aiPick = catalog.get(idx - 1);
            } else if (idx != 0) {
                log.warn("[ReceiptScan] productIndex ngoai khoang: {} (catalog={})", idx, catalog.size());
            }
        }

        // Chấm điểm khớp tên trên toàn danh mục, cộng thêm nếu trùng bí danh đã học
        UUID aliasHit = rawText == null ? null : aliases.get(VietnameseTextMatcher.normalize(rawText));
        List<Map.Entry<CatalogItem, Integer>> scored = new ArrayList<>();
        if (rawText != null && !rawText.isBlank()) {
            for (CatalogItem c : catalog) {
                int s = VietnameseTextMatcher.score(rawText, c.name(), c.description());
                if (c.id().equals(aliasHit)) s += ALIAS_SCORE_BONUS;
                if (s > 0) scored.add(Map.entry(c, s));
            }
            scored.sort(Comparator.<Map.Entry<CatalogItem, Integer>>comparingInt(Map.Entry::getValue).reversed());
        }
        CatalogItem textBest = scored.isEmpty() ? null : scored.get(0).getKey();
        int textBestScore = scored.isEmpty() ? 0 : scored.get(0).getValue();

        // Khớp theo giá
        List<CatalogItem> priceMatches = new ArrayList<>();
        if (unitPrice != null) {
            for (CatalogItem c : catalog) {
                if (priceEquals(unitPrice, c.price())) priceMatches.add(c);
            }
        }

        int aiScore = aiPick == null || rawText == null ? 0
                : VietnameseTextMatcher.score(rawText, aiPick.name(), aiPick.description());
        if (aiPick != null && aiPick.id().equals(aliasHit)) aiScore += ALIAS_SCORE_BONUS;
        boolean priceBacksAi = aiPick != null && priceMatches.contains(aiPick);

        CatalogItem chosen;
        String confidence;
        List<String> warnings = new ArrayList<>();

        // Bí danh do chính nhân viên xác nhận trước đó là tín hiệu mạnh nhất — tin trước cả AI
        CatalogItem aliasItem = aliasHit == null ? null
                : catalog.stream().filter(c -> c.id().equals(aliasHit)).findFirst().orElse(null);

        if (aliasItem != null && (unitPrice == null || priceMatches.isEmpty() || priceMatches.contains(aliasItem))) {
            chosen = aliasItem;
            confidence = "high";
        } else if (priceBacksAi && aiScore >= VietnameseTextMatcher.MIN_PLAUSIBLE_SCORE) {
            // Cả AI, tên và giá cùng chỉ về một món — trường hợp tốt nhất
            chosen = aiPick;
            confidence = "high";
        } else if (priceMatches.size() == 1
                && VietnameseTextMatcher.score(rawText, priceMatches.get(0).name(), priceMatches.get(0).description())
                   >= VietnameseTextMatcher.MIN_PLAUSIBLE_SCORE) {
            // Giá chỉ đúng một món và tên cũng hợp lý — tin giá kể cả khi AI chọn khác
            chosen = priceMatches.get(0);
            confidence = "high";
            if (aiPick != null && !aiPick.equals(chosen)) {
                warnings.add("AI đọc là \"" + aiPick.name() + "\" nhưng đơn giá khớp \"" + chosen.name() + "\".");
                confidence = "low";
            }
        } else if (aiPick != null && aiScore >= VietnameseTextMatcher.STRONG_SCORE) {
            // Không có tín hiệu giá nhưng tên khớp rất mạnh
            chosen = aiPick;
            confidence = unitPrice == null ? "high" : "low";
            if (unitPrice != null) {
                warnings.add("Đơn giá viết tay không khớp giá trong thực đơn.");
            }
        } else if (aiPick != null) {
            chosen = aiPick;
            confidence = "low";
        } else if (textBest != null && textBestScore >= VietnameseTextMatcher.STRONG_SCORE) {
            chosen = textBest;
            confidence = "low";
        } else {
            chosen = null;
            confidence = "none";
        }

        // Suy ra số lượng khi cột SL không đọc được nhưng còn đủ tiền và giá
        if (quantity == null && lineTotal != null && chosen != null && chosen.price() != null && chosen.price() > 0) {
            long inferred = Math.round(lineTotal / chosen.price());
            if (inferred >= 1 && Math.abs(inferred * chosen.price() - lineTotal) <= TOTAL_TOLERANCE) {
                quantity = (int) inferred;
                warnings.add("Số lượng được suy ra từ thành tiền (" + inferred + ").");
                if ("high".equals(confidence)) confidence = "low";
            }
        }

        // Kiểm tra số học: SL × Đơn giá = Thành tiền
        if (quantity != null && unitPrice != null && lineTotal != null) {
            double expected = quantity * unitPrice;
            if (Math.abs(expected - lineTotal) > TOTAL_TOLERANCE) {
                warnings.add(String.format(
                        "Lệch phép tính: %d × %,.0fđ = %,.0fđ nhưng thành tiền ghi %,.0fđ.",
                        quantity, unitPrice, expected, lineTotal));
                confidence = "low";
            }
        }

        if (quantity == null || quantity < 1) quantity = 1;

        // Gợi ý thay thế cho các dòng chưa chắc chắn
        List<MatchCandidate> candidates = List.of();
        if (!"high".equals(confidence)) {
            List<MatchCandidate> list = new ArrayList<>();
            for (CatalogItem c : priceMatches) {
                if (!c.equals(chosen)) list.add(toCandidate(c, 1000));
            }
            for (Map.Entry<CatalogItem, Integer> e : scored) {
                if (list.size() >= 4) break;
                if (e.getKey().equals(chosen)) continue;
                if (list.stream().anyMatch(m -> m.getProductId().equals(e.getKey().id()))) continue;
                if (e.getValue() < VietnameseTextMatcher.MIN_PLAUSIBLE_SCORE) continue;
                list.add(toCandidate(e.getKey(), e.getValue()));
            }
            candidates = list;
        }

        return ScannedItemResponse.builder()
                .rowNumber(rowNumber)
                .productId(chosen == null ? null : chosen.id())
                .productName(chosen != null ? chosen.name()
                        : (rawText == null || rawText.isBlank() ? "Món chưa rõ" : rawText))
                .quantity(quantity)
                // Luôn lấy đơn vị từ DB — chữ viết tay ở cột ĐVT chỉ để tham chiếu
                .saleUnit(chosen == null ? "PORTION" : chosen.saleUnit())
                .rawText(rawText)
                .rawUnit(rawUnit)
                .unitPrice(unitPrice)
                .lineTotal(lineTotal)
                .catalogPrice(chosen == null ? null : chosen.price())
                .confidence(confidence)
                .candidates(candidates)
                .warnings(warnings)
                .build();
    }

    private MatchCandidate toCandidate(CatalogItem c, int score) {
        return MatchCandidate.builder()
                .productId(c.id()).productName(c.name()).price(c.price()).score(score)
                .build();
    }

    // ── Hàng "Bia" trên mẫu hoá đơn ─────────────────────────────────────────

    /** Số cốc tối đa chấp nhận cho một ô — hơn mức này gần như chắc chắn là đọc nhầm chữ in. */
    private static final int MAX_CUPS_PER_CELL = 99;

    /** Món bia cốc trong thực đơn. Cách nhận biết giống hệt trang chi tiết đơn bên web và app. */
    private CatalogItem findBeer(List<CatalogItem> catalog) {
        return catalog.stream()
                .filter(c -> "DRINK".equalsIgnoreCase(c.category())
                        && c.name() != null
                        && c.name().toLowerCase().contains("bia cốc"))
                .findFirst()
                .orElse(null);
    }

    /**
     * Mỗi ô có số trong hàng "Bia" là một đợt khách gọi — giữ nguyên từng ô, không cộng gộp.
     * Trả về danh sách rỗng nếu hàng bia để trống.
     */
    private List<Integer> readBeerRounds(JsonNode node, CatalogItem beer, List<String> warnings) {
        if (node == null || !node.isArray() || node.isEmpty()) return List.of();

        if (beer == null) {
            warnings.add("Hoá đơn có ghi bia nhưng thực đơn không có món \"Bia Cốc\" — bỏ qua hàng bia.");
            return List.of();
        }

        List<Integer> rounds = new ArrayList<>();
        int skipped = 0;
        for (JsonNode cell : node) {
            if (!cell.isNumber()) { skipped++; continue; }
            int qty = cell.asInt();
            if (qty < 1 || qty > MAX_CUPS_PER_CELL) { skipped++; continue; }
            rounds.add(qty);
        }
        if (skipped > 0) {
            warnings.add("Có " + skipped + " ô bia không đọc được số hợp lệ — kiểm tra lại hàng Bia trên tờ giấy.");
        }
        return rounds;
    }

    /** Các chữ ở cột ĐVT — nếu cả tên món chỉ là một từ như vậy thì đó là lỗi đọc lệch cột. */
    private static final java.util.Set<String> UNIT_WORDS = java.util.Set.of(
            "phan", "suat", "dia", "to", "bat", "ly", "coc", "cai", "mieng", "lon", "chai",
            "kg", "goi", "hop", "vi", "binh", "thung", "bao", "noi", "xuat", "dv", "dvt");

    private boolean isUnitWordOnly(String rawText) {
        if (rawText == null || rawText.isBlank()) return false;
        return UNIT_WORDS.contains(VietnameseTextMatcher.normalize(rawText));
    }

    private boolean priceEquals(Double read, Double catalogPrice) {
        if (read == null || catalogPrice == null) return false;
        if (Math.abs(read - catalogPrice) <= PRICE_TOLERANCE) return true;
        // Nhân viên hay ghi tắt "85" thay cho "85.000"
        return read < 1000 && Math.abs(read * 1000 - catalogPrice) <= PRICE_TOLERANCE;
    }

    /** Đọc số tiền, chấp nhận cả dạng chuỗi "85.000" nếu model lỡ trả string. */
    private Double readMoney(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        if (node.isNumber()) {
            double v = node.asDouble();
            return v <= 0 ? null : v;
        }
        String s = node.asText("").replaceAll("[^0-9]", "");
        if (s.isBlank()) return null;
        try {
            double v = Double.parseDouble(s);
            return v <= 0 ? null : v;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String textOrNull(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        String s = node.asText("").trim();
        return s.isBlank() ? null : s;
    }
}
