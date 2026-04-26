using ELearning.Domain.Entities;

namespace ELearning.Application.Interfaces;

public interface ICourseRepository
{
    Task<IEnumerable<Course>> GetAllPublishedAsync(int page, int pageSize, CancellationToken ct = default);
    Task<Course?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<Course> AddAsync(Course course, CancellationToken ct = default);
    Task UpdateAsync(Course course, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
}
