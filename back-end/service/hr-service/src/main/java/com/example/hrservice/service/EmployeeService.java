package com.example.hrservice.service;

import com.example.hrservice.entity.Employee;
import com.example.hrservice.entity.DTO.req.CreateEmployeeRequest;
import com.example.hrservice.entity.DTO.res.EmployeeResponse;
import com.example.hrservice.repository.EmployeeRepository;
import com.example.restaurant_common.util.exception.MessageException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class EmployeeService {

    private final EmployeeRepository employeeRepository;

    public Page<EmployeeResponse> getAll(int page, int size, String search) {
        if (search != null && !search.isBlank()) {
            return employeeRepository
                    .findByNameContainingIgnoreCaseAndActiveTrue(search, PageRequest.of(page, size))
                    .map(EmployeeResponse::from);
        }
        return employeeRepository.findByActiveTrue(PageRequest.of(page, size)).map(EmployeeResponse::from);
    }

    public EmployeeResponse getById(Long id) throws MessageException {
        return EmployeeResponse.from(findById(id));
    }

    @Transactional
    public EmployeeResponse create(CreateEmployeeRequest req) throws MessageException {
        // Nếu có userId → kiểm tra đã tồn tại chưa (auto-create từ user-service)
        if (req.getUserId() != null) {
            Optional<Employee> existing = employeeRepository.findByUserId(req.getUserId());
            if (existing.isPresent()) {
                return EmployeeResponse.from(existing.get());
            }
        }
        if (req.getPhone() != null && !req.getPhone().isBlank()) {
            if (employeeRepository.findByPhone(req.getPhone()).isPresent()) {
                throw new MessageException("Số điện thoại này đã được đăng ký cho nhân viên khác");
            }
        }
        if (req.getTelegramId() != null) {
            if (employeeRepository.findByTelegramId(req.getTelegramId()).isPresent()) {
                throw new MessageException("Telegram ID này đã được liên kết với nhân viên khác");
            }
        }
        Employee employee = Employee.builder()
                .name(req.getName())
                .phone(req.getPhone())
                .telegramId(req.getTelegramId())
                .type(req.getType())
                .salaryType(req.getSalaryType())
                .baseValue(req.getBaseValue())
                .targetDays(req.getTargetDays())
                .userId(req.getUserId())
                .build();
        return EmployeeResponse.from(employeeRepository.save(employee));
    }

    public EmployeeResponse findByUserId(Long userId) throws MessageException {
        return EmployeeResponse.from(
                employeeRepository.findByUserId(userId)
                        .orElseThrow(() -> new MessageException("Chưa có hồ sơ nhân viên HR cho user này"))
        );
    }

    @Transactional
    public EmployeeResponse update(Long id, CreateEmployeeRequest req) throws MessageException {
        Employee employee = findById(id);
        employee.setName(req.getName());
        employee.setPhone(req.getPhone());
        employee.setType(req.getType());
        employee.setSalaryType(req.getSalaryType());
        employee.setBaseValue(req.getBaseValue());
        employee.setTargetDays(req.getTargetDays());
        return EmployeeResponse.from(employeeRepository.save(employee));
    }

    @Transactional
    public EmployeeResponse deactivate(Long id) throws MessageException {
        Employee employee = findById(id);
        employee.setActive(false);
        return EmployeeResponse.from(employeeRepository.save(employee));
    }

    @Transactional
    public EmployeeResponse activate(Long id) throws MessageException {
        Employee employee = findById(id);
        employee.setActive(true);
        return EmployeeResponse.from(employeeRepository.save(employee));
    }

    // Dùng bởi Telegram bot: liên kết telegramId với nhân viên qua số điện thoại
    @Transactional
    public EmployeeResponse linkTelegram(Long telegramId, String phone) throws MessageException {
        Employee employee = employeeRepository.findByPhone(phone)
                .orElseThrow(() -> new MessageException("Không tìm thấy nhân viên với số điện thoại này. Vui lòng liên hệ quản lý."));
        if (employee.getTelegramId() != null) {
            throw new MessageException("Tài khoản này đã được liên kết với Telegram khác. Vui lòng liên hệ quản lý.");
        }
        employee.setTelegramId(telegramId);
        return EmployeeResponse.from(employeeRepository.save(employee));
    }

    @Transactional
    public EmployeeResponse linkTelegramById(Long employeeId, Long telegramId) throws MessageException {
        Employee employee = findById(employeeId);
        Employee existing = employeeRepository.findByTelegramId(telegramId).orElse(null);
        if (existing != null && !existing.getId().equals(employeeId)) {
            throw new MessageException("Telegram ID này đã được liên kết với nhân viên khác");
        }
        employee.setTelegramId(telegramId);
        return EmployeeResponse.from(employeeRepository.save(employee));
    }

    public Employee findById(Long id) throws MessageException {
        return employeeRepository.findById(id)
                .orElseThrow(() -> new MessageException("Không tìm thấy nhân viên với ID: " + id));
    }

    public Employee findByTelegramId(Long telegramId) throws MessageException {
        return employeeRepository.findByTelegramId(telegramId)
                .orElseThrow(() -> new MessageException("Chưa đăng ký tài khoản. Vui lòng gõ /register"));
    }
}
