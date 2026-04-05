import { useState, useEffect } from 'react';

export default function MatrixIntro() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    console.log('MatrixIntro: Component mounted');
    
    // Force show for testing
    sessionStorage.removeItem('matrix-intro-shown');
    
    // Auto-hide after 3 seconds
    const timer = setTimeout(() => {
      console.log('MatrixIntro: Hiding component');
      setShow(false);
      sessionStorage.setItem('matrix-intro-shown', 'true');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: '#000',
      zIndex: 9998,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column'
    }}>
      <h1 style={{
        fontSize: '4rem',
        fontWeight: '900',
        fontFamily: 'monospace',
        color: '#22d3ee',
        margin: 0,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        textShadow: '0 0 20px rgba(34, 211, 238, 0.8)'
      }}>
        PACKETPULSE
      </h1>
      <div style={{
        fontSize: '1rem',
        fontFamily: 'monospace',
        color: '#22d3ee',
        marginTop: '1rem',
        opacity: 0.8
      }}>
        INITIALIZING...
      </div>
    </div>
  );
}
