package com.example.userservice.service;

import com.example.userservice.client.HrServiceClient;
import com.example.userservice.client.dto.CreateHrEmployeeRequest;
import com.example.userservice.entity.User;
import com.example.userservice.entity.DTO.req.CreateUserRequest;
import com.example.userservice.entity.DTO.req.UpdateProfileRequest;
import com.example.userservice.entity.DTO.req.UpdateRoleRequest;
import com.example.userservice.entity.DTO.res.UserResponse;
import com.example.userservice.entity.DTO.res.UserStatsResponse;
import com.example.userservice.repository.UserRepository;
import com.example.restaurant_common.util.exception.MessageException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final HrServiceClient hrServiceClient;

    @Transactional
    public UserResponse getCurrentUser(String username, String role) {
        return userRepository.findByUsername(username)
                .map(UserResponse::from)
                .orElseGet(() -> {
                    User newUser = User.builder()
                            .username(username)
                            .role(role)
                            .enabled(true)
                            .build();
                    return UserResponse.from(userRepository.save(newUser));
                });
    }

    @Transactional
    public UserResponse updateProfile(String username, UpdateProfileRequest req) throws MessageException {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new MessageException("Không tìm thấy người dùng"));

        if (req.getFullName() != null && !req.getFullName().isBlank()) {
            user.setFullName(req.getFullName());
        }
        if (req.getPhone() != null && !req.getPhone().isBlank()) {
            user.setPhone(req.getPhone());
        }
        if (req.getEmail() != null && !req.getEmail().isBlank()) {
            if (!req.getEmail().equals(user.getEmail()) && userRepository.existsByEmail(req.getEmail())) {
                throw new MessageException("Email này đã được sử dụng");
            }
            user.setEmail(req.getEmail());
        }

        return UserResponse.from(userRepository.save(user));
    }


    public Page<UserResponse> getAllUsers(int page, int size) {
        return userRepository.findAll(PageRequest.of(page, size, Sort.by("id").ascending()))
                .map(UserResponse::from);
    }

    public Page<UserResponse> searchUsers(String keyword, int page, int size) {
        return userRepository
                .findByUsernameContainingIgnoreCaseOrEmailContainingIgnoreCaseOrFullNameContainingIgnoreCase(
                        keyword, keyword, keyword,
                        PageRequest.of(page, size, Sort.by("id").ascending()))
                .map(UserResponse::from);
    }

    public UserResponse getUserById(Long id) throws MessageException {
        return userRepository.findById(id)
                .map(UserResponse::from)
                .orElseThrow(() -> new MessageException("Không tìm thấy người dùng với id: " + id));
    }

    @Transactional
    public UserResponse createUser(CreateUserRequest req) throws MessageException {
        if (userRepository.existsByUsername(req.getUsername())) {
            throw new MessageException("Tên đăng nhập đã tồn tại");
        }
        if (req.getEmail() != null && userRepository.existsByEmail(req.getEmail())) {
            throw new MessageException("Email đã được sử dụng");
        }

        String role = (req.getRole() != null && !req.getRole().isBlank()) ? req.getRole() : "ROLE_USER";
        if (!role.startsWith("ROLE_")) {
            role = "ROLE_" + role;
        }

        User user = User.builder()
                .username(req.getUsername())
                .password(passwordEncoder.encode(req.getPassword()))
                .email(req.getEmail())
                .fullName(req.getFullName())
                .role(role)
                .enabled(true)
                .build();

        return UserResponse.from(userRepository.save(user));
    }

    @Transactional
    public UserResponse updateRole(Long id, UpdateRoleRequest req) throws MessageException {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new MessageException("Không tìm thấy người dùng với id: " + id));

        String role = req.getRole().startsWith("ROLE_") ? req.getRole() : "ROLE_" + req.getRole();
        user.setRole(role);
        UserResponse saved = UserResponse.from(userRepository.save(user));

        // Tự động tạo hồ sơ nhân viên HR khi role là EMPLOYEE hoặc ADMIN
        if ("ROLE_EMPLOYEE".equals(role) || "ROLE_ADMIN".equals(role)) {
            try {
                String name = (user.getFullName() != null && !user.getFullName().isBlank())
                        ? user.getFullName() : user.getUsername();
                hrServiceClient.createEmployee(new CreateHrEmployeeRequest(
                        name, null, user.getId(),
                        "FULL_TIME", "HOURLY", 50000.0
                ));
            } catch (Exception e) {
                log.warn("Auto-create HR employee failed for user {}: {}", id, e.getMessage());
            }
        }

        return saved;
    }

    @Transactional
    public UserResponse toggleStatus(Long id) throws MessageException {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new MessageException("Không tìm thấy người dùng với id: " + id));
        user.setEnabled(!user.isEnabled());
        return UserResponse.from(userRepository.save(user));
    }

    @Transactional
    public void deleteUser(Long id) throws MessageException {
        if (!userRepository.existsById(id)) {
            throw new MessageException("Không tìm thấy người dùng với id: " + id);
        }
        userRepository.deleteById(id);
    }

    public UserStatsResponse getStats() {
        return UserStatsResponse.builder()
                .activeAdmin(userRepository.countByRoleAndEnabled("ROLE_ADMIN", true))
                .activeEmployee(userRepository.countByRoleAndEnabled("ROLE_EMPLOYEE", true))
                .totalActive(userRepository.countByEnabled(true))
                .build();
    }
}
