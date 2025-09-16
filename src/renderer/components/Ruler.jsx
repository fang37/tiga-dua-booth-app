import React from 'react';

function Ruler({ lengthMm, scale, orientation }) {
  const ticks = [];
  // Create a tick every 5mm and a labeled tick every 10mm
  for (let i = 0; i <= lengthMm; i += 5) {
    const isMajorTick = i % 10 === 0;
    ticks.push(
      <div
        key={i}
        className={`ruler-tick ${isMajorTick ? 'major' : ''}`}
        style={orientation === 'horizontal' ? { left: `${i * scale}px` } : { top: `${i * scale}px` }}
      >
        {isMajorTick && <span className="ruler-label">{i}</span>}
      </div>
    );
  }

  return <div className={`ruler ${orientation}`}>{ticks}</div>;
}

export default Ruler;