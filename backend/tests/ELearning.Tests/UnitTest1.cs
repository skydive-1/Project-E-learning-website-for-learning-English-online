namespace ELearning.Tests;

public class SampleDomainTests
{
    [Fact]
    public void User_DefaultRole_IsStudent()
    {
        var user = new ELearning.Domain.Entities.User();
        Assert.Equal(ELearning.Domain.Enums.UserRole.Student, user.Role);
    }
}
