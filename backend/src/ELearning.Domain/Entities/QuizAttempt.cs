namespace ELearning.Domain.Entities;

public class QuizAttempt
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int QuizId { get; set; }
    public int Score { get; set; }
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Quiz Quiz { get; set; } = null!;
    public ICollection<UserAnswer> Answers { get; set; } = [];
}
