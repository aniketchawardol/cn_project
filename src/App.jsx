import React, { useEffect, useRef, useState } from "react";
import Arrow from "./Arrow";

const TwoHeadedArrow = ({ 
  label = "Timeout interval", 
  length = 800, 
  x = 50, 
  y = 50,
  color = "black"
}) => {
  return (
    <svg width={length + 20} height={100} className="overflow-visible">
      {/* Vertical start line */}
      <line 
        x1={x + 10} 
        y1={y - 20}  
        x2={x + 10} 
        y2={y + 20}  
        stroke={color} 
        strokeWidth="1" 
      />
      
      {/* Main horizontal arrow */}
      <line 
        x1={x + 10} 
        y1={y} 
        x2={x + length + 10} 
        y2={y} 
        stroke={color} 
        strokeWidth="1" 
      />
      
      {/* Vertical end line */}
      <line 
        x1={x + length + 10} 
        y1={y - 20} 
        x2={x + length + 10} 
        y2={y + 20} 
        stroke={color} 
        strokeWidth="1" 
      />
      
      {/* Label */}
      <text 
        x={x + length / 2 + 10} 
        y={y - 10} 
        textAnchor="middle" 
        fontSize="15"
        fill={color}
      >
        {label}
      </text>
    </svg>
  );
};

// Window Component to visualize sliding window
const SlidingWindow = ({ 
  x, 
  y, 
  width, 
  height, 
  label, 
  color = "rgba(0, 128, 255, 0.2)" 
}) => {
  return (
    <g>
      <rect 
        x={x} 
        y={y + 5} 
        width={width} 
        height={height + 30} 
        fill={color} 
        stroke="rgba(0, 128, 255, 0.8)" 
        strokeWidth="2" 
        strokeDasharray="5,5" 
      />
      <text 
        x={x + width / 2} 
        y={y - 5} 
        textAnchor="middle" 
        fontSize="12" 
        fill="rgba(0, 128, 255, 0.8)"
      >
        {label}
      </text>
    </g>
  );
};

