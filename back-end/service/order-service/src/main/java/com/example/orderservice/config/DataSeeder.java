package com.example.orderservice.config;

import com.example.orderservice.entity.DiningTable;
import com.example.orderservice.entity.enums.TableStatus;
import com.example.orderservice.entity.enums.TableZone;
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
        // Migrate bàn cũ chưa có zone
        migrateZones();

        if (tableRepository.count() > 0) return;

        List<DiningTable> tables = new ArrayList<>();

        // Tầng 1: bàn 1–4
        for (int i = 1; i <= 4; i++) {
            tables.add(DiningTable.builder()
                    .tableNumber(i)
                    .name("Bàn " + i)
                    .qrToken(UUID.randomUUID().toString())
                    .status(TableStatus.AVAILABLE)
                    .zone(TableZone.INDOOR_FLOOR_1)
                    .note("Tầng 1, sức chứa 4 người")
                    .isDeleted(false)
                    .build());
        }

        // Tầng 2: bàn 5–8
        for (int i = 5; i <= 8; i++) {
            tables.add(DiningTable.builder()
                    .tableNumber(i)
                    .name("Bàn " + i)
                    .qrToken(UUID.randomUUID().toString())
                    .status(TableStatus.AVAILABLE)
                    .zone(TableZone.INDOOR_FLOOR_2)
                    .note("Tầng 2, sức chứa 4 người")
                    .isDeleted(false)
                    .build());
        }

        // Ngoài trời: bàn 9–12
        for (int i = 9; i <= 12; i++) {
            tables.add(DiningTable.builder()
                    .tableNumber(i)
                    .name("Bàn " + i)
                    .qrToken(UUID.randomUUID().toString())
                    .status(TableStatus.AVAILABLE)
                    .zone(TableZone.OUTDOOR)
                    .note("Khu vực ngoài trời, sức chứa 6 người")
                    .isDeleted(false)
                    .build());
        }

        // Phòng VIP tầng 1
        tables.add(DiningTable.builder()
                .tableNumber(13)
                .name("Phòng VIP 1")
                .qrToken(UUID.randomUUID().toString())
                .status(TableStatus.AVAILABLE)
                .zone(TableZone.INDOOR_FLOOR_1)
                .note("Phòng riêng VIP, sức chứa 10 người")
                .isDeleted(false)
                .build());

        tableRepository.saveAll(tables);
        log.info("[Seed] Đã tạo {} bàn mẫu", tables.size());
    }

    private void migrateZones() {
        List<DiningTable> unzoned = tableRepository.findByZoneIsNull();
        if (unzoned.isEmpty()) return;
        for (DiningTable t : unzoned) {
            int num = t.getTableNumber() != null ? t.getTableNumber() : 99;
            if (num <= 3) t.setZone(TableZone.INDOOR_FLOOR_1);
            else if (num <= 6) t.setZone(TableZone.INDOOR_FLOOR_2);
            else if (num <= 10) t.setZone(TableZone.OUTDOOR);
            else t.setZone(TableZone.INDOOR_FLOOR_1);
        }
        tableRepository.saveAll(unzoned);
        log.info("[Migrate] Đã gán zone cho {} bàn cũ", unzoned.size());
    }
}
