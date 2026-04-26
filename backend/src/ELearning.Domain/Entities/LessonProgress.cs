namespace ELearning.Domain.Entities;

public class LessonProgress
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int LessonId { get; set; }
    public int WatchedSeconds { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime LastWatchedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Lesson Lesson { get; set; } = null!;
}
