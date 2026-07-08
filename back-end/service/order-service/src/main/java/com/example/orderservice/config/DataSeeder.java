package com.example.orderservice.config;

import com.example.orderservice.entity.DiningTable;
import com.example.orderservice.entity.enums.TableStatus;
import com.example.orderservice.repository.DiningTableRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements ApplicationRunner {

    private final DiningTableRepository tableRepository;

    @Override
    public void run(ApplicationArguments args) {
        if (tableRepository.count() > 0) return;

        List<DiningTable> tables = new ArrayList<>();

        // Khu vực trong nhà: bàn 1–6
        for (int i = 1; i <= 6; i++) {
            tables.add(DiningTable.builder()
                    .tableNumber(i)
                    .name("Bàn " + i)
                    .qrToken(UUID.randomUUID().toString())
                    .status(TableStatus.AVAILABLE)
                    .note("Khu vực trong nhà, sức chứa 4 người")
                    .isDeleted(false)
                    .build());
        }

        // Khu vực ngoài trời: bàn 7–10
        for (int i = 7; i <= 10; i++) {
            tables.add(DiningTable.builder()
                    .tableNumber(i)
                    .name("Bàn " + i)
                    .qrToken(UUID.randomUUID().toString())
                    .status(TableStatus.AVAILABLE)
                    .note("Khu vực ngoài trời, sức chứa 6 người")
                    .isDeleted(false)
                    .build());
        }

        // Phòng VIP
        tables.add(DiningTable.builder()
                .tableNumber(11)
                .name("Phòng VIP 1")
                .qrToken(UUID.randomUUID().toString())
                .status(TableStatus.AVAILABLE)
                .note("Phòng riêng VIP, sức chứa 10 người")
                .isDeleted(false)
                .build());

        tableRepository.saveAll(tables);
        log.info("[Seed] Đã tạo {} bàn mẫu", tables.size());
    }
}
