using ELearning.Domain.Enums;

namespace ELearning.Domain.Entities;

public class User
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Student;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Enrollment> Enrollments { get; set; } = [];
    public ICollection<LessonProgress> LessonProgresses { get; set; } = [];
    public ICollection<QuizAttempt> QuizAttempts { get; set; } = [];
}
