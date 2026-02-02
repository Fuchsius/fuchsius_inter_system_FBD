import React from 'react';
import { motion } from 'framer-motion';
import logo from '../assets/logo2.png';

const Loading = ({ size = 300, className = "", bg = null }) => {
  const spinner = (
    <motion.div
      style={{
        perspective: '1000px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <motion.div
        style={{
          position: 'relative',
          width: size,
          height: size,
          transformStyle: 'preserve-3d',
        }}
        animate={{
          rotateX: 360,
          rotateY: 360,
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* Front face */}
        <div
          style={{
            position: 'absolute',
            width: size,
            height: size,
            background: 'white',
            backgroundImage: `url(${logo})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '2px solid rgba(0, 0, 0, 0.3)',
            boxShadow: '0px 5px 15px rgba(0,0,0,0.1)',
            transform: `translateZ(${size / 2}px)`,
          }}
        ></div>
        {/* Back face */}
        <div
          style={{
            position: 'absolute',
            width: size,
            height: size,
            background: 'white',
            backgroundImage: `url(${logo})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '2px solid rgba(0, 0, 0, 0.3)',
            boxShadow: '0px 5px 15px rgba(0,0,0,0.1)',
            transform: `translateZ(-${size / 2}px) rotateY(180deg)`,
          }}
        ></div>
        {/* Right face */}
        <div
          style={{
            position: 'absolute',
            width: size,
            height: size,
            background: 'white',
            backgroundImage: `url(${logo})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '2px solid rgba(0, 0, 0, 0.3)',
            boxShadow: '0px 5px 15px rgba(0,0,0,0.1)',
            transform: `rotateY(90deg) translateZ(${size / 2}px)`,
          }}
        ></div>
        {/* Left face */}
        <div
          style={{
            position: 'absolute',
            width: size,
            height: size,
            background: 'white',
            backgroundImage: `url(${logo})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '2px solid rgba(0, 0, 0, 0.3)',
            boxShadow: '0px 5px 15px rgba(0,0,0,0.1)',
            transform: `rotateY(-90deg) translateZ(${size / 2}px)`,
          }}
        ></div>
        {/* Top face */}
        <div
          style={{
            position: 'absolute',
            width: size,
            height: size,
            background: 'white',
            backgroundImage: `url(${logo})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '2px solid rgba(0, 0, 0, 0.3)',
            boxShadow: '0px 5px 15px rgba(0,0,0,0.1)',
            transform: `rotateX(90deg) translateZ(${size / 2}px)`,
          }}
        ></div>
        {/* Bottom face */}
        <div
          style={{
            position: 'absolute',
            width: size,
            height: size,
            background: 'white',
            backgroundImage: `url(${logo})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '2px solid rgba(0, 0, 0, 0.3)',
            boxShadow: '0px 5px 15px rgba(0,0,0,0.1)',
            transform: `rotateX(-90deg) translateZ(${size / 2}px)`,
          }}
        ></div>
      </motion.div>
    </motion.div>
  );

  if (bg) {
    return (
      <div className={`fixed inset-0 h-screen bg-black/30 flex items-center justify-center z-100`}>
        <div className={`flex items-center justify-center ${className}`}>
          {spinner}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      {spinner}
    </div>
  );
};

export default Loading;
