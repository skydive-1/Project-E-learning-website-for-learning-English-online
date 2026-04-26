namespace ELearning.Application.Interfaces;

public interface IUnitOfWork
{
    ICourseRepository Courses { get; }
    IUserRepository Users { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
