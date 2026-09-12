export const roadmapPaths = [
  {
    id: 'basic',
    title: 'Tiếng Anh Cơ Bản',
    shortTitle: 'Nền tảng tiếng Anh',
    description: 'Dành cho người mới bắt đầu hoặc mất gốc. Tập trung vào phát âm chuẩn IPA và ngữ pháp nền tảng.',
    introduction: [
      'Lộ trình này giúp bạn xây lại nền tảng theo thứ tự dễ tiếp thu: nghe đúng âm, hiểu cấu trúc câu, sau đó luyện phản xạ trong các tình huống quen thuộc.',
      'Bạn nên học đều đặn theo từng giai đoạn và chỉ chuyển tiếp khi đã hoàn thành phần luyện tập cốt lõi. Tốc độ học có thể thay đổi theo thời gian bạn dành mỗi tuần.'
    ],
    note: 'Nếu bạn chưa chắc trình độ hiện tại, hãy bắt đầu từ phần phát âm và làm lại các bài ngữ pháp nền tảng trước khi chuyển sang giao tiếp.',
    coursesCount: 5,
    time: '3-4 tháng',
    weeklyCommitment: '4-5 giờ mỗi tuần',
    skills: ['Phát âm IPA chuẩn', 'Ngữ pháp cơ bản', 'Từ vựng thông dụng', 'Giao tiếp hàng ngày'],
    image: '/images/hero_illustration.png',
    subjectFilter: '4',
    subjectFilters: ['4', '5'],
    subjectTerms: ['general english', 'communication', 'giao tiep', 'grammar', 'essential'],
    courseTerms: ['co ban', 'can ban', 'mat goc', 'beginner', 'foundation', 'phat am', 'ipa'],
    phases: [
      {
        step: 'Tháng 1',
        name: 'Chuẩn hóa phát âm IPA và từ vựng nền tảng',
        desc: 'Học cách phát âm 44 âm trong bảng IPA, tạo thói quen nghe lại bản ghi và sửa từng lỗi phát âm.',
        focus: ['Nhận diện và phát âm 44 âm IPA', 'Nối âm trong từ và câu ngắn', 'Xây vốn từ cho các chủ đề thường ngày'],
        practice: 'Ghi âm một đoạn giới thiệu bản thân, nghe lại và sửa các âm chưa rõ.'
      },
      {
        step: 'Tháng 2',
        name: 'Ngữ pháp căn bản và ghép câu giao tiếp',
        desc: 'Nắm các thì thông dụng, cấu trúc câu cơ bản và cách đặt câu hỏi để diễn đạt ý trọn vẹn.',
        focus: ['Sử dụng các thì tiếng Anh thông dụng', 'Ghép câu khẳng định, phủ định và nghi vấn', 'Đặt câu hỏi theo ngữ cảnh'],
        practice: 'Viết và đọc thành tiếng một hội thoại ngắn cho tình huống quen thuộc.'
      },
      {
        step: 'Tháng 3-4',
        name: 'Phản xạ giao tiếp trong tình huống thực tế',
        desc: 'Luyện nghe và trả lời theo các tình huống như chào hỏi, mua sắm, chỉ đường và giới thiệu bản thân.',
        focus: ['Nghe ý chính trong hội thoại ngắn', 'Trả lời câu hỏi không cần dịch từng từ', 'Duy trì một lượt hội thoại tự nhiên'],
        practice: 'Thực hành hội thoại theo vai và tự đánh giá mức độ trôi chảy sau mỗi tuần.'
      }
    ]
  },
  {
    id: 'toeic',
    title: 'Lộ trình TOEIC 700+',
    shortTitle: 'TOEIC 700+',
    description: 'Củng cố nền tảng TOEIC thực tế qua trắc nghiệm từ vựng, ngữ pháp theo cấp độ và phòng thi đấu Quiz PIN trực tiếp.',
    introduction: [
      'Lộ trình TOEIC 700+ kết hợp ôn kiến thức trọng tâm với luyện phản xạ làm bài. Bạn sẽ đi từ từ vựng và ngữ pháp đến các lượt luyện đề có giới hạn thời gian.',
      'Mỗi giai đoạn đều có mục tiêu rõ ràng để bạn nhận ra phần còn yếu và dành thêm thời gian cho đúng dạng bài.'
    ],
    note: 'Điểm đầu vào và thời gian luyện tập ảnh hưởng trực tiếp đến tiến độ. Hãy làm bài theo đúng thời gian quy định để kết quả phản ánh sát năng lực hiện tại.',
    coursesCount: 8,
    time: '4-6 tháng',
    weeklyCommitment: '5-7 giờ mỗi tuần',
    skills: ['Từ vựng TOEIC theo chủ đề', 'Ngữ pháp trọng tâm', 'Phản xạ làm bài', 'Luyện đề có thời gian'],
    image: '/images/meeting_group.png',
    subjectFilter: '2',
    subjectFilters: ['2'],
    subjectTerms: ['toeic'],
    courseTerms: ['toeic'],
    phases: [
      {
        step: 'Tháng 1-2',
        name: 'Củng cố từ vựng và ngữ pháp TOEIC',
        desc: 'Hệ thống lại nhóm từ thường gặp, cấu trúc câu và các điểm ngữ pháp xuất hiện nhiều trong bài thi.',
        focus: ['Từ vựng theo bối cảnh công việc', 'Loại từ và cấu trúc câu', 'Mệnh đề và liên từ thường gặp'],
        practice: 'Làm một lượt trắc nghiệm ngắn sau mỗi chủ đề và ghi lại nhóm lỗi lặp lại.'
      },
      {
        step: 'Tháng 3-4',
        name: 'Tăng tốc độ xử lý câu hỏi',
        desc: 'Luyện nhận diện dạng bài, loại đáp án nhiễu và phân bổ thời gian hợp lý cho từng phần.',
        focus: ['Nhận diện tín hiệu trong câu hỏi', 'Loại trừ đáp án không phù hợp', 'Giữ nhịp làm bài ổn định'],
        practice: 'Luyện theo bộ câu hỏi có giới hạn thời gian và xem lại lời giải ngay sau khi hoàn thành.'
      },
      {
        step: 'Tháng 5-6',
        name: 'Luyện đề tổng hợp và vá lỗ hổng',
        desc: 'Làm đề mô phỏng, phân tích nhóm lỗi và ôn lại nội dung chưa vững trước khi bước vào kỳ thi.',
        focus: ['Hoàn thành đề theo thời gian thật', 'Phân loại lỗi theo kỹ năng', 'Ôn tập có ưu tiên'],
        practice: 'Lập nhật ký lỗi sau mỗi đề và dành buổi học tiếp theo để xử lý nhóm lỗi phổ biến nhất.'
      }
    ]
  },
  {
    id: 'ielts',
    title: 'Lộ trình IELTS 6.5+',
    shortTitle: 'IELTS 6.5+',
    description: 'Nâng cao năng lực tiếng Anh với luyện phát âm AI chấm điểm và luyện viết bài luận có AI phản hồi.',
    introduction: [
      'Lộ trình IELTS 6.5+ tổ chức việc học theo ba lớp: nền tảng học thuật, luyện kỹ năng có phản hồi và luyện đề tổng hợp.',
      'Bạn sẽ kết hợp nội dung do giảng viên biên soạn với công cụ AI hỗ trợ phát âm và bài viết. Kết quả từ AI là gợi ý luyện tập, không thay thế đánh giá chuyên môn của giáo viên.'
    ],
    note: 'Band mục tiêu phụ thuộc vào năng lực đầu vào và mức độ luyện tập. Hãy theo dõi lỗi theo từng kỹ năng thay vì chỉ nhìn vào điểm tổng.',
    coursesCount: 12,
    time: '6-8 tháng',
    weeklyCommitment: '7-9 giờ mỗi tuần',
    skills: ['Từ vựng học thuật', 'Viết bài có phản hồi', 'Phát âm và nói', 'Luyện đề tổng hợp'],
    image: '/images/hero_illustration.png',
    subjectFilter: '1',
    subjectFilters: ['1'],
    subjectTerms: ['ielts'],
    courseTerms: ['ielts'],
    phases: [
      {
        step: 'Tháng 1-2',
        name: 'Xây nền tảng tiếng Anh học thuật',
        desc: 'Tích lũy từ vựng theo chủ đề, ôn cấu trúc câu và làm quen với yêu cầu của từng kỹ năng IELTS.',
        focus: ['Từ vựng theo chủ đề học thuật', 'Câu phức và liên kết ý', 'Tiêu chí chấm của từng kỹ năng'],
        practice: 'Lập sổ từ vựng theo chủ đề và sử dụng từ mới trong câu hoàn chỉnh.'
      },
      {
        step: 'Tháng 3-5',
        name: 'Luyện viết và nói có phản hồi',
        desc: 'Thực hành bài viết và phần nói theo nhiệm vụ cụ thể, sau đó dùng phản hồi để sửa từng nhóm lỗi.',
        focus: ['Lập dàn ý trước khi viết', 'Phát triển câu trả lời nói', 'Sửa lỗi theo tiêu chí chấm'],
        practice: 'Hoàn thành một bài viết và một lượt nói mỗi tuần, sau đó viết lại phần còn yếu.'
      },
      {
        step: 'Tháng 6-8',
        name: 'Luyện đề tổng hợp theo chiến lược',
        desc: 'Kết hợp bốn kỹ năng trong các lượt luyện có thời gian và điều chỉnh kế hoạch dựa trên lỗi thực tế.',
        focus: ['Phân bổ thời gian theo kỹ năng', 'Duy trì chất lượng dưới áp lực', 'Ôn tập dựa trên dữ liệu lỗi'],
        practice: 'Mô phỏng một lượt thi hoàn chỉnh và dành buổi học kế tiếp để sửa bài có hệ thống.'
      }
    ]
  }
];

export const getRoadmapById = (roadmapId) => roadmapPaths.find((path) => path.id === roadmapId);
