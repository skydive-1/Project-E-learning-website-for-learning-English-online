export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <main className="flex flex-col items-center gap-8 text-center px-8 py-20 max-w-2xl">
        <h1 className="text-5xl font-bold text-indigo-700 tracking-tight">
          🌐 ELearn
        </h1>
        <p className="text-xl text-gray-600 leading-relaxed">
          An English E-Learning platform with structured courses, video lessons,
          AI-powered quizzes, and personalised progress tracking.
        </p>
        <div className="flex gap-4 flex-wrap justify-center">
          <a
            href="/courses"
            className="px-6 py-3 rounded-full bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
          >
            Browse Courses
          </a>
          <a
            href="/auth/register"
            className="px-6 py-3 rounded-full border border-indigo-600 text-indigo-600 font-semibold hover:bg-indigo-50 transition-colors"
          >
            Get Started Free
          </a>
        </div>
        <p className="text-sm text-gray-400 mt-4">
          Backend API running at{" "}
          <code className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">
            {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api"}
          </code>
        </p>
      </main>
    </div>
  );
}
