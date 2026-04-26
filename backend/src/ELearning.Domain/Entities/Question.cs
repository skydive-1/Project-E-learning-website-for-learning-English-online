using ELearning.Domain.Enums;

namespace ELearning.Domain.Entities;

public class Question
{
    public int Id { get; set; }
    public int QuizId { get; set; }
    public string Content { get; set; } = string.Empty;
    public QuestionType Type { get; set; }
    public int Points { get; set; }
    public int OrderIndex { get; set; }

    public Quiz Quiz { get; set; } = null!;
    public ICollection<AnswerOption> Options { get; set; } = [];
    public ICollection<UserAnswer> UserAnswers { get; set; } = [];
}
