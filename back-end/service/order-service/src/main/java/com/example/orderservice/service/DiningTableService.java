package com.example.orderservice.service;

import com.example.orderservice.entity.DiningTable;
import com.example.orderservice.entity.DTO.req.CreateTableRequest;
import com.example.orderservice.entity.DTO.req.UpdateTableRequest;
import com.example.orderservice.entity.DTO.res.TableResponse;
import com.example.orderservice.entity.enums.OrderStatus;
import com.example.orderservice.entity.enums.TableStatus;
import com.example.orderservice.repository.DiningTableRepository;
import com.example.orderservice.repository.OrderRepository;
import com.example.restaurant_common.util.exception.MessageException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DiningTableService {

    private final DiningTableRepository tableRepository;
    private final OrderRepository orderRepository;

    @Transactional(readOnly = true)
    public List<TableResponse> getAll() {
        return tableRepository.findAllByOrderByTableNumberAsc()
                .stream().map(TableResponse::from).collect(Collectors.toList());
    }

    @Transactional
    public TableResponse create(CreateTableRequest req) throws MessageException {
        if (tableRepository.existsByTableNumber(req.getTableNumber())) {
            throw new MessageException("Bàn số " + req.getTableNumber() + " đã tồn tại");
        }

        DiningTable table = DiningTable.builder()
                .tableNumber(req.getTableNumber())
                .name(req.getName())
                .qrToken(UUID.randomUUID().toString())
                .note(req.getNote())
                .build();

        return TableResponse.from(tableRepository.save(table));
    }

    @Transactional
    public TableResponse update(Long id, UpdateTableRequest req) throws MessageException {
        DiningTable table = tableRepository.findById(id)
                .orElseThrow(() -> new MessageException("Không tìm thấy bàn với id: " + id));

        if (req.getName() != null) table.setName(req.getName());
        if (req.getNote() != null) table.setNote(req.getNote());

        return TableResponse.from(tableRepository.save(table));
    }

    @Transactional
    public void delete(Long id) throws MessageException {
        DiningTable table = tableRepository.findById(id)
                .orElseThrow(() -> new MessageException("Không tìm thấy bàn với id: " + id));

        boolean hasActiveOrder = orderRepository
                .findByDiningTableAndStatusIn(table, List.of(OrderStatus.OPEN))
                .isPresent();

        if (hasActiveOrder) {
            throw new MessageException("Không thể xóa bàn đang có đơn hàng đang mở");
        }

        tableRepository.delete(table);
    }

    @Transactional(readOnly = true)
    public TableResponse getById(Long id) throws MessageException {
        return TableResponse.from(tableRepository.findById(id)
                .orElseThrow(() -> new MessageException("Không tìm thấy bàn với id: " + id)));
    }

    @Transactional(readOnly = true)
    public List<TableResponse> getByStatus(TableStatus status) {
        return tableRepository.findByStatus(status)
                .stream().map(TableResponse::from).collect(Collectors.toList());
    }
}
