package com.example.orderservice.util;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * So khớp tên món viết tay với danh mục sản phẩm.
 *
 * <p>Dùng NFD + xoá dấu tổ hợp thay vì bảng regex từng ký tự (cách web đang làm ở
 * {@code quet-hoa-don/page.tsx}) — bền hơn vì bắt được cả chuỗi ở dạng tổ hợp (decomposed) mà
 * regex theo ký tự dựng sẵn (precomposed) bỏ lọt.
 *
 * <p>Điểm số chỉ có ý nghĩa tương đối để xếp hạng ứng viên, không phải xác suất.
 */
public final class VietnameseTextMatcher {

    private VietnameseTextMatcher() {}

    private static final Pattern COMBINING_MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern NON_ALNUM = Pattern.compile("[^a-z0-9\\s]");
    private static final Pattern MULTI_SPACE = Pattern.compile("\\s+");

    /** Từ quá phổ biến, gần như món nào cũng có — không nên cộng điểm khi trùng. */
    private static final Set<String> STOP_WORDS = Set.of("mon", "cai", "phan", "dia", "ly", "coc", "lon");

    /**
     * Chuẩn hoá về chữ thường không dấu, bỏ dấu câu, gộp khoảng trắng.
     * {@code "Gà nướng sa tế"} → {@code "ga nuong sa te"}.
     */
    public static String normalize(String input) {
        if (input == null || input.isBlank()) return "";
        // đ/Đ không phải nguyên âm có dấu tổ hợp nên NFD không tách được — phải thay thủ công
        String s = input.toLowerCase().replace('đ', 'd').replace('Đ', 'd');
        s = Normalizer.normalize(s, Normalizer.Form.NFD);
        s = COMBINING_MARKS.matcher(s).replaceAll("");
        s = NON_ALNUM.matcher(s).replaceAll(" ");
        return MULTI_SPACE.matcher(s).replaceAll(" ").trim();
    }

    /** Chữ cái đầu của mỗi từ — để bắt viết tắt kiểu "ga nuong ST" → "sa tế". */
    public static String initials(String normalized) {
        if (normalized.isBlank()) return "";
        StringBuilder sb = new StringBuilder();
        for (String w : normalized.split(" ")) {
            if (!w.isEmpty()) sb.append(w.charAt(0));
        }
        return sb.toString();
    }

    private static List<String> tokens(String normalized) {
        if (normalized.isBlank()) return List.of();
        List<String> out = new ArrayList<>();
        for (String w : normalized.split(" ")) {
            if (w.length() >= 2 && !STOP_WORDS.contains(w)) out.add(w);
        }
        return out;
    }

    /**
     * Chấm điểm mức khớp giữa chữ viết tay và một sản phẩm.
     *
     * @param rawText    chữ đọc được từ hoá đơn
     * @param productName tên sản phẩm trong DB
     * @param description mô tả sản phẩm (có thể null) — chứa nhiều từ khoá dân dã hữu ích
     * @return điểm >= 0, càng cao càng khớp
     */
    public static int score(String rawText, String productName, String description) {
        String raw = normalize(rawText);
        String name = normalize(productName);
        if (raw.isBlank() || name.isBlank()) return 0;

        int score = 0;

        if (name.equals(raw)) {
            score += 100;
        } else if (name.contains(raw) || raw.contains(name)) {
            score += 50;
        }

        List<String> rawTokens = tokens(raw);
        List<String> nameTokens = tokens(name);

        // Trùng token là tín hiệu chính: "ga chien nc mam" vs "ga chien nuoc mam"
        Set<String> nameSet = new LinkedHashSet<>(nameTokens);
        int matched = 0;
        for (String t : rawTokens) {
            if (nameSet.contains(t)) {
                matched++;
                score += 12;
            } else {
                // khớp một phần: chữ viết tay hay bị cụt ("nuong" vs "nuong")
                for (String n : nameSet) {
                    if (n.length() >= 3 && t.length() >= 3 && (n.startsWith(t) || t.startsWith(n))) {
                        score += 6;
                        break;
                    }
                }
            }
        }

        // Thưởng khi phủ được phần lớn tên món — tránh việc một từ chung chung ("ga")
        // ăn điểm ngang với khớp gần hết
        if (!nameTokens.isEmpty()) {
            double coverage = (double) matched / nameTokens.size();
            if (coverage >= 0.8) score += 30;
            else if (coverage >= 0.5) score += 12;
        }

        // Viết tắt: "ga nuong ST" → initials của "sa te" là "st"
        String rawInitials = initials(raw);
        String nameInitials = initials(name);
        if (rawInitials.length() >= 2 && rawInitials.equals(nameInitials)) {
            score += 40;
        }

        // Mô tả chỉ là tín hiệu phụ, điểm thấp để không lấn át tên
        if (description != null && !description.isBlank()) {
            String desc = normalize(description);
            for (String t : rawTokens) {
                if (t.length() >= 3 && desc.contains(t)) score += 2;
            }
        }

        return score;
    }

    /** Điểm tối thiểu để coi là "có khả năng đúng" — dưới mức này xem như không khớp. */
    public static final int MIN_PLAUSIBLE_SCORE = 20;

    /** Điểm đủ cao để tin tưởng khi không có tín hiệu nào khác mâu thuẫn. */
    public static final int STRONG_SCORE = 70;

    /** Tách chuỗi "sa te|st|satay" thành các bí danh đã chuẩn hoá. */
    public static List<String> splitAliases(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        return Arrays.stream(raw.split("[|,;]"))
                .map(VietnameseTextMatcher::normalize)
                .filter(s -> !s.isBlank())
                .toList();
    }
}
