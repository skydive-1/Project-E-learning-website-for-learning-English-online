using ELearning.Domain.Enums;

namespace ELearning.Application.DTOs;

public record CourseDto(
    int Id,
    string Title,
    string Description,
    string? ThumbnailUrl,
    CourseLevel Level,
    int LessonCount,
    int EnrollmentCount);

public record CreateCourseRequest(
    string Title,
    string Description,
    string? ThumbnailUrl,
    CourseLevel Level);

public record PagedResult<T>(IEnumerable<T> Data, int TotalCount, int Page, int PageSize);
