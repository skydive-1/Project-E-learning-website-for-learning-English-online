using ELearning.Domain.Entities;

namespace ELearning.Application.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByEmailAsync(string email, CancellationToken ct = default);
    Task<User?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<User> AddAsync(User user, CancellationToken ct = default);
}
