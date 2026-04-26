namespace ELearning.Domain.Entities;

public class Lesson
{
    public int Id { get; set; }
    public int CourseId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? VideoUrl { get; set; }
    public int DurationSeconds { get; set; }
    public int OrderIndex { get; set; }
    public bool IsPublished { get; set; }

    public Course Course { get; set; } = null!;
    public Quiz? Quiz { get; set; }
    public ICollection<LessonProgress> Progresses { get; set; } = [];
}
