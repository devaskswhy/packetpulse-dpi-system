import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function CyberCursor() {
  // dot follows instantly
  const dotX = useMotionValue(0);
  const dotY = useMotionValue(0);
  
  // ring follows with spring lag - OPTIMIZED
  const springConfig = { damping: 30, stiffness: 150 };
  const ringX = useSpring(dotX, springConfig);
  const ringY = useSpring(dotY, springConfig);
  
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    const moveCursor = (e) => {
      dotX.set(e.clientX);
      dotY.set(e.clientY);
    };
    
    const handleHover = () => setHovered(true);
    const handleLeave = () => setHovered(false);
    const handleClick = () => {
      setClicked(true);
      setTimeout(() => setClicked(false), 300);
    };
    
    window.addEventListener('mousemove', moveCursor);
    window.addEventListener('click', handleClick);
    
    // Add hover detection for interactive elements
    const interactives = document.querySelectorAll(
      'button, a, [role="button"], .card, nav a'
    );
    interactives.forEach(el => {
      el.addEventListener('mouseenter', handleHover);
      el.addEventListener('mouseleave', handleLeave);
    });
    
    return () => {
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('click', handleClick);
    };
  }, []);

  return (
    <>
      {/* Hide default cursor via style tag */}
      <style>{`* { cursor: none !important; }`}</style>
      
      {/* Outer ring */}
      <motion.div
        style={{
          position: 'fixed',
          left: ringX,
          top: ringY,
          x: '-50%',
          y: '-50%',
          zIndex: 9999,
          pointerEvents: 'none',
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '2px solid',
          borderColor: clicked ? '#ffffff' : '#22d3ee',
          scale: clicked ? 1.5 : 1,
          willChange: 'transform',
        }}
        animate={{
          width: clicked ? 64 : hovered ? 48 : 32,
          height: clicked ? 64 : hovered ? 48 : 32,
          backgroundColor: hovered 
            ? 'rgba(34,211,238,0.1)' 
            : 'transparent',
        }}
        transition={{ duration: 0.15 }}
        className="rounded-full border border-cyan-400"
      />
      
      {/* Inner dot */}
      <motion.div
        style={{
          position: 'fixed',
          left: dotX,
          top: dotY,
          x: '-50%',
          y: '-50%',
          zIndex: 9999,
          pointerEvents: 'none',
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: hovered ? '#ffffff' : '#22d3ee',
          willChange: 'transform',
        }}
        animate={{ scale: clicked ? 0.5 : 1 }}
        transition={{ duration: 0.1 }}
      />
    </>
  );
}
