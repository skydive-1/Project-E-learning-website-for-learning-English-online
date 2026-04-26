using ELearning.Domain.Enums;

namespace ELearning.Domain.Entities;

public class Course
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public int InstructorId { get; set; }
    public CourseLevel Level { get; set; }
    public bool IsPublished { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User Instructor { get; set; } = null!;
    public ICollection<Lesson> Lessons { get; set; } = [];
    public ICollection<Enrollment> Enrollments { get; set; } = [];
}
