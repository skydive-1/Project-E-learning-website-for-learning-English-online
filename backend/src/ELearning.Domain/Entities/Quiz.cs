namespace ELearning.Domain.Entities;

public class Quiz
{
    public int Id { get; set; }
    public int LessonId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int PassScore { get; set; }

    public Lesson Lesson { get; set; } = null!;
    public ICollection<Question> Questions { get; set; } = [];
    public ICollection<QuizAttempt> Attempts { get; set; } = [];
}