// Timer Component to visualize individual packet timers
const PacketTimer = ({ x, y, progress, isActive }) => {
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill="white"
        stroke="#ccc"
        strokeWidth="2"
      />
      {isActive && (
        <circle
          cx={x}
          cy={y}
          r={radius}
          fill="none"
          stroke="orange"
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${x} ${y})`}
        />
      )}
    </g>
  );
};

const SelectiveRepeatARQ = () => {
  const senderRefs = useRef([]);
  const receiverRefs = useRef([]);
  const [arrowPositions, setArrowPositions] = useState([]);
  const [ackPositions, setAckPositions] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isContinuous, setIsContinuous] = useState(false);
  const stepTimerRef = useRef(null);
  const [lostFrame, setLostFrame] = useState(1);
  const [shownSenderFrames, setShownSenderFrames] = useState([]);
  const [shownReceiverFrames, setShownReceiverFrames] = useState([]);
  const [visibleArrowIndexes, setVisibleArrowIndexes] = useState([]);
  const windowSize = 4; // Fixed window size of 4
  const [packetTimers, setPacketTimers] = useState({});
  const [adaptiveTimeout, setAdaptiveTimeout] = useState(600); // Base timeout value
  const [windowStart, setWindowStart] = useState(0); // Start of sender window
  const [receiverWindowStart, setReceiverWindowStart] = useState(0); // Start of receiver window

  // Update ACK trigger mapping based on lost frame
  const getAckTriggerMapping = () => {
    const mapping = {
      0: lostFrame === 0 ? null : 4,
      1: lostFrame === 1 ? null : 5,
      2: lostFrame === 2 ? null : 6,
      3: lostFrame === 3 ? null : 7,
      4: 8,
      5: 9,
      6: 10,
      7: 11,
      8: 12,
      9: 13,
    };
    
    // Add retransmitted frame's ACK
    if (lostFrame >= 0 && lostFrame <= 3) {
      mapping[lostFrame] = lostFrame + 8; // Retransmitted frame's ACK comes later
    }
    
    return mapping;
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

  // Reset simulation
  const resetSimulation = () => {
    setCurrentStep(0);
    setWindowStart(0);
    setReceiverWindowStart(0);
    setShownSenderFrames([]);
    setShownReceiverFrames([]);
    setVisibleArrowIndexes([]);
    setPacketTimers({});
    if (stepTimerRef.current) {
      clearInterval(stepTimerRef.current);
      stepTimerRef.current = null;
    }
    setIsContinuous(false);
  };

  // Handle lost frame selection
  const handleLostFrameChange = (e) => {
    const newLostFrame = parseInt(e.target.value);
    setLostFrame(newLostFrame);
    resetSimulation();
  };

  // Calculate adaptive timeout based on network conditions
  const calculateAdaptiveTimeout = () => {
    // Simulate RTT variation based on current step
    const baseRTT = 500;
    const variation = Math.sin(currentStep * 0.1) * 100;
    
    // Apply exponential backoff after frame loss
    const backoff = shownSenderFrames.includes(lostFrame) ? 
      Math.min(200 * Math.pow(2, Math.min(3, currentStep - lostFrame * 2)), 800) : 0;
    
    const newTimeout = baseRTT + variation + backoff;
    setAdaptiveTimeout(newTimeout);
    
    return newTimeout;
  };

  useEffect(() => {
    // Calculate adaptive timeout
    calculateAdaptiveTimeout();
    
    // Get current ACK trigger mapping based on lostFrame
    const ackTriggerMapping = getAckTriggerMapping();
    
    // Update window start position based on ACKs
    if (currentStep > 4) {
      const ackedFrames = Object.keys(ackTriggerMapping)
        .filter(frame => {
          const frameNum = parseInt(frame);
          // Special handling for frame 0 when it's the lost frame
          if (lostFrame === 0 && frameNum === 0) {
            return ackTriggerMapping[frame] !== null && ackTriggerMapping[frame] * 2 - 1 <= currentStep;
          } else {
            return ackTriggerMapping[frame] !== null && ackTriggerMapping[frame] * 2 - 1 <= currentStep;
          }
        })
        .map(frame => parseInt(frame));
      
      if (ackedFrames.length > 0) {
        // Special handling for lost frame 0 case
        if (lostFrame === 0) {
          // Check if frame 0 has been ACKed after retransmission
          const isFrame0Acked = ackedFrames.includes(0) && currentStep >= 16; // Frame 0 ack comes much later
          
          // Find the largest consecutively ACKed frame
          const consecutiveAcks = [...ackedFrames].sort((a, b) => a - b);
          let lastConsecutive = isFrame0Acked ? 0 : -1; // Start with -1 if frame 0 not ACKed yet
          
          for (let i = 0; i < consecutiveAcks.length; i++) {
            if (consecutiveAcks[i] === lastConsecutive + 1) {
              lastConsecutive = consecutiveAcks[i];
            } else if (consecutiveAcks[i] > lastConsecutive + 1) {
              break;
            }
          }
          
          // Update window start (add 1 because window starts after the last ACKed frame)
          setWindowStart(Math.max(windowStart, lastConsecutive + 1));
          setReceiverWindowStart(Math.max(receiverWindowStart, lastConsecutive + 1));
        } else {
          // Standard logic for other lost frames
          // Find the largest consecutively ACKed frame
          const consecutiveAcks = [...ackedFrames].sort((a, b) => a - b);
          let lastConsecutive = consecutiveAcks[0];
          
          for (let i = 1; i < consecutiveAcks.length; i++) {
            if (consecutiveAcks[i] === lastConsecutive + 1) {
              lastConsecutive = consecutiveAcks[i];
            } else {
              break;
            }
          }
          
          // Update window start (add 1 because window starts after the last ACKed frame)
          setWindowStart(Math.max(windowStart, lastConsecutive + 1));
          setReceiverWindowStart(Math.max(receiverWindowStart, lastConsecutive + 1));
        }
      }
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
              isFromError: receiverPackets[index] === "E", // Check if this ACK is from an error frame
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

    // Update packet timers
    const newPacketTimers = {};
    for (let i = 0; i < 14; i++) {
      // Only active timers for packets in the current window that haven't been ACKed
      const isInWindow = i >= windowStart && i < windowStart + windowSize;
      const isAcked = Object.keys(ackTriggerMapping)
        .filter(frame => parseInt(frame) === i && ackTriggerMapping[frame] !== null)
        .some(frame => ackTriggerMapping[frame] * 2 - 1 <= currentStep);
      
      const isActive = isInWindow && !isAcked && shownSenderFrames.includes(i);
      
      // Calculate progress based on current step and when the packet was sent
      const sentStep = i * 2;
      const timeElapsed = Math.max(0, currentStep - sentStep);
      const timeoutSteps = adaptiveTimeout / 2000; // Convert timeout to steps
      const progress = Math.min(1, timeElapsed / timeoutSteps);
      
      newPacketTimers[i] = { isActive, progress };
    }
    setPacketTimers(newPacketTimers);

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
  }, [isContinuous, currentStep, adaptiveTimeout, windowStart, lostFrame]);

  // Create packet sequences based on the lost frame
  const createSenderPackets = () => {
    let initial = 8;

    let packets = [...Array(initial + lostFrame).keys()]; // Basic sequence 0-9
    
    // Add retransmitted frame and subsequent frames
    if (lostFrame >= 0 && lostFrame <= 3) {
      // Add retransmitted frame after the regular sequence
      packets = [...packets, lostFrame];
      
      // Add additional frames after retransmission
      for (let i = 8 + lostFrame; i < 14; i++) {
        packets.push(i);
      }
    }
    
    return packets;
  };
  
  const createReceiverPackets = () => {
    let packets = [];
    
    // Create the sequence with an error at the lost frame position
    for (let i = 0; i < 8 + lostFrame; i++) {
      if (i === lostFrame) {
        packets.push("E"); // Error
      } else {
        packets.push(i);
      }
    }
    
    // Add the retransmitted frame and subsequent frames
    if (lostFrame >= 0 && lostFrame <= 3) {
      packets.push(lostFrame);
      for (let i = 8 + lostFrame; i < 13; i++) {
        packets.push(i);
      }
    }
    
    return packets;
  };
  
  const senderPackets = createSenderPackets();
  const receiverPackets = createReceiverPackets();
  
  // Calculate arrow positioning based on lost frame
  const getArrowPosition = (frameType) => {
    const baseOffset = 300;
    const lostFrameOffset = lostFrame * 90;
    
    if (frameType === 'timeout') {
      return {
        x: baseOffset + lostFrameOffset,
        y: 30
      };
    } else if (frameType === 'buffer') {
      return {
        x: baseOffset + 300 + lostFrameOffset,
        y: 350
      };
    } else if (frameType === 'error') {
      return {
        x: baseOffset + 200 + lostFrameOffset,
        y: 340
      };
    } else if (frameType === 'network') {
      return {
        x: baseOffset + 800 + lostFrameOffset,
        y: 340
      };
    }
    
    return { x: 0, y: 0 };
  };
  
  const timeoutArrowPos = getArrowPosition('timeout');
  const bufferArrowPos = getArrowPosition('buffer');
  const errorArrowPos = getArrowPosition('error');
  const networkArrowPos = getArrowPosition('network');
  
  return (
    <div className="relative flex flex-col items-center p-5">
      <h1 className="text-4xl font-bold mb-4">Selective Repeat ARQ</h1>
      
      {/* Control Panel */}
      <div className="flex items-center space-x-4 m-4 text-xl">
        <div className="flex items-center space-x-2">
          <label htmlFor="mode-toggle">Continuous</label>
          <input 
            type="checkbox" 
            id="mode-toggle" 
            checked={isContinuous} 
            onChange={toggleMode} 
            className="toggle"
          />
        </div>
        
        {/* Lost Frame Selection Dropdown */}
        <div className="flex items-center space-x-2">
          <label htmlFor="lost-frame-select">Lost Frame:</label>
          <select 
            id="lost-frame-select" 
            value={lostFrame} 
            onChange={handleLostFrameChange}
            className="px-3 py-2 border rounded"
          >
            <option value="0">Frame 0</option>
            <option value="1">Frame 1</option>
            <option value="2">Frame 2</option>
            <option value="3">Frame 3</option>
          </select>
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
          onClick={resetSimulation} 
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Reset
        </button>
      </div>

      {/* Timeout Interval Arrow */}
      <div className={`absolute top-36 left-0 right-0 ${shownSenderFrames.includes(lostFrame + 8) ? 'frame-fade-in' : 'opacity-0'}`}>
        <TwoHeadedArrow 
          label={`Timeout interval (Frame ${lostFrame})`} 
          length={720}  
          x={timeoutArrowPos.x - 70}        
          y={timeoutArrowPos.y}
          color="orange"
        />
      </div>

      <div className={`absolute top-36 left-0 right-0 ${shownSenderFrames.includes(lostFrame + 7) ? 'frame-fade-in' : 'opacity-0'}`}>
        <TwoHeadedArrow 
          label="Buffered by data link layer" 
          length={560}  
          x={bufferArrowPos.x - 210}        
          y={bufferArrowPos.y}        
        />
      </div>

      <div className={`absolute top-36 left-0 right-0 ${shownReceiverFrames.includes(lostFrame) ? 'frame-fade-in' : 'opacity-0'}`}>
      <Arrow label = {`Error (Frame ${lostFrame})`}
      x={errorArrowPos.x - 210} 
      y={errorArrowPos.y}
      pointerY = {-20}
      textWidth = {20} />
      </div>

      <div className={`absolute top-36 left-0 right-0 ${shownReceiverFrames.includes(lostFrame + 9) ? 'frame-fade-in' : 'opacity-0'}`}>
      <Arrow label = {`Packets ${lostFrame + 1}-${lostFrame + 7} passed to network layer`}
      x={networkArrowPos.x} 
      y={networkArrowPos.y}
      pointerY = {-20}
      textWidth = {20} />
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
        
        @keyframes blinkError {
          0%, 100% { stroke: red; }
          50% { stroke: #ff8080; }
        }
        
        .data-arrow, .ack-arrow {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: drawArrow 1s linear forwards;
        }
        
        .error-arrow {
          animation: drawArrow 1s linear forwards, blinkError 1s infinite;
        }
        
        .frame-fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
        
        .window-slide {
          transition: transform 0.5s ease-out;
        }
      `}</style>

      {/* Sender Packets */}
      <div className="flex space-x-2 mt-10">
        {senderPackets.map((num, index) => (
          <div 
            key={index} 
            ref={el => senderRefs.current[index] = el} 
            className={`w-15 h-15 m-4 border border-black flex items-center justify-center 
              ${shownSenderFrames.includes(index) ? 'frame-fade-in' : 'opacity-0'}
              ${index >= windowStart && index < windowStart + windowSize ? 'border-blue-500 border-2' : ''}`}
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
            className={`w-15 h-15 m-4 mt-10 border border-black flex items-center justify-center 
              ${shownReceiverFrames.includes(index) ? 'frame-fade-in' : 'opacity-0'}
              ${index >= receiverWindowStart && index < receiverWindowStart + windowSize ? 'border-green-500 border-2' : ''}`}
          >
            {num}
          </div>
        ))}
      </div>

      {/* Arrows using SVG */}
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
        {/* Sliding Windows */}
        {senderRefs.current.length > 0 && (
          <SlidingWindow 
            x={senderRefs.current[windowStart]?.getBoundingClientRect().left - 10 || 0}
            y={senderRefs.current[0]?.getBoundingClientRect().top - 10 || 0}
            width={Math.min(windowSize, senderRefs.current.length - windowStart) * 
              (senderRefs.current[1]?.getBoundingClientRect().left - senderRefs.current[0]?.getBoundingClientRect().left || 60)}
            height={40}
            label="Sender Window"
            color="rgba(0, 128, 255, 0.2)"
          />
        )}
        
        {receiverRefs.current.length > 0 && (
          <SlidingWindow 
            x={receiverRefs.current[receiverWindowStart]?.getBoundingClientRect().left - 10 || 0}
            y={receiverRefs.current[0]?.getBoundingClientRect().top - 10 || 0}
            width={Math.min(windowSize, receiverRefs.current.length - receiverWindowStart) * 
              (receiverRefs.current[1]?.getBoundingClientRect().left - receiverRefs.current[0]?.getBoundingClientRect().left || 60)}
            height={40}
            label="Receiver Window"
            color="rgba(0, 192, 0, 0.2)"
          />
        )}

        {/* Packet Timers */}
        {Object.entries(packetTimers).map(([index, { isActive, progress }]) => {
          const packetEl = senderRefs.current[parseInt(index)];
          if (!packetEl || !shownSenderFrames.includes(parseInt(index))) return null;
          
          const rect = packetEl.getBoundingClientRect();
          return (
            <PacketTimer 
              key={`timer-${index}`}
              x={rect.left + rect.width / 2}
              y={rect.top - 15}
              progress={progress}
              isActive={isActive}
            />
          );
        })}
        
        {/* ACK Arrows - drawn before data arrows */}
        {ackPositions
          .filter(({ ackStep }) => ackStep <= currentStep)
          .map(({ x1, y1, x2, y2, label, isFromError }, index) => (
            <React.Fragment key={`ack-${index}`}>
              <line 
                x1={x1} y1={y1 - 30} 
                x2={x2} y2={y2 + 30} 
                stroke={isFromError ? "white" : "grey"} 
                strokeWidth="2" 
                opacity="0.8" 
                className="ack-arrow" 
              />
              <text 
                x={(x1 + x2) / 2} 
                y={(y1 + y2) / 2 - 5} 
                fontSize="15" 
                fill={isFromError ? "white" : "red"} 
                fontWeight="bold"
                textAnchor="middle" 
                dominantBaseline="middle"
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
              x1={x1} y1={y1 + 30} 
              x2={x2} y2={y2 - 30} 
              stroke={isError ? "red" : "black"} 
              strokeWidth="2" 
              className={isError ? "error-arrow" : "data-arrow"}
            />
          ))}
      </svg>
    </div>
  );
};

export default SelectiveRepeatARQ;