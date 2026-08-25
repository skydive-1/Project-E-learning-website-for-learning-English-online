import React from 'react';
import './RotatedPhotoMarquee.css';

// 16 curated educational photo items with subtle rotations and contextual English learning labels
const PHOTO_ITEMS = [
  {
    id: 1,
    title: 'Luyện nói AI 1-1',
    category: 'Speaking Practice',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
    rotation: '-5deg',
    badgeColor: 'teal'
  },
  {
    id: 2,
    title: 'IELTS Band 7.5+',
    category: 'Academic Goal',
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=400',
    rotation: '4deg',
    badgeColor: 'indigo'
  },
  {
    id: 3,
    title: 'Phản xạ IPA chuẩn',
    category: 'Pronunciation',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=400',
    rotation: '-3deg',
    badgeColor: 'orange'
  },
  {
    id: 4,
    title: 'TOEIC 850+ Cấp tốc',
    category: 'Certificate',
    image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=400',
    rotation: '6deg',
    badgeColor: 'emerald'
  },
  {
    id: 5,
    title: 'Thảo luận nhóm Online',
    category: 'Group Study',
    image: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=400',
    rotation: '-4deg',
    badgeColor: 'purple'
  },
  {
    id: 6,
    title: 'Business English Email',
    category: 'Workplace',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=400',
    rotation: '5deg',
    badgeColor: 'blue'
  },
  {
    id: 7,
    title: 'Luyện nghe Podcast AI',
    category: 'Listening',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=400',
    rotation: '-6deg',
    badgeColor: 'teal'
  },
  {
    id: 8,
    title: 'Sửa lỗi ngữ pháp tức thì',
    category: 'AI Correction',
    image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=400',
    rotation: '3deg',
    badgeColor: 'amber'
  }
];

const RotatedPhotoMarquee = () => {
  // Repeat list 3 times for completely seamless infinite translation loop
  const marqueeItems = [...PHOTO_ITEMS, ...PHOTO_ITEMS, ...PHOTO_ITEMS];

  return (
    <div className="rotated-marquee-wrapper" aria-label="Hình ảnh học viên và lớp học trực tuyến">
      <div className="rotated-marquee-track">
        {marqueeItems.map((item, index) => (
          <div
            key={`${item.id}-${index}`}
            className="rotated-photo-card group"
            style={{ '--card-rotation': item.rotation }}
          >
            <div className="rotated-photo-inner">
              <img
                src={item.image}
                alt={item.title}
                loading="lazy"
                className="rotated-photo-img"
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=400';
                }}
              />
              <div className="rotated-photo-overlay">
                <span className={`photo-badge badge-${item.badgeColor}`}>
                  {item.category}
                </span>
                <p className="photo-title">{item.title}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RotatedPhotoMarquee;
