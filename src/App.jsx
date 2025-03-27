import React, { useEffect, useRef, useState } from "react";

const SelectiveRepeatARQ = () => {
  const senderRefs = useRef([]);
  const receiverRefs = useRef([]);
  const [arrowPositions, setArrowPositions] = useState([]);
  const [ackPositions, setAckPositions] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isContinuous, setIsContinuous] = useState(false);
  const stepTimerRef = useRef(null);
  const [lostFrame, setLostFrame] = useState(null);
  const [shownSenderFrames, setShownSenderFrames] = useState([]);
  const [shownReceiverFrames, setShownReceiverFrames] = useState([]);
  const [visibleArrowIndexes, setVisibleArrowIndexes] = useState([]);

  // Mapping to control ACK arrow timing
  const ackTriggerMapping = {
    0: 3,  1: lostFrame === 2 ? 4 : null,  2: (lostFrame === 1) ? 5 : null, 3: 6, 4: 7, 5: 8, 
    6: 9,  7: 10, 8: 11,  9: 12,
  };

  // Toggle Continuous Mode
  const toggleMode = () => {
    setIsContinuous(prev => !prev);
    if (stepTimerRef.current) {
      clearInterval(stepTimerRef.current);
      stepTimerRef.current = null;
    }

    if (!isContinuous) {
      stepTimerRef.current = setInterval(() => {
        setCurrentStep(prevStep => prevStep + 1);
      }, 2000);
    }
  };

  // Handle manual next step
  const handleNextStep = () => {
    setCurrentStep(prevStep => prevStep + 1);
  };

  useEffect(() => {
    if (lostFrame === null) {
      setLostFrame(Math.random() < 0.5 ? 1 : 2);
    }
    const calculateArrowPositions = () => {
      if (senderRefs.current.length && receiverRefs.current.length) {
        const dataArrows = senderRefs.current
          .map((senderEl, index) => {
            if (!senderEl || !receiverRefs.current[index]) return null;
            const senderBox = senderEl.getBoundingClientRect();
            const receiverBox = receiverRefs.current[index].getBoundingClientRect();

            return {
              x1: senderBox.left + senderBox.width / 2,
              y1: senderBox.top + senderBox.height / 2,
              x2: receiverBox.left + receiverBox.width / 2,
              y2: receiverBox.top + receiverBox.height / 2,
              sender: index,
              isError: index === lostFrame, 
            };
          })
          .filter(Boolean);

        const ackArrows = receiverRefs.current
          .map((receiverEl, index) => {
            const ackSenderIndex = ackTriggerMapping[index];
            if (!receiverEl || ackSenderIndex === null || !senderRefs.current[ackSenderIndex]) 
              return null;

            const receiverBox = receiverEl.getBoundingClientRect();
            const senderBox = senderRefs.current[ackSenderIndex].getBoundingClientRect();

            return {
              x1: receiverBox.left + receiverBox.width / 2,
              y1: receiverBox.top + receiverBox.height / 2,
              x2: senderBox.left + senderBox.width / 2,
              y2: senderBox.top + senderBox.height / 2,
              label: `Ack ${index}`,
              ackStep: ackTriggerMapping[index] * 2 - 1, // Ensures ACK appears in previous step
            };
          })
          .filter(Boolean);

        setArrowPositions(dataArrows);
        setAckPositions(ackArrows);
      }
    };

    const timer = setTimeout(calculateArrowPositions, 100);

    // Manage frame visibility based on current step
    const newSenderFrames = arrowPositions
      .filter((_, index) => index * 2 <= currentStep)
      .map(arrow => arrow.sender);
    
    const newReceiverFrames = arrowPositions
      .filter((_, index) => index * 2 <= currentStep)
      .map(arrow => arrow.sender);

    // New logic to manage visible arrow indexes
    const newVisibleArrowIndexes = arrowPositions
      .filter((_, index) => newSenderFrames.includes(index))
      .map((_, index) => index);

    setShownSenderFrames(newSenderFrames);
    setShownReceiverFrames(newReceiverFrames);
    setVisibleArrowIndexes(newVisibleArrowIndexes);

    if (isContinuous) {
      stepTimerRef.current = setInterval(() => {
        setCurrentStep(prevStep => prevStep + 1);
      }, 2000);
    }

    return () => {
      clearTimeout(timer);
      if (stepTimerRef.current) {
        clearInterval(stepTimerRef.current);
      }
    };
  }, [isContinuous, currentStep]);

  const senderPackets = lostFrame == 2 ? [...Array(9).keys(), 2,9,10,11,12] : [...Array(8).keys(), 1,8,9,10,11,12];
  const receiverPackets = lostFrame === 1 ? [0, "E", 2, 3, 4, 5, 6, 7, 1, 8, 9] : [0, 1, "E", 3, 4, 5, 6, 7, 8, 2, 9]
  return (
    <div className="relative flex flex-col items-center p-4">
      <h1 className="text-2xl font-bold mb-4">Selective Repeat ARQ</h1>
      {/* Control Panel */}
      <div className="flex items-center space-x-4 mb-4">
        <div className="flex items-center space-x-2">
          <label htmlFor="mode-toggle" className="text-sm">Continuous</label>
          <input 
            type="checkbox" 
            id="mode-toggle" 
            checked={isContinuous} 
            onChange={toggleMode} 
            className="toggle"
          />
        </div>
        {!isContinuous && (
          <button 
            onClick={handleNextStep} 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Next Step
          </button>
        )}
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Reset
        </button>
      </div>

      <style>{`
        @keyframes drawArrow {
          0% { stroke-dashoffset: 1000; }
          100% { stroke-dashoffset: 0; }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        
        .data-arrow, .ack-arrow {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: drawArrow 1s linear forwards;
        }
        
        .frame-fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>

      {/* Sender Packets */}
      <div className="flex space-x-2 mt-10">
        {senderPackets.map((num, index) => (
          <div 
            key={index} 
            ref={el => senderRefs.current[index] = el} 
            className={`w-10 h-10 m-4 border border-black flex items-center justify-center 
              ${shownSenderFrames.includes(index) ? 'frame-fade-in' : 'opacity-0'}`}
          >
            {num}
          </div>
        ))}
      </div>

      {/* Receiver Packets */}
      <div className="flex space-x-2 mt-20 ml-15">
        {receiverPackets.map((num, index) => (
          <div 
            key={index} 
            ref={el => receiverRefs.current[index] = el} 
            className={`w-10 h-10 m-4 border border-black flex items-center justify-center 
              ${shownReceiverFrames.includes(index) ? 'frame-fade-in' : 'opacity-0'}`}
          >
            {num}
          </div>
        ))}
      </div>

      {/* Arrows using SVG */}
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
        {/* ACK Arrows - drawn before data arrows */}
        {ackPositions
          .filter(({ ackStep }) => ackStep <= currentStep)
          .map(({ x1, y1, x2, y2, label }, index) => (
            <React.Fragment key={`ack-${index}`}>
              <line 
                x1={x1} y1={y1 - 20} 
                x2={x2} y2={y2 + 20} 
                stroke="grey" strokeWidth="2" opacity="0.8" className="ack-arrow" 
              />
              <text 
                x={(x1 + x2) / 2} 
                y={(y1 + y2) / 2 - 5} 
                fontSize="15" fill="red" fontWeight="bold"
                textAnchor="middle" dominantBaseline="middle"
              >
                {label}
              </text>
            </React.Fragment>
          ))}

        {/* Data Arrows */}
        {arrowPositions
          .filter((_, index) => visibleArrowIndexes.includes(index))
          .map(({ x1, y1, x2, y2, sender, isError }, index) => (
            <line 
              key={`data-${sender}`} 
              x1={x1} y1={y1 + 20} 
              x2={x2} y2={y2 - 20} 
              stroke={isError ? "red" : "black"} 
              strokeWidth="2" 
              className="data-arrow"
            />
          ))}

      </svg>
    </div>
  );
};

export default SelectiveRepeatARQ;