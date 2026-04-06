import { useState, useEffect } from 'react';

export default function TypeWriter({ text }) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [cursorVisible, setCursorVisible] = useState(true);

  console.log('TypeWriter received text:', text, 'type:', typeof text);

  useEffect(() => {
    setDisplayedText('');
    setIsTyping(true);
    setCursorVisible(true);
    
    let currentIndex = 0;
    const typeInterval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(prev => prev + text[currentIndex]);
        currentIndex++;
      } else {
        setIsTyping(false);
        clearInterval(typeInterval);
        
        // Blink cursor 3 times after typing is complete
        let blinks = 0;
        const blinkInterval = setInterval(() => {
          setCursorVisible(prev => !prev);
          blinks++;
          if (blinks >= 6) { // 3 blinks = 6 state changes
            clearInterval(blinkInterval);
            setCursorVisible(false);
          }
        }, 200);
      }
    }, 80);

    return () => {
      clearInterval(typeInterval);
    };
  }, [text]);

  return (
    <span style={{ color: 'white' }}>
      {displayedText}
      {(isTyping || cursorVisible) && (
        <span 
          style={{
            opacity: cursorVisible ? 1 : 0,
            transition: 'opacity 0.1s'
          }}
        >
          |
        </span>
      )}
    </span>
  );
}
