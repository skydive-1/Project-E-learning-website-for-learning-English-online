import React, { useEffect } from 'react';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import TeamMarquee from '../../../components/common/TeamMarquee';
import DolHeroSection from '../../../components/common/DolHeroSection';
import PainPointsSection from '../components/PainPointsSection';
import CurriculumSection from '../components/CurriculumSection';
import AudienceFitSection from '../components/AudienceFitSection';
import KineticDirectionSection from '../components/KineticDirectionSection';
import VideoReviewsSection from '../components/VideoReviewsSection';
import FaqSection from '../components/FaqSection';
import MentorClosingSection from '../components/MentorClosingSection';
import '../styles/homepage.scss';

const HomePage = () => {
  // Intersection Observer for scroll animations with safety fallback
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '60px',
      threshold: 0.05
    };

    const handleIntersect = (entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, observerOptions);
    const animElements = document.querySelectorAll('.scroll-animate');
    animElements.forEach(el => observer.observe(el));

    // Safety fallback: Ensure all components are revealed
    const fallbackTimer = setTimeout(() => {
      document.querySelectorAll('.scroll-animate').forEach(el => {
        el.classList.add('animate-in');
      });
    }, 400);

    return () => {
      clearTimeout(fallbackTimer);
      animElements.forEach(el => observer.unobserve(el));
    };
  }, []);

  return (
    <div className="homepage-wrapper">
      {/* 1. HEADER / TASKBAR (PRESERVED 100%) */}
      <Header />

      <main className="homepage-main">
        {/* 2. DOL-INSPIRED HERO SECTION WITH ROTATING ARC & 4 CARDS (PRESERVED 100%) */}
        <DolHeroSection />

        {/* 3. SECTION 2 — PAIN POINTS & SOLUTIONS (IS THIS YOU?) */}
        <PainPointsSection />

        {/* 4. SECTION 3 — CURRICULUM OVERVIEW (SPLIT COMPOSITION & ACCORDION) */}
        <CurriculumSection />

        {/* 5. SECTION 4 — AUDIENCE FIT (LIGHT VS DARK COMPARISON) */}
        <AudienceFitSection />

        {/* 6. APPLE-STYLE KINETIC TYPOGRAPHY & INLINE SCROLL VIDEO TRANSITION */}
        <KineticDirectionSection />

        {/* 7. VIDEO REVIEWS & VERIFIED TRUST SCORE */}
        <VideoReviewsSection />

        {/* 8. FAQ ACCORDION (GET EVERY ANSWER) */}
        <FaqSection />

        {/* 9. PROJECT DEVELOPMENT TEAM MARQUEE (PRESERVED 100%) */}
        <TeamMarquee />

        {/* 10. MENTOR, NEWSLETTER & SKY-BLUE CLOSING */}
        <MentorClosingSection />
      </main>

      {/* 11. FOOTER (PRESERVED 100%) */}
      <Footer />
    </div>
  );
};

export default HomePage;
