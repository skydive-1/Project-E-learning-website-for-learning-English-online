/**
 * Input Validation Middleware
 * - Kiểm tra dữ liệu đầu vào (body, query, params) trước khi gửi tới controller.
 * - Không cần thư viện ngoài để tránh làm phình dự án và dễ bảo trì.
 */

const validate = (schema) => (req, res, next) => {
  const targets = ['body', 'query', 'params'];

  for (const target of targets) {
    if (schema[target]) {
      for (const [field, rules] of Object.entries(schema[target])) {
        const value = req[target]?.[field];

        // 1. Check required
        if (rules.required && (value === undefined || value === null || String(value).trim() === '')) {
          const error = new Error(`Trường '${field}' trong ${target} là bắt buộc`);
          error.name = 'ValidationError';
          error.status = 400;
          return next(error);
        }

        if (value !== undefined && value !== null) {
          // 2. Check email format
          if (rules.isEmail) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
              const error = new Error(`Trường '${field}' không phải là một email hợp lệ`);
              error.name = 'ValidationError';
              error.status = 400;
              return next(error);
            }
          }

          // 3. Check min length
          if (rules.minLength && String(value).length < rules.minLength) {
            const error = new Error(`Trường '${field}' phải dài tối thiểu ${rules.minLength} ký tự`);
            error.name = 'ValidationError';
            error.status = 400;
            return next(error);
          }
        }
      }
    }
  }

  next();
};

module.exports = validate;
