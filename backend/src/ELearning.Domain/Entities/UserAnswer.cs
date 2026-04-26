namespace ELearning.Domain.Entities;

public class UserAnswer
{
    public int Id { get; set; }
    public int AttemptId { get; set; }
    public int QuestionId { get; set; }
    public int? SelectedOptionId { get; set; }
    public string? OpenEndedText { get; set; }
    public int? AiScore { get; set; }
    public string? AiFeedback { get; set; }

    public QuizAttempt Attempt { get; set; } = null!;
    public Question Question { get; set; } = null!;
    public AnswerOption? SelectedOption { get; set; }
}
