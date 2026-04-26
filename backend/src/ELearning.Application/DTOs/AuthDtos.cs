namespace ELearning.Application.DTOs;

public record RegisterRequest(string FullName, string Email, string Password);

public record LoginRequest(string Email, string Password);

public record AuthResponse(string AccessToken, string RefreshToken, int ExpiresIn);
