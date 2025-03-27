import React from 'react';

const NetworkLayerAnnotation = ({ 
  label = "Packets 2-8 passed to network layer", 
  x = 10, 
  y = 20,
  pointerY = -20,
  textWidth = 250,
}) => {
  return (
    <svg 
      width={textWidth + 50} 
      height={50} 
      className="overflow-visible"
      style={{ position: 'absolute', left: x, top: y }}
    >
      {/* Pointer line */}
      <line 
        x1={textWidth / 2 + 10} 
        y1={20} 
        x2={textWidth / 2 + 10} 
        y2={pointerY} 
        stroke="black" 
        strokeWidth="1" 
      />

      {/* Pointer arrowhead */}
      <polygon 
        points={`${textWidth / 2 + 10},${pointerY} ${textWidth / 2 + 5},${pointerY + 10} ${textWidth / 2 + 15},${pointerY + 10}`} 
        fill="black" 
      />

      {/* Label */}
      <text 
        x="5" 
        y="35" 
        textAnchor="start" 
        fontSize="15"
        fontWeight="bold"
      >
        {label}
      </text>
    </svg>
  );
};

export default NetworkLayerAnnotation;